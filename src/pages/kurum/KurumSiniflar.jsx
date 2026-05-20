import { useEffect, useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, writeBatch,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

const BOŞ_FORM = { ad: '', seviye: '', sube: '' }
const OKUL_SIRA = { ilkokul: 1, ortaokul: 2, lise: 3 }

const ŞABLON_BAŞLIKLAR = ['ÖĞRENCİ AD / SOYAD', 'TC NO', 'Sınıf/Şb', 'ANNE AD / SOYAD', 'ANNE TLF', 'BABA AD / SOYAD', 'BABA TLF', 'ÖĞRENCİ MAİL ADRES']
const ŞABLON_ÖRNEK    = ['Ali Yılmaz', '12345678901', '5-A', 'Ayşe Yılmaz', '0555 111 22 33', 'Ahmet Yılmaz', '0555 000 00 00', 'ali.yilmaz@okul.com']

export default function KurumSiniflar() {
  const { secilenKurumId, secilenKurum, erisimKurumlar } = useKurumYonetim()

  const ust = erisimKurumlar.find(k => k.id === secilenKurum?.parentId)
  const seviye = !secilenKurum?.parentId ? 'root' : !ust?.parentId ? 'kampus' : 'altKurum'

  const sayimKurumlar = useMemo(() => {
    if (seviye === 'root') return erisimKurumlar.filter(k => { if (!k.parentId) return false; const u = erisimKurumlar.find(x => x.id === k.parentId); return !!u?.parentId })
    if (seviye === 'kampus') return erisimKurumlar.filter(k => k.parentId === secilenKurumId)
    return secilenKurum ? [secilenKurum] : []
  }, [seviye, secilenKurumId, erisimKurumlar]) // eslint-disable-line

  const listKurumId = seviye === 'altKurum' ? secilenKurumId : null
  const secilebilir = erisimKurumlar.filter(k => { if (!k.parentId) return false; const u = erisimKurumlar.find(x => x.id === k.parentId); return !!u?.parentId })

  const [siniflarMap, setSiniflarMap]   = useState({})
  const [acikGruplar, setAcikGruplar]   = useState({})
  const [modalKurumId, setModalKurumId] = useState('')
  const [form, setForm]                 = useState(BOŞ_FORM)
  const [modal, setModal]               = useState(false)
  const [duzenlenen, setDuzenlenen]     = useState(null)
  const [kaydediyor, setKaydediyor]     = useState(false)
  const [hata, setHata]                 = useState('')

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
      if (duzenlenen) await updateDoc(doc(db, 'kurumlar', hedefKurumId, 'siniflar', duzenlenen.id), { ad: form.ad, seviye: form.seviye, sube: form.sube })
      else await addDoc(collection(db, 'kurumlar', hedefKurumId, 'siniflar'), { ...form, olusturmaTarihi: serverTimestamp() })
      modalKapat()
    } catch (err) { setHata('Kayıt hatası: ' + err.message) }
    finally { setKaydediyor(false) }
  }

  async function sil(sinif) {
    if (!window.confirm('Bu sınıfı silmek istediğinize emin misiniz?')) return
    await deleteDoc(doc(db, 'kurumlar', sinif._kurumId, 'siniflar', sinif.id))
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
  function sinifNormalize(s) { return s?.toString().toLowerCase().replace(/[\s\-_]/g, '') || '' }

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
    if (!importSinif || importSatirlar.length === 0) return
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

  const toplamSinif = sayimKurumlar.reduce((a, k) => a + (siniflarMap[k.id]?.length || 0), 0)

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
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Sınıflar</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Sınıf ve şube yönetimi</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#64748B' }}>
          {sayimKurumlar.length === 0 ? 'Sol menüden kurum seçin' : `${toplamSinif} sınıf`}
        </span>
        {listKurumId && (
          <button onClick={() => modalAc()} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
            + Yeni Sınıf
          </button>
        )}
      </div>

      {/* ── Gruplu sınıf listesi ── */}
      {sayimKurumlar.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sayimKurumlar
            .slice()
            .sort((a, b) => {
              const ka = erisimKurumlar.find(x => x.id === a.parentId)
              const kb = erisimKurumlar.find(x => x.id === b.parentId)
              const kk = (ka?.ad || '').localeCompare(kb?.ad || '', 'tr')
              if (kk !== 0) return kk
              return (OKUL_SIRA[a.okulTuru] || 9) - (OKUL_SIRA[b.okulTuru] || 9)
            })
            .map(k => {
              const kampus = erisimKurumlar.find(x => x.id === k.parentId)
              const grupSiniflar = (siniflarMap[k.id] || []).slice().sort((a, b) => {
                const sv = (Number(a.seviye) || 0) - (Number(b.seviye) || 0)
                return sv !== 0 ? sv : (a.sube || '').localeCompare(b.sube || '', 'tr')
              })
              const acik = acikGruplar[k.id] === true

              return (
                <div key={k.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <div onClick={() => setAcikGruplar(prev => ({ ...prev, [k.id]: !acik }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderBottom: acik ? '1px solid #E2E8F0' : 'none', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{acik ? '▼' : '▶'}</span>
                    {kampus && <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '500' }}>{kampus.ad}</span>}
                    {kampus && <span style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>›</span>}
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1E293B' }}>{k.ad}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: 'auto' }}>{grupSiniflar.length} sınıf</span>
                    <button
                      onClick={e => { e.stopPropagation(); importKurumAc(k.id) }}
                      style={{ marginLeft: '0.75rem', padding: '2px 10px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', color: '#065F46', cursor: 'pointer' }}>
                      📥 Toplu Ekle
                    </button>
                  </div>

                  {acik && (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{['Sınıf Adı', 'Seviye', 'Şube', 'İşlemler'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {grupSiniflar.length === 0 ? (
                          <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '2rem' }}>Henüz sınıf eklenmemiş</td></tr>
                        ) : grupSiniflar.map(sinif => (
                          <tr key={sinif.id}>
                            <td style={s.td}><strong>{sinif.ad}</strong></td>
                            <td style={s.td}>{sinif.seviye || '—'}</td>
                            <td style={s.td}>{sinif.sube || '—'}</td>
                            <td style={s.td}>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button style={s.eylem} onClick={() => modalAc(sinif)}>Düzenle</button>
                                <button style={{ ...s.eylem, color: '#065F46', borderColor: '#A7F3D0' }} onClick={() => importAc(sinif)}>📥 Toplu Ekle</button>
                                <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => sil(sinif)}>Sil</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
        </div>
      )}

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

      {/* ── Toplu öğrenci import modal ── */}
      {importModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && importKapat()}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

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
