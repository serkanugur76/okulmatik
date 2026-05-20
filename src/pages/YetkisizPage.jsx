import { useAuth } from '../contexts/AuthContext'
export default function YetkisizPage() {
  const { cikisYap, kullanici } = useAuth()
  return (
    <div style={{ padding:'2rem', fontFamily:'Arial', textAlign:'center' }}>
      <h2 style={{ color:'#991B1B' }}>Erişim Yetkisi Yok</h2>
      <p style={{ color:'#64748B', marginTop:'0.5rem' }}>Bu sayfayı görüntüleme yetkiniz yok.</p>
      {kullanici && <p style={{ color:'#94A3B8', fontSize:'0.875rem', marginTop:'0.25rem' }}>{kullanici.email}</p>}
      <button onClick={cikisYap} style={{ marginTop:'1.5rem', padding:'8px 16px', background:'#991B1B', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer' }}>Çıkış Yap</button>
    </div>
  )
}
