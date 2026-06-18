import { useEffect, useState, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  collection, onSnapshot, query, orderBy, where
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'

export default function KurumOgretmenler() {
  const { secilenKurumId, secilenKurum, erisimKurumlar, ogretmenModu } = useKurumYonetim()
  const { profil } = useAuth()

  const ust = erisimKurumlar.find(k => k.id === secilenKurum?.parentId)
  const seviye = !secilenKurum?.parentId ? 'root' : !ust?.parentId ? 'kampus' : 'altKurum'

  // Alt kurumlar listesi (seçim için)
  const sayimKurumlar = useMemo(() => {
    if (seviye === 'root') return erisimKurumlar.filter(k => k.rootKurumId === secilenKurumId && k.tip === 'altKurum')
    if (seviye === 'kampus') return erisimKurumlar.filter(k => k.parentId === secilenKurumId && k.tip === 'altKurum')
    return secilenKurum ? [secilenKurum] : []
  }, [seviye, secilenKurumId, erisimKurumlar, secilenKurum])

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

  // Resolve all sub-institution IDs in the hierarchy
  const activeTip = erisimKurumlar.find(k => k.id === secilenKurumId)?.tip
  const sorguIds = useMemo(() => {
    if (!secilenKurumId) return []
    if (activeTip === 'altKurum') return [secilenKurumId]
    if (activeTip === 'kampus') {
      return [secilenKurumId, ...erisimKurumlar.filter(k => k.parentId === secilenKurumId).map(k => k.id)]
    }
    return [secilenKurumId, ...erisimKurumlar.filter(k => k.rootKurumId === secilenKurumId).map(k => k.id)]
  }, [secilenKurumId, erisimKurumlar, activeTip])

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

  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            🧑‍🏫 Öğretmen Listesi
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.925rem', marginTop: '0.25rem' }}>
            Kurum öğretmenleri, ders branşları, koordinatörlük yetkileri ve aktif sınıf atamaları
          </p>
        </div>

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
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
                    <td style={{ ...styles.tableCell, fontWeight: '700', color: '#1B3A6B' }}>{o.ad || '—'}</td>
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
    </div>
  )
}
