import { useAuth } from '../contexts/AuthContext'
export default function PlatformAdminPage() {
  const { profil, cikisYap } = useAuth()
  return (
    <div style={{ padding:'2rem', fontFamily:'Arial' }}>
      <h2 style={{ color:'#1B3A6B' }}>Platform Admin Paneli</h2>
      <p style={{ color:'#64748B', marginTop:'0.5rem' }}>Hoş geldiniz, {profil?.ad || profil?.email}</p>
      <p style={{ color:'#94A3B8', fontSize:'0.875rem', marginTop:'1rem' }}>Kurum listesi ve onay yönetimi — sonraki adımda eklenecek.</p>
      <button onClick={cikisYap} style={{ marginTop:'1.5rem', padding:'8px 16px', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer' }}>Çıkış Yap</button>
    </div>
  )
}
