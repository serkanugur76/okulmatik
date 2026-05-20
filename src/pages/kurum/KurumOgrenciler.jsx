import { useEffect, useState, useMemo } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

const BOŞ_FORM = { ad: '', soyad: '', ogrenciNo: '', sinifId: '', sinifAd: '', cinsiyet: '', dogumTarihi: '', anneAdSoyad: '', anneTelefon: '', babaAdSoyad: '', babaTelefon: '', email: '' }
const OKUL_SIRA = { ilkokul: 1, ortaokul: 2, lise: 3 }

export default function KurumOgrenciler() {
  const { secilenKurumId, secilenKurum, erisimKurumlar } = useKurumYonetim()

  // Seçili seviye
  const ust = erisimKurumlar.find(k => k.id === secilenKurum?.parentId)
  const seviye = !secilenKurum?.parentId ? 'root'
    : !ust?.parentId ? 'kampus'
    : 'altKurum'

  // Listelenecek alt kurumlar
  const sayimKurumlar = useMemo(() => {
    if (seviye === 'root') {
      return erisimKurumlar.filter(k => {
        if (!k.parentId) return false
        const u = erisimKurumlar.find(x => x.id === k.parentId)
        return !!u?.parentId
      })
    }
    if (seviye === 'kampus') {
      return erisimKurumlar.filter(k => k.parentId === secilenKurumId)
    }
    return secilenKurum ? [secilenKurum] : []
  }, [seviye, secilenKurumId, erisimKurumlar]) // eslint-disable-line

  const listKurumId = seviye === 'altKurum' ? secilenKurumId : null

  // Sadece altKurum'lar (modal kurum seçimi için)
  const secilebilir = erisimKurumlar.filter(k => {
    if (!k.parentId) return false
    const u = erisimKurumlar.find(x => x.id === k.parentId)
    return !!u?.parentId
  })

  const [ogrencilerMap, setOgrencilerMap] = useState({}) // { kurumId: ogrenci[] }
  const [acikGruplar, setAcikGruplar]     = useState({}) // { kurumId: bool }
  const [siniflar, setSiniflar]           = useState([])
  const [modalKurumId, setModalKurumId]   = useState('')
  const [form, setForm]                   = useState(BOŞ_FORM)
  const [modal, setModal]                 = useState(false)
  const [duzenlenen, setDuzenlenen]       = useState(null)
  const [kaydediyor, setKaydediyor]       = useState(false)
  const [hata, setHata]                   = useState('')
  const [aramaMetni, setAramaMetni]       = useState('')

  // Tüm ilgili kurumların öğrencilerine abone ol
  useEffect(() => {
    if (sayimKurumlar.length === 0) { setOgrencilerMap({}); return }

    const unsubs = sayimKurumlar.map(k => {
      const kampus = erisimKurumlar.find(x => x.id === k.parentId)
      const tamAd = kampus ? `${kampus.ad} · ${k.ad}` : k.ad
      const q = query(collection(db, 'kurumlar', k.id, 'ogrenciler'), orderBy('ad', 'asc'))
      return onSnapshot(q, snap => {
        setOgrencilerMap(prev => ({
          ...prev,
          [k.id]: snap.docs.map(d => ({ id: d.id, _kurumId: k.id, _kurumAd: tamAd, ...d.data() })),
        }))
      })
    })

    setOgrencilerMap(prev => {
      const gecerliIdler = new Set(sayimKurumlar.map(k => k.id))
      const temizlenmis = {}
      Object.keys(prev).forEach(id => { if (gecerliIdler.has(id)) temizlenmis[id] = prev[id] })
      return temizlenmis
    })
    setAcikGruplar(prev => {
      const guncellenen = { ...prev }
      sayimKurumlar.forEach(k => { if (!(k.id in guncellenen)) guncellenen[k.id] = false })
      return guncellenen
    })

    return () => unsubs.forEach(u => u())
  }, [sayimKurumlar.map(k => k.id).join(',')]) // eslint-disable-line

  // Sınıf listesi: düzenlemede _kurumId, yeni eklemede modalKurumId
  const sinifKurumId = duzenlenen ? duzenlenen._kurumId : modalKurumId
  useEffect(() => {
    if (!sinifKurumId) { setSiniflar([]); return }
    const q = query(collection(db, 'kurumlar', sinifKurumId, 'siniflar'), orderBy('ad', 'asc'))
    return onSnapshot(q, snap => setSiniflar(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [sinifKurumId])

  function modalAc(ogr = null) {
    setDuzenlenen(ogr)
    setForm(ogr ? {
      ad: ogr.ad, soyad: ogr.soyad || '', ogrenciNo: ogr.ogrenciNo || '',
      sinifId: ogr.sinifId || '', sinifAd: ogr.sinifAd || '',
      cinsiyet: ogr.cinsiyet || '', dogumTarihi: ogr.dogumTarihi || '',
      anneAdSoyad: ogr.anneAdSoyad || '', anneTelefon: ogr.anneTelefon || '',
      babaAdSoyad: ogr.babaAdSoyad || '', babaTelefon: ogr.babaTelefon || '',
      email: ogr.email || '',
    } : BOŞ_FORM)
    setModalKurumId(listKurumId || '')
    setHata('')
    setModal(true)
  }

  function modalKapat() { setModal(false); setDuzenlenen(null); setForm(BOŞ_FORM) }

  function sinifSec(sinifId) {
    const sx = siniflar.find(x => x.id === sinifId)
    setForm(f => ({ ...f, sinifId, sinifAd: sx?.ad || '' }))
  }

  async function kaydet(e) {
    e.preventDefault()
    if (!form.ad.trim()) { setHata('Ad zorunludur.'); return }
    const hedefKurumId = duzenlenen ? duzenlenen._kurumId : modalKurumId
    if (!hedefKurumId) { setHata('Lütfen bir kurum seçin.'); return }
    setKaydediyor(true)
    try {
      if (duzenlenen) {
        await updateDoc(doc(db, 'kurumlar', hedefKurumId, 'ogrenciler', duzenlenen.id), { ad: form.ad, soyad: form.soyad, ogrenciNo: form.ogrenciNo, sinifId: form.sinifId, sinifAd: form.sinifAd, cinsiyet: form.cinsiyet, dogumTarihi: form.dogumTarihi, anneAdSoyad: form.anneAdSoyad, anneTelefon: form.anneTelefon, babaAdSoyad: form.babaAdSoyad, babaTelefon: form.babaTelefon, email: form.email })
      } else {
        await addDoc(collection(db, 'kurumlar', hedefKurumId, 'ogrenciler'), { ...form, olusturmaTarihi: serverTimestamp() })
      }
      modalKapat()
    } catch (err) {
      setHata('Kayıt hatası: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  async function sil(ogr) {
    if (!window.confirm('Bu öğrenciyi silmek istediğinize emin misiniz?')) return
    await deleteDoc(doc(db, 'kurumlar', ogr._kurumId, 'ogrenciler', ogr.id))
  }

  function kurumAdi(k) {
    const u = erisimKurumlar.find(x => x.id === k.parentId)
    return u?.parentId ? `${u.ad} - ${k.ad}` : k.ad
  }

  // Toplam öğrenci sayısı (arama filtreli)
  const toplamOgrenci = sayimKurumlar.reduce((acc, k) => {
    const list = (ogrencilerMap[k.id] || []).filter(o =>
      `${o.ad} ${o.soyad} ${o.ogrenciNo}`.toLowerCase().includes(aramaMetni.toLowerCase())
    )
    return acc + list.length
  }, 0)

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
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Öğrenciler</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Öğrenci kayıt ve yönetimi</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
            placeholder="Ad, soyad veya öğrenci no ara..."
            style={{ padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', width: '280px', color: '#1E293B' }} />
          <span style={{ fontSize: '0.875rem', color: '#64748B' }}>
            {sayimKurumlar.length === 0 ? 'Sol menüden kurum seçin' : `${toplamOgrenci} öğrenci`}
          </span>
        </div>
        {listKurumId && (
          <button onClick={() => modalAc()} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
            + Yeni Öğrenci
          </button>
        )}
      </div>

      {sayimKurumlar.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sayimKurumlar
            .slice()
            .sort((a, b) => {
              const ka = erisimKurumlar.find(x => x.id === a.parentId)
              const kb = erisimKurumlar.find(x => x.id === b.parentId)
              const kampusKarsi = (ka?.ad || '').localeCompare(kb?.ad || '', 'tr')
              if (kampusKarsi !== 0) return kampusKarsi
              return (OKUL_SIRA[a.okulTuru] || 9) - (OKUL_SIRA[b.okulTuru] || 9)
            })
            .map(k => {
              const kampus = erisimKurumlar.find(x => x.id === k.parentId)
              const grupOgrenciler = (ogrencilerMap[k.id] || []).filter(o =>
                `${o.ad} ${o.soyad} ${o.ogrenciNo}`.toLowerCase().includes(aramaMetni.toLowerCase())
              )
              const acik = acikGruplar[k.id] === true

              return (
                <div key={k.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  {/* Grup başlığı */}
                  <div
                    onClick={() => setAcikGruplar(prev => ({ ...prev, [k.id]: !acik }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderBottom: acik ? '1px solid #E2E8F0' : 'none', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{acik ? '▼' : '▶'}</span>
                    {kampus && <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '500' }}>{kampus.ad}</span>}
                    {kampus && <span style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>›</span>}
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1E293B' }}>{k.ad}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: 'auto' }}>{grupOgrenciler.length} öğrenci</span>
                  </div>

                  {/* Öğrenci tablosu */}
                  {acik && (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Ad Soyad', 'TC No', 'Sınıf', 'Anne', 'Baba', 'İşlemler'].map(h => (
                            <th key={h} style={s.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {grupOgrenciler.length === 0 ? (
                          <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '2rem' }}>
                            {aramaMetni ? 'Sonuç bulunamadı' : 'Henüz öğrenci eklenmemiş'}
                          </td></tr>
                        ) : grupOgrenciler.map(o => (
                          <tr key={o.id}>
                            <td style={s.td}><strong>{o.ad} {o.soyad}</strong></td>
                            <td style={s.td}>{o.ogrenciNo || '—'}</td>
                            <td style={s.td}>{o.sinifAd || '—'}</td>
                            <td style={s.td}>{o.anneAdSoyad ? `${o.anneAdSoyad}${o.anneTelefon ? ` · ${o.anneTelefon}` : ''}` : '—'}</td>
                            <td style={s.td}>{o.babaAdSoyad ? `${o.babaAdSoyad}${o.babaTelefon ? ` · ${o.babaTelefon}` : ''}` : '—'}</td>
                            <td style={s.td}>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button style={s.eylem} onClick={() => modalAc(o)}>Düzenle</button>
                                <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => sil(o)}>Sil</button>
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

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && modalKapat()}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '1.5rem' }}>
              {duzenlenen ? 'Öğrenciyi Düzenle' : 'Yeni Öğrenci Ekle'}
            </h2>
            <form onSubmit={kaydet}>
              {!duzenlenen && secilebilir.length > 0 && (
                <div style={s.alan}>
                  <label style={s.etiket}>Kurum *</label>
                  <select style={s.girdi} value={modalKurumId} onChange={e => { setModalKurumId(e.target.value); setForm(f => ({ ...f, sinifId: '', sinifAd: '' })) }}>
                    <option value="">— Seçin —</option>
                    {secilebilir.map(k => (
                      <option key={k.id} value={k.id}>{kurumAdi(k)}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}>
                  <label style={s.etiket}>Ad *</label>
                  <input style={s.girdi} value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} autoFocus />
                </div>
                <div style={s.alan}>
                  <label style={s.etiket}>Soyad</label>
                  <input style={s.girdi} value={form.soyad} onChange={e => setForm(f => ({ ...f, soyad: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}>
                  <label style={s.etiket}>Öğrenci No</label>
                  <input style={s.girdi} value={form.ogrenciNo} onChange={e => setForm(f => ({ ...f, ogrenciNo: e.target.value }))} />
                </div>
                <div style={s.alan}>
                  <label style={s.etiket}>Cinsiyet</label>
                  <select style={s.girdi} value={form.cinsiyet} onChange={e => setForm(f => ({ ...f, cinsiyet: e.target.value }))}>
                    <option value="">Seçin</option>
                    <option value="erkek">Erkek</option>
                    <option value="kız">Kız</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}>
                  <label style={s.etiket}>Sınıf</label>
                  <select style={s.girdi} value={form.sinifId} onChange={e => sinifSec(e.target.value)}>
                    <option value="">Seçin</option>
                    {siniflar.map(sx => <option key={sx.id} value={sx.id}>{sx.ad}</option>)}
                  </select>
                </div>
                <div style={s.alan}>
                  <label style={s.etiket}>Doğum Tarihi</label>
                  <input style={s.girdi} type="date" value={form.dogumTarihi} onChange={e => setForm(f => ({ ...f, dogumTarihi: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}>
                  <label style={s.etiket}>Anne Ad Soyad</label>
                  <input style={s.girdi} value={form.anneAdSoyad} onChange={e => setForm(f => ({ ...f, anneAdSoyad: e.target.value }))} />
                </div>
                <div style={s.alan}>
                  <label style={s.etiket}>Anne Telefon</label>
                  <input style={s.girdi} value={form.anneTelefon} onChange={e => setForm(f => ({ ...f, anneTelefon: e.target.value }))} placeholder="0555 000 00 00" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}>
                  <label style={s.etiket}>Baba Ad Soyad</label>
                  <input style={s.girdi} value={form.babaAdSoyad} onChange={e => setForm(f => ({ ...f, babaAdSoyad: e.target.value }))} />
                </div>
                <div style={s.alan}>
                  <label style={s.etiket}>Baba Telefon</label>
                  <input style={s.girdi} value={form.babaTelefon} onChange={e => setForm(f => ({ ...f, babaTelefon: e.target.value }))} placeholder="0555 000 00 00" />
                </div>
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>Öğrenci E-posta</label>
                <input style={s.girdi} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ali@okul.com" />
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
    </div>
  )
}
