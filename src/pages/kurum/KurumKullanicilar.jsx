import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, doc, setDoc, updateDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'

const ROL_ETİKET = {
  kurum_admin: { etiket: 'Kurum Admin', renk: '#0369A1', bg: '#E0F2FE' },
  ogretmen:    { etiket: 'Öğretmen',    renk: '#065F46', bg: '#D1FAE5' },
}

const BOŞ_FORM = { ad: '', email: '', rol: 'ogretmen', telefon: '' }

export default function KurumKullanicilar() {
  const { kurumId } = useAuth()
  const [kullanicilar, setKullanicilar] = useState([])
  const [form, setForm]                 = useState(BOŞ_FORM)
  const [modal, setModal]               = useState(false)
  const [duzenlenen, setDuzenlenen]     = useState(null)
  const [kaydediyor, setKaydediyor]     = useState(false)
  const [hata, setHata]                 = useState('')
  const [aramaMetni, setAramaMetni]     = useState('')

  useEffect(() => {
    if (!kurumId) return
    const q = query(collection(db, 'kurumlar', kurumId, 'kullanicilar'), orderBy('ad', 'asc'))
    return onSnapshot(q, snap => {
      setKullanicilar(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [kurumId])

  function modalAc(k = null) {
    setDuzenlenen(k)
    setForm(k ? { ad: k.ad || '', email: k.email, rol: k.rol, telefon: k.telefon || '' } : BOŞ_FORM)
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
        await updateDoc(doc(db, 'kurumlar', kurumId, 'kullanicilar', duzenlenen.id), {
          ad: form.ad, rol: form.rol, telefon: form.telefon,
        })
      } else {
        const id = form.email.replace(/[^a-zA-Z0-9]/g, '_')
        await setDoc(doc(db, 'kurumlar', kurumId, 'kullanicilar', id), {
          ...form, kurumId, durum: 'davet_bekliyor', olusturmaTarihi: serverTimestamp(),
        })
      }
      modalKapat()
    } catch (err) {
      setHata('Kayıt hatası: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  const liste = kullanicilar.filter(k =>
    `${k.ad} ${k.email}`.toLowerCase().includes(aramaMetni.toLowerCase())
  )

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
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Kullanıcılar</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Öğretmen ve yönetici listesi</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <input value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
          placeholder="Ad veya e-posta ara..."
          style={{ padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', width: '260px', color: '#1E293B' }} />
        <button onClick={() => modalAc()} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
          + Kullanıcı Ekle
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Ad', 'E-posta', 'Rol', 'Durum', 'İşlemler'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>
                {aramaMetni ? 'Sonuç bulunamadı' : 'Henüz kullanıcı eklenmemiş'}
              </td></tr>
            ) : liste.map(k => {
              const rolBilgi = ROL_ETİKET[k.rol] || { etiket: k.rol, renk: '#374151', bg: '#F1F5F9' }
              return (
                <tr key={k.id}>
                  <td style={s.td}><strong>{k.ad || '—'}</strong></td>
                  <td style={s.td}>{k.email}</td>
                  <td style={s.td}>
                    <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600', background: rolBilgi.bg, color: rolBilgi.renk }}>
                      {rolBilgi.etiket}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={{ fontSize: '0.75rem', color: k.durum === 'aktif' ? '#065F46' : '#92400E' }}>
                      {k.durum === 'aktif' ? 'Aktif' : 'Davet Bekliyor'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <button style={s.eylem} onClick={() => modalAc(k)}>Düzenle</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && modalKapat()}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '1.5rem' }}>
              {duzenlenen ? 'Kullanıcıyı Düzenle' : 'Kullanıcı Ekle'}
            </h2>
            <form onSubmit={kaydet}>
              <div style={s.alan}>
                <label style={s.etiket}>Ad Soyad *</label>
                <input style={s.girdi} value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} autoFocus />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>E-posta *</label>
                <input style={s.girdi} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!duzenlenen} />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>Telefon</label>
                <input style={s.girdi} value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} placeholder="0555 000 00 00" />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>Rol</label>
                <select style={s.girdi} value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                  <option value="ogretmen">Öğretmen</option>
                  <option value="kurum_admin">Kurum Admin</option>
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
