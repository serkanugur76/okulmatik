import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

const BOŞ_FORM = { ad: '', seviye: '', sube: '' }

export default function KurumSiniflar() {
  const { secilenKurumId, secilenKurum, erisimKurumlar } = useKurumYonetim()

  // Seçilebilir kurumlar (kampüs + alt kurum)
  const secilebilir = erisimKurumlar.filter(k => k.parentId)

  // Modal için kurum: sidebar'dan seçiliyse onu al, yoksa boş
  const [modalKurumId, setModalKurumId] = useState('')
  const [siniflar, setSiniflar]         = useState([])
  const [form, setForm]                 = useState(BOŞ_FORM)
  const [modal, setModal]               = useState(false)
  const [duzenlenen, setDuzenlenen]     = useState(null)
  const [kaydediyor, setKaydediyor]     = useState(false)
  const [hata, setHata]                 = useState('')

  // Liste: seçili kurum kampüs/altKurum ise onun sınıfları
  const listKurumId = secilenKurum?.parentId ? secilenKurumId : null

  useEffect(() => {
    if (!listKurumId) { setSiniflar([]); return }
    const q = query(collection(db, 'kurumlar', listKurumId, 'siniflar'), orderBy('olusturmaTarihi', 'asc'))
    return onSnapshot(q, snap => setSiniflar(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [listKurumId])

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
    const hedefKurumId = duzenlenen ? listKurumId : modalKurumId
    if (!hedefKurumId) { setHata('Lütfen bir kurum seçin.'); return }
    setKaydediyor(true)
    try {
      if (duzenlenen) {
        await updateDoc(doc(db, 'kurumlar', hedefKurumId, 'siniflar', duzenlenen.id), { ...form })
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

  async function sil(id) {
    if (!window.confirm('Bu sınıfı silmek istediğinize emin misiniz?')) return
    await deleteDoc(doc(db, 'kurumlar', listKurumId, 'siniflar', id))
  }

  function kurumAdi(k) {
    const ust = erisimKurumlar.find(x => x.id === k.parentId)
    return ust?.parentId ? `${ust.ad} - ${k.ad}` : k.ad
  }

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
        <span style={{ fontSize: '0.875rem', color: '#64748B' }}>{listKurumId ? `${siniflar.length} sınıf` : 'Sol menüden kurum seçin'}</span>
        {listKurumId && (
          <button onClick={() => modalAc()} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
            + Yeni Sınıf
          </button>
        )}
      </div>

      {listKurumId && (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Sınıf Adı', 'Seviye', 'Şube', 'İşlemler'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {siniflar.length === 0 ? (
                <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Henüz sınıf eklenmemiş</td></tr>
              ) : siniflar.map(sinif => (
                <tr key={sinif.id}>
                  <td style={s.td}><strong>{sinif.ad}</strong></td>
                  <td style={s.td}>{sinif.seviye || '—'}</td>
                  <td style={s.td}>{sinif.sube || '—'}</td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={s.eylem} onClick={() => modalAc(sinif)}>Düzenle</button>
                      <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => sil(sinif.id)}>Sil</button>
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
                  <input style={s.girdi} value={form.seviye} onChange={e => setForm(f => ({ ...f, seviye: e.target.value }))} placeholder="5" />
                </div>
                <div style={s.alan}>
                  <label style={s.etiket}>Şube</label>
                  <input style={s.girdi} value={form.sube} onChange={e => setForm(f => ({ ...f, sube: e.target.value }))} placeholder="A" />
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
