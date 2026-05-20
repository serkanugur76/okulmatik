import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function GirisPage() {
  const { girisYap, sifreSifirla } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]           = useState('')
  const [sifre, setSifre]           = useState('')
  const [hata, setHata]             = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [sifirMod, setSifirMod]     = useState(false)
  const [mesaj, setMesaj]           = useState('')

  async function handleGiris(e) {
    e.preventDefault()
    setHata('')
    setYukleniyor(true)
    try {
      await girisYap(email, sifre)
      navigate('/')
    } catch (err) {
      setHata(hataMetni(err.code))
    } finally {
      setYukleniyor(false)
    }
  }

  async function handleSifirla(e) {
    e.preventDefault()
    try {
      await sifreSifirla(email)
      setMesaj('Şifre sıfırlama e-postası gönderildi.')
    } catch (err) {
      setHata(hataMetni(err.code))
    }
  }

  function hataMetni(kod) {
    const map = {
      'auth/user-not-found':     'Bu e-posta ile kayıtlı kullanıcı yok.',
      'auth/wrong-password':     'Şifre hatalı.',
      'auth/invalid-credential': 'E-posta veya şifre hatalı.',
      'auth/too-many-requests':  'Çok fazla deneme. Lütfen bekleyin.',
    }
    return map[kod] || 'Giriş başarısız. Lütfen tekrar deneyin.'
  }

  const s = {
    kapsayici: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F1F5F9', padding:'1rem' },
    kart: { background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0', padding:'2.5rem 2rem', width:'100%', maxWidth:'400px', boxShadow:'0 4px 24px rgba(0,0,0,0.06)' },
    logo: { textAlign:'center', marginBottom:'2rem' },
    h1: { fontSize:'1.75rem', fontWeight:'700', color:'#1B3A6B', margin:'0.5rem 0 0.25rem' },
    alt: { fontSize:'0.875rem', color:'#64748B', margin:0 },
    form: { display:'flex', flexDirection:'column', gap:'1rem' },
    alan: { display:'flex', flexDirection:'column', gap:'0.375rem' },
    etiket: { fontSize:'0.875rem', fontWeight:'500', color:'#374151' },
    girdi: { padding:'0.625rem 0.875rem', border:'1.5px solid #E2E8F0', borderRadius:'8px', fontSize:'0.9375rem', color:'#1E293B' },
    buton: { padding:'0.75rem', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:'8px', fontSize:'0.9375rem', fontWeight:'600', cursor:'pointer', marginTop:'0.5rem' },
    link: { background:'none', border:'none', color:'#1B3A6B', fontSize:'0.875rem', cursor:'pointer', textDecoration:'underline', textAlign:'center' },
    hata: { fontSize:'0.875rem', color:'#991B1B', background:'#FEE2E2', borderRadius:'6px', padding:'0.5rem 0.75rem' },
    basari: { fontSize:'0.875rem', color:'#065F46', background:'#D1FAE5', borderRadius:'6px', padding:'0.5rem 0.75rem' },
  }

  return (
    <div style={s.kapsayici}>
      <div style={s.kart}>
        <div style={s.logo}>
          <div style={{ fontSize:'2.5rem' }}>📚</div>
          <h1 style={s.h1}>Okulmatik</h1>
          <p style={s.alt}>Okul ve öğretmen araçları platformu</p>
        </div>
        {!sifirMod ? (
          <form onSubmit={handleGiris} style={s.form}>
            <div style={s.alan}>
              <label style={s.etiket}>E-posta</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={s.girdi} placeholder="ornek@okul.com" required autoFocus />
            </div>
            <div style={s.alan}>
              <label style={s.etiket}>Şifre</label>
              <input type="password" value={sifre} onChange={e=>setSifre(e.target.value)} style={s.girdi} placeholder="••••••••" required />
            </div>
            {hata && <p style={s.hata}>{hata}</p>}
            <button type="submit" style={s.buton} disabled={yukleniyor}>
              {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
            <button type="button" onClick={()=>setSifirMod(true)} style={s.link}>Şifremi unuttum</button>
          </form>
        ) : (
          <form onSubmit={handleSifirla} style={s.form}>
            <p style={{ fontSize:'0.875rem', color:'#64748B' }}>E-postanıza sıfırlama bağlantısı göndereceğiz.</p>
            <div style={s.alan}>
              <label style={s.etiket}>E-posta</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={s.girdi} required autoFocus />
            </div>
            {hata  && <p style={s.hata}>{hata}</p>}
            {mesaj && <p style={s.basari}>{mesaj}</p>}
            <button type="submit" style={s.buton}>Sıfırlama Gönder</button>
            <button type="button" onClick={()=>{setSifirMod(false);setHata('');setMesaj('')}} style={s.link}>← Geri dön</button>
          </form>
        )}
      </div>
    </div>
  )
}
