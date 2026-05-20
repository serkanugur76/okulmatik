import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const menuler = [
  { yol: '/platform',          etiket: 'Dashboard',  ikon: '📊' },
  { yol: '/platform/kurumlar', etiket: 'Kurumlar',   ikon: '🏫' },
  { yol: '/platform/kullanicilar', etiket: 'Kullanıcılar', ikon: '👥' },
]

export default function PlatformLayout() {
  const { profil, cikisYap } = useAuth()
  const navigate = useNavigate()

  async function handleCikis() {
    await cikisYap()
    navigate('/giris')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9' }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px', minHeight: '100vh', background: '#1B3A6B',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>📚 Okulmatik</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>Platform Yönetimi</div>
        </div>

        {/* Menü */}
        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {menuler.map(m => (
            <NavLink
              key={m.yol}
              to={m.yol}
              end={m.yol === '/platform'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1.25rem', textDecoration: 'none',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                borderLeft: isActive ? '3px solid #60A5FA' : '3px solid transparent',
                fontSize: '0.9rem', fontWeight: isActive ? '600' : '400',
                transition: 'all 0.15s',
              })}
            >
              <span>{m.ikon}</span>
              <span>{m.etiket}</span>
            </NavLink>
          ))}
        </nav>

        {/* Alt kullanıcı alanı */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem' }}>
            {profil?.ad || profil?.email}
          </div>
          <button onClick={handleCikis} style={{
            width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.1)',
            color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
            fontSize: '0.8rem', cursor: 'pointer',
          }}>
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* İçerik */}
      <main style={{ marginLeft: '240px', flex: 1, padding: '2rem' }}>
        <Outlet />
      </main>
    </div>
  )
}
