import { useEffect, useState, useMemo } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

const VARSAYILAN_SEVİYELER = [
  { ad: 'Başlangıç', puan: 1, aciklama: '' },
  { ad: 'Gelişiyor', puan: 2, aciklama: '' },
  { ad: 'İyi',       puan: 3, aciklama: '' },
  { ad: 'Mükemmel',  puan: 4, aciklama: '' },
]

function yeniKriter() {
  return { id: 'k' + Date.now() + Math.random().toString(36).slice(2), ad: '', seviyeler: VARSAYILAN_SEVİYELER.map(s => ({ ...s })) }
}

const BOŞ_FORM = { ad: '', aciklama: '', kriterler: [] }

export default function KurumRubrikler() {
  const { secilenKurumId, secilenKurum, erisimKurumlar } = useKurumYonetim()

  const ust = erisimKurumlar.find(k => k.id === secilenKurum?.parentId)
  const seviye = !secilenKurum?.parentId ? 'root' : !ust?.parentId ? 'kampus' : 'altKurum'

  // Hangi alt kurumun rubriklerini yönetiyoruz?
  const hedefKurumId = seviye === 'altKurum' ? secilenKurumId : null

  const [rubrikler, setRubrikler]         = useState([])
  const [sablonlar, setSablonlar]         = useState([])  // platform şablonları
  const [modal, setModal]                 = useState(false)
  const [duzenlenen, setDuzenlenen]       = useState(null)
  const [form, setForm]                   = useState(BOŞ_FORM)
  const [acikKriterler, setAcikKriterler] = useState({})
  const [onizleme, setOnizleme]           = useState(null)
  const [sablonSecici, setSablonSecici]   = useState(false)  // şablon seçici modal
  const [kaydediyor, setKaydediyor]       = useState(false)
  const [hata, setHata]                   = useState('')

  // Platform şablonları
  useEffect(() => {
    const q = query(collection(db, 'rubrikSablonlar'), orderBy('olusturmaTarihi', 'desc'))
    return onSnapshot(q, snap => setSablonlar(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  // Kurum rubrikleri
  useEffect(() => {
    if (!hedefKurumId) { setRubrikler([]); return }
    const q = query(collection(db, 'kurumlar', hedefKurumId, 'rubrikler'), orderBy('olusturmaTarihi', 'desc'))
    return onSnapshot(q, snap => setRubrikler(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [hedefKurumId])

  // ── Modal ────────────────────────────────────────────────
  function modalAc(rubrik = null) {
    setDuzenlenen(rubrik)
    if (rubrik) {
      setForm({ ad: rubrik.ad, aciklama: rubrik.aciklama || '', kriterler: rubrik.kriterler.map(k => ({ ...k, seviyeler: k.seviyeler.map(s => ({ ...s })) })) })
      const a = {}; rubrik.kriterler.forEach(k => { a[k.id] = false }); setAcikKriterler(a)
    } else {
      const ilk = yeniKriter()
      setForm({ ...BOŞ_FORM, kriterler: [ilk] })
      setAcikKriterler({ [ilk.id]: true })
    }
    setHata(''); setModal(true)
  }
  function modalKapat() { setModal(false); setDuzenlenen(null) }

  // Şablondan kopyala
  function sablondanKopyala(sablon) {
    const kriterler = sablon.kriterler.map(k => ({
      ...k,
      id: 'k' + Date.now() + Math.random().toString(36).slice(2),
      seviyeler: k.seviyeler.map(s => ({ ...s })),
    }))
    setForm({ ad: sablon.ad, aciklama: sablon.aciklama || '', kriterler })
    const a = {}; kriterler.forEach(k => { a[k.id] = false }); setAcikKriterler(a)
    setSablonSecici(false); setModal(true)
  }

  // ── Kriter yönetimi ──────────────────────────────────────
  function kriterEkle() {
    const k = yeniKriter()
    setForm(f => ({ ...f, kriterler: [...f.kriterler, k] }))
    setAcikKriterler(a => ({ ...a, [k.id]: true }))
  }
  function kriterSil(id) { setForm(f => ({ ...f, kriterler: f.kriterler.filter(k => k.id !== id) })) }
  function kriterAdGuncelle(id, val) { setForm(f => ({ ...f, kriterler: f.kriterler.map(k => k.id === id ? { ...k, ad: val } : k) })) }
  function kriterToggle(id) { setAcikKriterler(a => ({ ...a, [id]: !a[id] })) }

  // ── Seviye yönetimi ──────────────────────────────────────
  function seviyeGuncelle(kId, idx, alan, val) {
    setForm(f => ({
      ...f,
      kriterler: f.kriterler.map(k => {
        if (k.id !== kId) return k
        const seviyeler = k.seviyeler.map((s, i) => i === idx ? { ...s, [alan]: alan === 'puan' ? Number(val) : val } : s)
        return { ...k, seviyeler }
      }),
    }))
  }
  function seviyeEkle(kId) {
    setForm(f => ({
      ...f,
      kriterler: f.kriterler.map(k => {
        if (k.id !== kId) return k
        const maxP = Math.max(...k.seviyeler.map(s => s.puan || 0), 0)
        return { ...k, seviyeler: [...k.seviyeler, { ad: '', puan: maxP + 1, aciklama: '' }] }
      }),
    }))
  }
  function seviyeSil(kId, idx) {
    setForm(f => ({
      ...f,
      kriterler: f.kriterler.map(k => {
        if (k.id !== kId) return k
        return { ...k, seviyeler: k.seviyeler.filter((_, i) => i !== idx) }
      }),
    }))
  }

  // ── Kaydet ───────────────────────────────────────────────
  async function kaydet(e) {
    e.preventDefault()
    if (!hedefKurumId) { setHata('Lütfen bir alt kurum seçin.'); return }
    if (!form.ad.trim()) { setHata('Rubrik adı zorunludur.'); return }
    if (form.kriterler.length === 0) { setHata('En az bir kriter ekleyin.'); return }
    for (const k of form.kriterler) {
      if (!k.ad.trim()) { setHata('Tüm kriterlere ad verilmelidir.'); return }
      if (k.seviyeler.length < 2) { setHata(`"${k.ad || 'Kriter'}" için en az 2 seviye gerekli.`); return }
    }
    setKaydediyor(true)
    try {
      const veri = { ad: form.ad.trim(), aciklama: form.aciklama.trim(), kriterler: form.kriterler }
      if (duzenlenen) {
        await updateDoc(doc(db, 'kurumlar', hedefKurumId, 'rubrikler', duzenlenen.id), veri)
      } else {
        await addDoc(collection(db, 'kurumlar', hedefKurumId, 'rubrikler'), { ...veri, olusturmaTarihi: serverTimestamp() })
      }
      modalKapat()
    } catch (err) { setHata('Kayıt hatası: ' + err.message) }
    finally { setKaydediyor(false) }
  }

  async function sil(rubrik) {
    if (!window.confirm(`"${rubrik.ad}" rubriğini silmek istediğinize emin misiniz?`)) return
    await deleteDoc(doc(db, 'kurumlar', hedefKurumId, 'rubrikler', rubrik.id))
  }

  const maxPuan = (kriterler) => kriterler.reduce((t, k) => t + Math.max(...k.seviyeler.map(s => s.puan || 0), 0), 0)

  const s = {
    th:     { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    td:     { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    eylem:  { background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 9px', fontSize: '0.75rem', cursor: 'pointer', color: '#374151' },
    alan:   { display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' },
    etiket: { fontSize: '0.875rem', fontWeight: '500', color: '#374151' },
    girdi:  { padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', color: '#1E293B', width: '100%', boxSizing: 'border-box' },
  }

  if (!hedefKurumId) {
    return (
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Rubrikler</h1>
        <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Değerlendirme rubriklerini yönetin</p>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
          Rubrik yönetimi için sol menüden bir alt kurum seçin
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Rubrikler</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>
        <strong>{secilenKurum?.ad}</strong> — değerlendirme rubrikleri
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#64748B' }}>{rubrikler.length} rubrik</span>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          {sablonlar.length > 0 && (
            <button onClick={() => setSablonSecici(true)}
              style={{ padding: '0.6rem 1.25rem', background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
              📋 Şablondan Ekle
            </button>
          )}
          <button onClick={() => modalAc()}
            style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
            + Sıfırdan Oluştur
          </button>
        </div>
      </div>

      {/* Rubrik listesi */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Rubrik Adı', 'Kriter', 'Maks. Puan', 'İşlemler'].map(h => <th key={h} style={s.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rubrikler.length === 0 ? (
              <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Henüz rubrik eklenmemiş</td></tr>
            ) : rubrikler.map(r => (
              <tr key={r.id}>
                <td style={s.td}>
                  <div style={{ fontWeight: '600', color: '#1E293B' }}>{r.ad}</div>
                  {r.aciklama && <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>{r.aciklama}</div>}
                </td>
                <td style={s.td}>
                  <span style={{ background: '#EEF2FF', color: '#4338CA', padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600' }}>
                    {r.kriterler?.length || 0} kriter
                  </span>
                </td>
                <td style={s.td}>
                  <span style={{ fontWeight: '700', color: '#1B3A6B' }}>{maxPuan(r.kriterler || [])}</span>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}> puan</span>
                </td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <button style={s.eylem} onClick={() => setOnizleme(r)}>Önizle</button>
                    <button style={s.eylem} onClick={() => modalAc(r)}>Düzenle</button>
                    <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => sil(r)}>Sil</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Şablon Seçici Modal ── */}
      {sablonSecici && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
          onClick={e => e.target === e.currentTarget && setSablonSecici(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#1E293B' }}>📋 Şablon Seç</h2>
              <button onClick={() => setSablonSecici(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#94A3B8' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {sablonlar.map(s => (
                <div key={s.id}
                  onClick={() => sablondanKopyala(s)}
                  style={{ border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '0.875rem 1rem', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#818CF8'; e.currentTarget.style.background = '#F5F3FF' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#fff' }}>
                  <div style={{ fontWeight: '600', color: '#1E293B', marginBottom: '2px' }}>{s.ad}</div>
                  {s.aciklama && <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{s.aciklama}</div>}
                  <div style={{ marginTop: '0.375rem', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', background: '#EEF2FF', color: '#4338CA', padding: '1px 7px', borderRadius: '999px', fontWeight: '600' }}>{s.kriterler?.length} kriter</span>
                    <span style={{ fontSize: '0.7rem', background: '#F0FDF4', color: '#065F46', padding: '1px 7px', borderRadius: '999px', fontWeight: '600' }}>maks {maxPuan(s.kriterler || [])} puan</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Oluştur / Düzenle Modal ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, overflowY: 'auto', padding: '2rem 1rem' }}
          onClick={e => e.target === e.currentTarget && modalKapat()}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '720px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ padding: '1.5rem 1.75rem 0' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>
                {duzenlenen ? 'Rubriği Düzenle' : 'Yeni Rubrik'}
              </h2>
              <p style={{ fontSize: '0.825rem', color: '#94A3B8', marginBottom: '1.25rem' }}>Kriterleri ve değerlendirme seviyelerini belirleyin</p>
            </div>
            <form onSubmit={kaydet}>
              <div style={{ padding: '0 1.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={s.alan}>
                    <label style={s.etiket}>Rubrik Adı *</label>
                    <input style={s.girdi} value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} placeholder="Yazılı Anlatım Rubriği" autoFocus />
                  </div>
                  <div style={s.alan}>
                    <label style={s.etiket}>Açıklama</label>
                    <input style={s.girdi} value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} placeholder="Kısa açıklama (isteğe bağlı)" />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1.25rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Kriterler <span style={{ fontWeight: '400', color: '#94A3B8' }}>({form.kriterler.length})</span></span>
                    <button type="button" onClick={kriterEkle}
                      style={{ padding: '4px 12px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', color: '#4338CA', cursor: 'pointer' }}>+ Kriter Ekle</button>
                  </div>
                  {form.kriterler.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', background: '#F8FAFC', borderRadius: '8px', color: '#94A3B8', fontSize: '0.875rem' }}>
                      Henüz kriter eklenmedi.
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {form.kriterler.map((kriter, ki) => {
                      const acik = acikKriterler[kriter.id]
                      const kriterMax = kriter.seviyeler.length > 0 ? Math.max(...kriter.seviyeler.map(s => s.puan || 0)) : 0
                      return (
                        <div key={kriter.id} style={{ border: '1.5px solid ' + (acik ? '#C7D2FE' : '#E2E8F0'), borderRadius: '10px', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.875rem', background: acik ? '#F5F3FF' : '#F8FAFC', cursor: 'pointer' }}
                            onClick={() => kriterToggle(kriter.id)}>
                            <span style={{ fontSize: '0.7rem', color: '#94A3B8', flexShrink: 0 }}>{acik ? '▼' : '▶'}</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', flexShrink: 0, minWidth: '24px' }}>{ki + 1}.</span>
                            <input value={kriter.ad} onChange={e => { e.stopPropagation(); kriterAdGuncelle(kriter.id, e.target.value) }} onClick={e => e.stopPropagation()}
                              placeholder="Kriter adı" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.875rem', fontWeight: '600', color: '#1E293B', outline: 'none' }} />
                            <span style={{ fontSize: '0.7rem', color: '#94A3B8', flexShrink: 0 }}>{kriter.seviyeler.length} seviye · maks {kriterMax} puan</span>
                            <button type="button" onClick={e => { e.stopPropagation(); kriterSil(kriter.id) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '0.9rem', padding: '0 2px', flexShrink: 0 }}>✕</button>
                          </div>
                          {acik && (
                            <div style={{ padding: '0.75rem 0.875rem', background: '#fff' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
                                {kriter.seviyeler.map((seviye, si) => (
                                  <div key={si} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.625rem', background: '#FAFAFA', position: 'relative' }}>
                                    <button type="button" onClick={() => seviyeSil(kriter.id, si)} disabled={kriter.seviyeler.length <= 2}
                                      style={{ position: 'absolute', top: '4px', right: '4px', background: 'none', border: 'none', cursor: kriter.seviyeler.length <= 2 ? 'not-allowed' : 'pointer', color: '#CBD5E1', fontSize: '0.7rem', padding: 0 }}>✕</button>
                                    <input value={seviye.ad} onChange={e => seviyeGuncelle(kriter.id, si, 'ad', e.target.value)} placeholder="Seviye adı"
                                      style={{ width: '100%', border: 'none', borderBottom: '1px solid #E2E8F0', background: 'transparent', fontSize: '0.8rem', fontWeight: '600', color: '#1E293B', outline: 'none', paddingBottom: '2px', boxSizing: 'border-box', marginBottom: '0.375rem' }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.375rem' }}>
                                      <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Puan:</span>
                                      <input type="number" min="0" max="100" value={seviye.puan} onChange={e => seviyeGuncelle(kriter.id, si, 'puan', e.target.value)}
                                        style={{ width: '48px', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '2px 6px', fontSize: '0.8rem', textAlign: 'center' }} />
                                    </div>
                                    <textarea value={seviye.aciklama} onChange={e => seviyeGuncelle(kriter.id, si, 'aciklama', e.target.value)} placeholder="Açıklama" rows={2}
                                      style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '4px 6px', fontSize: '0.75rem', color: '#64748B', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                                  </div>
                                ))}
                                <div onClick={() => seviyeEkle(kriter.id)}
                                  style={{ border: '1.5px dashed #E2E8F0', borderRadius: '8px', padding: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94A3B8', fontSize: '0.8rem', minHeight: '80px' }}>
                                  + Seviye
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              {hata && <div style={{ margin: '0 1.75rem 1rem', fontSize: '0.875rem', color: '#991B1B', background: '#FEE2E2', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>{hata}</div>}
              <div style={{ padding: '1rem 1.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{form.kriterler.length} kriter · toplam maks {maxPuan(form.kriterler)} puan</span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" onClick={modalKapat} style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>İptal</button>
                  <button type="submit" disabled={kaydediyor} style={{ padding: '0.6rem 1.5rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                    {kaydediyor ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Önizleme Modal ── */}
      {onizleme && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, overflowY: 'auto', padding: '2rem 1rem' }}
          onClick={e => e.target === e.currentTarget && setOnizleme(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '800px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B' }}>{onizleme.ad}</h2>
                {onizleme.aciklama && <p style={{ fontSize: '0.825rem', color: '#64748B', marginTop: '2px' }}>{onizleme.aciklama}</p>}
              </div>
              <button onClick={() => setOnizleme(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#94A3B8' }}>✕</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', color: '#64748B', fontWeight: '600', borderBottom: '2px solid #E2E8F0', minWidth: '140px' }}>Kriter</th>
                    {onizleme.kriterler[0]?.seviyeler.map((s, i) => (
                      <th key={i} style={{ padding: '0.625rem 0.875rem', textAlign: 'center', color: '#64748B', fontWeight: '600', borderBottom: '2px solid #E2E8F0' }}>
                        {s.ad || `Seviye ${i + 1}`}
                        <div style={{ fontWeight: '400', fontSize: '0.7rem', color: '#94A3B8' }}>{s.puan} puan</div>
                      </th>
                    ))}
                    <th style={{ padding: '0.625rem 0.875rem', textAlign: 'center', color: '#64748B', fontWeight: '600', borderBottom: '2px solid #E2E8F0' }}>Maks.</th>
                  </tr>
                </thead>
                <tbody>
                  {onizleme.kriterler.map((k, ki) => (
                    <tr key={k.id} style={{ background: ki % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ padding: '0.75rem 0.875rem', fontWeight: '600', color: '#1E293B', borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' }}>{k.ad}</td>
                      {k.seviyeler.map((sv, si) => (
                        <td key={si} style={{ padding: '0.75rem 0.875rem', color: '#64748B', borderBottom: '1px solid #F1F5F9', verticalAlign: 'top', textAlign: 'center', maxWidth: '160px' }}>
                          {sv.aciklama || <span style={{ color: '#CBD5E1' }}>—</span>}
                        </td>
                      ))}
                      <td style={{ padding: '0.75rem 0.875rem', fontWeight: '700', color: '#1B3A6B', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>
                        {Math.max(...k.seviyeler.map(s => s.puan || 0))}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#F8FAFC' }}>
                    <td colSpan={1 + (onizleme.kriterler[0]?.seviyeler.length || 0)} style={{ padding: '0.625rem 0.875rem', fontWeight: '600', color: '#64748B', textAlign: 'right', fontSize: '0.8rem' }}>Toplam Maksimum:</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontWeight: '800', color: '#1B3A6B', textAlign: 'center' }}>{maxPuan(onizleme.kriterler)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
