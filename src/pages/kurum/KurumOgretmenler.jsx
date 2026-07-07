import { useEffect, useState, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  collection, onSnapshot, query, orderBy, where, doc, getDoc
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import * as XLSX from 'xlsx'
import { davetEt } from '../../services/davetEt'
import { logKaydet } from '../../services/logService'
import { getDescendants, getAncestors } from '../../utils/hierarchy'

export default function KurumOgretmenler() {
  const { secilenKurumId, secilenKurum, erisimKurumlar, ogretmenModu } = useKurumYonetim()
  const { profil } = useAuth()

  const ust = erisimKurumlar.find(k => k.id === secilenKurum?.parentId)
  const seviye = !secilenKurum?.parentId ? 'root' : !ust?.parentId ? 'kampus' : 'altKurum'

  // Alt kurumlar listesi (seçim için)
  const sayimKurumlar = useMemo(() => {
    if (!secilenKurumId) return []
    const descendants = getDescendants(secilenKurumId, erisimKurumlar)
    const subSchools = descendants.filter(k => k.tip === 'altKurum')
    const seciliObj = erisimKurumlar.find(k => k.id === secilenKurumId)
    if (seciliObj && seciliObj.tip === 'altKurum') {
      subSchools.push(seciliObj)
    }
    return [...new Map(subSchools.map(s => [s.id, s])).values()]
  }, [secilenKurumId, erisimKurumlar])

  // URL parameters for sub-institution selection persistence
  const [searchParams, setSearchParams] = useSearchParams()
  function updateParam(updates) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([k, v]) => {
        if (v != null && v !== '') next.set(k, String(v))
        else next.delete(k)
      })
      return next
    }, { replace: true })
  }

  const secilenAltKurumId = searchParams.get('ak') || ''
  function setSecilenAltKurumId(id) { updateParam({ ak: id }) }

  // Reset selected altKurum when parent institution changes
  const altKurumInitRef = useRef(false)
  useEffect(() => {
    if (!secilenKurumId) return
    if (!altKurumInitRef.current) { altKurumInitRef.current = true; return }
    updateParam({ ak: null })
  }, [secilenKurumId])

  // Active leaf school ID for filtering results
  const hedefKurumId = ogretmenModu
    ? (secilenKurumId || null)
    : seviye === 'altKurum' ? secilenKurumId : (secilenAltKurumId || null)

  // ── State variables ───────────────────────────────────────
  const [kullanicilarMap, setKullanicilarMap] = useState({}) // { kid: user[] }
  const [siniflarMap, setSiniflarMap] = useState({}) // { kid: sinif[] }
  const [bekleyenler, setBekleyenler] = useState([]) // yetkiliKullanicilar
  const [aramaMetni, setAramaMetni] = useState('')
  const [bransFiltre, setBransFiltre] = useState('')
  const [koordinatorFiltre, setKoordinatorFiltre] = useState('hepsi') // 'hepsi' | 'koordinator' | 'normal'
  const [durumFiltre, setDurumFiltre] = useState('hepsi') // 'hepsi' | 'aktif' | 'bekleyen'

  // Toplu öğretmen yükleme states
  const [importModal, setImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importSatirlar, setImportSatirlar] = useState([])
  const [importHata, setImportHata] = useState('')
  const [importProgress, setImportProgress] = useState(0)
  const [importProgressText, setImportProgressText] = useState('')

  // Resolve all sub-institution IDs in the hierarchy
  const sorguIds = useMemo(() => {
    if (!secilenKurumId) return []
    const descendants = getDescendants(secilenKurumId, erisimKurumlar).map(k => k.id)
    const ancestors = getAncestors(secilenKurumId, erisimKurumlar)

    const uniqueIds = new Set([secilenKurumId, ...descendants, ...ancestors])
    return [...uniqueIds]
  }, [secilenKurumId, erisimKurumlar])

  const sorguIdsKey = sorguIds.join(',')

  // ── Firestore Listeners ───────────────────────────────────
  useEffect(() => {
    if (sorguIds.length === 0) {
      setKullanicilarMap({})
      setSiniflarMap({})
      setBekleyenler([])
      return
    }

    const unsubs = []

    // 1. Listen to user subcollections and class subcollections for all institutions in the hierarchy
    sorguIds.forEach(kid => {
      const qK = query(collection(db, 'kurumlar', kid, 'kullanicilar'), orderBy('ad', 'asc'))
      unsubs.push(onSnapshot(qK, snap => {
        setKullanicilarMap(prev => ({ ...prev, [kid]: snap.docs.map(d => ({ id: d.id, _kurumId: kid, ...d.data() })) }))
      }))

      const qS = query(collection(db, 'kurumlar', kid, 'siniflar'), orderBy('ad', 'asc'))
      unsubs.push(onSnapshot(qS, snap => {
        setSiniflarMap(prev => ({ ...prev, [kid]: snap.docs.map(d => ({ id: d.id, _kurumId: kid, ...d.data() })) }))
      }))
    })

    // 2. Listen to pending invitations (yetkiliKullanicilar) in the hierarchy
    const qBekleyen = query(
      collection(db, 'yetkiliKullanicilar'),
      where('rol', '==', 'ogretmen'),
      where('kurumId', 'in', sorguIds.slice(0, 30))
    )
    unsubs.push(onSnapshot(qBekleyen, snap => {
      setBekleyenler(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => {
      console.warn("Bekleyen davetler dinlenemedi (muhtemelen yetki veya boş):", err.message)
    }))

    return () => unsubs.forEach(u => u())
  }, [sorguIdsKey])

  // Build global flat classes map: ID -> class object
  const sinifMap = useMemo(() => {
    const map = new Map()
    Object.values(siniflarMap).flat().forEach(s => {
      map.set(s.id, s)
    })
    return map
  }, [siniflarMap])

  // Resolve class names for a teacher
  const getOgretmenSinifAdlari = (ogretmen) => {
    const atamalar = ogretmen.sinifAtamalari || []
    let activeAtamaList = atamalar
    if (hedefKurumId) {
      activeAtamaList = atamalar.filter(a => a.kurumId === hedefKurumId)
    }
    const classIds = activeAtamaList.flatMap(a => a.siniflar || [])
    return classIds
      .map(cid => sinifMap.get(cid)?.ad)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'tr'))
  }

  // Combined and de-duplicated list of teachers (Active + Pending)
  const tumOgretmenler = useMemo(() => {
    // 1. Get active teachers across subcollections, merged by UID
    const activeUsersFlat = Object.values(kullanicilarMap).flat()
    const activeTeachers = activeUsersFlat.filter(k => k.rol === 'ogretmen')

    const activeMap = new Map()
    activeTeachers.forEach(t => {
      // Merge properties if teacher appears in multiple subcollections (unlikely, but safe)
      const varolan = activeMap.get(t.id)
      if (varolan) {
        activeMap.set(t.id, {
          ...varolan,
          ...t,
          sinifAtamalari: [...(varolan.sinifAtamalari || []), ...(t.sinifAtamalari || [])],
          erisimKurumIdler: [...new Set([...(varolan.erisimKurumIdler || []), ...(t.erisimKurumIdler || [])])]
        })
      } else {
        activeMap.set(t.id, { ...t, status: 'aktif' })
      }
    })

    const activeList = [...activeMap.values()]

    // 2. Map pending invitations to the teacher list
    const pendingList = bekleyenler.map(b => ({
      id: b.id,
      ad: b.ad || b.email.split('@')[0],
      email: b.email,
      rol: b.rol,
      kurumId: b.kurumId,
      branslar: b.branslar || [],
      sinifAtamalari: b.sinifAtamalari || [],
      sinifIdler: b.sinifIdler || [],
      erisimKurumIdler: b.erisimKurumIdler || [],
      modulIzinler: b.modulIzinler || {},
      status: 'bekleyen'
    }))

    // Avoid duplicating if an invitation has just been accepted but not cleared yet
    const activeEmails = new Set(activeList.map(a => (a.email || '').toLowerCase()))
    const filteredPending = pendingList.filter(p => !activeEmails.has((p.email || '').toLowerCase()))

    return [...activeList, ...filteredPending].sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
  }, [kullanicilarMap, bekleyenler])

  // Branch names list for subject filter dropdown
  const branslarListesi = useMemo(() => {
    const set = new Set()
    tumOgretmenler.forEach(o => {
      const branches = o.branslar || []
      branches.forEach(b => {
        if (b && b.trim()) set.add(b.trim())
      })
    })
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [tumOgretmenler])

  // Filter teachers based on selected school, search text, and filter values
  const filtreliOgretmenler = useMemo(() => {
    return tumOgretmenler.filter(o => {
      // 1. School level filter (if a sub-institution is active)
      if (hedefKurumId) {
        const primaryUyum = o.kurumId === hedefKurumId
        const erisimUyum = (o.erisimKurumIdler || []).includes(hedefKurumId)
        const atamaUyum = (o.sinifAtamalari || []).some(a => a.kurumId === hedefKurumId)
        
        if (!primaryUyum && !erisimUyum && !atamaUyum) return false
      }

      // 2. Search query filter
      const sinifAdlari = getOgretmenSinifAdlari(o)
      const matchesSearch = !aramaMetni ||
        (o.ad || '').toLowerCase().includes(aramaMetni.toLowerCase()) ||
        (o.email || '').toLowerCase().includes(aramaMetni.toLowerCase()) ||
        (o.branslar || []).some(b => b.toLowerCase().includes(aramaMetni.toLowerCase())) ||
        sinifAdlari.some(sa => sa.toLowerCase().includes(aramaMetni.toLowerCase()))

      // 3. Branch filter
      const matchesBranch = !bransFiltre || (o.branslar || []).includes(bransFiltre)

      // 4. Coordinator filter
      let matchesKoordinator = true
      if (koordinatorFiltre === 'koordinator') {
        matchesKoordinator = !!o.modulIzinler?.rubrik_olustur
      } else if (koordinatorFiltre === 'normal') {
        matchesKoordinator = !o.modulIzinler?.rubrik_olustur
      }

      // 5. Status filter
      let matchesStatus = true
      if (durumFiltre === 'aktif') matchesStatus = o.status === 'aktif'
      else if (durumFiltre === 'bekleyen') matchesStatus = o.status === 'bekleyen'

      return matchesSearch && matchesBranch && matchesKoordinator && matchesStatus
    })
  }, [tumOgretmenler, hedefKurumId, aramaMetni, bransFiltre, koordinatorFiltre, durumFiltre, sinifMap]) // eslint-disable-line

  // ── Statistics calculation ───────────────────────────────
  const istatistikler = useMemo(() => {
    // Stats apply to the current active school view (if selected) or the entire hierarchy
    const list = tumOgretmenler.filter(o => {
      if (!hedefKurumId) return true
      return o.kurumId === hedefKurumId || 
             (o.erisimKurumIdler || []).includes(hedefKurumId) ||
             (o.sinifAtamalari || []).some(a => a.kurumId === hedefKurumId)
    })

    const toplamOgretmen = list.length
    const aktifSayisi = list.filter(o => o.status === 'aktif').length
    const koordinatorSayisi = list.filter(o => o.modulIzinler?.rubrik_olustur).length
    const atamasizSayisi = list.filter(o => {
      // Check if they have class assignments in their accessible schools
      const atamalar = o.sinifAtamalari || []
      const activeAtama = hedefKurumId 
        ? atamalar.find(a => a.kurumId === hedefKurumId)
        : atamalar.find(a => a.siniflar && a.siniflar.length > 0)
      return !activeAtama || !activeAtama.siniflar || activeAtama.siniflar.length === 0
    }).length

    return {
      toplamOgretmen,
      aktifSayisi,
      koordinatorSayisi,
      atamasizSayisi
    }
  }, [tumOgretmenler, hedefKurumId])

  // Styles
  const styles = {
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' },
    statCard: {
      background: 'rgba(255, 255, 255, 0.75)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      borderRadius: '16px',
      padding: '1.25rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      transition: 'all 0.2s ease'
    },
    statIcon: {
      width: '48px', height: '48px', borderRadius: '12px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.5rem', fontWeight: 'bold'
    },
    tableHeader: { padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    tableRow: { transition: 'background-color 0.15s ease' },
    tableCell: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    input: { padding: '0.65rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', color: '#1E293B' },
    select: { padding: '0.65rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', color: '#1E293B', background: '#fff', cursor: 'pointer' },
    badge: { display: 'inline-block', fontSize: '0.72rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', marginRight: '4px', marginBottom: '4px' },
    bransBadge: { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' },
    sinifBadge: { background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }
  }

  // ── Toplu Öğretmen Import Yardımcıları ──────────────────────
  const SABLON_BASLIKLAR = ['ÖĞRETMEN ADI SOYADI', 'E-POSTA', 'BRANŞLAR', 'KOORDİNATÖR MÜ?']
  const SABLON_ORNEK = ['Süleyman Demir', 'suleyman.demir@gelecekkoleji.com', 'Matematik, Fen Bilimleri', 'Evet']

  function sablonIndir() {
    const ws = XLSX.utils.aoa_to_sheet([SABLON_BASLIKLAR, SABLON_ORNEK])
    ws['!cols'] = SABLON_BASLIKLAR.map((_, i) => ({ wch: [24, 32, 28, 18][i] }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Öğretmenler')
    XLSX.writeFile(wb, 'ogretmen_davet_sablonu.xlsx')
  }

  function dosyaOku(e) {
    const dosya = e.target.files[0]
    if (!dosya) return
    setImportHata('')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (rows.length < 2) { setImportHata('Dosyada veri satırı bulunamadı.'); return }

        let dataStart = 1
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          if (rows[i].some(c => c?.toString().toUpperCase().includes('E-POSTA') || c?.toString().toUpperCase().includes('ÖĞRETMEN'))) {
            dataStart = i + 1; break
          }
        }

        const parsedRows = rows.slice(dataStart).filter(r => r[1]?.toString().trim()).map(r => {
          const ad = r[0]?.toString().trim() || ''
          const email = r[1]?.toString().trim().toLowerCase() || ''
          const branslarRaw = r[2]?.toString().trim() || ''
          const koordinatorRaw = r[3]?.toString().trim().toLowerCase() || ''

          const branslar = branslarRaw.split(',').map(b => b.trim()).filter(Boolean)
          const koordinator = ['evet', 'yes', '1', 'true'].includes(koordinatorRaw)
          const emailGecerli = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

          return {
            ad,
            email,
            branslar,
            koordinator,
            _hatali: !email || !emailGecerli,
            _hataMesaji: !email ? 'E-posta boş olamaz' : !emailGecerli ? 'E-posta formatı geçersiz' : ''
          }
        })

        if (parsedRows.length === 0) { setImportHata('Geçerli e-posta içeren satır bulunamadı.'); return }
        setImportSatirlar(parsedRows)
      } catch (err) {
        setImportHata('Dosya okunamadı: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(dosya)
    e.target.value = ''
  }

  async function topluKaydet() {
    if (!hedefKurumId || importSatirlar.length === 0) return
    setImporting(true)
    setImportHata('')
    
    let isGoogle = false
    try {
      const snap = await getDoc(doc(db, 'kurumlar', hedefKurumId))
      if (snap.exists()) {
        isGoogle = !!snap.data().googleAltyapisi
      }
    } catch (e) {
      console.warn('Kurum bilgisi okunamadı:', e.message)
    }

    const validRows = importSatirlar.filter(s => !s._hatali)
    let basariliSayisi = 0

    try {
      for (let i = 0; i < validRows.length; i++) {
        const satir = validRows[i]
        setImportProgressText(`${i + 1}/${validRows.length}: ${satir.email} davet ediliyor...`)
        setImportProgress(Math.round(((i + 1) / validRows.length) * 100))

        await davetEt({
          email: satir.email,
          rol: 'ogretmen',
          kurumId: hedefKurumId,
          googleAltyapisi: isGoogle,
          ad: satir.ad,
          branslar: satir.branslar,
          modulIzinler: { rubrik_olustur: satir.koordinator },
          sinifAtamalari: [],
          sinifIdler: [],
          erisimKurumIdler: [hedefKurumId],
          parentKurumIdler: secilenKurum?.parentId ? [secilenKurum.parentId] : []
        })
        
        basariliSayisi++
      }

      await logKaydet({
        profil,
        kullanici,
        islem: 'davet',
        modul: 'kullanicilar',
        hedefAd: `${basariliSayisi} öğretmen`,
        kurumId: hedefKurumId,
        detay: `E-tablo ile toplu öğretmen daveti gönderildi.`
      })

      alert(`Başarılı: ${basariliSayisi} öğretmen davet edildi.`)
      setImportModal(false)
      setImportSatirlar([])
    } catch (err) {
      setImportHata(`Kayıt sırasında hata (Başarılı: ${basariliSayisi}): ` + err.message)
    } finally {
      setImporting(false)
      setImportProgress(0)
      setImportProgressText('')
    }
  }

  return (
    <div style={{ paddingBottom: '60px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .desktop-table-container {
            display: none !important;
          }
          .mobile-cards-container {
            display: flex !important;
            flex-direction: column;
            gap: 1rem;
          }
        }
        @media (min-width: 769px) {
          .mobile-cards-container {
            display: none !important;
          }
          .desktop-table-container {
            display: block !important;
          }
        }
      `}} />
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1B3A6B', marginBottom: '0.15rem' }}>
            🧑‍🏫 Öğretmen Listesi
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.85rem', margin: 0 }}>
            Kurum öğretmenleri, ders branşları, koordinatörlük yetkileri ve aktif sınıf atamaları
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Toplu Öğretmen Ekle Button */}
          <button
            onClick={() => {
              if (!hedefKurumId) {
                alert('Lütfen toplu öğretmen eklemek için önce sağ üstten bir okul seçin.');
                return;
              }
              setImportModal(true);
              setImportSatirlar([]);
              setImportHata('');
            }}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#fff',
              border: '1.5px solid #D1D5DB',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: '700',
              color: '#374151',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
          >
            📥 Toplu Öğretmen Tanımla
          </button>

          {/* Institution dropdown if platform admin or campus managers */}
          {seviye !== 'altKurum' && !ogretmenModu && (
          <div style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', border: '1px solid #C7D2FE', borderRadius: '12px', padding: '0.75rem 1.125rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#3730A3' }}>🏫 Okul Seçimi:</span>
            <select value={secilenAltKurumId} onChange={e => setSecilenAltKurumId(e.target.value)}
              style={{ padding: '6px 12px', border: '1.5px solid #4F46E5', borderRadius: '8px', fontSize: '0.875rem', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: '600' }}>
              <option value="">— Tüm Okullar —</option>
              {(() => {
                const OKUL_SIRA = { ilkokul: 1, ortaokul: 2, lise: 3 }
                const kampusIdler = [...new Set(sayimKurumlar.map(k => k.parentId).filter(Boolean))]
                const kampusGruplari = kampusIdler
                  .map(kpId => ({
                    kampus: erisimKurumlar.find(x => x.id === kpId),
                    altlar: sayimKurumlar
                      .filter(k => k.parentId === kpId)
                      .sort((a, b) => (OKUL_SIRA[a.okulTuru] || 9) - (OKUL_SIRA[b.okulTuru] || 9) || (a.ad || '').localeCompare(b.ad || '', 'tr')),
                  }))
                  .filter(g => g.kampus)
                  .sort((a, b) => (a.kampus.ad || '').localeCompare(b.kampus.ad || '', 'tr'))

                return kampusGruplari.map(({ kampus, altlar }) => (
                  <optgroup key={kampus.id} label={`🏛 ${kampus.ad}`}>
                    {altlar.map(k => (
                      <option key={k.id} value={k.id}>{k.ad}</option>
                    ))}
                  </optgroup>
                ))
              })()}
            </select>
          </div>
        )}
      </div>
    </div>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: '#E0E7FF', color: '#4F46E5' }}>👥</div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Toplam Öğretmen</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', marginTop: '0.15rem' }}>{istatistikler.toplamOgretmen}</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: '#ECFDF5', color: '#059669' }}>✓</div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Aktif Giriş Yapmış</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', marginTop: '0.15rem' }}>{istatistikler.aktifSayisi}</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: '#FEF3C7', color: '#D97706' }}>⭐</div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Koordinatör Sayısı</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', marginTop: '0.15rem' }}>{istatistikler.koordinatorSayisi}</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: '#FEF2F2', color: '#DC2626' }}>🎒</div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Atamasız Öğretmen</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', marginTop: '0.15rem' }}>{istatistikler.atamasizSayisi}</div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
          placeholder="Öğretmen adı, e-posta, branş veya sınıf ara..."
          style={{ ...styles.input, width: '280px' }} />

        <select value={bransFiltre} onChange={e => setBransFiltre(e.target.value)}
          style={{ ...styles.select, width: '180px' }}>
          <option value="">— Tüm Branşlar —</option>
          {branslarListesi.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select value={koordinatorFiltre} onChange={e => setKoordinatorFiltre(e.target.value)}
          style={{ ...styles.select, width: '180px' }}>
          <option value="hepsi">Tüm Yetkiler</option>
          <option value="koordinator">Sadece Koordinatörler ⭐</option>
          <option value="normal">Normal Yetki</option>
        </select>

        <select value={durumFiltre} onChange={e => setDurumFiltre(e.target.value)}
          style={{ ...styles.select, width: '180px' }}>
          <option value="hepsi">Tüm Durumlar</option>
          <option value="aktif">Sadece Aktif</option>
          <option value="bekleyen">Sadece Davet Edilenler</option>
        </select>

        {(aramaMetni || bransFiltre || koordinatorFiltre !== 'hepsi' || durumFiltre !== 'hepsi') && (
          <button onClick={() => { setAramaMetni(''); setBransFiltre(''); setKoordinatorFiltre('hepsi'); setDurumFiltre('hepsi') }}
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.875rem', fontWeight: '600', borderRadius: '8px', cursor: 'pointer', border: '1.5px solid #D1D5DB', background: '#fff', color: '#374151' }}>
            Temizle
          </button>
        )}
      </div>

      {/* Table representation */}
      <div className="desktop-table-container" style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>Öğretmen Adı Soyadı</th>
              <th style={styles.tableHeader}>E-posta Adresi</th>
              <th style={styles.tableHeader}>Durum</th>
              <th style={styles.tableHeader}>Birincil Okulu</th>
              <th style={styles.tableHeader}>Branşlar</th>
              <th style={styles.tableHeader}>Koordinatör mü?</th>
              <th style={styles.tableHeader}>Atandığı Sınıflar</th>
            </tr>
          </thead>
          <tbody>
            {filtreliOgretmenler.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                  Kriterlere uygun öğretmen bulunamadı.
                </td>
              </tr>
            ) : (
              filtreliOgretmenler.map(o => {
                const siniflarList = getOgretmenSinifAdlari(o)
                const koordinator = !!o.modulIzinler?.rubrik_olustur
                const kObj = erisimKurumlar.find(x => x.id === o.kurumId)
                const birincilOkulAd = kObj ? kObj.ad : '— Atanmamış'
                
                return (
                  <tr key={o.id} style={styles.tableRow} className="table-row-hover">
                    <td style={{ ...styles.tableCell, fontWeight: '700', color: '#1B3A6B', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {o.photoURL ? (
                          <img
                            src={o.photoURL}
                            alt="Avatar"
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #E2E8F0', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: '#E2E8F0', color: '#475569',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '700', fontSize: '0.75rem', border: '1px solid #CBD5E1', flexShrink: 0
                          }}>
                            {(() => {
                              const name = o.ad || o.email || '?';
                              const parts = name.split(' ');
                              if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                              return name[0].toUpperCase();
                            })()}
                          </div>
                        )}
                        <span>{o.ad || '—'}</span>
                      </div>
                    </td>
                    <td style={styles.tableCell}>{o.email || '—'}</td>
                    <td style={styles.tableCell}>
                      {o.status === 'aktif' ? (
                        <span style={{ fontSize: '0.72rem', background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                          Aktif
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', background: '#FFEDD5', color: '#9A3412', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                          Davet Edildi
                        </span>
                      )}
                    </td>
                    <td style={{ ...styles.tableCell, fontSize: '0.8rem', color: '#475569', fontWeight: '500' }}>{birincilOkulAd}</td>
                    <td style={styles.tableCell}>
                      {o.branslar && o.branslar.length > 0 ? (
                        o.branslar.map(b => (
                          <span key={b} style={{ ...styles.badge, ...styles.bransBadge }}>{b}</span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontStyle: 'italic' }}>Tanımlanmamış</span>
                      )}
                    </td>
                    <td style={styles.tableCell}>
                      {koordinator ? (
                        <span style={{ fontSize: '0.75rem', background: '#FEF3C7', color: '#92400E', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
                          Evet ⭐
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Hayır</span>
                      )}
                    </td>
                    <td style={styles.tableCell}>
                      {siniflarList.length > 0 ? (
                        siniflarList.map(s => (
                          <span key={s} style={{ ...styles.badge, ...styles.sinifBadge }}>{s}</span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.75rem', background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>Sınıf Ataması Yok</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile representation (Cards) */}
      <div className="mobile-cards-container" style={{ display: 'none' }}>
        {filtreliOgretmenler.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
            Kriterlere uygun öğretmen bulunamadı.
          </div>
        ) : (
          filtreliOgretmenler.map(o => {
            const siniflarList = getOgretmenSinifAdlari(o)
            const koordinator = !!o.modulIzinler?.rubrik_olustur
            const kObj = erisimKurumlar.find(x => x.id === o.kurumId)
            const birincilOkulAd = kObj ? kObj.ad : '— Atanmamış'
            
            return (
              <div key={o.id} style={{
                background: '#fff',
                border: '1.5px solid #E2E8F0',
                borderRadius: '16px',
                padding: '1.25rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                {/* Öğretmen Üst Bilgi */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                    {o.photoURL ? (
                      <img
                        src={o.photoURL}
                        alt="Avatar"
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #E2E8F0', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: '#E0F2FE', color: '#0369A1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '700', fontSize: '0.85rem', border: '1px solid #B9E6FE', flexShrink: 0
                      }}>
                        {(() => {
                          const name = o.ad || o.email || '?';
                          const parts = name.split(' ');
                          if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                          return name[0].toUpperCase();
                        })()}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.ad || '—'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.email || '—'}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    {o.status === 'aktif' ? (
                      <span style={{ fontSize: '0.65rem', background: '#D1FAE5', color: '#065F46', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                        Aktif
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.65rem', background: '#FFEDD5', color: '#9A3412', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                        Davet
                      </span>
                    )}
                    {koordinator && (
                      <span style={{ fontSize: '0.65rem', background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                        Koord ⭐
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ height: '1px', background: '#F1F5F9' }} />

                {/* Detay Bilgileri */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>Birincil Okul:</span>
                    <span style={{ color: '#334155', fontWeight: '700' }}>{birincilOkulAd}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>Branşlar:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                      {o.branslar && o.branslar.length > 0 ? (
                        o.branslar.map(b => (
                          <span key={b} style={{ ...styles.badge, ...styles.bransBadge, margin: 0, fontSize: '0.68rem' }}>{b}</span>
                        ))
                      ) : (
                        <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Tanımlanmamış</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                    <span style={{ color: '#64748B', fontWeight: '500' }}>Atandığı Sınıflar:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                      {siniflarList.length > 0 ? (
                        siniflarList.map(s => (
                          <span key={s} style={{ ...styles.badge, ...styles.sinifBadge, margin: 0, fontSize: '0.68rem' }}>{s}</span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.68rem', background: '#FEE2E2', color: '#991B1B', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>Sınıf Ataması Yok</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Toplu öğretmen import modal ── */}
      {importModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && !importing && setImportModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', position: 'relative' }}>

            {/* Yükleme overlay */}
            {importing && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.92)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, gap: '1rem' }}>
                <div style={{ width: '48px', height: '48px', border: '5px solid #E2E8F0', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1E293B' }}>Öğretmenler Davet Ediliyor...</div>
                <div style={{ fontSize: '0.85rem', color: '#4F46E5', fontWeight: '600' }}>{importProgressText}</div>
                
                {/* Progress bar */}
                <div style={{ width: '80%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${importProgress}%`, height: '100%', background: '#4F46E5', transition: 'width 0.2s ease' }} />
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            )}

            {/* Başlık */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📥 Toplu Öğretmen Davet Et
              </h2>
              <button disabled={importing} onClick={() => setImportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#94A3B8' }}>✕</button>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1.5rem' }}>
              Aşağıdaki adımları takip ederek Excel şablonu ile birden çok öğretmene toplu davet gönderebilirsiniz.
              Okul: <strong>{erisimKurumlar.find(k => k.id === hedefKurumId)?.ad}</strong>
            </p>

            {/* Adım 1: Şablon */}
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#166534', marginBottom: '0.35rem' }}>1. Excel Şablonunu İndirin</div>
              <div style={{ fontSize: '0.8rem', color: '#14532D', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                İlk olarak şablon dosyasını bilgisayarınıza indirin ve kolon yapısını değiştirmeden öğretmen bilgilerinizi doldurun.
              </div>
              <button onClick={sablonIndir} style={{ padding: '0.55rem 1.125rem', background: '#166534', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                ⬇ Şablonu İndir (.xlsx)
              </button>
            </div>

            {/* Adım 2: Yükle */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.5rem' }}>2. Doldurulan Dosyayı Yükleyin</div>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                border: '2px dashed #CBD5E1', borderRadius: '12px', padding: '1.75rem', cursor: 'pointer',
                background: '#F8FAFC', transition: 'border-color 0.2s',
              }}>
                <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📂</span>
                <span style={{ fontSize: '0.875rem', color: '#475569', fontWeight: '600' }}>
                  {importSatirlar.length > 0 ? `✅ ${importSatirlar.length} öğretmen verisi okundu` : 'Dosya seçmek için tıklayın veya sürükleyin'}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.25rem' }}>Desteklenen formatlar: .xlsx, .xls, .csv</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={dosyaOku} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Önizleme Tablosu */}
            {importSatirlar.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.5rem' }}>
                  Önizleme ({importSatirlar.length} satır{importSatirlar.length > 5 ? `, ilk 5 gösteriliyor` : ''})
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['Öğretmen Adı Soyadı', 'E-Posta', 'Branşlar', 'Koordinatör mü?'].map(h => (
                          <th key={h} style={{ padding: '0.6rem 0.8rem', textAlign: 'left', color: '#475569', fontWeight: '600', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importSatirlar.slice(0, 5).map((satir, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: satir._hatali ? '#FEF2F2' : 'transparent' }}>
                          <td style={{ padding: '0.6rem 0.8rem', color: '#1E293B', fontWeight: '600' }}>{satir.ad || '—'}</td>
                          <td style={{ padding: '0.6rem 0.8rem', color: satir._hatali ? '#991B1B' : '#475569' }}>
                            {satir.email} {satir._hatali && <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>({satir._hataMesaji})</span>}
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', color: '#475569' }}>
                            {satir.branslar.join(', ') || '—'}
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', color: '#475569' }}>
                            {satir.koordinator ? 'Evet ⭐' : 'Hayır'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importSatirlar.length > 5 && (
                  <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.375rem', fontStyle: 'italic' }}>... ve {importSatirlar.length - 5} satır daha</p>
                )}
              </div>
            )}

            {importHata && <p style={{ fontSize: '0.875rem', color: '#991B1B', background: '#FEE2E2', borderRadius: '8px', padding: '0.6rem 0.875rem', marginBottom: '1.25rem', fontWeight: '600' }}>⚠️ {importHata}</p>}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '1.25rem', marginTop: '1.5rem' }}>
              <button disabled={importing} onClick={() => setImportModal(false)} style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151', fontWeight: '600' }}>İptal</button>
              <button
                onClick={topluKaydet}
                disabled={importing || importSatirlar.length === 0}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: importSatirlar.length === 0 ? '#CBD5E1' : '#1B3A6B',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: importSatirlar.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {importing ? 'Kaydediliyor...' : `${importSatirlar.filter(s => !s._hatali).length} Öğretmen Davet Et`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
