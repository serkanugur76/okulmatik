import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { KurumYonetimProvider, useKurumYonetim } from '../../contexts/KurumYonetimContext'

const menuler = [
  { yol: '/kurum',              etiket: 'Dashboard',    ikon: '📊' },
  { yol: '/kurum/siniflar',     etiket: 'Sınıflar',     ikon: '🏫' },
  { yol: '/kurum/ogrenciler',   etiket: 'Öğrenciler',   ikon: '🎒' },
  { yol: '/kurum/kullanicilar', etiket: 'Kullanıcılar', ikon: '👥' },
]

const TIP_GIRINTI = { kurum: 0, kampus: 12, altKurum: 24 }

function KurumLayoutInner() {
  const { profil, cikisYap } = useAuth()
  const { erisimKurumlar, secilenKurumId, secilenKurum, setSecilenKurumId } = useKurumYonetim()
  const navigate = useNavigate()

  async function handleCikis() {
    await cikisYap()
    navigate('/giris')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9' }}>
      <aside style={{
        width: '240px', minHeight: '100vh', background: '#1B3A6B',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0,
      }}>
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>📚 Okulmatik</div>

          {/* Kurum seçici — birden fazla kurum varsa dropdown göster */}
          {erisimKurumlar.length > 1 ? (
            <select
              value={secilenKurumId || ''}
              onChange={e => setSecilenKurumId(e.target.value)}
              style={{
                marginTop: '0.625rem', width: '100%',
                background: 'rgba(255,255,255,0.12)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
                padding: '0.375rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer',
              }}
            >
              {erisimKurumlar.map(k => (
                <option key={k.id} value={k.id} style={{ background: '#1B3A6B', paddingLeft: `${TIP_GIRINTI[k.tip] || 0}px` }}>
                  {k.tip === 'kampus' ? '  └ ' : k.tip === 'altKurum' ? '    └ ' : ''}{k.ad}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {secilenKurum?.ad || 'Kurum Yönetimi'}
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {menuler.map(m => (
            <NavLink
              key={m.yol}
              to={m.yol}
              end={m.yol === '/kurum'}
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

      <main style={{ marginLeft: '240px', flex: 1, padding: '2rem' }}>
        <Outlet />
      </main>
    </div>
  )
}

export default function KurumLayout() {
  return (
    <KurumYonetimProvider>
      <KurumLayoutInner />
    </KurumYonetimProvider>
  )
}
