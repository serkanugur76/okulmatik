import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { KurumYonetimProvider, useKurumYonetim } from '../../contexts/KurumYonetimContext'

// ── Platform yönetim menüsü (kurumdan bağımsız) ───────────────────────────────
const PLATFORM_MENULER = [
  { yol: '/platform',              etiket: 'Dashboard',    ikon: '📊', end: true },
  { yol: '/platform/kurumlar',     etiket: 'Kurumlar',     ikon: '🏛' },
  { yol: '/platform/kullanicilar', etiket: 'Kullanıcılar', ikon: '👥' },
  { yol: '/platform/rubrikler',    etiket: 'Rubrik Şablonlar', ikon: '📋' },
  { yol: '/platform/loglar',        etiket: 'İşlem Logları', ikon: '🗒️' },
  { yol: '/platform/hakkinda',     etiket: 'Hakkında',      ikon: 'ℹ️' },
]

// ── Kurum operasyon menüsü (seçili kuruma bağlı) ─────────────────────────────
const KURUM_MENULER = [
  { yol: '/platform/kurum/siniflar',         etiket: 'Sınıflar',         ikon: '🏫' },
  { yol: '/platform/kurum/ogrenciler',       etiket: 'Öğrenciler',       ikon: '🎒' },
  { yol: '/platform/kurum/kullanicilar',     etiket: 'Kurum Kullanıcılar', ikon: '👤' },
  { yol: '/platform/kurum/rubrikler',        etiket: 'Kurum Rubrikler',  ikon: '📝' },
  { yol: '/platform/kurum/degerlendirmeler', etiket: 'Değerlendirmeler', ikon: '✅' },
  { yol: '/platform/kurum/mentor',          etiket: 'Mentor',           ikon: '🎓' },
  { yol: '/platform/kurum/kutuphane',       etiket: 'Kütüphane',        ikon: '📚' },
]

const SIDEBAR_BG   = '#1E1B4B'   // indigo koyu — platform admin rengi
const SIDEBAR_AKT  = '#4338CA'   // aktif menü
const BORDER_COLOR = 'rgba(255,255,255,0.1)'

function MenuLink({ yol, ikon, etiket, end = false }) {
  return (
    <NavLink
      to={yol}
      end={end}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.65rem 1.25rem', textDecoration: 'none',
        color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
        background: isActive ? SIDEBAR_AKT : 'transparent',
        borderLeft: isActive ? '3px solid #818CF8' : '3px solid transparent',
        fontSize: '0.875rem', fontWeight: isActive ? '600' : '400',
        transition: 'all 0.15s',
      })}
    >
      <span>{ikon}</span>
      <span>{etiket}</span>
    </NavLink>
  )
}

