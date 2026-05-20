import { useEffect, useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  collection, onSnapshot, doc, setDoc,
  query, orderBy, where, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

// Puan renk stili
const PUAN_BG = {
  4: { background: '#D1FAE5', color: '#065F46' },
  3: { background: '#DBEAFE', color: '#1E40AF' },
  2: { background: '#FEF3C7', color: '#92400E' },
  1: { background: '#FEE2E2', color: '#991B1B' },
}

// Rubrikten tüm alt kriterler (düz liste)
function altKriterListesi(rubrik) {
  return (rubrik?.kriterler || []).flatMap(k =>
    (k.altKriterler || []).map(ak => ({ ...ak, anaAd: k.ad, anaId: k.id }))
  )
}

// Ortalama hesapla (tüm alt kriterler üzerinden)
function hesaplaOrt(puanlar, rubrik) {
  const liste = altKriterListesi(rubrik)
  if (!liste.length) return null
  const degerler = liste.map(ak => puanlar?.[ak.id]).filter(v => v > 0)
  if (!degerler.length) return null
  return degerler.reduce((a, b) => a + b, 0) / degerler.length
}

function OrtBadge({ ort }) {
  if (ort == null) return <span style={{ color: '#CBD5E1', fontSize: '0.8rem' }}>—</span>
  const n = parseFloat(ort)
  const st = n >= 3.5 ? PUAN_BG[4] : n >= 2.5 ? PUAN_BG[3] : n >= 1.5 ? PUAN_BG[2] : PUAN_BG[1]
  return (
    <span style={{ ...st, padding: '2px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '0.85rem' }}>
      {n.toFixed(2)}
    </span>
  )
}

export default function KurumDegerlendirmeler() {
  const { secilenKurumId, secilenKurum, erisimKurumlar } = useKurumYonetim()

  const ust    = erisimKurumlar.find(k => k.id === secilenKurum?.parentId)
  const seviye = !secilenKurum?.parentId ? 'root' : !ust?.parentId ? 'kampus' : 'altKurum'
  const hedefKurumId = seviye === 'altKurum' ? secilenKurumId : null

  // ── Veri ─────────────────────────────────────────────────
  const [rubrikler,  setRubrikler]  = useState([])
  const [ogrenciler, setOgrenciler] = useState([])
  const [siniflar,   setSiniflar]   = useState([])
  const [mevcut,     setMevcut]     = useState({})   // ogrenciId → { altKriterId: puan }

  // ── UI ───────────────────────────────────────────────────
  const [secilenRubrikId, setSecilenRubrikId] = useState(null)
  const [secilenDonem,    setSecilenDonem]    = useState(1)
  const [secilenSinifId,  setSecilenSinifId]  = useState('')
  const [degisiklikler,   setDegisiklikler]   = useState({})
  const [kaydediyor,      setKaydediyor]      = useState(false)

  // ── Import ───────────────────────────────────────────────
  const [importModal,    setImportModal]    = useState(false)
  const [importSatirlar, setImportSatirlar] = useState([])
  const [importing,      setImporting]      = useState(false)
  const [importHata,     setImportHata]     = useState('')

  // Rubrikler
  useEffect(() => {
    if (!hedefKurumId) { setRubrikler([]); setSecilenRubrikId(null); return }
    const q = query(collection(db, 'kurumlar', hedefKurumId, 'rubrikler'), orderBy('olusturmaTarihi', 'asc'))
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setRubrikler(list)
      setSecilenRubrikId(prev => list.find(r => r.id === prev) ? prev : list[0]?.id || null)
    })
  }, [hedefKurumId])

  // Öğrenciler
  useEffect(() => {
    if (!hedefKurumId) { setOgrenciler([]); return }
    return onSnapshot(
      query(collection(db, 'kurumlar', hedefKurumId, 'ogrenciler'), orderBy('soyad', 'asc')),
      snap => setOgrenciler(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  }, [hedefKurumId])

  // Sınıflar
  useEffect(() => {
    if (!hedefKurumId) { setSiniflar([]); return }
    return onSnapshot(
      collection(db, 'kurumlar', hedefKurumId, 'siniflar'),
      snap => setSiniflar(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  }, [hedefKurumId])

  // Mevcut değerlendirmeler
  useEffect(() => {
    if (!hedefKurumId || !secilenRubrikId) { setMevcut({}); return }
    const q = query(
      collection(db, 'kurumlar', hedefKurumId, 'degerlendirmeler'),
      where('rubrikId', '==', secilenRubrikId),
      where('donem',    '==', secilenDonem)
    )
    return onSnapshot(q, snap => {
      const m = {}
      snap.docs.forEach(d => { m[d.data().ogrenciId] = d.data().puanlar || {} })
      setMevcut(m)
    })
  }, [hedefKurumId, secilenRubrikId, secilenDonem])

  // Rubrik / dönem değişince değişiklikleri sıfırla
  useEffect(() => { setDegisiklikler({}) }, [secilenRubrikId, secilenDonem])

  const secilenRubrik = rubrikler.find(r => r.id === secilenRubrikId) || null

  const filtreliOgrenciler = useMemo(() => {
    const liste = secilenSinifId ? ogrenciler.filter(o => o.sinifId === secilenSinifId) : ogrenciler
    return liste.slice().sort((a, b) => {
      const sa = siniflar.find(s => s.id === a.sinifId)
      const sb = siniflar.find(s => s.id === b.sinifId)
      const sevA = Number(sa?.seviye || 99); const sevB = Number(sb?.seviye || 99)
      if (sevA !== sevB) return sevA - sevB
      const subA = sa?.sube || ''; const subB = sb?.sube || ''
      if (subA !== subB) return subA.localeCompare(subB, 'tr')
      return (a.soyad || '').localeCompare(b.soyad || '', 'tr')
    })
  }, [ogrenciler, secilenSinifId, siniflar])

  // ── Puan okuma / yazma ────────────────────────────────────
  function getPuan(ogrenciId, akId) {
    if (degisiklikler[ogrenciId]?.hasOwnProperty(akId)) return degisiklikler[ogrenciId][akId]
    return mevcut[ogrenciId]?.[akId] || null
  }
  function puanDegisti(ogrenciId, akId, val) {
    setDegisiklikler(prev => ({
      ...prev,
      [ogrenciId]: { ...prev[ogrenciId], [akId]: val ? Number(val) : null },
    }))
  }
  const degisiklikSayisi = Object.keys(degisiklikler).length

  // ── Kaydet ───────────────────────────────────────────────
  async function kaydet() {
    if (!hedefKurumId || !secilenRubrik || !degisiklikSayisi) return
    setKaydediyor(true)
    try {
      await Promise.all(
        Object.entries(degisiklikler).map(([ogrenciId, yeniPuanlar]) => {
          const birlesik = { ...(mevcut[ogrenciId] || {}) }
          Object.entries(yeniPuanlar).forEach(([akId, p]) => {
            if (p != null) birlesik[akId] = p; else delete birlesik[akId]
          })
          const ogr   = ogrenciler.find(o => o.id === ogrenciId)
          const sinif = siniflar.find(s => s.id === ogr?.sinifId)
          const ort   = hesaplaOrt(birlesik, secilenRubrik)
          const degId = `${ogrenciId}_${secilenRubrikId}_d${secilenDonem}`
          return setDoc(doc(db, 'kurumlar', hedefKurumId, 'degerlendirmeler', degId), {
            ogrenciId,
            ogrenciAd:    ogr?.ad    || '',
            ogrenciSoyad: ogr?.soyad || '',
            sinifId:  ogr?.sinifId || '',
            sinifAd:  sinif?.ad || '',
            rubrikId: secilenRubrikId,
            rubrikAd: secilenRubrik.ad,
            donem:    secilenDonem,
            puanlar:  birlesik,
            ort:      ort != null ? parseFloat(ort.toFixed(2)) : null,
            guncellenmeTarihi: serverTimestamp(),
          })
        })
      )
      setDegisiklikler({})
    } catch (err) { alert('Kayıt hatası: ' + err.message) }
    finally { setKaydediyor(false) }
  }

  // ── Excel Şablon İndir ────────────────────────────────────
  function sablonIndir() {
    if (!secilenRubrik) return
    const akler = altKriterListesi(secilenRubrik)

    // Satır 1: Ana kriter başlıkları (merge ile birleştirilecek)
    const row1 = ['#', 'Ad Soyad', 'TC No', 'Sınıf']
    // Satır 2: Alt kriter adları
    const row2 = ['', '', '', '']

    let col = 4
    const merges = []
    secilenRubrik.kriterler.forEach(k => {
      const n = (k.altKriterler || []).length
      row1.push(k.ad)
      for (let i = 1; i < n; i++) row1.push('')
      ;(k.altKriterler || []).forEach(ak => row2.push(ak.ad))
      if (n > 1) merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + n - 1 } })
      col += n
    })
    row1.push('Dönem Ort.'); row2.push('')

    const infoRow = ['', 'Puan ölçeği: 1=Başlangıç  2=Gelişiyor  3=Yeterli  4=Mükemmel', '', '',
      ...akler.map(() => '1-4'), '']

    const dataRows = filtreliOgrenciler.map((ogr, i) => {
      const sinif = siniflar.find(s => s.id === ogr.sinifId)
      return [
        i + 1,
        `${ogr.ad} ${ogr.soyad}`,
        ogr.ogrenciNo || '',
        sinif?.ad || '',
        ...akler.map(ak => getPuan(ogr.id, ak.id) || ''),
        '',
      ]
    })

    const ws = XLSX.utils.aoa_to_sheet([row1, row2, infoRow, ...dataRows])
    if (merges.length) ws['!merges'] = merges
    ws['!cols'] = [{ wch: 4 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, ...akler.map(() => ({ wch: 18 })), { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Değerlendirme')
    XLSX.writeFile(wb, `${secilenRubrik.ad}_${secilenDonem}donem.xlsx`)
  }

  // ── Excel Import ──────────────────────────────────────────
  function dosyaOku(e) {
    const dosya = e.target.files[0]; if (!dosya) return
    setImportHata('')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (rows.length < 2) { setImportHata('Dosyada veri bulunamadı.'); return }

        const akler = altKriterListesi(secilenRubrik)

        // Alt kriter adlarını en çok içeren satırı başlık satırı olarak bul
        let hIdx = 0, maxHit = 0
        for (let i = 0; i < Math.min(rows.length, 6); i++) {
          const hit = rows[i].filter(c => {
            const cs = c?.toString().toLowerCase()
            return akler.some(ak => cs?.includes(ak.ad.toLowerCase().slice(0, 5)))
          }).length
          if (hit > maxHit) { maxHit = hit; hIdx = i }
        }
        // Fallback: satır "Ad" veya "Soyad" içeriyorsa
        if (maxHit === 0) {
          for (let i = 0; i < Math.min(rows.length, 5); i++) {
            if (rows[i].some(c => /ad|soyad/i.test(c?.toString()))) { hIdx = i; break }
          }
        }

        const baslik   = rows[hIdx].map(c => c?.toString().trim().toLowerCase())
        const tcIdx    = baslik.findIndex(b => /tc|no/i.test(b))
        const adIdx    = baslik.findIndex(b => /ad.*soyad|soyad|ad/i.test(b)) || 1
        const akIdx    = akler.map(ak => {
          const slug = ak.ad.toLowerCase().slice(0, 6)
          return baslik.findIndex(b => b.includes(slug))
        })

        const satirlar = rows.slice(hIdx + 1)
          .filter(r => r.some(c => c?.toString().trim()))
          .map((r, i) => {
            const adSoyad = r[adIdx]?.toString().trim() || ''
            const tcNo    = tcIdx >= 0 ? r[tcIdx]?.toString().trim() : ''
            let eslenenOgr = ogrenciler.find(o => o.ogrenciNo && o.ogrenciNo.toString() === tcNo)
            if (!eslenenOgr) {
              const norm = s => s?.toLowerCase().replace(/\s+/g, '') || ''
              eslenenOgr = ogrenciler.find(o => norm(`${o.ad} ${o.soyad}`) === norm(adSoyad))
            }
            const puanlar = {}
            akler.forEach((ak, ki) => {
              const col = akIdx[ki]
              if (col >= 0) {
                const val = parseInt(r[col])
                if (val >= 1 && val <= 4) puanlar[ak.id] = val
              }
            })
            return { satir: i + 1, adSoyad, tcNo, eslenenOgr, eslenmedi: !eslenenOgr, puanlar, puanSayisi: Object.keys(puanlar).length }
          })
          .filter(s => s.adSoyad)

        if (!satirlar.length) { setImportHata('Veri satırı bulunamadı.'); return }
        setImportSatirlar(satirlar)
      } catch (err) { setImportHata('Dosya okunamadı: ' + err.message) }
    }
    reader.readAsArrayBuffer(dosya); e.target.value = ''
  }

  async function importKaydet() {
    if (!hedefKurumId || !secilenRubrik) return
    const yazilacaklar = importSatirlar.filter(s => !s.eslenmedi && s.puanSayisi > 0)
    if (!yazilacaklar.length) return
    setImporting(true)
    try {
      await Promise.all(yazilacaklar.map(s => {
        const ogr   = s.eslenenOgr
        const sinif = siniflar.find(sf => sf.id === ogr.sinifId)
        const birlesik = { ...(mevcut[ogr.id] || {}), ...s.puanlar }
        const ort   = hesaplaOrt(birlesik, secilenRubrik)
        const degId = `${ogr.id}_${secilenRubrikId}_d${secilenDonem}`
        return setDoc(doc(db, 'kurumlar', hedefKurumId, 'degerlendirmeler', degId), {
          ogrenciId: ogr.id, ogrenciAd: ogr.ad || '', ogrenciSoyad: ogr.soyad || '',
          sinifId: ogr.sinifId || '', sinifAd: sinif?.ad || '',
          rubrikId: secilenRubrikId, rubrikAd: secilenRubrik.ad,
          donem: secilenDonem, puanlar: birlesik,
          ort: ort != null ? parseFloat(ort.toFixed(2)) : null,
          guncellenmeTarihi: serverTimestamp(),
        })
      }))
      setImportModal(false); setImportSatirlar([])
    } catch (err) { setImportHata('Kayıt hatası: ' + err.message) }
    finally { setImporting(false) }
  }

  // ── TD stilleri ───────────────────────────────────────────
  const thAna = { padding: '0.5rem 0.625rem', textAlign: 'center', fontSize: '0.72rem', fontWeight: '700', color: '#fff', background: '#1B3A6B', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.15)' }
  const thAlt = { padding: '0.5rem 0.625rem', textAlign: 'center', fontSize: '0.68rem', fontWeight: '600', color: '#fff', background: '#2D5099', whiteSpace: 'normal', lineHeight: '1.3', maxWidth: '130px', borderRight: '1px solid rgba(255,255,255,0.1)' }
  const thFix = { padding: '0.625rem 0.75rem', fontSize: '0.72rem', fontWeight: '600', color: '#fff', background: '#1B3A6B', whiteSpace: 'nowrap' }
  const td    = { padding: '0.5rem 0.5rem', textAlign: 'center', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem' }
  const tdAd  = { padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem', fontWeight: '500' }

  if (!hedefKurumId) return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Değerlendirmeler</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Rubrik bazlı dönem değerlendirmesi</p>
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
        Değerlendirme yapmak için sol menüden bir alt kurum seçin
      </div>
    </div>
  )

  return (
    <div style={{ paddingBottom: '80px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Değerlendirmeler</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        <strong>{secilenKurum?.ad}</strong> — rubrik bazlı dönem değerlendirmesi
      </p>

      {rubrikler.length === 0 ? (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '10px', padding: '1.5rem', color: '#92400E', fontSize: '0.875rem' }}>
          ⚠ Henüz rubrik eklenmemiş. <strong>Rubrikler</strong> sayfasından önce rubrik oluşturun.
        </div>
      ) : (
        <>
          {/* ── Rubrik Sekmeleri ── */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {rubrikler.map(r => (
              <button key={r.id} onClick={() => setSecilenRubrikId(r.id)}
                style={{
                  padding: '7px 16px', borderRadius: '20px', border: '1.5px solid',
                  borderColor: secilenRubrikId === r.id ? '#1B3A6B' : '#CBD5E1',
                  background:  secilenRubrikId === r.id ? '#1B3A6B' : '#fff',
                  color:       secilenRubrikId === r.id ? '#fff' : '#475569',
                  fontSize: '0.825rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {r.ad}
              </button>
            ))}
          </div>

          {/* ── Dönem Seçici ── */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
            {[1, 2].map(d => (
              <button key={d} onClick={() => setSecilenDonem(d)}
                style={{
                  flex: 1, maxWidth: '200px', padding: '9px', border: '1.5px solid',
                  borderColor: secilenDonem === d ? '#0E7490' : '#CBD5E1',
                  background:  secilenDonem === d ? '#ECFEFF' : '#fff',
                  color:       secilenDonem === d ? '#0E7490' : '#475569',
                  borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer',
                }}>
                {d}. Dönem
              </button>
            ))}
          </div>

          {/* ── Filtre + Butonlar ── */}
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <select value={secilenSinifId} onChange={e => setSecilenSinifId(e.target.value)}
              style={{ padding: '6px 10px', border: '1.5px solid #E2E8F0', borderRadius: '7px', fontSize: '0.825rem', background: '#fff', color: '#374151', cursor: 'pointer' }}>
              <option value="">Tüm sınıflar ({ogrenciler.length} öğrenci)</option>
              {siniflar.slice().sort((a, b) => (Number(a.seviye)||0)-(Number(b.seviye)||0) || (a.sube||'').localeCompare(b.sube||'')).map(sf => {
                const say = ogrenciler.filter(o => o.sinifId === sf.id).length
                return <option key={sf.id} value={sf.id}>{sf.ad} ({say})</option>
              })}
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <button onClick={sablonIndir}
                style={{ padding: '6px 14px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '7px', fontSize: '0.8rem', fontWeight: '600', color: '#4338CA', cursor: 'pointer' }}>
                ⬇ Şablon İndir
              </button>
              <button onClick={() => { setImportSatirlar([]); setImportHata(''); setImportModal(true) }}
                style={{ padding: '6px 14px', background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: '7px', fontSize: '0.8rem', fontWeight: '600', color: '#065F46', cursor: 'pointer' }}>
                📥 E-Tablodan Aktar
              </button>
            </div>
          </div>

          {/* ── Puanlama Tablosu ── */}
          {secilenRubrik && (() => {
            const akler = altKriterListesi(secilenRubrik)
            return (
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1B3A6B' }}>
                    {secilenRubrik.ad} — {secilenDonem}. Dönem
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                    4=Mükemmel · 3=İyi · 2=Gelişiyor · 1=Başlangıç
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      {/* Satır 1: Sabit + Ana Kriter başlıkları + Ort */}
                      <tr>
                        <th rowSpan={2} style={{ ...thFix, width: '36px', verticalAlign: 'middle' }}>#</th>
                        <th rowSpan={2} style={{ ...thFix, textAlign: 'left', minWidth: '160px', verticalAlign: 'middle' }}>Ad Soyad</th>
                        <th rowSpan={2} style={{ ...thFix, minWidth: '72px', verticalAlign: 'middle' }}>Sınıf</th>
                        {secilenRubrik.kriterler.map(k => (
                          <th key={k.id}
                            colSpan={k.altKriterler?.length || 1}
                            style={{ ...thAna, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            {k.ad}
                          </th>
                        ))}
                        <th rowSpan={2} style={{ ...thFix, minWidth: '80px', verticalAlign: 'middle' }}>Dönem Ort.</th>
                      </tr>
                      {/* Satır 2: Alt Kriter adları */}
                      <tr>
                        {secilenRubrik.kriterler.flatMap(k =>
                          (k.altKriterler || []).map(ak => (
                            <th key={ak.id} style={thAlt}>{ak.ad}</th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filtreliOgrenciler.length === 0 ? (
                        <tr>
                          <td colSpan={4 + akler.length} style={{ ...td, padding: '2.5rem', color: '#94A3B8' }}>
                            Öğrenci bulunamadı
                          </td>
                        </tr>
                      ) : filtreliOgrenciler.map((ogr, idx) => {
                        const sinif = siniflar.find(sf => sf.id === ogr.sinifId)
                        const birlesik = {
                          ...(mevcut[ogr.id] || {}),
                          ...Object.fromEntries(
                            Object.entries(degisiklikler[ogr.id] || {}).filter(([, v]) => v != null)
                          ),
                        }
                        const ort     = hesaplaOrt(birlesik, secilenRubrik)
                        const degisti = !!degisiklikler[ogr.id]
                        return (
                          <tr key={ogr.id} style={{ background: degisti ? '#FFFBEB' : idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                            <td style={{ ...td, color: '#94A3B8' }}>{idx + 1}</td>
                            <td style={tdAd}>
                              {ogr.ad} {ogr.soyad}
                              {degisti && <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: '#D97706' }}>●</span>}
                            </td>
                            <td style={{ ...td, color: '#64748B', fontSize: '0.75rem' }}>{sinif?.ad || '—'}</td>
                            {akler.map(ak => {
                              const p  = getPuan(ogr.id, ak.id)
                              const st = p ? PUAN_BG[p] : { background: '#F8FAFC', color: '#94A3B8' }
                              return (
                                <td key={ak.id} style={td}>
                                  <select value={p || ''} onChange={e => puanDegisti(ogr.id, ak.id, e.target.value)}
                                    style={{ width: '56px', padding: '3px 2px', borderRadius: '5px', fontSize: '0.82rem', border: '1.5px solid #E2E8F0', cursor: 'pointer', textAlign: 'center', fontWeight: p ? '700' : '400', ...st }}>
                                    <option value="">—</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                  </select>
                                </td>
                              )
                            })}
                            <td style={td}><OrtBadge ort={ort} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* ── Sticky Kaydet Barı ── */}
      {degisiklikSayisi > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: '240px', right: 0,
          background: '#fff', borderTop: '1px solid #E2E8F0',
          padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 50, boxShadow: '0 -4px 16px rgba(0,0,0,0.07)',
        }}>
          <span style={{ fontSize: '0.875rem', color: '#64748B' }}>
            <strong style={{ color: '#D97706' }}>{degisiklikSayisi}</strong> öğrencide değişiklik var
          </span>
          <button onClick={kaydet} disabled={kaydediyor}
            style={{ padding: '0.6rem 1.75rem', background: '#1A7A4A', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '700', cursor: 'pointer' }}>
            {kaydediyor ? 'Kaydediliyor...' : '✓ Kaydet'}
          </button>
        </div>
      )}

      {/* ── Import Modal ── */}
      {importModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
          onClick={e => e.target === e.currentTarget && setImportModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', position: 'relative' }}>

            {importing && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.9)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, gap: '1rem' }}>
                <div style={{ width: '44px', height: '44px', border: '5px solid #E2E8F0', borderTopColor: '#1B3A6B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1E293B' }}>Puanlar kaydediliyor…</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            )}

            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B' }}>📥 E-Tablodan Puan Aktar</h2>
                <button onClick={() => setImportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#94A3B8' }}>✕</button>
              </div>
              <p style={{ fontSize: '0.825rem', color: '#64748B', marginBottom: '1.25rem' }}>
                <strong>{secilenRubrik?.ad}</strong> — {secilenDonem}. Dönem
              </p>

              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#065F46', marginBottom: '0.5rem' }}>1. Şablonu indir, puanları doldur</div>
                <div style={{ fontSize: '0.8rem', color: '#047857', marginBottom: '0.75rem' }}>
                  Şablonda ana başlıklar ve alt kriter sütunları hazır gelir. Her hücreye 1–4 arası puan girin.
                </div>
                <button onClick={sablonIndir}
                  style={{ padding: '5px 14px', background: '#065F46', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>
                  ⬇ Şablonu İndir (.xlsx)
                </button>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1E293B', marginBottom: '0.5rem' }}>2. Doldurulmuş dosyayı yükle</div>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #CBD5E1', borderRadius: '10px', padding: '1.5rem', cursor: 'pointer', background: '#F8FAFC' }}>
                  <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📂</span>
                  <span style={{ fontSize: '0.875rem', color: '#64748B' }}>
                    {importSatirlar.length > 0 ? `✅ ${importSatirlar.length} satır okundu` : '.xlsx veya .csv seçin'}
                  </span>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={dosyaOku} style={{ display: 'none' }} />
                </label>
              </div>

              {importSatirlar.length > 0 && (() => {
                const eslenmeyenler = importSatirlar.filter(s => s.eslenmedi)
                const yazilacak = importSatirlar.filter(s => !s.eslenmedi && s.puanSayisi > 0)
                return (
                  <div style={{ marginBottom: '1rem' }}>
                    {eslenmeyenler.length > 0 && (
                      <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', padding: '0.625rem 0.875rem', marginBottom: '0.625rem', fontSize: '0.8rem', color: '#92400E' }}>
                        ⚠ {eslenmeyenler.length} satırda öğrenci eşleşmedi — atlanacak
                      </div>
                    )}
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1E293B', marginBottom: '0.375rem' }}>
                      Önizleme ({importSatirlar.length} satır)
                    </div>
                    <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC' }}>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#64748B', fontWeight: '600', borderBottom: '1px solid #E2E8F0' }}>Ad Soyad</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#64748B', fontWeight: '600', borderBottom: '1px solid #E2E8F0' }}>Eşleşme</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#64748B', fontWeight: '600', borderBottom: '1px solid #E2E8F0' }}>Puan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importSatirlar.slice(0, 8).map((s, i) => (
                            <tr key={i} style={{ background: s.eslenmedi ? '#FEF2F2' : 'transparent', borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '0.5rem 0.75rem', color: '#1E293B' }}>{s.adSoyad}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                {s.eslenmedi
                                  ? <span style={{ color: '#991B1B', fontSize: '0.75rem' }}>⚠ Bulunamadı</span>
                                  : <span style={{ color: '#065F46', fontSize: '0.75rem' }}>✓ {s.eslenenOgr?.ad} {s.eslenenOgr?.soyad}</span>}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#64748B' }}>
                                {s.puanSayisi > 0 ? `${s.puanSayisi} kriter` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {importSatirlar.length > 8 && <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.25rem' }}>… ve {importSatirlar.length - 8} satır daha</p>}
                    <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.5rem' }}>
                      <strong style={{ color: '#1B3A6B' }}>{yazilacak.length}</strong> öğrenci kaydedilecek
                      {yazilacak.length !== importSatirlar.length && `, ${importSatirlar.length - yazilacak.length} atlanacak`}
                    </p>
                  </div>
                )
              })()}

              {importHata && <p style={{ fontSize: '0.875rem', color: '#991B1B', background: '#FEE2E2', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '0.75rem' }}>{importHata}</p>}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setImportModal(false)}
                  style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>
                  İptal
                </button>
                <button onClick={importKaydet}
                  disabled={importing || importSatirlar.filter(s => !s.eslenmedi && s.puanSayisi > 0).length === 0}
                  style={{ padding: '0.6rem 1.5rem', background: '#1A7A4A', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                  {importing ? 'Kaydediliyor...' : `${importSatirlar.filter(s => !s.eslenmedi && s.puanSayisi > 0).length} Öğrenci Kaydet`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
