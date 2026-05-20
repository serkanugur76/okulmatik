import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function GirisPage() {
  const { girisYap, googleGiris, sifreSifirla } = useAuth()
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

  async function handleGoogleGiris() {
    setHata('')
    setYukleniyor(true)
    try {
      await googleGiris()
      navigate('/')
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setHata(hataMetni(err.code))
    } finally {
      setYukleniyor(false)
    }
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
    ayrac: { display:'flex', alignItems:'center', gap:'0.75rem', color:'#94A3B8', fontSize:'0.8rem' },
    cizgi: { flex:1, height:'1px', background:'#E2E8F0' },
    googleButon: { display:'flex', alignItems:'center', justifyContent:'center', gap:'0.625rem', padding:'0.75rem', background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:'8px', fontSize:'0.9375rem', fontWeight:'500', cursor:'pointer', color:'#374151' },
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
            <div style={s.ayrac}><span style={s.cizgi}/><span>veya</span><span style={s.cizgi}/></div>
            <button type="button" onClick={handleGoogleGiris} disabled={yukleniyor} style={s.googleButon}>
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A353" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
              Google ile Giriş Yap
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
