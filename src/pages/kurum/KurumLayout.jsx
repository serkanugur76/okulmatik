import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { KurumYonetimProvider, useKurumYonetim } from '../../contexts/KurumYonetimContext'

const menuler = [
  { yol: '/kurum',                   etiket: 'Dashboard',       ikon: '📊' },
  { yol: '/kurum/siniflar',          etiket: 'Sınıflar',        ikon: '🏫' },
  { yol: '/kurum/ogrenciler',        etiket: 'Öğrenciler',      ikon: '🎒' },
  { yol: '/kurum/kullanicilar',      etiket: 'Kullanıcılar',    ikon: '👥' },
  { yol: '/kurum/rubrikler',         etiket: 'Rubrikler',       ikon: '📋' },
  { yol: '/kurum/degerlendirmeler',  etiket: 'Değerlendirmeler',ikon: '📝' },
]

function KurumLayoutInner() {
  const { profil, cikisYap } = useAuth()
  const { erisimKurumlar, secilenKurumId, setSecilenKurumId } = useKurumYonetim()
  const navigate = useNavigate()

  // Root kurum (parentId yok)
  const rootKurum = erisimKurumlar.find(k => !k.parentId)

  // Seçilebilir kurumlar: sadece kampüs ve alt kurumlar
  const secilebilir = erisimKurumlar.filter(k => k.parentId)

  // Seçili kurumun tam yolu: Gelecek Okulları - Mezitli Kampüsü - İlkokul
  function tamYol(kurum) {
    if (!kurum || !kurum.parentId) return kurum?.ad || ''
    const ust = erisimKurumlar.find(k => k.id === kurum.parentId)
    if (!ust || !ust.parentId) {
      // Kampüs seviyesi: Root - Kampüs
      return `${rootKurum?.ad || ''} - ${kurum.ad}`
    }
    // Alt kurum seviyesi: Root - Kampüs - AltKurum
    return `${rootKurum?.ad || ''} - ${ust.ad} - ${kurum.ad}`
  }

  const secilenKurum = erisimKurumlar.find(k => k.id === secilenKurumId)

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

          {/* Root kurum adı — sabit */}
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: '0.5rem' }}>
            {rootKurum?.ad || '—'}
          </div>

          {/* Kampüs/Alt kurum seçici */}
          {secilebilir.length > 0 && (
            <select
              value={secilenKurumId && secilenKurum?.parentId ? secilenKurumId : ''}
              onChange={e => setSecilenKurumId(e.target.value || rootKurum?.id)}
              style={{
                marginTop: '0.5rem', width: '100%',
                background: 'rgba(255,255,255,0.12)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
                padding: '0.375rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: '#1B3A6B' }}>— Kurum seçin —</option>
              {secilebilir.map(k => {
                const ust = erisimKurumlar.find(x => x.id === k.parentId)
                const etiket = k.tip === 'altKurum' && ust
                  ? `${ust.ad} - ${k.ad}`
                  : k.ad
                return (
                  <option key={k.id} value={k.id} style={{ background: '#1B3A6B' }}>
                    {etiket}
                  </option>
                )
              })}
            </select>
          )}

          {/* Seçili kurumun tam yolu */}
          {secilenKurum?.parentId && (
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.375rem', lineHeight: '1.3' }}>
              {tamYol(secilenKurum)}
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
