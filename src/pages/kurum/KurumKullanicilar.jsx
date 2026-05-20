import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, doc, updateDoc, getDoc,
  query, orderBy,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { davetEt, davetIptal } from '../../services/davetEt'

const ROL_ETİKET = {
  kurum_admin: { etiket: 'Kurum Admin', renk: '#0369A1', bg: '#E0F2FE' },
  ogretmen:    { etiket: 'Öğretmen',    renk: '#065F46', bg: '#D1FAE5' },
}

const BOŞ_FORM = { email: '', rol: 'ogretmen' }

export default function KurumKullanicilar() {
  const { kurumId } = useAuth()
  const [kullanicilar, setKullanicilar] = useState([])
  const [bekleyenler, setBekleyenler]   = useState([])
  const [googleAltyapisi, setGoogleAltyapisi] = useState(false)
  const [form, setForm]                 = useState(BOŞ_FORM)
  const [modal, setModal]               = useState(false)
  const [duzenlenen, setDuzenlenen]     = useState(null)
  const [kaydediyor, setKaydediyor]     = useState(false)
  const [hata, setHata]                 = useState('')
  const [basari, setBasari]             = useState('')
  const [aramaMetni, setAramaMetni]     = useState('')
  const [sekme, setSekme]               = useState('aktif')

  useEffect(() => {
    if (!kurumId) return
    const q1 = query(collection(db, 'kurumlar', kurumId, 'kullanicilar'), orderBy('ad', 'asc'))
    const q2 = query(collection(db, 'yetkiliKullanicilar'), orderBy('olusturmaTarihi', 'desc'))
    const u1 = onSnapshot(q1, snap => setKullanicilar(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const u2 = onSnapshot(q2, snap => {
      setBekleyenler(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(k => k.kurumId === kurumId))
    })
    getDoc(doc(db, 'kurumlar', kurumId)).then(snap => {
      if (snap.exists()) setGoogleAltyapisi(!!snap.data().googleAltyapisi)
    })
    return () => { u1(); u2() }
  }, [kurumId])

  function modalAc(k = null) {
    setDuzenlenen(k)
    setForm(k ? { ad: k.ad || '', email: k.email, rol: k.rol } : BOŞ_FORM)
    setHata('')
    setBasari('')
    setModal(true)
  }

  function modalKapat() { setModal(false); setDuzenlenen(null); setForm(BOŞ_FORM) }

  async function kaydet(e) {
    e.preventDefault()
    if (!form.email.trim()) { setHata('E-posta zorunludur.'); return }
    setKaydediyor(true)
    setHata('')
    try {
      if (duzenlenen) {
        await updateDoc(doc(db, 'kurumlar', kurumId, 'kullanicilar', duzenlenen.id), {
          ad: form.ad, rol: form.rol,
        })
        setBasari('Kullanıcı güncellendi.')
        setTimeout(modalKapat, 1200)
      } else {
        await davetEt({ email: form.email.trim(), rol: form.rol, kurumId, googleAltyapisi })
        setBasari(`Davet gönderildi: ${form.email}`)
        setTimeout(modalKapat, 1500)
      }
    } catch (err) {
      setHata(err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  async function davetSil(email) {
    if (!confirm(`${email} davetini iptal etmek istediğinize emin misiniz?`)) return
    await davetIptal(email)
  }

  const aktifListe   = kullanicilar.filter(k => `${k.ad} ${k.email}`.toLowerCase().includes(aramaMetni.toLowerCase()))
  const bekleyenListe = bekleyenler.filter(k => k.email.toLowerCase().includes(aramaMetni.toLowerCase()))

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
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>
        Öğretmen ve yönetici listesi
        {googleAltyapisi && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#E8F0FE', color: '#1557B0', padding: '2px 8px', borderRadius: '999px', fontWeight: '600' }}>Google Workspace</span>}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
            placeholder="Ad veya e-posta ara..."
            style={{ padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', width: '260px', color: '#1E293B' }} />
          {['aktif', 'bekleyen'].map(s2 => (
            <button key={s2} onClick={() => setSekme(s2)}
              style={{ padding: '0.5rem 1rem', border: '1.5px solid', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                borderColor: sekme === s2 ? '#1B3A6B' : '#E2E8F0',
                background: sekme === s2 ? '#1B3A6B' : '#fff',
                color: sekme === s2 ? '#fff' : '#64748B' }}>
              {s2 === 'aktif' ? `Aktif (${kullanicilar.length})` : `Bekleyen (${bekleyenler.length})`}
            </button>
          ))}
        </div>
        <button onClick={() => modalAc()} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
          + Kullanıcı Davet Et
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {sekme === 'aktif' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Ad', 'E-posta', 'Rol', 'Durum', 'İşlemler'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {aktifListe.length === 0 ? (
                <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>
                  {aramaMetni ? 'Sonuç bulunamadı' : 'Henüz kullanıcı eklenmemiş'}
                </td></tr>
              ) : aktifListe.map(k => {
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
                        {k.durum === 'aktif' ? 'Aktif' : '—'}
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
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['E-posta', 'Rol', 'Giriş Yöntemi', 'İşlemler'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {bekleyenListe.length === 0 ? (
                <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Bekleyen davet yok</td></tr>
              ) : bekleyenListe.map(k => {
                const rolBilgi = ROL_ETİKET[k.rol] || { etiket: k.rol, renk: '#374151', bg: '#F1F5F9' }
                return (
                  <tr key={k.id}>
                    <td style={s.td}>{k.email}</td>
                    <td style={s.td}>
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600', background: rolBilgi.bg, color: rolBilgi.renk }}>
                        {rolBilgi.etiket}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontSize: '0.75rem', color: k.googleAltyapisi ? '#1557B0' : '#374151' }}>
                        {k.googleAltyapisi ? 'Google' : 'E-posta / Şifre'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => davetSil(k.email)}>
                        İptal Et
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && modalKapat()}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.5rem' }}>
              {duzenlenen ? 'Kullanıcıyı Düzenle' : 'Kullanıcı Davet Et'}
            </h2>
            {!duzenlenen && (
              <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1.25rem' }}>
                {googleAltyapisi
                  ? 'Kullanıcı Google hesabıyla giriş yapacak.'
                  : 'Kullanıcıya şifre belirleme e-postası gönderilecek.'}
              </p>
            )}
            <form onSubmit={kaydet}>
              {duzenlenen && (
                <div style={s.alan}>
                  <label style={s.etiket}>Ad Soyad</label>
                  <input style={s.girdi} value={form.ad || ''} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} autoFocus />
                </div>
              )}
              <div style={s.alan}>
                <label style={s.etiket}>E-posta *</label>
                <input style={s.girdi} type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  disabled={!!duzenlenen} autoFocus={!duzenlenen} />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>Rol</label>
                <select style={s.girdi} value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                  <option value="ogretmen">Öğretmen</option>
                  <option value="kurum_admin">Kurum Admin</option>
                </select>
              </div>
              {basari && <p style={{ fontSize: '0.875rem', color: '#065F46', background: '#D1FAE5', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>{basari}</p>}
              {hata && <p style={{ fontSize: '0.875rem', color: '#991B1B', background: '#FEE2E2', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>{hata}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={modalKapat} style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>İptal</button>
                <button type="submit" disabled={kaydediyor} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                  {kaydediyor ? 'Gönderiliyor...' : duzenlenen ? 'Kaydet' : 'Davet Gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
