import React, { useEffect, useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, writeBatch,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { logKaydet } from '../../services/logService'
import { getDescendants } from '../../utils/hierarchy'

const BOŞ_FORM = { ad: '', seviye: '', sube: '' }
const OKUL_SIRA = { ilkokul: 1, ortaokul: 2, lise: 3 }

const BRANS_IKON = {
  'Türkçe': '📖', 'Türk Dili ve Edebiyatı': '📖',
  'Matematik': '📐',
  'Fen Bilimleri': '🔬', 'Fizik': '🔬', 'Kimya': '🧪', 'Biyoloji': '🧬',
  'Sosyal Bilgiler': '🌍', 'Tarih': '🏛', 'Coğrafya': '🗺️',
  'İngilizce': '🌐',
  'Din Kültürü ve Ahlak Bilgisi': '🕌',
  'Görsel Sanatlar': '🎨',
  'Müzik': '🎵',
  'Beden Eğitimi ve Spor': '⚽',
  'Bilişim Teknolojileri': '💻',
  'Teknoloji ve Tasarım': '⚙️',
  'Trafik Güvenliği': '🚦',
}

const ŞABLON_BAŞLIKLAR = ['ÖĞRENCİ AD / SOYAD', 'TC NO', 'Sınıf/Şb', 'ANNE AD / SOYAD', 'ANNE TLF', 'BABA AD / SOYAD', 'BABA TLF', 'ÖĞRENCİ MAİL ADRES']
const ŞABLON_ÖRNEK    = ['Ali Yılmaz', '12345678901', '5-A', 'Ayşe Yılmaz', '0555 111 22 33', 'Ahmet Yılmaz', '0555 000 00 00', 'ali.yilmaz@okul.com']

export default function KurumSiniflar() {
  const { secilenKurumId, secilenKurum, erisimKurumlar, ogretmenModu, ogretmenSinifIdleri } = useKurumYonetim()
  const { profil, kullanici, kurumId } = useAuth()

  const ust = erisimKurumlar.find(k => k.id === secilenKurum?.parentId)
  const seviye = !secilenKurum?.parentId ? 'root' : !ust?.parentId ? 'kampus' : 'altKurum'

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

  const listKurumId = seviye === 'altKurum' ? secilenKurumId : null
  const secilebilir = useMemo(() => {
    const benimKurum = erisimKurumlar.find(x => x.id === kurumId)
    const adminSeviyesi = benimKurum ? benimKurum.tip : 'root'
    return erisimKurumlar.filter(k => {
      if (k.tip !== 'altKurum') return false
      if (adminSeviyesi === 'kurum') return k.rootKurumId === kurumId
      if (adminSeviyesi === 'kampus') return k.parentId === kurumId
      return k.id === kurumId
    })
  }, [erisimKurumlar, kurumId])

  const [siniflarMap, setSiniflarMap]     = useState({})
  const [ogrencilerMap, setOgrencilerMap] = useState({})  // kurumId → ogrenci[]

  const getFilteredSiniflar = (kid) => {
    const raw = siniflarMap[kid] || []
    if (ogretmenModu) {
      return raw.filter(s => ogretmenSinifIdleri.includes(s.id))
    }
    return raw
  }

  const getFilteredOgrenciler = (kid) => {
    const raw = ogrencilerMap[kid] || []
    if (ogretmenModu) {
      return raw.filter(o => ogretmenSinifIdleri.includes(o.sinifId))
    }
    return raw
  }
  const [rubriklerMap, setRubriklerMap]   = useState({})  // kurumId → rubrik[]
  const [acikGruplar, setAcikGruplar]     = useState({})
  const [acikKampusler, setAcikKampusler] = useState({})
  const [acikSeviyeler, setAcikSeviyeler] = useState({})   // `${kurumId}_${seviye}` → bool
  const [rubrikModal, setRubrikModal]     = useState(null) // { sinif, rubrikler, aktifBrans }
  const [detayModal, setDetayModal]       = useState(null) // sinif
  const [openMenuId, setOpenMenuId]       = useState(null)
  const [seciliOgrenci, setSeciliOgrenci] = useState(null)
  const [modalKurumId, setModalKurumId] = useState('')
  const [form, setForm]                 = useState(BOŞ_FORM)
  const [modal, setModal]               = useState(false)
  const [duzenlenen, setDuzenlenen]     = useState(null)
  const [kaydediyor, setKaydediyor]     = useState(false)
  const [hata, setHata]                 = useState('')

  // Öğretmen atama state
  const [ogretmenModal, setOgretmenModal]   = useState(false)
  const [ogretmenSinif, setOgretmenSinif]   = useState(null)
  const [ogretmenForm, setOgretmenForm]     = useState({ ogretmenAd: '', ogretmenMail: '', ogretmenTel: '' })
  const [ogretmenKayd, setOgretmenKayd]     = useState(false)
  const [ogretmenHata, setOgretmenHata]     = useState('')

  // Import state
  const [importModal, setImportModal]       = useState(false)
  const [importSinif, setImportSinif]       = useState(null)   // tek sınıf modu
  const [importKurumId, setImportKurumId]   = useState(null)   // çoklu sınıf modu
  const [importSatirlar, setImportSatirlar] = useState([])
  const [importing, setImporting]           = useState(false)
  const [importHata, setImportHata]         = useState('')

  useEffect(() => {
    if (sayimKurumlar.length === 0) { setSiniflarMap({}); return }
    const unsubs = sayimKurumlar.map(k => {
      const kampus = erisimKurumlar.find(x => x.id === k.parentId)
      const tamAd = kampus ? `${kampus.ad} · ${k.ad}` : k.ad
      const q = query(collection(db, 'kurumlar', k.id, 'siniflar'), orderBy('olusturmaTarihi', 'asc'))
      return onSnapshot(q, snap => {
        setSiniflarMap(prev => ({ ...prev, [k.id]: snap.docs.map(d => ({ id: d.id, _kurumId: k.id, _kurumAd: tamAd, ...d.data() })) }))
      })
    })
    setSiniflarMap(prev => {
      const ids = new Set(sayimKurumlar.map(k => k.id))
      const t = {}; Object.keys(prev).forEach(id => { if (ids.has(id)) t[id] = prev[id] }); return t
    })
    setAcikGruplar(prev => {
      const g = { ...prev }; sayimKurumlar.forEach(k => { if (!(k.id in g)) g[k.id] = false }); return g
    })
    return () => unsubs.forEach(u => u())
  }, [sayimKurumlar.map(k => k.id).join(',')]) // eslint-disable-line

  // Öğrenci sayıları için subscription
  useEffect(() => {
    if (sayimKurumlar.length === 0) { setOgrencilerMap({}); return }
    const unsubs = sayimKurumlar.map(k =>
      onSnapshot(collection(db, 'kurumlar', k.id, 'ogrenciler'), snap => {
        setOgrencilerMap(prev => ({ ...prev, [k.id]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }))
      })
    )
    setOgrencilerMap(prev => {
      const ids = new Set(sayimKurumlar.map(k => k.id))
      const t = {}; Object.keys(prev).forEach(id => { if (ids.has(id)) t[id] = prev[id] }); return t
    })
    return () => unsubs.forEach(u => u())
  }, [sayimKurumlar.map(k => k.id).join(',')]) // eslint-disable-line

  // Rubrikler için subscription — altKurum + kampüs + root hepsini dinle
  const rubrikKurumIds = useMemo(() => {
    const ids = new Set()
    sayimKurumlar.forEach(k => {
      ids.add(k.id)                                                         // altKurum
      if (k.parentId) {
        ids.add(k.parentId)                                                 // kampüs
        const kampus = erisimKurumlar.find(x => x.id === k.parentId)
        if (kampus?.parentId) ids.add(kampus.parentId)                     // root
      }
    })
    return [...ids]
  }, [sayimKurumlar.map(k => k.id).join(','), erisimKurumlar.map(k => k.id).join(',')]) // eslint-disable-line

  useEffect(() => {
    if (rubrikKurumIds.length === 0) { setRubriklerMap({}); return }
    const unsubs = rubrikKurumIds.map(id =>
      onSnapshot(collection(db, 'kurumlar', id, 'rubrikler'), snap => {
        setRubriklerMap(prev => ({ ...prev, [id]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }))
      })
    )
    setRubriklerMap(prev => {
      const ids = new Set(rubrikKurumIds)
      const t = {}; Object.keys(prev).forEach(id => { if (ids.has(id)) t[id] = prev[id] }); return t
    })
    return () => unsubs.forEach(u => u())
  }, [rubrikKurumIds.join(',')]) // eslint-disable-line

  // Bir altKurum için tüm seviyelerdeki (altKurum + kampüs + root) rubrikleri birleştirir
  function kurumRubrikleri(kurumId) {
    const k = erisimKurumlar.find(x => x.id === kurumId)
    const kampus = k?.parentId ? erisimKurumlar.find(x => x.id === k.parentId) : null
    const all = [
      ...(rubriklerMap[kurumId]         || []),
      ...(k?.parentId                   ? (rubriklerMap[k.parentId]      || []) : []),
      ...(kampus?.parentId              ? (rubriklerMap[kampus.parentId] || []) : []),
    ]
    return [...new Map(all.map(r => [r.id, r])).values()].filter(r => !r.isKulup)
  }

  // ── Sınıf CRUD ──────────────────────────────────────────
  function modalAc(sinif = null) {
    setDuzenlenen(sinif)
    setForm(sinif ? { ad: sinif.ad, seviye: sinif.seviye || '', sube: sinif.sube || '' } : BOŞ_FORM)
    setModalKurumId(listKurumId || '')
    setHata(''); setModal(true)
  }
  function modalKapat() { setModal(false); setDuzenlenen(null); setForm(BOŞ_FORM) }

  async function kaydet(e) {
    e.preventDefault()
    if (!form.ad.trim()) { setHata('Sınıf adı zorunludur.'); return }
    const hedefKurumId = duzenlenen ? duzenlenen._kurumId : modalKurumId
    if (!hedefKurumId) { setHata('Lütfen bir kurum seçin.'); return }
    setKaydediyor(true)
    try {
      if (duzenlenen) {
        await updateDoc(doc(db, 'kurumlar', hedefKurumId, 'siniflar', duzenlenen.id), { ad: form.ad, seviye: form.seviye, sube: form.sube })
        logKaydet({ profil, kullanici, islem: 'guncelle', modul: 'siniflar', hedefAd: form.ad, kurumId: hedefKurumId })
      } else {
        await addDoc(collection(db, 'kurumlar', hedefKurumId, 'siniflar'), { ...form, olusturmaTarihi: serverTimestamp() })
        logKaydet({ profil, kullanici, islem: 'olustur', modul: 'siniflar', hedefAd: form.ad, kurumId: hedefKurumId })
      }
      modalKapat()
    } catch (err) { setHata('Kayıt hatası: ' + err.message) }
    finally { setKaydediyor(false) }
  }

  async function sil(sinif) {
    if (!window.confirm('Bu sınıfı silmek istediğinize emin misiniz?')) return
    await deleteDoc(doc(db, 'kurumlar', sinif._kurumId, 'siniflar', sinif.id))
    logKaydet({ profil, kullanici, islem: 'sil', modul: 'siniflar', hedefAd: sinif.ad, kurumId: sinif._kurumId })
  }

  // ── Öğretmen atama ──────────────────────────────────────
  function ogretmenAc(sinif) {
    setOgretmenSinif(sinif)
    setOgretmenForm({
      ogretmenAd:   sinif.ogretmenAd   || '',
      ogretmenMail: sinif.ogretmenMail || '',
      ogretmenTel:  sinif.ogretmenTel  || '',
    })
    setOgretmenHata(''); setOgretmenModal(true)
  }
  function ogretmenKapat() { setOgretmenModal(false); setOgretmenSinif(null) }

  async function ogretmenKaydet(e) {
    e.preventDefault()
    if (!ogretmenSinif) return
    setOgretmenKayd(true); setOgretmenHata('')
    try {
      await updateDoc(
        doc(db, 'kurumlar', ogretmenSinif._kurumId, 'siniflar', ogretmenSinif.id),
        {
          ogretmenAd:   ogretmenForm.ogretmenAd.trim(),
          ogretmenMail: ogretmenForm.ogretmenMail.trim(),
          ogretmenTel:  ogretmenForm.ogretmenTel.trim(),
        }
      )
      ogretmenKapat()
    } catch (err) { setOgretmenHata('Kayıt hatası: ' + err.message) }
    finally { setOgretmenKayd(false) }
  }

  // ── Toplu öğrenci import ────────────────────────────────
  function sablonIndir() {
    const ws = XLSX.utils.aoa_to_sheet([ŞABLON_BAŞLIKLAR, ŞABLON_ÖRNEK])
    ws['!cols'] = ŞABLON_BAŞLIKLAR.map((_, i) => ({ wch: [12, 12, 12, 18, 22, 18, 14][i] }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Öğrenciler')
    XLSX.writeFile(wb, 'ogrenci_sablonu.xlsx')
  }

  // Tek sınıf modu
  function importAc(sinif) {
    setImportSinif(sinif); setImportKurumId(null)
    setImportSatirlar([]); setImportHata(''); setImportModal(true)
  }
  // Çoklu sınıf modu (tüm alt kurum)
  function importKurumAc(kurumId) {
    setImportKurumId(kurumId); setImportSinif(null)
    setImportSatirlar([]); setImportHata(''); setImportModal(true)
  }
  function importKapat() { setImportModal(false); setImportSinif(null); setImportKurumId(null); setImportSatirlar([]) }

  // Sınıf adını normalize et: "1-A" = "1A" = "1 A" = "1a"
  function sinifNormalize(s) { return s?.toString().toLowerCase().replace(/[\s\-_/\\\.]/g, '') || '' }

  // Bir satırın sınıfını eşleştir
  function sinifEsle(sinifAdi, kurumId) {
    const siniflar = siniflarMap[kurumId] || []
    return siniflar.find(s => sinifNormalize(s.ad) === sinifNormalize(sinifAdi)) || null
  }

  function dosyaOku(e) {
    const dosya = e.target.files[0]
    if (!dosya) return
    setImportHata('')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (rows.length < 2) { setImportHata('Dosyada veri satırı bulunamadı.'); return }

        // Başlık satırını bul (ilk satır veya "ÖĞRENCİ" içeren satır)
        let dataStart = 1
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          if (rows[i].some(c => c?.toString().toUpperCase().includes('ÖĞRENCİ'))) {
            dataStart = i + 1; break
          }
        }

        const hedefKurumId = importKurumId || importSinif?._kurumId

        const satirlar = rows.slice(dataStart).filter(r => r[0]?.toString().trim()).map(r => {
          const { ad, soyad } = adSoyadAyir(r[0]?.toString().trim() || '')
          const sinifHamAd    = r[2]?.toString().trim() || ''
          const eslenenSinif  = importKurumId ? sinifEsle(sinifHamAd, hedefKurumId) : null

          return {
            ad, soyad,
            ogrenciNo:   r[1]?.toString().trim() || '',
            _sinifHam:   sinifHamAd,                          // orijinal metin
            _sinifId:    importKurumId ? (eslenenSinif?.id  || null) : importSinif?.id,
            _sinifAd:    importKurumId ? (eslenenSinif?.ad  || null) : importSinif?.ad,
            _eslenmedi:  importKurumId && !eslenenSinif,
            anneAdSoyad: r[3]?.toString().trim() || '',
            anneTelefon: r[4]?.toString().trim() || '',
            babaAdSoyad: r[5]?.toString().trim() || '',
            babaTelefon: r[6]?.toString().trim() || '',
            email:       r[7]?.toString().trim() || '',
          }
        })

        if (satirlar.length === 0) { setImportHata('Ad alanı dolu satır bulunamadı.'); return }
        setImportSatirlar(satirlar)
      } catch (err) {
        setImportHata('Dosya okunamadı: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(dosya)
    e.target.value = ''
  }

  function adSoyadAyir(tamAd) {
    const parcalar = tamAd.trim().split(/\s+/)
    if (parcalar.length === 1) return { ad: parcalar[0], soyad: '' }
    const soyad = parcalar.pop()
    return { ad: parcalar.join(' '), soyad }
  }

  function formatTarih(val) {
    if (!val) return ''
    if (val instanceof Date) {
      const g = String(val.getDate()).padStart(2,'0')
      const a = String(val.getMonth()+1).padStart(2,'0')
      return `${val.getFullYear()}-${a}-${g}`
    }
    const str = val.toString().trim()
    // GG.AA.YYYY → YYYY-MM-DD
    const m = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
    return str
  }

  async function topluKaydet() {
    if ((!importSinif && !importKurumId) || importSatirlar.length === 0) return
    setImporting(true)
    try {
      const batch = writeBatch(db)
      const hedefKurumId = importKurumId || importSinif._kurumId
      const yazilacaklar = importSatirlar.filter(s => !s._eslenmedi)
      yazilacaklar.forEach(satir => {
        const ref = doc(collection(db, 'kurumlar', hedefKurumId, 'ogrenciler'))
        batch.set(ref, {
          ad: satir.ad, soyad: satir.soyad, ogrenciNo: satir.ogrenciNo,
          anneAdSoyad: satir.anneAdSoyad, anneTelefon: satir.anneTelefon,
          babaAdSoyad: satir.babaAdSoyad, babaTelefon: satir.babaTelefon,
          email: satir.email,
          sinifId: satir._sinifId || '', sinifAd: satir._sinifAd || '',
          olusturmaTarihi: serverTimestamp(),
        })
      })
      await batch.commit()
      logKaydet({ profil, kullanici, islem: 'yukle', modul: 'ogrenciler', hedefAd: `${yazilacaklar.length} öğrenci`, kurumId: hedefKurumId, detay: importSinif ? `Sınıf: ${importSinif.ad}` : 'Toplu sınıf yüklemesi' })
      importKapat()
    } catch (err) {
      setImportHata('Kayıt hatası: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  // ── Yardımcı ────────────────────────────────────────────
  function seviyeSecenekleri(kurumId) {
    const kurum = erisimKurumlar.find(k => k.id === kurumId)
    switch (kurum?.okulTuru) {
      case 'ilkokul':  return Array.from({ length: 4 },  (_, i) => i + 1)
      case 'ortaokul': return Array.from({ length: 4 },  (_, i) => i + 5)
      case 'lise':     return Array.from({ length: 4 },  (_, i) => i + 9)
      default:         return Array.from({ length: 12 }, (_, i) => i + 1)
    }
  }
  function kurumAdi(k) { const u = erisimKurumlar.find(x => x.id === k.parentId); return u?.parentId ? `${u.ad} - ${k.ad}` : k.ad }

  const toplamSinif    = sayimKurumlar.reduce((a, k) => a + getFilteredSiniflar(k.id).length, 0)
  const toplamOgrenci  = sayimKurumlar.reduce((a, k) => a + getFilteredOgrenciler(k.id).length, 0)

  const s = {
    th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    td: { padding: '1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    eylem: { background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 9px', fontSize: '0.75rem', cursor: 'pointer', color: '#374151' },
    alan: { display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' },
    etiket: { fontSize: '0.875rem', fontWeight: '500', color: '#374151' },
    girdi: { padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', color: '#1E293B' },
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .desktop-table-container {
            display: none !important;
          }
          .mobile-cards-container {
            display: flex !important;
            flex-direction: column;
          }
          .modal-box {
            max-height: 85vh !important;
            padding: 1.25rem !important;
            width: 95% !important;
          }
          .modal-input,
          select, input, textarea {
            font-size: 16px !important;
          }
        }
        @media (min-width: 769px) {
          .desktop-table-container {
            display: block !important;
          }
          .mobile-cards-container {
            display: none !important;
          }
        }
      `}} />
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Sınıflar</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Sınıf ve şube yönetimi</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#64748B' }}>
          {sayimKurumlar.length === 0 ? 'Sol menüden kurum seçin' : `${toplamSinif} sınıf · ${toplamOgrenci} öğrenci`}
        </span>
        {listKurumId && !ogretmenModu && (
          <button onClick={() => modalAc()} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
            + Yeni Sınıf
          </button>
        )}
      </div>

      {/* ── Kampüse göre gruplandırılmış sınıf listesi ── */}
      {sayimKurumlar.length > 0 && (() => {
        // Kampüse göre grupla
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

        const cokluKampus = kampusGruplari.length > 1

        // AltKurum kartı (ortak render)
        function renderAltKurum(k) {
          const grupSiniflar = getFilteredSiniflar(k.id).slice().sort((a, b) => {
            const sv = (Number(a.seviye) || 0) - (Number(b.seviye) || 0)
            return sv !== 0 ? sv : (a.sube || '').localeCompare(b.sube || '', 'tr')
          })
          const acik = acikGruplar[k.id] === true
          const grupToplamOgrenci = getFilteredOgrenciler(k.id).length

          return (
            <div key={k.id} style={{ background: '#fff', borderRadius: cokluKampus ? '8px' : '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div onClick={() => setAcikGruplar(prev => ({ ...prev, [k.id]: !acik }))}
                style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderBottom: acik ? '1px solid #E2E8F0' : 'none', cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{acik ? '▼' : '▶'}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1E293B' }}>{k.ad}</span>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: 'auto' }}>
                  {grupSiniflar.length} sınıf
                  <span style={{ margin: '0 0.375rem', color: '#CBD5E1' }}>·</span>
                  {grupToplamOgrenci} öğrenci
                </span>
                {!ogretmenModu && (
                  <button onClick={e => { e.stopPropagation(); importKurumAc(k.id) }}
                    style={{ marginLeft: '0.75rem', padding: '2px 10px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', color: '#065F46', cursor: 'pointer' }}>
                    📥 Toplu Ekle
                  </button>
                )}
              </div>

              {acik && (() => {
                const seviyeleri = [...new Set(grupSiniflar.map(sf => sf.seviye || ''))].sort((a, b) => (Number(a)||99) - (Number(b)||99))
                const seviyeGruplari = seviyeleri.map(sev => ({ seviye: sev, siniflar: grupSiniflar.filter(sf => (sf.seviye || '') === sev) }))
                return (
                  <>
                    {/* Desktop Table View */}
                    <div className="desktop-table-container">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>{['Sınıf Adı', 'Şube', 'Öğrenci', 'Modüller', 'Öğretmen', 'İşlemler'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {grupSiniflar.length === 0 ? (
                            <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '2rem' }}>Henüz sınıf eklenmemiş</td></tr>
                          ) : seviyeGruplari.map(({ seviye: sev, siniflar: sevSiniflar }) => {
                            const sevSayiOgrenci = sevSiniflar.reduce((t, sinif) => t + getFilteredOgrenciler(k.id).filter(o => o.sinifId === sinif.id).length, 0)
                            const seviyeNo = Number(sev) || 0
                            const sevRubrikler = kurumRubrikleri(k.id).filter(r => seviyeNo > 0 && r.hedefSeviyeler?.includes(seviyeNo))
                            const sevKey = `${k.id}_${sev}`
                            const sevAcik = !!acikSeviyeler[sevKey]
                            return (
                              <React.Fragment key={`sev-${sev}`}>
                                <tr onClick={() => setAcikSeviyeler(prev => ({ ...prev, [sevKey]: !prev[sevKey] }))}
                                  style={{ cursor: 'pointer', userSelect: 'none' }}>
                                  <td colSpan={6} style={{ padding: '0.5rem 1rem', background: '#F1F5F9', borderTop: '2px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>{sevAcik ? '▼' : '▶'}</span>
                                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1B3A6B' }}>{sev ? `${sev}. Sınıf` : 'Seviyesiz'}</span>
                                      <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{sevSiniflar.length} şube · {sevSayiOgrenci} öğrenci</span>
                                      {sevRubrikler.length > 0 && (
                                        <span title={`${sevRubrikler.length} rubrik atandı`}
                                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366F1,#4338CA)', color: '#fff', fontSize: '0.72rem', fontWeight: '800', fontFamily: 'Georgia,serif', flexShrink: 0 }}>
                                          R
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                {sevAcik && sevSiniflar.map(sinif => {
                                  const sinifOgrenciSayisi = getFilteredOgrenciler(k.id).filter(o => o.sinifId === sinif.id).length
                                  const sinifSeviye = Number(sinif.seviye) || 0
                                  const sinifRubrikler = kurumRubrikleri(k.id).filter(r => sinifSeviye > 0 && r.hedefSeviyeler?.includes(sinifSeviye))
                                  return (
                                    <tr key={sinif.id}>
                                      <td style={{ ...s.td, paddingLeft: '2rem', cursor: 'pointer' }} onClick={() => setDetayModal(sinif)}>
                                        <strong style={{ color: '#1B3A6B', textDecoration: 'underline' }}>{sinif.ad}</strong>
                                      </td>
                                      <td style={s.td}>{sinif.sube || '—'}</td>
                                      <td style={{ ...s.td, fontWeight: '700', color: '#1B3A6B', fontSize: '1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => setDetayModal(sinif)}>
                                        <span style={{ textDecoration: 'underline' }}>{sinifOgrenciSayisi}</span>
                                      </td>
                                      <td style={s.td}>
                                        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                                          {/* ── R — Rubrikler butonu ── */}
                                          {sinifSeviye > 0 && sinifRubrikler.length > 0 ? (
                                            <button
                                              title="Rubrikleri görüntüle"
                                              onClick={() => {
                                                const branslar = [...new Set(sinifRubrikler.map(r => r.ders || 'Diğer'))]
                                                setRubrikModal({ sinif, rubrikler: sinifRubrikler, aktifBrans: branslar[0] })
                                              }}
                                              style={{
                                                width: '32px', height: '32px', borderRadius: '50%', border: 'none',
                                                background: 'linear-gradient(135deg,#6366F1,#4338CA)', color: '#fff',
                                                fontSize: '0.9rem', fontWeight: '800', fontFamily: 'Georgia,serif',
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(99,102,241,0.35)', flexShrink: 0,
                                                transition: 'transform 0.1s, box-shadow 0.1s',
                                              }}
                                              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.5)' }}
                                              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';   e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.35)' }}>
                                              R
                                            </button>
                                          ) : (
                                            <span style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>—</span>
                                          )}
                                        </div>
                                      </td>
                                      <td style={s.td}>
                                        {sinif.ogretmenAd ? (
                                          <div style={{ fontSize: '0.8rem', lineHeight: '1.5' }}>
                                            <div style={{ fontWeight: '600', color: '#1E293B' }}>👤 {sinif.ogretmenAd}</div>
                                            {sinif.ogretmenMail && <div style={{ color: '#64748B' }}>✉ {sinif.ogretmenMail}</div>}
                                            {sinif.ogretmenTel  && <div style={{ color: '#64748B' }}>📞 {sinif.ogretmenTel}</div>}
                                          </div>
                                        ) : <span style={{ fontSize: '0.8rem', color: '#CBD5E1' }}>—</span>}
                                      </td>
                                      <td style={s.td}>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                          <button style={{ ...s.eylem, color: '#1B3A6B', borderColor: '#BFDBFE', fontWeight: 'bold' }} onClick={() => setDetayModal(sinif)}>📄 Detay</button>
                                          <button style={s.eylem} onClick={() => modalAc(sinif)}>Düzenle</button>
                                          <button style={{ ...s.eylem, color: '#7C3AED', borderColor: '#DDD6FE' }} onClick={() => ogretmenAc(sinif)}>👤 Öğretmen</button>
                                          <button style={{ ...s.eylem, color: '#065F46', borderColor: '#A7F3D0' }} onClick={() => importAc(sinif)}>📥 Toplu Ekle</button>
                                          <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => sil(sinif)}>Sil</button>
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards View */}
                    <div className="mobile-cards-container" style={{ display: 'none', flexDirection: 'column', background: '#F8FAFC' }}>
                      {grupSiniflar.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>Henüz sınıf eklenmemiş</div>
                      ) : seviyeGruplari.map(({ seviye: sev, siniflar: sevSiniflar }) => {
                        const sevSayiOgrenci = sevSiniflar.reduce((t, sinif) => t + getFilteredOgrenciler(k.id).filter(o => o.sinifId === sinif.id).length, 0)
                        const seviyeNo = Number(sev) || 0
                        const sevRubrikler = kurumRubrikleri(k.id).filter(r => seviyeNo > 0 && r.hedefSeviyeler?.includes(seviyeNo))
                        const sevKey = `${k.id}_${sev}`
                        const sevAcik = !!acikSeviyeler[sevKey]

                        return (
                          <div key={`sev-mob-${sev}`} style={{ display: 'flex', flexDirection: 'column' }}>
                            {/* Seviye Başlığı */}
                            <div 
                              onClick={() => setAcikSeviyeler(prev => ({ ...prev, [sevKey]: !prev[sevKey] }))}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1rem',
                                background: '#EFF6FF',
                                borderBottom: '1px solid #DBEAFE',
                                borderTop: '1px solid #DBEAFE',
                                cursor: 'pointer',
                                userSelect: 'none'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                <span style={{ fontSize: '0.75rem', color: '#3B82F6' }}>{sevAcik ? '▼' : '▶'}</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1E40AF' }}>
                                  {sev ? `${sev}. Sınıf` : 'Seviyesiz'}
                                </span>
                                {sevRubrikler.length > 0 && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366F1,#4338CA)', color: '#fff', fontSize: '0.65rem', fontWeight: '800', fontFamily: 'Georgia,serif' }}>
                                    R
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '600' }}>
                                {sevSiniflar.length} Şube · {sevSayiOgrenci} Öğr
                              </span>
                            </div>

                            {/* Seviyenin Sınıfları */}
                            {sevAcik && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#F8FAFC', padding: '0.5rem' }}>
                                {sevSiniflar.map(sinif => {
                                  const sinifOgrenciSayisi = getFilteredOgrenciler(k.id).filter(o => o.sinifId === sinif.id).length
                                  const sinifSeviye = Number(sinif.seviye) || 0
                                  const sinifRubrikler = kurumRubrikleri(k.id).filter(r => sinifSeviye > 0 && r.hedefSeviyeler?.includes(sinifSeviye))
                                  
                                  return (
                                    <div key={sinif.id} style={{
                                      background: '#fff',
                                      borderRadius: '12px',
                                      border: '1.5px solid #E2E8F0',
                                      padding: '1rem',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.75rem'
                                    }}>
                                      {/* Sınıf Adı, Şube, Öğrenci Sayısı ve ⋮ İşlem Butonu */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => setDetayModal(sinif)}>
                                          <span style={{ fontSize: '1rem', fontWeight: '800', color: '#1B3A6B', textDecoration: 'underline' }}>
                                            {sinif.ad}
                                          </span>
                                          <span style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                                            Şube: <strong style={{ color: '#1E293B' }}>{sinif.sube || '—'}</strong>
                                          </span>
                                        </div>
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', cursor: 'pointer' }} onClick={() => setDetayModal(sinif)}>
                                            <span style={{ fontSize: '1.125rem', fontWeight: '800', color: '#1B3A6B', textDecoration: 'underline' }}>
                                              {sinifOgrenciSayisi}
                                            </span>
                                            <span style={{ fontSize: '0.62rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>
                                              ÖĞRENCİ
                                            </span>
                                          </div>

                                          {/* Sınıf Eylemleri Menüsü */}
                                          <div style={{ position: 'relative' }}>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === sinif.id ? null : sinif.id);
                                              }}
                                              style={{
                                                background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px',
                                                padding: '6px 10px', fontSize: '1rem', cursor: 'pointer', color: '#475569',
                                                fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                              }}
                                            >
                                              ⋮
                                            </button>
                                            {openMenuId === sinif.id && (
                                              <>
                                                <div 
                                                  onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}
                                                  style={{ position: 'fixed', inset: 0, zIndex: 9998 }} 
                                                />
                                                <div style={{
                                                  position: 'absolute', right: 0, top: '100%', marginTop: '6px',
                                                  backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px',
                                                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                                  zIndex: 9999, minWidth: '170px', padding: '4px', display: 'flex', flexDirection: 'column'
                                                }}>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setDetayModal(sinif); }}
                                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', border: 'none', background: 'none', fontSize: '0.825rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left', borderRadius: '6px', color: '#1B3A6B' }}
                                                  >
                                                    📄 Sınıf Detayı & Öğrenciler
                                                  </button>
                                                  {!ogretmenModu && (
                                                    <>
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); modalAc(sinif); }}
                                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', border: 'none', background: 'none', fontSize: '0.825rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left', borderRadius: '6px', color: '#475569' }}
                                                      >
                                                        ✏️ Düzenle
                                                      </button>
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); ogretmenAc(sinif); }}
                                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', border: 'none', background: 'none', fontSize: '0.825rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left', borderRadius: '6px', color: '#7C3AED' }}
                                                      >
                                                        👤 Öğretmen Ata
                                                      </button>
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); importAc(sinif); }}
                                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', border: 'none', background: 'none', fontSize: '0.825rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left', borderRadius: '6px', color: '#065F46' }}
                                                      >
                                                        📥 Toplu Öğrenci
                                                      </button>
                                                      <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); sil(sinif); }}
                                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', border: 'none', background: 'none', fontSize: '0.825rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left', borderRadius: '6px', color: '#991B1B' }}
                                                      >
                                                        🗑️ Sil
                                                      </button>
                                                    </>
                                                  )}
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div style={{ height: '1px', background: '#F1F5F9' }} />

                                      {/* Sınıf Öğretmen Bilgisi */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                          Sınıf Öğretmeni
                                        </span>
                                        {sinif.ogretmenAd ? (
                                          <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '8px 12px', border: '1px solid #F1F5F9' }}>
                                            <strong style={{ fontSize: '0.85rem', color: '#1E293B', display: 'block' }}>
                                              👤 {sinif.ogretmenAd}
                                            </strong>
                                            {sinif.ogretmenMail && (
                                              <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                                ✉️ {sinif.ogretmenMail}
                                              </span>
                                            )}
                                            {sinif.ogretmenTel && (
                                              <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                                📞 {sinif.ogretmenTel}
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontStyle: 'italic' }}>
                                            Öğretmen atanmamış
                                          </span>
                                        )}
                                      </div>

                                      {/* Modüller (Rubrikler) */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', borderRadius: '8px', padding: '8px 12px', border: '1px solid #F1F5F9', marginTop: '4px' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>
                                          Değerlendirme:
                                        </span>
                                        {sinifSeviye > 0 && sinifRubrikler.length > 0 ? (
                                          <button
                                            onClick={() => {
                                              const branslar = [...new Set(sinifRubrikler.map(r => r.ders || 'Diğer'))]
                                              setRubrikModal({ sinif, rubrikler: sinifRubrikler, aktifBrans: branslar[0] })
                                            }}
                                            style={{
                                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                                              padding: '4px 10px', borderRadius: '999px', border: 'none',
                                              background: 'linear-gradient(135deg,#6366F1,#4338CA)', color: '#fff',
                                              fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer',
                                              boxShadow: '0 2px 4px rgba(99,102,241,0.2)'
                                            }}
                                          >
                                            <span>R</span> {sinifRubrikler.length} Rubrik Aç
                                          </button>
                                        ) : (
                                          <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                                            Atanmış rubrik yok
                                          </span>
                                        )}
                                      </div>

                                      {/* Öğrenci Listesi Göster Butonu */}
                                      <button
                                        onClick={() => setDetayModal(sinif)}
                                        style={{
                                          width: '100%', padding: '8px 12px', background: '#EFF6FF', border: '1px solid #BFDBFE',
                                          borderRadius: '8px', color: '#1E40AF', fontSize: '0.8rem', fontWeight: '700',
                                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                          marginTop: '6px'
                                        }}
                                      >
                                        📄 Öğrenci Listesini Göster ({sinifOgrenciSayisi} Öğrenci)
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()}
            </div>
          )
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {kampusGruplari.map(({ kampus, altlar }) => {
              if (!cokluKampus) {
                // Tek kampüs: kampüs başlığı olmadan doğrudan altKurum kartları
                return altlar.map(k => renderAltKurum(k))
              }
              const kampusAcik = !!acikKampusler[kampus.id]
              const kToplamSinif   = altlar.reduce((a, k) => a + getFilteredSiniflar(k.id).length, 0)
              const kToplamOgrenci = altlar.reduce((a, k) => a + getFilteredOgrenciler(k.id).length, 0)
              return (
                <div key={kampus.id} style={{ borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #BFDBFE', background: '#fff' }}>
                  {/* Kampüs başlık */}
                  <div onClick={() => setAcikKampusler(prev => ({ ...prev, [kampus.id]: !kampusAcik }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#EFF6FF', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ fontSize: '0.75rem', color: '#3B82F6' }}>{kampusAcik ? '▼' : '▶'}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E40AF' }}>🏛 {kampus.ad}</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748B', marginLeft: 'auto' }}>
                      {altlar.length} okul · {kToplamSinif} sınıf · {kToplamOgrenci} öğrenci
                    </span>
                  </div>
                  {/* AltKurum kartları */}
                  {kampusAcik && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem', borderTop: '1px solid #BFDBFE', background: '#F8FAFC' }}>
                      {altlar.map(k => renderAltKurum(k))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ── Rubrik Modül Modalı ── */}
      {rubrikModal && (() => {
        const branslar = [...new Set(rubrikModal.rubrikler.map(r => r.ders || 'Diğer'))]
        const aktifRubrikler = rubrikModal.rubrikler.filter(r => (r.ders || 'Diğer') === rubrikModal.aktifBrans)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
            onClick={e => e.target === e.currentTarget && setRubrikModal(null)}>
            <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '540px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

              {/* Başlık */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366F1,#4338CA)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '800', fontFamily: 'Georgia,serif', flexShrink: 0, boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}>
                  R
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1E293B' }}>{rubrikModal.sinif.ad} — Rubrikler</div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{rubrikModal.rubrikler.length} rubrik · {branslar.length} branş</div>
                </div>
                <button onClick={() => setRubrikModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#94A3B8', padding: '0.25rem', lineHeight: 1 }}>✕</button>
              </div>

              {/* Branş Tabları */}
              <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', paddingLeft: '0.5rem', overflowX: 'auto', flexShrink: 0 }}>
                {branslar.map(ders => {
                  const aktif = rubrikModal.aktifBrans === ders
                  const count = rubrikModal.rubrikler.filter(r => (r.ders || 'Diğer') === ders).length
                  return (
                    <button key={ders}
                      onClick={() => setRubrikModal(m => ({ ...m, aktifBrans: ders }))}
                      style={{
                        padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
                        fontSize: '0.875rem', fontWeight: aktif ? '700' : '500', whiteSpace: 'nowrap',
                        color: aktif ? '#4338CA' : '#64748B',
                        borderBottom: aktif ? '2.5px solid #6366F1' : '2.5px solid transparent',
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        transition: 'color 0.12s',
                      }}>
                      <span>{BRANS_IKON[ders] || '📋'}</span>
                      <span>{ders}</span>
                      {count > 1 && <span style={{ fontSize: '0.65rem', background: aktif ? '#6366F1' : '#E2E8F0', color: aktif ? '#fff' : '#64748B', borderRadius: '999px', padding: '0 5px', minWidth: '16px', textAlign: 'center', lineHeight: '16px', fontWeight: '700' }}>{count}</span>}
                    </button>
                  )
                })}
              </div>

              {/* Rubrik Listesi */}
              <div style={{ overflowY: 'auto', padding: '1rem 1.5rem', flex: 1 }}>
                {aktifRubrikler.map(r => (
                  <div key={r.id} style={{ padding: '0.875rem 1rem', border: '1px solid #E2E8F0', borderRadius: '10px', marginBottom: '0.625rem', transition: 'border-color 0.12s' }}>
                    <div style={{ fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem', fontSize: '0.925rem' }}>{r.ad}</div>
                    {r.aciklama && <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '0.375rem' }}>{r.aciklama}</div>}
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', background: '#EEF2FF', color: '#4338CA', padding: '1px 8px', borderRadius: '999px', fontWeight: '600' }}>
                        {r.kriterler?.length || 0} başlık
                      </span>
                      <span style={{ fontSize: '0.7rem', background: '#F0FDF4', color: '#065F46', padding: '1px 8px', borderRadius: '999px', fontWeight: '600' }}>
                        {(r.kriterler || []).reduce((t, k) => t + (k.altKriterler?.length || 0), 0)} kriter
                      </span>
                      {r.hedefSeviyeler?.map(sev => (
                        <span key={sev} style={{ fontSize: '0.7rem', background: '#F1F5F9', color: '#64748B', padding: '1px 8px', borderRadius: '999px', fontWeight: '600' }}>
                          {sev}. Sınıf
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Öğrenci Detay Modalı (TC No & Veli Arama) ── */}
      {seciliOgrenci && (() => {
        const o = seciliOgrenci
        const harfler = `${o.ad?.[0] || ''}${o.soyad?.[0] || ''}`.toUpperCase()

        const telTemizle = (tel) => {
          if (!tel) return ''
          return tel.toString().replace(/\D/g, '')
        }

        const telFormat = (tel) => {
          if (!tel) return '—'
          let clean = telTemizle(tel)
          if (clean.length === 10 && clean.startsWith('5')) {
            clean = '0' + clean
          }
          if (clean.length === 11 && clean.startsWith('0')) {
            return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7, 9)} ${clean.slice(9, 11)}`
          }
          return tel
        }

        const telLink = (tel) => {
          if (!tel) return ''
          let clean = telTemizle(tel)
          if (clean.length === 10 && clean.startsWith('5')) {
            clean = '0' + clean
          }
          return clean
        }

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210, padding: '1rem' }}
            onClick={e => e.target === e.currentTarget && setSeciliOgrenci(null)}>
            <div className="modal-box" style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '360px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              
              {/* Header / Avatar */}
              <div style={{ background: 'linear-gradient(135deg, #1E3A8A, #3B82F6)', padding: '1.25rem 1rem', textAlign: 'center', position: 'relative' }}>
                <button onClick={() => setSeciliOgrenci(null)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>✕</button>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fff', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: '800', margin: '0 auto 0.5rem', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                  {harfler || '🎒'}
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#fff', margin: 0 }}>{o.ad} {o.soyad}</h3>
                <span style={{ fontSize: '0.72rem', color: '#E0F2FE', background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: '999px', marginTop: '4px', display: 'inline-block', fontWeight: '600' }}>
                  No / TC: {o.ogrenciNo || '—'}
                </span>
              </div>

              {/* Detay Bilgileri */}
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                
                {/* E-posta */}
                {o.email ? (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>E-posta</span>
                      <strong style={{ fontSize: '0.8rem', color: '#1E293B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.email}</strong>
                    </div>
                    <a href={`mailto:${o.email}`} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#475569', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: '700', fontSize: '0.75rem' }}>
                      ✉️ Yaz
                    </a>
                  </div>
                ) : null}

                {/* Anne Bilgileri */}
                {o.anneAdSoyad || o.anneTelefon ? (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Anne</span>
                      <strong style={{ fontSize: '0.825rem', color: '#1E293B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.anneAdSoyad || '—'}</strong>
                      {o.anneTelefon && <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{telFormat(o.anneTelefon)}</span>}
                    </div>
                    {o.anneTelefon && (
                      <a href={`tel:${telLink(o.anneTelefon)}`} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#10B981', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: '700', fontSize: '0.75rem', boxShadow: '0 2px 4px rgba(16,185,129,0.1)' }}>
                        📞 Ara
                      </a>
                    )}
                  </div>
                ) : null}

                {/* Baba Bilgileri */}
                {o.babaAdSoyad || o.babaTelefon ? (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Baba</span>
                      <strong style={{ fontSize: '0.825rem', color: '#1E293B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.babaAdSoyad || '—'}</strong>
                      {o.babaTelefon && <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{telFormat(o.babaTelefon)}</span>}
                    </div>
                    {o.babaTelefon && (
                      <a href={`tel:${telLink(o.babaTelefon)}`} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#3B82F6', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: '700', fontSize: '0.75rem', boxShadow: '0 2px 4px rgba(59,130,246,0.1)' }}>
                        📞 Ara
                      </a>
                    )}
                  </div>
                ) : null}

              </div>

              {/* Kapat butonu */}
              <div style={{ padding: '0 1rem 1rem', textAlign: 'right' }}>
                <button onClick={() => setSeciliOgrenci(null)} style={{ padding: '6px 20px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Kapat</button>
              </div>

            </div>
          </div>
        )
      })()}

      {/* ── Sınıf Detay (Öğrenci Listesi) Modalı ── */}
      {detayModal && (() => {
        const sinif = detayModal
        const sinifOgrencileri = getFilteredOgrenciler(sinif._kurumId)
          .filter(o => o.sinifId === sinif.id)
          .sort((a, b) => {
            const noA = Number(a.ogrenciNo) || 0
            const noB = Number(b.ogrenciNo) || 0
            if (noA !== 0 && noB !== 0) return noA - noB
            if (noA !== 0) return -1
            if (noB !== 0) return 1
            return `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, 'tr')
          })

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
            onClick={e => e.target === e.currentTarget && setDetayModal(null)}>
            <div className="modal-box" style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
              
              {/* Başlık */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: '800', color: '#1B3A6B' }}>Öğrenci Listesi</span>
                  <span style={{ fontSize: '0.72rem', background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>
                    {sinifOgrencileri.length} Öğrenci
                  </span>
                </div>
                <button onClick={() => setDetayModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#94A3B8', padding: '0.25rem', lineHeight: 1 }}>✕</button>
              </div>

              {/* İçerik Gövdesi */}
              <div style={{ overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Öğrenci Listesi */}
                <div>
                  {sinifOgrencileri.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8', border: '1.5px dashed #E2E8F0', borderRadius: '12px' }}>
                      Bu sınıfta henüz kayıtlı öğrenci bulunmuyor.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {sinifOgrencileri.map((o, idx) => (
                        <div
                          key={o.id}
                          onClick={() => setSeciliOgrenci(o)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                            background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)', cursor: 'pointer',
                            transition: 'all 0.15s ease-in-out'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#3B82F6';
                            e.currentTarget.style.background = '#EFF6FF';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#E2E8F0';
                            e.currentTarget.style.background = '#F8FAFC';
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748B', minWidth: '20px' }}>{idx + 1}.</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1B3A6B', textDecoration: 'underline' }}>{o.ad} {o.soyad}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>
        )
      })()}

      {/* ── Sınıf ekle/düzenle modal ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && modalKapat()}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '1.5rem' }}>
              {duzenlenen ? 'Sınıfı Düzenle' : 'Yeni Sınıf Ekle'}
            </h2>
            <form onSubmit={kaydet}>
              {!duzenlenen && secilebilir.length > 0 && (
                <div style={s.alan}>
                  <label style={s.etiket}>Kurum *</label>
                  <select style={s.girdi} value={modalKurumId} onChange={e => setModalKurumId(e.target.value)}>
                    <option value="">— Seçin —</option>
                    {secilebilir.map(k => <option key={k.id} value={k.id}>{kurumAdi(k)}</option>)}
                  </select>
                </div>
              )}
              <div style={s.alan}>
                <label style={s.etiket}>Sınıf Adı *</label>
                <input style={s.girdi} value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} placeholder="5-A" autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}>
                  <label style={s.etiket}>Seviye</label>
                  <select style={s.girdi} value={form.seviye} onChange={e => setForm(f => ({ ...f, seviye: e.target.value }))}>
                    <option value="">Seçin</option>
                    {seviyeSecenekleri(duzenlenen ? duzenlenen._kurumId : modalKurumId).map(n => (
                      <option key={n} value={String(n)}>{n}. Sınıf</option>
                    ))}
                  </select>
                </div>
                <div style={s.alan}>
                  <label style={s.etiket}>Şube</label>
                  {form.sube && !['A','B','C','D','E','F'].includes(form.sube) ? (
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <input style={{ ...s.girdi, flex: 1 }} value={form.sube} onChange={e => setForm(f => ({ ...f, sube: e.target.value }))} placeholder="Şube adı" />
                      <button type="button" onClick={() => setForm(f => ({ ...f, sube: '' }))}
                        style={{ padding: '0.6rem 0.75rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', color: '#64748B', fontSize: '0.85rem' }}>✕</button>
                    </div>
                  ) : (
                    <select style={s.girdi} value={form.sube} onChange={e => setForm(f => ({ ...f, sube: e.target.value }))}>
                      <option value="">Seçin</option>
                      {['A','B','C','D','E','F'].map(h => <option key={h} value={h}>{h} Şubesi</option>)}
                      <option value="__diger__">+ Diğer şube ekle…</option>
                    </select>
                  )}
                  {form.sube === '__diger__' && (
                    <input style={{ ...s.girdi, marginTop: '0.375rem' }} autoFocus placeholder="Şube adı girin (G, H…)"
                      onChange={e => setForm(f => ({ ...f, sube: e.target.value }))} />
                  )}
                </div>
              </div>
              {hata && <p style={{ fontSize: '0.875rem', color: '#991B1B', background: '#FEE2E2', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>{hata}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={modalKapat} style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>İptal</button>
                <button type="submit" disabled={kaydediyor} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                  {kaydediyor ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Öğretmen atama modal ── */}
      {ogretmenModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && ogretmenKapat()}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>
              👤 Öğretmen Ata
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1.5rem' }}>
              <strong>{ogretmenSinif?.ad}</strong> sınıfına öğretmen bilgisi ekle
            </p>
            <form onSubmit={ogretmenKaydet}>
              <div style={s.alan}>
                <label style={s.etiket}>Öğretmen Adı Soyadı</label>
                <input style={s.girdi} value={ogretmenForm.ogretmenAd}
                  onChange={e => setOgretmenForm(f => ({ ...f, ogretmenAd: e.target.value }))}
                  placeholder="Mehmet Yılmaz" autoFocus />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>E-posta</label>
                <input style={s.girdi} type="email" value={ogretmenForm.ogretmenMail}
                  onChange={e => setOgretmenForm(f => ({ ...f, ogretmenMail: e.target.value }))}
                  placeholder="ogretmen@okul.com" />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>Telefon</label>
                <input style={s.girdi} type="tel" value={ogretmenForm.ogretmenTel}
                  onChange={e => setOgretmenForm(f => ({ ...f, ogretmenTel: e.target.value }))}
                  placeholder="0555 123 45 67" />
              </div>
              {ogretmenHata && (
                <p style={{ fontSize: '0.875rem', color: '#991B1B', background: '#FEE2E2', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>{ogretmenHata}</p>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                {ogretmenSinif?.ogretmenAd && (
                  <button type="button"
                    onClick={async () => {
                      await updateDoc(doc(db, 'kurumlar', ogretmenSinif._kurumId, 'siniflar', ogretmenSinif.id), { ogretmenAd: '', ogretmenMail: '', ogretmenTel: '' })
                      ogretmenKapat()
                    }}
                    style={{ padding: '0.6rem 1rem', background: '#fff', border: '1.5px solid #FECACA', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#991B1B' }}>
                    Öğretmeni Kaldır
                  </button>
                )}
                <button type="button" onClick={ogretmenKapat} style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>İptal</button>
                <button type="submit" disabled={ogretmenKayd} style={{ padding: '0.6rem 1.25rem', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                  {ogretmenKayd ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Toplu öğrenci import modal ── */}
      {importModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && importKapat()}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', position: 'relative' }}>

            {/* Yükleme overlay */}
            {importing && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.88)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, gap: '1rem' }}>
                <div style={{ width: '48px', height: '48px', border: '5px solid #E2E8F0', borderTopColor: '#1B3A6B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1E293B' }}>Öğrenciler kaydediliyor…</div>
                <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{importSatirlar.filter(s => !s._eslenmedi).length} öğrenci Firestore'a yazılıyor</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            )}

            {/* Başlık */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B' }}>📥 Toplu Öğrenci Ekle</h2>
              <button onClick={importKapat} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#94A3B8' }}>✕</button>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1.5rem' }}>
              {importSinif
                ? <><strong>{importSinif.ad}</strong> sınıfına toplu öğrenci ekle</>
                : <><strong>{erisimKurumlar.find(k => k.id === importKurumId)?.ad}</strong> — tüm sınıflara toplu ekle (Sınıf/Şb sütununa göre)</>}
            </p>

            {/* Adım 1: Şablon */}
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#065F46', marginBottom: '0.5rem' }}>1. Şablonu indir ve doldur</div>
              <div style={{ fontSize: '0.8rem', color: '#047857', marginBottom: '0.75rem' }}>
                Excel şablonunu indir, öğrenci bilgilerini doldur ve kaydet.
              </div>
              <button onClick={sablonIndir} style={{ padding: '0.5rem 1rem', background: '#065F46', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>
                ⬇ Şablonu İndir (.xlsx)
              </button>
            </div>

            {/* Adım 2: Yükle */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1E293B', marginBottom: '0.5rem' }}>2. Doldurulmuş dosyayı yükle</div>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                border: '2px dashed #CBD5E1', borderRadius: '10px', padding: '1.5rem', cursor: 'pointer',
                background: '#F8FAFC', transition: 'border-color 0.2s',
              }}>
                <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📂</span>
                <span style={{ fontSize: '0.875rem', color: '#64748B' }}>
                  {importSatirlar.length > 0 ? `✅ ${importSatirlar.length} öğrenci okundu` : '.xlsx veya .csv dosyası seçin'}
                </span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={dosyaOku} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Önizleme */}
            {importSatirlar.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                {(() => {
                  const eslenmeyenler = importSatirlar.filter(s => s._eslenmedi)
                  return eslenmeyenler.length > 0 && (
                    <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', padding: '0.625rem 0.875rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#92400E' }}>
                      ⚠ {eslenmeyenler.length} satırda sınıf eşleşmedi ({[...new Set(eslenmeyenler.map(s => s._sinifHam))].join(', ')}) — bu satırlar atlanacak
                    </div>
                  )
                })()}
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1E293B', marginBottom: '0.5rem' }}>
                  Önizleme ({importSatirlar.length} satır{importSatirlar.length > 5 ? `, ilk 5 gösteriliyor` : ''})
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {[...(importKurumId ? ['Sınıf'] : []), 'Ad', 'Soyad', 'TC No', 'Anne', 'Baba'].map(h => (
                          <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#64748B', fontWeight: '600', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importSatirlar.slice(0, 5).map((satir, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: satir._eslenmedi ? '#FEF2F2' : 'transparent' }}>
                          {importKurumId && (
                            <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', color: satir._eslenmedi ? '#991B1B' : '#065F46', fontWeight: '600', fontSize: '0.75rem' }}>
                              {satir._eslenmedi ? `⚠ ${satir._sinifHam}` : satir._sinifAd}
                            </td>
                          )}
                          <td style={{ padding: '0.5rem 0.75rem', color: '#1E293B', whiteSpace: 'nowrap' }}>{satir.ad}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#1E293B', whiteSpace: 'nowrap' }}>{satir.soyad || '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#64748B' }}>{satir.ogrenciNo || '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#64748B', whiteSpace: 'nowrap' }}>{satir.anneAdSoyad || '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#64748B', whiteSpace: 'nowrap' }}>{satir.babaAdSoyad || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importSatirlar.length > 5 && (
                  <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.375rem' }}>… ve {importSatirlar.length - 5} satır daha</p>
                )}
              </div>
            )}

            {importHata && <p style={{ fontSize: '0.875rem', color: '#991B1B', background: '#FEE2E2', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>{importHata}</p>}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={importKapat} style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>İptal</button>
              <button onClick={topluKaydet} disabled={importing || importSatirlar.length === 0}
                style={{ padding: '0.6rem 1.25rem', background: importSatirlar.length === 0 ? '#94A3B8' : '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: importSatirlar.length === 0 ? 'not-allowed' : 'pointer' }}>
                {importing ? 'Kaydediliyor...' : (() => {
                const yazilacak = importSatirlar.filter(s => !s._eslenmedi).length
                return importKurumId
                  ? `${yazilacak} Öğrenci Ekle${importSatirlar.length !== yazilacak ? ` (${importSatirlar.length - yazilacak} atlanıyor)` : ''}`
                  : `${importSatirlar.length} Öğrenci Ekle`
              })()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
