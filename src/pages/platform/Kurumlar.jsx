import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../../services/firebase'

const BOŞ_FORM = { ad: '', email: '', telefon: '', adres: '', durum: 'aktif' }

export default function Kurumlar() {
  const [kurumlar, setKurumlar]   = useState([])
  const [form, setForm]           = useState(BOŞ_FORM)
  const [modal, setModal]         = useState(false)
  const [duzenlenen, setDuzenlenen] = useState(null)
  const [kaydediyor, setKaydediyor] = useState(false)
  const [hata, setHata]           = useState('')

  useEffect(() => {
    const q = query(collection(db, 'kurumlar'), orderBy('olusturmaTarihi', 'desc'))
    return onSnapshot(q, snap => {
      setKurumlar(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  function modalAc(kurum = null) {
    setDuzenlenen(kurum)
    setForm(kurum ? {
      ad: kurum.ad, email: kurum.email, telefon: kurum.telefon || '',
      adres: kurum.adres || '', durum: kurum.durum,
    } : BOŞ_FORM)
    setHata('')
    setModal(true)
  }

  function modalKapat() { setModal(false); setDuzenlenen(null); setForm(BOŞ_FORM) }

  async function kaydet(e) {
    e.preventDefault()
    if (!form.ad.trim() || !form.email.trim()) { setHata('Ad ve e-posta zorunludur.'); return }
    setKaydediyor(true)
    try {
      if (duzenlenen) {
        await updateDoc(doc(db, 'kurumlar', duzenlenen.id), { ...form })
      } else {
        await addDoc(collection(db, 'kurumlar'), { ...form, olusturmaTarihi: serverTimestamp() })
      }
      modalKapat()
    } catch (err) {
      setHata('Kayıt hatası: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  async function durumDegistir(kurum) {
    const yeniDurum = kurum.durum === 'aktif' ? 'pasif' : 'aktif'
    await updateDoc(doc(db, 'kurumlar', kurum.id), { durum: yeniDurum })
  }

  const s = {
    baslik: { fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' },
    altBaslik: { color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' },
    toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' },
    ekleBtn: { padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' },
    tablo: { background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' },
    th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    td: { padding: '1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    durum: (d) => ({ display: 'inline-flex', padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', background: d === 'aktif' ? '#D1FAE5' : '#FEE2E2', color: d === 'aktif' ? '#065F46' : '#991B1B' }),
    eylem: { background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', color: '#374151' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modalKart: { background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
    alan: { display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' },
    etiket: { fontSize: '0.875rem', fontWeight: '500', color: '#374151' },
    girdi: { padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', color: '#1E293B' },
  }

  return (
    <div>
      <h1 style={s.baslik}>Kurumlar</h1>
      <p style={s.altBaslik}>Platforma kayıtlı tüm kurumlar</p>

      <div style={s.toolbar}>
        <span style={{ fontSize: '0.875rem', color: '#64748B' }}>{kurumlar.length} kurum</span>
        <button style={s.ekleBtn} onClick={() => modalAc()}>+ Yeni Kurum</button>
      </div>

      <div style={s.tablo}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Kurum Adı', 'E-posta', 'Telefon', 'Durum', 'İşlemler'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kurumlar.length === 0 ? (
              <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Henüz kurum eklenmemiş</td></tr>
            ) : kurumlar.map(k => (
              <tr key={k.id}>
                <td style={s.td}><strong>{k.ad}</strong></td>
                <td style={s.td}>{k.email}</td>
                <td style={s.td}>{k.telefon || '—'}</td>
                <td style={s.td}><span style={s.durum(k.durum)}>{k.durum}</span></td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={s.eylem} onClick={() => modalAc(k)}>Düzenle</button>
                    <button style={{ ...s.eylem, color: k.durum === 'aktif' ? '#991B1B' : '#065F46' }} onClick={() => durumDegistir(k)}>
                      {k.durum === 'aktif' ? 'Pasif Yap' : 'Aktif Yap'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && modalKapat()}>
          <div style={s.modalKart}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '1.5rem' }}>
              {duzenlenen ? 'Kurumu Düzenle' : 'Yeni Kurum Ekle'}
            </h2>
            <form onSubmit={kaydet}>
              <div style={s.alan}>
                <label style={s.etiket}>Kurum Adı *</label>
                <input style={s.girdi} value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} placeholder="Örnek İlkokulu" autoFocus />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>E-posta *</label>
                <input style={s.girdi} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="okul@example.com" />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>Telefon</label>
                <input style={s.girdi} value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} placeholder="0212 000 00 00" />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>Adres</label>
                <textarea style={{ ...s.girdi, resize: 'vertical', minHeight: '70px' }} value={form.adres} onChange={e => setForm(f => ({ ...f, adres: e.target.value }))} placeholder="Kurum adresi..." />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>Durum</label>
                <select style={s.girdi} value={form.durum} onChange={e => setForm(f => ({ ...f, durum: e.target.value }))}>
                  <option value="aktif">Aktif</option>
                  <option value="pasif">Pasif</option>
                </select>
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
