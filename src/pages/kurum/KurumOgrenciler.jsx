import { useEffect, useState, useMemo } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, getDoc, getDocs,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { logKaydet } from '../../services/logService'
import { getDescendants } from '../../utils/hierarchy'

const BOŞ_FORM = { ad: '', soyad: '', ogrenciNo: '', sinifId: '', sinifAd: '', cinsiyet: '', dogumTarihi: '', anneAdSoyad: '', anneTelefon: '', babaAdSoyad: '', babaTelefon: '', email: '' }
const OKUL_SIRA = { ilkokul: 1, ortaokul: 2, lise: 3 }

function normalizeText(text) {
  if (!text) return ''
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

function parseSinif(ad) {
  const m = (ad || '').match(/^(\d+)(.*)$/)
  return m ? { n: parseInt(m[1]), h: m[2].trim() } : { n: 999, h: ad || '' }
}

export default function KurumOgrenciler() {
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

  const [ogrencilerMap, setOgrencilerMap] = useState({}) // { kurumId: ogrenci[] }
  const [siniflarMap, setSiniflarMap]     = useState({}) // { kurumId: sinif[] }

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
  const [acikGruplar, setAcikGruplar]     = useState({}) // { kurumId: bool } — alt kurum seviyesi
  const [acikKampusler, setAcikKampusler] = useState({}) // { kampusId: bool } — kampüs seviyesi
  const [acikSiniflar, setAcikSiniflar]   = useState({}) // { kurumId_sinifId: bool } — sınıf seviyesi
  const [modalSiniflar, setModalSiniflar] = useState([])
  const [modalKurumId, setModalKurumId]   = useState('')
  const [form, setForm]                   = useState(BOŞ_FORM)
  const [modal, setModal]                 = useState(false)
  const [duzenlenen, setDuzenlenen]       = useState(null)
  const [kaydediyor, setKaydediyor]       = useState(false)
  const [hata, setHata]                   = useState('')
  const [aramaMetni, setAramaMetni]       = useState('')

  const kurumIdler = sayimKurumlar.map(k => k.id).join(',')

  // Öğrenci + sınıf aboneliği
  useEffect(() => {
    if (sayimKurumlar.length === 0) { setOgrencilerMap({}); setSiniflarMap({}); return }

    const unsubs = []

    if (ogretmenModu) {
      // Öğretmen: Sınıfları atamalarına göre tekil dinle; öğrencileri ise okul genelinde dinleyebilir (kurumUyesi/kurumErisimi kuralı izin veriyor)
      sayimKurumlar.forEach(k => {
        const kampus = erisimKurumlar.find(x => x.id === k.parentId)
        const tamAd = kampus ? `${kampus.ad} · ${k.ad}` : k.ad

        // Öğrencileri dinle
        const qO = query(collection(db, 'kurumlar', k.id, 'ogrenciler'), orderBy('ad', 'asc'))
        unsubs.push(onSnapshot(qO, snap => {
          setOgrencilerMap(prev => ({ ...prev, [k.id]: snap.docs.map(d => ({ id: d.id, _kurumId: k.id, _kurumAd: tamAd, ...d.data() })) }))
        }))

        // Sınıfları tek tek dinle
        const atama = (profil?.sinifAtamalari || []).find(a => a.kurumId === k.id)
        const ogretmenOkulSinifIds = atama?.siniflar || []

        if (ogretmenOkulSinifIds.length > 0) {
          const classesData = {}
          ogretmenOkulSinifIds.forEach(sid => {
            const docRef = doc(db, 'kurumlar', k.id, 'siniflar', sid)
            const unsub = onSnapshot(docRef, docSnap => {
              if (docSnap.exists()) {
                classesData[sid] = { id: docSnap.id, _kurumId: k.id, ...docSnap.data() }
              } else {
                delete classesData[sid]
              }
              setSiniflarMap(prev => ({
                ...prev,
                [k.id]: Object.values(classesData).sort((a, b) => (a.olusturmaTarihi?.seconds || 0) - (b.olusturmaTarihi?.seconds || 0))
              }))
            }, err => {
              console.warn(`Öğrenci sayfasında sınıf ${sid} dinleme hatası:`, err)
            })
            unsubs.push(unsub)
          })
        } else {
          setSiniflarMap(prev => ({ ...prev, [k.id]: [] }))
        }
      })
    } else {
      // Yönetici/Admin: Sınıfları ve öğrencileri doğrudan koleksiyon sorgularıyla dinle
      sayimKurumlar.forEach(k => {
        const kampus = erisimKurumlar.find(x => x.id === k.parentId)
        const tamAd = kampus ? `${kampus.ad} · ${k.ad}` : k.ad

        const qO = query(collection(db, 'kurumlar', k.id, 'ogrenciler'), orderBy('ad', 'asc'))
        unsubs.push(onSnapshot(qO, snap => {
          setOgrencilerMap(prev => ({ ...prev, [k.id]: snap.docs.map(d => ({ id: d.id, _kurumId: k.id, _kurumAd: tamAd, ...d.data() })) }))
        }))

        const qS = query(collection(db, 'kurumlar', k.id, 'siniflar'), orderBy('olusturmaTarihi', 'asc'))
        unsubs.push(onSnapshot(qS, snap => {
          setSiniflarMap(prev => ({ ...prev, [k.id]: snap.docs.map(d => ({ id: d.id, _kurumId: k.id, ...d.data() })) }))
        }))
      })
    }

    const gecerliIdler = new Set(sayimKurumlar.map(k => k.id))
    setOgrencilerMap(prev => { const t = {}; Object.keys(prev).forEach(id => { if (gecerliIdler.has(id)) t[id] = prev[id] }); return t })
    setSiniflarMap(prev => { const t = {}; Object.keys(prev).forEach(id => { if (gecerliIdler.has(id)) t[id] = prev[id] }); return t })
    setAcikGruplar(prev => { const g = { ...prev }; sayimKurumlar.forEach(k => { if (!(k.id in g)) g[k.id] = false }); return g })

    return () => unsubs.forEach(u => u())
  }, [kurumIdler, ogretmenModu, profil?.sinifAtamalari]) // eslint-disable-line

  // Modal sınıf listesi
  const sinifKurumId = duzenlenen ? duzenlenen._kurumId : modalKurumId
  useEffect(() => {
    if (!sinifKurumId) { setModalSiniflar([]); return }
    const q = query(collection(db, 'kurumlar', sinifKurumId, 'siniflar'), orderBy('ad', 'asc'))
    return onSnapshot(q, snap => setModalSiniflar(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [sinifKurumId])

  function modalAc(ogr = null) {
    setDuzenlenen(ogr)
    setForm(ogr ? { ad: ogr.ad, soyad: ogr.soyad || '', ogrenciNo: ogr.ogrenciNo || '', sinifId: ogr.sinifId || '', sinifAd: ogr.sinifAd || '', cinsiyet: ogr.cinsiyet || '', dogumTarihi: ogr.dogumTarihi || '', anneAdSoyad: ogr.anneAdSoyad || '', anneTelefon: ogr.anneTelefon || '', babaAdSoyad: ogr.babaAdSoyad || '', babaTelefon: ogr.babaTelefon || '', email: ogr.email || '' } : BOŞ_FORM)
    setModalKurumId(listKurumId || '')
    setHata(''); setModal(true)
  }
  function modalKapat() { setModal(false); setDuzenlenen(null); setForm(BOŞ_FORM) }
  function sinifSec(sinifId) { const sx = modalSiniflar.find(x => x.id === sinifId); setForm(f => ({ ...f, sinifId, sinifAd: sx?.ad || '' })) }

  async function kaydet(e) {
    e.preventDefault()
    if (!form.ad.trim()) { setHata('Ad zorunludur.'); return }
    const hedefKurumId = duzenlenen ? duzenlenen._kurumId : modalKurumId
    if (!hedefKurumId) { setHata('Lütfen bir kurum seçin.'); return }
    setKaydediyor(true)
    try {
      const veri = { ad: form.ad, soyad: form.soyad, ogrenciNo: form.ogrenciNo, sinifId: form.sinifId, sinifAd: form.sinifAd, cinsiyet: form.cinsiyet, dogumTarihi: form.dogumTarihi, anneAdSoyad: form.anneAdSoyad, anneTelefon: form.anneTelefon, babaAdSoyad: form.babaAdSoyad, babaTelefon: form.babaTelefon, email: form.email }
      if (duzenlenen) {
        await updateDoc(doc(db, 'kurumlar', hedefKurumId, 'ogrenciler', duzenlenen.id), veri)
        logKaydet({ profil, kullanici, islem: 'guncelle', modul: 'ogrenciler', hedefAd: `${form.ad} ${form.soyad}`.trim(), kurumId: hedefKurumId })
      } else {
        await addDoc(collection(db, 'kurumlar', hedefKurumId, 'ogrenciler'), { ...veri, olusturmaTarihi: serverTimestamp() })
        logKaydet({ profil, kullanici, islem: 'olustur', modul: 'ogrenciler', hedefAd: `${form.ad} ${form.soyad}`.trim(), kurumId: hedefKurumId })
      }
      modalKapat()
    } catch (err) { setHata('Kayıt hatası: ' + err.message) }
    finally { setKaydediyor(false) }
  }

  async function sil(ogr) {
    if (!window.confirm('Bu öğrenciyi silmek istediğinize emin misiniz?')) return
    await deleteDoc(doc(db, 'kurumlar', ogr._kurumId, 'ogrenciler', ogr.id))
    logKaydet({ profil, kullanici, islem: 'sil', modul: 'ogrenciler', hedefAd: `${ogr.ad} ${ogr.soyad}`.trim(), kurumId: ogr._kurumId })
  }

  function kurumAdi(k) { const u = erisimKurumlar.find(x => x.id === k.parentId); return u?.parentId ? `${u.ad} - ${k.ad}` : k.ad }
  function sinifGrupKey(kurumId, sinifId) { return `${kurumId}_${sinifId}` }
  function sinifAcikMi(kurumId, sinifId) { return acikSiniflar[sinifGrupKey(kurumId, sinifId)] === true }
  function sinifToggle(kurumId, sinifId) {
    const key = sinifGrupKey(kurumId, sinifId)
    setAcikSiniflar(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const kampusIdler = useMemo(() => [...new Set(sayimKurumlar.map(k => k.parentId).filter(Boolean))], [sayimKurumlar])
  const kampusGruplari = useMemo(() => {
    return kampusIdler
      .map(kpId => ({
        kampus: erisimKurumlar.find(x => x.id === kpId),
        altlar: sayimKurumlar
          .filter(k => k.parentId === kpId)
          .sort((a, b) => (OKUL_SIRA[a.okulTuru] || 9) - (OKUL_SIRA[b.okulTuru] || 9) || (a.ad || '').localeCompare(b.ad || '', 'tr')),
      }))
      .filter(g => g.kampus)
      .sort((a, b) => (a.kampus.ad || '').localeCompare(b.kampus.ad || '', 'tr'))
  }, [kampusIdler, sayimKurumlar, erisimKurumlar])

  const cleanSearch = normalizeText(aramaMetni)
  const toplamOgrenci = sayimKurumlar.reduce((acc, k) => acc + getFilteredOgrenciler(k.id).filter(o => normalizeText(`${o.ad} ${o.soyad} ${o.ogrenciNo}`).includes(cleanSearch)).length, 0)

  const ilkEslesenOgrenciId = useMemo(() => {
    if (!cleanSearch) return null

    for (const g of kampusGruplari) {
      for (const k of g.altlar) {
        const tumOgrenciler = getFilteredOgrenciler(k.id).filter(o =>
          normalizeText(`${o.ad} ${o.soyad} ${o.ogrenciNo}`).includes(cleanSearch)
        )
        if (tumOgrenciler.length === 0) continue

        const siniflar = getFilteredSiniflar(k.id).slice().sort((a, b) => {
          const sa = parseSinif(a.ad), sb = parseSinif(b.ad)
          return sa.n !== sb.n ? sa.n - sb.n : sa.h.localeCompare(sb.h, 'tr')
        })

        // Sınıflara bak
        for (const sinif of siniflar) {
          const sinifOgrenciler = tumOgrenciler
            .filter(o => o.sinifId === sinif.id)
            .sort((a, b) => {
              const ad = (a.ad || '').localeCompare(b.ad || '', 'tr')
              return ad !== 0 ? ad : (a.soyad || '').localeCompare(b.soyad || '', 'tr')
            })
          if (sinifOgrenciler.length > 0) {
            return sinifOgrenciler[0].id
          }
        }

        // Sınıfsızlara bak
        const sinifsizilar = tumOgrenciler
          .filter(o => !o.sinifId)
          .sort((a, b) => {
            const ad = (a.ad || '').localeCompare(b.ad || '', 'tr')
            return ad !== 0 ? ad : (a.soyad || '').localeCompare(b.soyad || '', 'tr')
          })
        if (sinifsizilar.length > 0) {
          return sinifsizilar[0].id
        }
      }
    }
    return null
  }, [cleanSearch, ogrencilerMap, siniflarMap, kampusGruplari])

  useEffect(() => {
    if (!ilkEslesenOgrenciId) return

    const timer = setTimeout(() => {
      const elements = document.querySelectorAll(`[data-ogrenci-id="${ilkEslesenOgrenciId}"]`)
      let el = null
      for (const item of elements) {
        const rect = item.getBoundingClientRect()
        if (rect.width > 0 || rect.height > 0) {
          el = item
          break
        }
      }
      if (!el && elements.length > 0) {
        el = elements[0]
      }

      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [ilkEslesenOgrenciId, aramaMetni])

  const s = {
    th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    td: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    eylem: { background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 9px', fontSize: '0.75rem', cursor: 'pointer', color: '#374151' },
    alan: { display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' },
    etiket: { fontSize: '0.875rem', fontWeight: '500', color: '#374151' },
    girdi: { padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', color: '#1E293B' },
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: `
        .ogrenciler-desktop-view {
          display: block;
        }
        .ogrenciler-mobile-view {
          display: none;
        }
        .modal-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        @media (max-width: 768px) {
          .ogrenciler-desktop-view {
            display: none !important;
          }
          .ogrenciler-mobile-view {
            display: flex !important;
            flex-direction: column;
            gap: 0.75rem;
          }
          .student-header-row {
            flex-direction: column-reverse;
            align-items: stretch !important;
            gap: 0.75rem;
          }
          .student-search-container {
            flex-direction: column;
            align-items: stretch !important;
            gap: 0.5rem !important;
          }
          .student-search-bar {
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .campus-header, .school-header, .class-header {
            flex-wrap: wrap !important;
            gap: 0.5rem !important;
          }
          .campus-count, .school-count, .class-count {
            margin-left: 0 !important;
            width: 100% !important;
            font-size: 0.7rem !important;
            padding-left: 1.25rem !important;
            text-align: left !important;
          }
          .campus-title, .school-title, .class-title {
            font-size: 0.85rem !important;
          }
          .modal-form-grid {
            grid-template-columns: 1fr !important;
            gap: 0.5rem !important;
          }
          .student-modal-container {
            padding: 1.25rem !important;
            max-height: 95vh !important;
          }
        }
      `}} />
      <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1B3A6B', marginBottom: '0.15rem' }}>Öğrenciler</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <p style={{ color: '#64748B', fontSize: '0.85rem', margin: 0 }}>
          Öğrenci kayıt ve yönetimi
          {sayimKurumlar.length > 0 && (
            <>
              <span style={{ color: '#CBD5E1', margin: '0 0.5rem' }}>•</span>
              <span style={{ fontWeight: '700', color: '#475569' }}>{toplamOgrenci} öğrenci</span>
            </>
          )}
        </p>
        {listKurumId && !ogretmenModu && (
          <button onClick={() => modalAc()} style={{ padding: '0.45rem 1rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Yeni Öğrenci
          </button>
        )}
      </div>

      <div className="student-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="student-search-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
          <input value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
            className="student-search-bar"
            placeholder="Ad, soyad veya öğrenci no ara..."
            style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.825rem', width: '280px', color: '#1E293B' }} />
        </div>
      </div>

      {sayimKurumlar.length > 0 && (() => {
        const cokluKampus = kampusGruplari.length > 1

        function renderAltKurum(k) {
          const tumOgrenciler = getFilteredOgrenciler(k.id).filter(o =>
            normalizeText(`${o.ad} ${o.soyad} ${o.ogrenciNo}`).includes(cleanSearch)
          )
          const acik = aramaMetni.trim() !== '' ? tumOgrenciler.length > 0 : acikGruplar[k.id] === true
          const siniflar = getFilteredSiniflar(k.id).slice().sort((a, b) => {
            const sa = parseSinif(a.ad), sb = parseSinif(b.ad)
            return sa.n !== sb.n ? sa.n - sb.n : sa.h.localeCompare(sb.h, 'tr')
          })
          const sinifsizilar = tumOgrenciler.filter(o => !o.sinifId)

          if (aramaMetni.trim() !== '' && tumOgrenciler.length === 0) {
            return null
          }

          return (
            <div key={k.id} style={{ background: '#fff', borderRadius: cokluKampus ? '8px' : '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div className="school-header" onClick={() => setAcikGruplar(prev => ({ ...prev, [k.id]: !acik }))}
                style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderBottom: acik ? '1px solid #E2E8F0' : 'none', cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{acik ? '▼' : '▶'}</span>
                <span className="school-title" style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1E293B' }}>{k.ad}</span>
                <span className="school-count" style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: 'auto' }}>{tumOgrenciler.length} öğrenci</span>
              </div>

              {acik && (
                <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {siniflar.map(sinif => {
                    const sinifOgrenciler = tumOgrenciler
                      .filter(o => o.sinifId === sinif.id)
                      .sort((a, b) => { const ad = (a.ad || '').localeCompare(b.ad || '', 'tr'); return ad !== 0 ? ad : (a.soyad || '').localeCompare(b.soyad || '', 'tr') })
                    const sinifAcik = aramaMetni.trim() !== '' ? sinifOgrenciler.length > 0 : sinifAcikMi(k.id, sinif.id)
                    if (aramaMetni.trim() !== '' && sinifOgrenciler.length === 0) {
                      return null
                    }
                    return (
                      <div key={sinif.id} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                        <div className="class-header" onClick={() => sinifToggle(k.id, sinif.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.875rem', background: '#FAFAFA', cursor: 'pointer', userSelect: 'none', borderBottom: sinifAcik ? '1px solid #E2E8F0' : 'none' }}>
                          <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{sinifAcik ? '▼' : '▶'}</span>
                          <span className="class-title" style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1B3A6B', minWidth: '40px' }}>{sinif.ad}</span>
                          {sinif.ogretmenAd && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', color: '#374151' }}>👤 {sinif.ogretmenAd}</span>
                              {sinif.ogretmenMail && <span className="desktop-only" style={{ fontSize: '0.75rem', color: '#6366F1' }}>✉ {sinif.ogretmenMail}</span>}
                              {sinif.ogretmenTel  && <span className="desktop-only" style={{ fontSize: '0.75rem', color: '#059669' }}>📞 {sinif.ogretmenTel}</span>}
                            </div>
                          )}
                          <span className="class-count" style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: 'auto' }}>{sinifOgrenciler.length} öğrenci</span>
                        </div>
                        {sinifAcik && (
                          <>
                            {/* Desktop View */}
                            <div className="ogrenciler-desktop-view">
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr>{(ogretmenModu ? ['Ad Soyad', 'TC No', 'Anne', 'Baba'] : ['Ad Soyad', 'TC No', 'Anne', 'Baba', 'İşlemler']).map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                                <tbody>
                                  {sinifOgrenciler.length === 0
                                    ? <tr><td colSpan={ogretmenModu ? 4 : 5} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '1.5rem' }}>Bu sınıfta öğrenci yok</td></tr>
                                    : sinifOgrenciler.map(o => (
                                      <tr key={o.id} data-ogrenci-id={o.id}>
                                        <td style={s.td}><strong>{o.ad} {o.soyad}</strong></td>
                                        <td style={s.td}>{o.ogrenciNo || '—'}</td>
                                        <td style={s.td}>{o.anneAdSoyad ? `${o.anneAdSoyad}${o.anneTelefon ? ` · ${o.anneTelefon}` : ''}` : '—'}</td>
                                        <td style={s.td}>{o.babaAdSoyad ? `${o.babaAdSoyad}${o.babaTelefon ? ` · ${o.babaTelefon}` : ''}` : '—'}</td>
                                        {!ogretmenModu && (
                                          <td style={s.td}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                              <button style={s.eylem} onClick={() => modalAc(o)}>Düzenle</button>
                                              <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => sil(o)}>Sil</button>
                                            </div>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Mobile View */}
                            <div className="ogrenciler-mobile-view">
                              {sinifOgrenciler.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#94A3B8', padding: '1.5rem' }}>Bu sınıfta öğrenci yok</div>
                              ) : (
                                sinifOgrenciler.map(o => (
                                  <div key={o.id} className="ogrenci-card" data-ogrenci-id={o.id} style={{
                                    background: '#ffffff',
                                    border: '1px solid #E2E8F0',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div>
                                        <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1B3A6B' }}>
                                          {o.ad} {o.soyad}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                                          No: {o.ogrenciNo || '—'}
                                        </div>
                                      </div>
                                      {!ogretmenModu && (
                                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                                          <button style={s.eylem} onClick={() => modalAc(o)}>Düzenle</button>
                                          <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => sil(o)}>Sil</button>
                                        </div>
                                      )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                        <div>
                                          <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', fontWeight: '600', textTransform: 'uppercase' }}>Anne</span>
                                          <span style={{ fontSize: '0.85rem', color: '#1E293B', fontWeight: '500' }}>{o.anneAdSoyad || '—'}</span>
                                        </div>
                                        {o.anneTelefon && (
                                          <a href={`tel:${o.anneTelefon}`} style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            backgroundColor: '#ECFDF5',
                                            color: '#059669',
                                            border: '1px solid #A7F3D0',
                                            borderRadius: '20px',
                                            padding: '4px 10px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            textDecoration: 'none'
                                          }}>
                                            📞 Ara
                                          </a>
                                        )}
                                      </div>

                                      <div style={{ height: '1px', backgroundColor: '#E2E8F0' }} />

                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                        <div>
                                          <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', fontWeight: '600', textTransform: 'uppercase' }}>Baba</span>
                                          <span style={{ fontSize: '0.85rem', color: '#1E293B', fontWeight: '500' }}>{o.babaAdSoyad || '—'}</span>
                                        </div>
                                        {o.babaTelefon && (
                                          <a href={`tel:${o.babaTelefon}`} style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            backgroundColor: '#ECFDF5',
                                            color: '#059669',
                                            border: '1px solid #A7F3D0',
                                            borderRadius: '20px',
                                            padding: '4px 10px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            textDecoration: 'none'
                                          }}>
                                            📞 Ara
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}

                  {sinifsizilar.length > 0 && (() => {
                    const sinifsizAcik = aramaMetni.trim() !== '' ? sinifsizilar.length > 0 : sinifAcikMi(k.id, '__sinifSiz__')
                    return (
                      <div style={{ border: '1px solid #FCD34D', borderRadius: '8px', overflow: 'hidden' }}>
                        <div onClick={() => sinifToggle(k.id, '__sinifSiz__')}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.875rem', background: '#FFFBEB', cursor: 'pointer', userSelect: 'none', borderBottom: sinifsizAcik ? '1px solid #FCD34D' : 'none' }}>
                          <span style={{ fontSize: '0.7rem', color: '#92400E' }}>{sinifsizAcik ? '▼' : '▶'}</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400E' }}>⚠ Sınıf Atanmamış</span>
                          <span style={{ fontSize: '0.75rem', color: '#B45309', marginLeft: 'auto' }}>{sinifsizilar.length} öğrenci</span>
                        </div>
                        {sinifsizAcik && (
                          <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {/* Desktop View */}
                            <div className="ogrenciler-desktop-view">
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr>{(ogretmenModu ? ['Ad Soyad', 'TC No', 'Anne', 'Baba'] : ['Ad Soyad', 'TC No', 'Anne', 'Baba', 'İşlemler']).map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                                <tbody>
                                  {sinifsizilar.map(o => (
                                    <tr key={o.id} data-ogrenci-id={o.id}>
                                      <td style={s.td}><strong>{o.ad} {o.soyad}</strong></td>
                                      <td style={s.td}>{o.ogrenciNo || '—'}</td>
                                      <td style={s.td}>{o.anneAdSoyad ? `${o.anneAdSoyad}${o.anneTelefon ? ` · ${o.anneTelefon}` : ''}` : '—'}</td>
                                      <td style={s.td}>{o.babaAdSoyad ? `${o.babaAdSoyad}${o.babaTelefon ? ` · ${o.babaTelefon}` : ''}` : '—'}</td>
                                      {!ogretmenModu && (
                                        <td style={s.td}>
                                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button style={s.eylem} onClick={() => modalAc(o)}>Düzenle</button>
                                            <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => sil(o)}>Sil</button>
                                          </div>
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Mobile View */}
                            <div className="ogrenciler-mobile-view">
                              {sinifsizilar.map(o => (
                                <div key={o.id} className="ogrenci-card" data-ogrenci-id={o.id} style={{
                                  background: '#ffffff',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '12px',
                                  padding: '1rem',
                                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.75rem'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1B3A6B' }}>
                                        {o.ad} {o.soyad}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                                        No: {o.ogrenciNo || '—'}
                                      </div>
                                    </div>
                                    {!ogretmenModu && (
                                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                                        <button style={s.eylem} onClick={() => modalAc(o)}>Düzenle</button>
                                        <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => sil(o)}>Sil</button>
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                      <div>
                                        <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', fontWeight: '600', textTransform: 'uppercase' }}>Anne</span>
                                        <span style={{ fontSize: '0.85rem', color: '#1E293B', fontWeight: '500' }}>{o.anneAdSoyad || '—'}</span>
                                      </div>
                                      {o.anneTelefon && (
                                        <a href={`tel:${o.anneTelefon}`} style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          backgroundColor: '#ECFDF5',
                                          color: '#059669',
                                          border: '1px solid #A7F3D0',
                                          borderRadius: '20px',
                                          padding: '4px 10px',
                                          fontSize: '0.75rem',
                                          fontWeight: '700',
                                          textDecoration: 'none'
                                        }}>
                                          📞 Ara
                                        </a>
                                      )}
                                    </div>

                                    <div style={{ height: '1px', backgroundColor: '#E2E8F0' }} />

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                      <div>
                                        <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', fontWeight: '600', textTransform: 'uppercase' }}>Baba</span>
                                        <span style={{ fontSize: '0.85rem', color: '#1E293B', fontWeight: '500' }}>{o.babaAdSoyad || '—'}</span>
                                      </div>
                                      {o.babaTelefon && (
                                        <a href={`tel:${o.babaTelefon}`} style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          backgroundColor: '#ECFDF5',
                                          color: '#059669',
                                          border: '1px solid #A7F3D0',
                                          borderRadius: '20px',
                                          padding: '4px 10px',
                                          fontSize: '0.75rem',
                                          fontWeight: '700',
                                          textDecoration: 'none'
                                        }}>
                                          📞 Ara
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {kampusGruplari.map(({ kampus, altlar }) => {
              const kToplamOgrenci = altlar.reduce((a, k) => a + getFilteredOgrenciler(k.id).filter(o =>
                normalizeText(`${o.ad} ${o.soyad} ${o.ogrenciNo}`).includes(cleanSearch)
              ).length, 0)
              if (aramaMetni.trim() !== '' && kToplamOgrenci === 0) {
                return null
              }
              if (!cokluKampus) return altlar.map(k => renderAltKurum(k))
              const kampusAcik = aramaMetni.trim() !== '' ? kToplamOgrenci > 0 : !!acikKampusler[kampus.id]
              return (
                <div key={kampus.id} style={{ borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #BFDBFE', background: '#fff' }}>
                  <div className="campus-header" onClick={() => setAcikKampusler(prev => ({ ...prev, [kampus.id]: !kampusAcik }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#EFF6FF', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ fontSize: '0.75rem', color: '#3B82F6' }}>{kampusAcik ? '▼' : '▶'}</span>
                    <span className="campus-title" style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E40AF' }}>🏛 {kampus.ad}</span>
                    <span className="campus-count" style={{ fontSize: '0.75rem', color: '#64748B', marginLeft: 'auto' }}>
                      {altlar.length} okul · {kToplamOgrenci} öğrenci
                    </span>
                  </div>
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

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
          onClick={e => e.target === e.currentTarget && modalKapat()}>
          <div className="student-modal-container" style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '1.5rem' }}>
              {duzenlenen ? 'Öğrenciyi Düzenle' : 'Yeni Öğrenci Ekle'}
            </h2>
            <form onSubmit={kaydet}>
              {!duzenlenen && secilebilir.length > 0 && (
                <div style={s.alan}>
                  <label style={s.etiket}>Kurum *</label>
                  <select style={s.girdi} value={modalKurumId} onChange={e => { setModalKurumId(e.target.value); setForm(f => ({ ...f, sinifId: '', sinifAd: '' })) }}>
                    <option value="">— Seçin —</option>
                    {secilebilir.map(k => <option key={k.id} value={k.id}>{kurumAdi(k)}</option>)}
                  </select>
                </div>
              )}
              <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}><label style={s.etiket}>Ad *</label><input style={s.girdi} value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} autoFocus /></div>
                <div style={s.alan}><label style={s.etiket}>Soyad</label><input style={s.girdi} value={form.soyad} onChange={e => setForm(f => ({ ...f, soyad: e.target.value }))} /></div>
              </div>
              <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}><label style={s.etiket}>TC No</label><input style={s.girdi} value={form.ogrenciNo} onChange={e => setForm(f => ({ ...f, ogrenciNo: e.target.value }))} /></div>
                <div style={s.alan}>
                  <label style={s.etiket}>Cinsiyet</label>
                  <select style={s.girdi} value={form.cinsiyet} onChange={e => setForm(f => ({ ...f, cinsiyet: e.target.value }))}>
                    <option value="">Seçin</option><option value="erkek">Erkek</option><option value="kız">Kız</option>
                  </select>
                </div>
              </div>
              <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}>
                  <label style={s.etiket}>Sınıf</label>
                  <select style={s.girdi} value={form.sinifId} onChange={e => sinifSec(e.target.value)}>
                    <option value="">Seçin</option>
                    {modalSiniflar.map(sx => <option key={sx.id} value={sx.id}>{sx.ad}</option>)}
                  </select>
                </div>
                <div style={s.alan}><label style={s.etiket}>Doğum Tarihi</label><input style={s.girdi} type="date" value={form.dogumTarihi} onChange={e => setForm(f => ({ ...f, dogumTarihi: e.target.value }))} /></div>
              </div>
              <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}><label style={s.etiket}>Anne Ad Soyad</label><input style={s.girdi} value={form.anneAdSoyad} onChange={e => setForm(f => ({ ...f, anneAdSoyad: e.target.value }))} /></div>
                <div style={s.alan}><label style={s.etiket}>Anne Telefon</label><input style={s.girdi} value={form.anneTelefon} onChange={e => setForm(f => ({ ...f, anneTelefon: e.target.value }))} placeholder="0555 000 00 00" /></div>
              </div>
              <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}><label style={s.etiket}>Baba Ad Soyad</label><input style={s.girdi} value={form.babaAdSoyad} onChange={e => setForm(f => ({ ...f, babaAdSoyad: e.target.value }))} /></div>
                <div style={s.alan}><label style={s.etiket}>Baba Telefon</label><input style={s.girdi} value={form.babaTelefon} onChange={e => setForm(f => ({ ...f, babaTelefon: e.target.value }))} placeholder="0555 000 00 00" /></div>
              </div>
              <div style={s.alan}><label style={s.etiket}>Öğrenci E-posta</label><input style={s.girdi} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ali@okul.com" /></div>
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
    </div>
  )
}
