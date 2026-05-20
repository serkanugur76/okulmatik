import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { davetEt, davetIptal } from '../../services/davetEt'
import KurumSecici from '../../components/KurumSecici'

const ROL_ETİKET = {
  platform_admin: { etiket: 'Platform Admin', renk: '#7C3AED', bg: '#EDE9FE' },
  kurum_admin:    { etiket: 'Kurum Admin',    renk: '#0369A1', bg: '#E0F2FE' },
  ogretmen:       { etiket: 'Öğretmen',       renk: '#065F46', bg: '#D1FAE5' },
}

const BOŞ_FORM = { email: '', rol: 'kurum_admin', kurumId: '' }

export default function PlatformKullanicilar() {
  const [kullanicilar, setKullanicilar] = useState([])
  const [bekleyenler, setBekleyenler]   = useState([])
  const [kurumlar, setKurumlar]         = useState([])
  const [filtre, setFiltre]             = useState('')
  const [modal, setModal]               = useState(false)
  const [duzenlenen, setDuzenlenen]     = useState(null)
  const [form, setForm]                 = useState(BOŞ_FORM)
  const [kaydediyor, setKaydediyor]     = useState(false)
  const [hata, setHata]                 = useState('')
  const [basari, setBasari]             = useState('')
  const [sekme, setSekme]               = useState('aktif') // 'aktif' | 'bekleyen'

  useEffect(() => {
    const q1 = query(collection(db, 'kullanicilar'), orderBy('email'))
    const q2 = query(collection(db, 'kurumlar'), orderBy('ad'))
    const q3 = query(collection(db, 'yetkiliKullanicilar'), orderBy('olusturmaTarihi', 'desc'))
    const u1 = onSnapshot(q1, snap => setKullanicilar(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const u2 = onSnapshot(q2, snap => setKurumlar(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const u3 = onSnapshot(q3, snap => setBekleyenler(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    return () => { u1(); u2(); u3() }
  }, [])

  const aktifListe = kullanicilar.filter(k =>
    k.email?.toLowerCase().includes(filtre.toLowerCase()) ||
    k.ad?.toLowerCase().includes(filtre.toLowerCase())
  )

  const bekleyenListe = bekleyenler.filter(k =>
    k.email?.toLowerCase().includes(filtre.toLowerCase())
  )

  function yeniModalAc() {
    setDuzenlenen(null)
    setForm(BOŞ_FORM)
    setHata('')
    setBasari('')
    setModal(true)
  }

  function duzenleModalAc(k) {
    setDuzenlenen(k)
    setForm({ ad: k.ad || '', email: k.email, rol: k.rol || 'ogretmen', kurumId: k.kurumId || '' })
    setHata('')
    setBasari('')
    setModal(true)
  }

  function modalKapat() { setModal(false); setDuzenlenen(null); setForm(BOŞ_FORM) }

  async function kaydet(e) {
    e.preventDefault()
    if (!form.email.trim()) { setHata('E-posta zorunludur.'); return }
    if ((form.rol === 'kurum_admin' || form.rol === 'ogretmen') && !form.kurumId) {
      setHata('Bu rol için kurum seçimi zorunludur.'); return
    }
    setKaydediyor(true)
    setHata('')
    try {
      if (duzenlenen) {
        await updateDoc(doc(db, 'kullanicilar', duzenlenen.id), {
          ad: form.ad, rol: form.rol, kurumId: form.kurumId || null,
        })
        setBasari('Kullanıcı güncellendi.')
        setTimeout(modalKapat, 1200)
      } else {
        const secilenKurum = kurumlar.find(k => k.id === form.kurumId)
        const googleAltyapisi = !!secilenKurum?.googleAltyapisi
        await davetEt({ email: form.email.trim(), rol: form.rol, kurumId: form.kurumId || null, googleAltyapisi })
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
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Kullanıcılar</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Platform genelindeki tüm kullanıcılar</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input value={filtre} onChange={e => setFiltre(e.target.value)}
            placeholder="Ad veya e-posta ile ara..."
            style={{ padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', width: '280px', color: '#1E293B' }} />
          {['aktif', 'bekleyen'].map(s2 => (
            <button key={s2} onClick={() => setSekme(s2)}
              style={{ padding: '0.5rem 1rem', border: '1.5px solid', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                borderColor: sekme === s2 ? '#1B3A6B' : '#E2E8F0',
                background: sekme === s2 ? '#1B3A6B' : '#fff',
                color: sekme === s2 ? '#fff' : '#64748B' }}>
              {s2 === 'aktif' ? `Aktif (${kullanicilar.length})` : `Davet Bekleyen (${bekleyenler.length})`}
            </button>
          ))}
        </div>
        <button onClick={yeniModalAc} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
          + Kullanıcı Davet Et
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {sekme === 'aktif' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Ad', 'E-posta', 'Rol', 'Kurum', 'İşlemler'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {aktifListe.length === 0 ? (
                <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Kullanıcı bulunamadı</td></tr>
              ) : aktifListe.map(k => {
                const rol = ROL_ETİKET[k.rol] || { etiket: k.rol || '—', renk: '#374151', bg: '#F1F5F9' }
                const kurum = kurumlar.find(x => x.id === k.kurumId)
                return (
                  <tr key={k.id}>
                    <td style={s.td}>{k.ad || '—'}</td>
                    <td style={s.td}>{k.email}</td>
                    <td style={s.td}>
                      <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', background: rol.bg, color: rol.renk }}>
                        {rol.etiket}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: kurum ? '#1E293B' : '#94A3B8' }}>
                      {kurum?.ad || (k.kurumId ? k.kurumId : '— Atanmamış')}
                    </td>
                    <td style={s.td}>
                      <button style={s.eylem} onClick={() => duzenleModalAc(k)}>Düzenle</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['E-posta', 'Rol', 'Kurum', 'Giriş Yöntemi', 'İşlemler'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {bekleyenListe.length === 0 ? (
                <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Bekleyen davet yok</td></tr>
              ) : bekleyenListe.map(k => {
                const rol = ROL_ETİKET[k.rol] || { etiket: k.rol || '—', renk: '#374151', bg: '#F1F5F9' }
                const kurum = kurumlar.find(x => x.id === k.kurumId)
                return (
                  <tr key={k.id}>
                    <td style={s.td}>{k.email}</td>
                    <td style={s.td}>
                      <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', background: rol.bg, color: rol.renk }}>
                        {rol.etiket}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: kurum ? '#1E293B' : '#94A3B8' }}>
                      {kurum?.ad || (k.kurumId ? k.kurumId : '— Atanmamış')}
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
                Kullanıcıya e-posta gönderilecek. Kurumun Google altyapısı varsa Google ile, yoksa şifre belirleme linki ile giriş yapacak.
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
                <select style={s.girdi} value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value, kurumId: '' }))}>
                  <option value="platform_admin">Platform Admin</option>
                  <option value="kurum_admin">Kurum Admin</option>
                  <option value="ogretmen">Öğretmen</option>
                </select>
              </div>
              {(form.rol === 'kurum_admin' || form.rol === 'ogretmen') && (
                <div style={s.alan}>
                  <label style={s.etiket}>Kurum *</label>
                  <KurumSecici value={form.kurumId} onChange={v => setForm(f => ({ ...f, kurumId: v }))} kurumlar={kurumlar} style={s.girdi} />
                </div>
              )}
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