function PlatformSidebar() {
  const { profil, cikisYap } = useAuth()
  const { erisimKurumlar, secilenKurumId, secilenKurum, setSecilenKurumId } = useKurumYonetim()
  const navigate = useNavigate()

  // Okul seviyesi sıralama: ilkokul → ortaokul → lise
  function okulSira(ad = '') {
    const s = ad.toLocaleLowerCase('tr')
    if (s.includes('ilkokul'))  return 1
    if (s.includes('ortaokul')) return 2
    if (s.includes('lise'))     return 3
    return 4
  }

  const rootKurumlar   = erisimKurumlar.filter(k => !k.parentId)
  const kampusKurumlar = erisimKurumlar
    .filter(k => k.parentId && erisimKurumlar.find(x => x.id === k.parentId && !x.parentId))
    .sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
  const altKurumlar    = erisimKurumlar.filter(k => {
    if (!k.parentId) return false
    const ust = erisimKurumlar.find(x => x.id === k.parentId)
    return !!ust?.parentId
  })

  // Seçili kurum için breadcrumb: root → kampüs → altKurum
  function buildBreadcrumb(kurum) {
    if (!kurum) return []
    const parts = [kurum.ad]
    let current = kurum
    while (current.parentId) {
      const parent = erisimKurumlar.find(k => k.id === current.parentId)
      if (!parent) break
      parts.unshift(parent.ad)
      current = parent
    }
    return parts
  }

  // optgroup yapısı: root → [ { kampus, altlar[] } ]
  const kurumGruplari = rootKurumlar.map(root => ({
    root,
    kampusGruplari: kampusKurumlar
      .filter(k => k.parentId === root.id)
      .map(kp => ({
        kampus: kp,
        altKurumlar: altKurumlar
          .filter(k => k.parentId === kp.id)
          .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr')),
      })),
  }))

  async function handleCikis() {
    await cikisYap()
    navigate('/giris')
  }

  return (
    <aside style={{
      width: '240px', height: '100vh', background: SIDEBAR_BG,
      display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0,
    }}>
      {/* Logo + badge */}
      <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: `1px solid ${BORDER_COLOR}` }}>
        <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#fff' }}>📚 Okulmatik</div>
        <div style={{
          display: 'inline-block', marginTop: '0.375rem',
          fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.08em',
          background: '#4338CA', color: '#C7D2FE',
          padding: '2px 8px', borderRadius: '999px', textTransform: 'uppercase',
        }}>
          ⚙ Platform Yöneticisi
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: '0.5rem' }}>
        {/* ── Platform Yönetimi ── */}
        <div style={{ padding: '0.75rem 1.25rem 0.25rem', fontSize: '0.65rem', fontWeight: '700',
          color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Platform
        </div>
        {PLATFORM_MENULER.map(m => (
          <MenuLink key={m.yol} {...m} />
        ))}

        {/* ── Kurum Operasyonları ── */}
        <div style={{ padding: '0.875rem 1.25rem 0.25rem', fontSize: '0.65rem', fontWeight: '700',
          color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase',
          borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '0.5rem' }}>
          Kurum Operasyonları
        </div>

        {/* Kurum seçici */}
        <div style={{ padding: '0 1rem 0.5rem' }}>
          <select
            value={secilenKurumId || ''}
            onChange={e => setSecilenKurumId(e.target.value || null)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.1)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
              padding: '0.375rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer',
            }}
          >
            <option value="" style={{ background: SIDEBAR_BG }}>— Kurum seçin —</option>
            {kurumGruplari.flatMap(({ root, kampusGruplari }) => [
              <optgroup key={`root-${root.id}`} label={`🏛 ${root.ad.toUpperCase()}`}>
                <option value={root.id} style={{ background: SIDEBAR_BG }}>🏛 {root.ad}</option>
              </optgroup>,
              ...kampusGruplari.map(({ kampus, altKurumlar: altlar }) => (
                <optgroup key={kampus.id} label={`  🏫 ${kampus.ad}`}>
                  <option value={kampus.id} style={{ background: SIDEBAR_BG }}>🏫 {kampus.ad}</option>
                  {altlar.map(ak => (
                    <option key={ak.id} value={ak.id} style={{ background: SIDEBAR_BG }}>
                      {'  '}└ {ak.ad}
                    </option>
                  ))}
                </optgroup>
              )),
            ])}
          </select>
        </div>

        {KURUM_MENULER.map(m => (
          <MenuLink key={m.yol} {...m} />
        ))}
      </nav>

      {/* Kullanıcı + çıkış */}
      <div style={{ padding: '1rem 1.25rem', borderTop: `1px solid ${BORDER_COLOR}` }}>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>
          {profil?.ad || profil?.email}
        </div>
        <button onClick={handleCikis} style={{
          width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.08)',
          color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
          fontSize: '0.8rem', cursor: 'pointer',
        }}>
          Çıkış Yap
        </button>
      </div>
    </aside>
  )
}

function PlatformMain() {
  const { erisimKurumlar, secilenKurum } = useKurumYonetim()

  function buildBreadcrumb(kurum) {
    if (!kurum) return []
    const parts = [kurum.ad]
    let current = kurum
    while (current.parentId) {
      const parent = erisimKurumlar.find(k => k.id === current.parentId)
      if (!parent) break
      parts.unshift(parent.ad)
      current = parent
    }
    return parts
  }

  const breadcrumb = buildBreadcrumb(secilenKurum)

  const logoUrl = secilenKurum?.logoUrl
    || (secilenKurum?.rootKurumId ? erisimKurumlar.find(k => k.id === secilenKurum.rootKurumId)?.logoUrl : null)
    || erisimKurumlar.find(k => !k.parentId)?.logoUrl

  return (
    <main style={{ marginLeft: '240px', flex: 1, padding: '2rem' }}>
      {/* Breadcrumb + Logo satırı */}
      {breadcrumb.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748B' }}>
            {breadcrumb.map((ad, i, arr) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: i === arr.length - 1 ? '#1E293B' : '#94A3B8', fontWeight: i === arr.length - 1 ? '600' : '400' }}>
                  {ad}
                </span>
                {i < arr.length - 1 && <span style={{ color: '#CBD5E1' }}>›</span>}
              </span>
            ))}
          </div>
          {logoUrl && (
            <img src={logoUrl} alt="Kurum Logosu"
              style={{ height: '48px', maxWidth: '140px', objectFit: 'contain' }} />
          )}
        </div>
      )}
      <Outlet />
    </main>
  )
}

export default function PlatformLayout() {
  return (
    <KurumYonetimProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9' }}>
        <PlatformSidebar />
        <PlatformMain />
      </div>
    </KurumYonetimProvider>
  )
}
