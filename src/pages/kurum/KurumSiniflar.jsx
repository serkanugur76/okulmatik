import { useEffect, useState, useMemo } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

const BOŞ_FORM = { ad: '', seviye: '', sube: '' }

export default function KurumSiniflar() {
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

  // listKurumId: sadece altKurum seçiliyse (yeni sınıf butonu + sil/düzenle için)
  const listKurumId = seviye === 'altKurum' ? secilenKurumId : null

  // Modal için seçilebilir kurumlar (sadece altKurum'lar)
  const secilebilir = erisimKurumlar.filter(k => {
    if (!k.parentId) return false
    const u = erisimKurumlar.find(x => x.id === k.parentId)
    return !!u?.parentId
  })

  const [siniflarMap, setSiniflarMap] = useState({}) // { kurumId: sinif[] }
  const [modalKurumId, setModalKurumId] = useState('')
  const [form, setForm]                 = useState(BOŞ_FORM)
  const [modal, setModal]               = useState(false)
  const [duzenlenen, setDuzenlenen]     = useState(null)
  const [kaydediyor, setKaydediyor]     = useState(false)
  const [hata, setHata]                 = useState('')

  // Tüm ilgili kurumların sınıflarına abone ol
  useEffect(() => {
    if (sayimKurumlar.length === 0) { setSiniflarMap({}); return }

    const unsubs = sayimKurumlar.map(k => {
      const kampus = erisimKurumlar.find(x => x.id === k.parentId)
      const tamAd = kampus ? `${kampus.ad} · ${k.ad}` : k.ad
      const q = query(collection(db, 'kurumlar', k.id, 'siniflar'), orderBy('olusturmaTarihi', 'asc'))
      return onSnapshot(q, snap => {
        setSiniflarMap(prev => ({
          ...prev,
          [k.id]: snap.docs.map(d => ({ id: d.id, _kurumId: k.id, _kurumAd: tamAd, ...d.data() })),
        }))
      })
    })

    // Kaldırılan kurum varsa temizle
    setSiniflarMap(prev => {
      const gecerliIdler = new Set(sayimKurumlar.map(k => k.id))
      const temizlenmis = {}
      Object.keys(prev).forEach(id => { if (gecerliIdler.has(id)) temizlenmis[id] = prev[id] })
      return temizlenmis
    })

    return () => unsubs.forEach(u => u())
  }, [sayimKurumlar.map(k => k.id).join(',')]) // eslint-disable-line

  // Düz liste (kurum adı ile)
  const siniflar = sayimKurumlar.flatMap(k => siniflarMap[k.id] || [])

  function modalAc(sinif = null) {
    setDuzenlenen(sinif)
    setForm(sinif ? { ad: sinif.ad, seviye: sinif.seviye || '', sube: sinif.sube || '' } : BOŞ_FORM)
    setModalKurumId(listKurumId || '')
    setHata('')
    setModal(true)
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
      } else {
        await addDoc(collection(db, 'kurumlar', hedefKurumId, 'siniflar'), { ...form, olusturmaTarihi: serverTimestamp() })
      }
      modalKapat()
    } catch (err) {
      setHata('Kayıt hatası: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  async function sil(sinif) {
    if (!window.confirm('Bu sınıfı silmek istediğinize emin misiniz?')) return
    await deleteDoc(doc(db, 'kurumlar', sinif._kurumId, 'siniflar', sinif.id))
  }

  function seviyeSecenekleri(kurumId) {
    const kurum = erisimKurumlar.find(k => k.id === kurumId)
    switch (kurum?.okulTuru) {
      case 'ilkokul':  return Array.from({ length: 4 },  (_, i) => i + 1)
      case 'ortaokul': return Array.from({ length: 4 },  (_, i) => i + 5)
      case 'lise':     return Array.from({ length: 4 },  (_, i) => i + 9)
      default:         return Array.from({ length: 12 }, (_, i) => i + 1)
    }
  }

  function kurumAdi(k) {
    const u = erisimKurumlar.find(x => x.id === k.parentId)
    return u?.parentId ? `${u.ad} - ${k.ad}` : k.ad
  }

  const cokluKurum = sayimKurumlar.length > 1

  const s = {
    th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    td: { padding: '1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    eylem: { background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 9px', fontSize: '0.75rem', cursor: 'pointer', color: '#374151' },
    alan: { display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' },
    etiket: { fontSize: '0.875rem', fontWeight: '500', color: '#374151' },
    girdi: { padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', color: '#1E293B' },
  }

  const baslik = seviye === 'root' ? 'Tüm sınıflar'
    : seviye === 'kampus' ? `${secilenKurum?.ad} — sınıflar`
    : `${secilenKurum?.ad} — sınıflar`

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Sınıflar</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Sınıf ve şube yönetimi</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#64748B' }}>
          {sayimKurumlar.length === 0 ? 'Sol menüden kurum seçin' : `${siniflar.length} sınıf${cokluKurum ? ` · ${baslik}` : ''}`}
        </span>
        {listKurumId && (
          <button onClick={() => modalAc()} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
            + Yeni Sınıf
          </button>
        )}
      </div>

      {sayimKurumlar.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {cokluKurum && <th style={s.th}>Kurum</th>}
                {['Sınıf Adı', 'Seviye', 'Şube', 'İşlemler'].map(h => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {siniflar.length === 0 ? (
                <tr><td colSpan={cokluKurum ? 5 : 4} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>
                  Henüz sınıf eklenmemiş
                </td></tr>
              ) : siniflar.map(sinif => (
                <tr key={`${sinif._kurumId}-${sinif.id}`}>
                  {cokluKurum && (
                    <td style={{ ...s.td, color: '#64748B', fontSize: '0.8rem' }}>{sinif._kurumAd}</td>
                  )}
                  <td style={s.td}><strong>{sinif.ad}</strong></td>
                  <td style={s.td}>{sinif.seviye || '—'}</td>
                  <td style={s.td}>{sinif.sube || '—'}</td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={s.eylem} onClick={() => modalAc(sinif)}>Düzenle</button>
                      <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => sil(sinif)}>Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                    {secilebilir.map(k => (
                      <option key={k.id} value={k.id}>{kurumAdi(k)}</option>
                    ))}
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
    </div>
  )
}
