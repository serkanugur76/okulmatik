import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { KurumYonetimProvider, useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { GenelKurumSecici } from '../kurum/KurumLayout'
import OkulmatikLogo from '../../components/OkulmatikLogo'

// ── Platform yönetim menüsü (kurumdan bağımsız) ───────────────────────────────
const PLATFORM_MENULER = [
  { yol: '/platform',              etiket: 'Dashboard',    ikon: '📊', end: true },
  { yol: '/platform/kurumlar',     etiket: 'Kurumlar',     ikon: '🏛' },
  { yol: '/platform/kullanicilar', etiket: 'Kullanıcılar', ikon: '👥' },
  { yol: '/platform/rubrikler',    etiket: 'Rubrik Şablonlar', ikon: '📋' },
  { yol: '/platform/belirli-gunler', etiket: 'Belirli Gün & Tatiller', ikon: '📅' },
  { yol: '/platform/loglar',        etiket: 'İşlem Logları', ikon: '🗒️' },
  { yol: '/platform/toplu-mail',   etiket: 'Toplu Mail Gönder', ikon: '✉️' },
  { yol: '/platform/sistem',       etiket: 'Sistem İşlemleri', ikon: '⚙️' },
  { yol: '/platform/versiyonlar',  etiket: 'Versiyon Geçmişi', ikon: '✨' },
  { yol: '/platform/hakkinda',     etiket: 'Hakkında',      ikon: 'ℹ️' },
]

// ── Kurum operasyon menüsü (seçili kuruma bağlı) ─────────────────────────────
const KURUM_MENULER = [
  { yol: '/platform/kurum/siniflar',         etiket: 'Sınıflar',         ikon: '🏫' },
  { yol: '/platform/kurum/ogrenciler',       etiket: 'Öğrenciler',       ikon: '🎒' },
  {
    etiket: 'Kullanıcılar',
    ikon: '👥',
    altMenuler: [
      { yol: '/platform/kurum/kullanicilar', etiket: 'Kurum Kullanıcıları', ikon: '👤' },
      { yol: '/platform/kurum/ogretmenler',  etiket: 'Öğretmenler',        ikon: '🧑‍🏫' },
    ]
  },
  {
    etiket: 'Rubrik Yönetimi',
    ikon: '📝',
    altMenuler: [
      { yol: '/platform/kurum/rubrikler',        etiket: 'Kurum Rubrikler',  ikon: '📋' },
      { yol: '/platform/kurum/degerlendirmeler', etiket: 'Değerlendirmeler', ikon: '✅' },
    ]
  },
  {
    etiket: 'Resmi İşlemler',
    ikon: '🏛️',
    altMenuler: [
      { yol: '/platform/kurum/resmi-islemler/is-plani', etiket: 'İş Planı & Takip',  ikon: '📋' },
      { yol: '/platform/kurum/resmi-islemler/evraklar', etiket: 'Evrak Üretimi',     ikon: '📄' },
    ]
  },
  { yol: '/platform/kurum/mentor',          etiket: 'Mentor Yönetimi',  ikon: '🎓' },
  { yol: '/platform/kurum/nobet',           etiket: 'Nöbet Yönetimi',   ikon: '🛡️' },
  { yol: '/platform/kurum/kulupler',        etiket: 'Kulüp Yönetimi',   ikon: '🏆' },
  { yol: '/platform/kurum/kutuphane',       etiket: 'Kütüphane',        ikon: '📚' },
  { yol: '/platform/kurum/arge',            etiket: 'Ar-Ge & Bilim Projeleri', ikon: '🔬' },
]

const SIDEBAR_BG   = '#1E1B4B'   // indigo koyu — platform admin rengi
const SIDEBAR_AKT  = '#4338CA'   // aktif menü
const BORDER_COLOR = 'rgba(255,255,255,0.1)'

function MenuLink({ yol, ikon, etiket, end = false }) {
  return (
    <NavLink
      to={yol}
      end={end}
      className="sidebar-nav-item"
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
      <span className="nav-icon">{ikon}</span>
      <span className="nav-text">{etiket}</span>
    </NavLink>
  )
}

function PlatformSidebar() {
  const { profil, cikisYap } = useAuth()
  const { erisimKurumlar, secilenKurumId, secilenKurum, setSecilenKurumId } = useKurumYonetim()
  const navigate = useNavigate()
  const location = useLocation()

  const [acikSubMenuler, setAcikSubMenuler] = useState(() => {
    return {
      'Kullanıcılar': location.pathname.startsWith('/platform/kurum/kullanicilar') || location.pathname.startsWith('/platform/kurum/ogretmenler'),
      'Rubrik Yönetimi': location.pathname.startsWith('/platform/kurum/rubrikler') || location.pathname.startsWith('/platform/kurum/degerlendirmeler'),
      'Resmi İşlemler': location.pathname.startsWith('/platform/kurum/resmi-islemler')
    }
  })

  const isModulAktif = (menu) => {
    // Platform admin (Super Admin) can always see all modules to manage and test them
    return true
  }

  useEffect(() => {
    const isKullaniciActive = location.pathname.startsWith('/platform/kurum/kullanicilar') || location.pathname.startsWith('/platform/kurum/ogretmenler')
    const isRubrikActive = location.pathname.startsWith('/platform/kurum/rubrikler') || location.pathname.startsWith('/platform/kurum/degerlendirmeler')
    const isResmiActive = location.pathname.startsWith('/platform/kurum/resmi-islemler')
    setAcikSubMenuler(prev => ({
      ...prev,
      'Kullanıcılar': isKullaniciActive ? true : prev['Kullanıcılar'],
      'Rubrik Yönetimi': isRubrikActive ? true : prev['Rubrik Yönetimi'],
      'Resmi İşlemler': isResmiActive ? true : prev['Resmi İşlemler']
    }))
  }, [location.pathname])

  // Okul seviyesi sıralama: ilkokul → ortaokul → lise
  function okulSira(ad = '') {
    const s = ad.toLocaleLowerCase('tr')
    if (s.includes('ilkokul'))  return 1
    if (s.includes('ortaokul')) return 2
    if (s.includes('lise'))     return 3
    return 4
  }

  const rootKurumlar = erisimKurumlar.filter(
    k => !k.parentId || !erisimKurumlar.some(p => p.id === k.parentId)
  )

  const kurumGruplari = rootKurumlar.map(root => {
    if (root.tip === 'kampus') {
      const altlarUnderKampus = erisimKurumlar.filter(k => k.parentId === root.id && k.tip === 'altKurum')
        .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr'))
      return {
        root,
        kampusGruplari: [
          {
            kampus: root,
            altKurumlar: altlarUnderKampus
          }
        ]
      }
    } else if (root.tip === 'altKurum') {
      return {
        root,
        kampusGruplari: []
      }
    } else {
      const kampuses = erisimKurumlar.filter(k => k.parentId === root.id && k.tip === 'kampus')
        .sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
      return {
        root,
        kampusGruplari: kampuses.map(kp => {
          const altlar = erisimKurumlar.filter(k => k.parentId === kp.id && k.tip === 'altKurum')
            .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr'))
          return {
            kampus: kp,
            altKurumlar: altlar
          }
        })
      }
    }
  })

  const seciliKurumObj = erisimKurumlar.find(k => k.id === secilenKurumId)
  const selectEmoji = (() => {
    if (!seciliKurumObj) return '🏢'
    if (seciliKurumObj.tip === 'kurum') return '🏛️'
    if (seciliKurumObj.tip === 'kampus') return '🏫'
    const nameLower = (seciliKurumObj.ad || '').toLowerCase()
    if (nameLower.includes('ilkokul')) return '🎒'
    if (nameLower.includes('ortaokul')) return '🏫'
    if (nameLower.includes('lise')) return '🎓'
    return '🏢'
  })()

  async function handleCikis() {
    await cikisYap()
    navigate('/giris')
  }

  return (
    <aside className="sidebar-aside" style={{
      width: '240px', height: '100vh', background: SIDEBAR_BG,
      display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0,
      zIndex: 100, transition: 'width 0.2s',
    }}>
      {/* Logo + badge */}
      <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: `1px solid ${BORDER_COLOR}` }}>
        <div className="sidebar-logo-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: '800', color: '#fff' }}>
            <OkulmatikLogo size={24} />
            <span className="logo-text">Okulmatik</span>
          </div>
          <div className="sidebar-badge" style={{
            display: 'inline-block',
            fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.08em',
            background: '#4338CA', color: '#C7D2FE',
            padding: '2px 8px', borderRadius: '999px', textTransform: 'uppercase',
          }}>
            ⚙ Admin
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: '0.5rem' }}>
        {/* ── Platform Yönetimi ── */}
        <div className="sidebar-section-title" style={{ padding: '0.75rem 1.25rem 0.25rem', fontSize: '0.65rem', fontWeight: '700',
          color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Platform
        </div>
        {PLATFORM_MENULER.map(m => (
          <MenuLink key={m.yol} {...m} />
        ))}

        {/* ── Kurum Operasyonları ── */}
        <div className="sidebar-section-title" style={{ padding: '0.875rem 1.25rem 0.25rem', fontSize: '0.65rem', fontWeight: '700',
          color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase',
          borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '0.5rem' }}>
          Kurum Operasyonları
        </div>

        {/* Kurum seçici */}
        <div className="sidebar-select-container" style={{ padding: '0 1rem 0.5rem' }}>
          <div className="sidebar-select-label" style={{ display: 'none' }} />
          <div className="select-wrapper">
            <select
              value={secilenKurumId || ''}
              onChange={e => setSecilenKurumId(e.target.value || null)}
              className="kurum-select"
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
            <div className="select-visual" style={{ display: 'none' }}>
              {selectEmoji}
            </div>
          </div>
        </div>

        {KURUM_MENULER.filter(isModulAktif).map(m => {
          if (m.altMenuler) {
            const isAnyChildActive = m.altMenuler.some(sub => location.pathname.startsWith(sub.yol))
            const isMenuOpen = !!acikSubMenuler[m.etiket]
            return (
              <div key={m.etiket}>
                <button
                  onClick={() => setAcikSubMenuler(prev => ({ ...prev, [m.etiket]: !prev[m.etiket] }))}
                  className="sidebar-nav-item"
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.65rem 1.25rem', background: 'transparent', border: 'none',
                    color: isAnyChildActive ? '#fff' : 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: '0.875rem',
                    transition: 'all 0.15s', outline: 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => {
                    if (!isAnyChildActive) e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="nav-icon">{m.ikon}</span>
                    <span className="nav-text">{m.etiket}</span>
                  </div>
                  <span className="nav-arrow" style={{ fontSize: '0.7rem', opacity: 0.7, transform: isMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    ▼
                  </span>
                </button>

                {isMenuOpen && (
                  <div className="sidebar-submenu" style={{ background: 'rgba(0,0,0,0.15)', paddingLeft: '0.5rem' }}>
                    {m.altMenuler.map(sub => (
                      <NavLink
                        key={sub.yol}
                        to={sub.yol}
                        className="sidebar-sub-item"
                        style={({ isActive }) => ({
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.6rem 1.25rem', textDecoration: 'none',
                          color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                          background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                          borderLeft: isActive ? '3px solid #818CF8' : '3px solid transparent',
                          fontSize: '0.85rem', fontWeight: isActive ? '600' : '400',
                          transition: 'all 0.15s',
                        })}
                      >
                        <span className="nav-icon">{sub.ikon}</span>
                        <span className="nav-text">{sub.etiket}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <MenuLink key={m.yol} {...m} />
          )
        })}
      </nav>

      {/* Kullanıcı + çıkış */}
      <div style={{ padding: '1rem 1.25rem', borderTop: `1px solid ${BORDER_COLOR}` }}>
        <div className="sidebar-user-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {profil?.photoURL ? (
            <img
              src={profil.photoURL}
              alt="Profil"
              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: '#4338CA', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: '700', fontSize: '0.9rem', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0
            }}>
              {(() => {
                const name = profil?.ad || profil?.email || '?';
                const parts = name.split(' ');
                if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                return name[0].toUpperCase();
              })()}
            </div>
          )}
          <div className="sidebar-user-info" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={profil?.ad}>
              {profil?.ad || 'Platform Yöneticisi'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={profil?.email}>
              {profil?.email}
            </span>
          </div>
        </div>

        {/* Yetki Rozeti */}
        <div className="sidebar-badges-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '0.75rem' }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.03em',
            background: 'rgba(99,102,241,0.2)', color: '#A5B4FC',
            border: '1px solid rgba(99,102,241,0.3)',
            padding: '2px 8px', borderRadius: '999px', display: 'inline-block'
          }}>
            ⚙ Süper Admin
          </span>
        </div>

        <button onClick={handleCikis} className="sidebar-logout-btn" style={{
          width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.08)',
          color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
          fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
          <span className="logout-text">Çıkış Yap</span>
          <span className="logout-icon" style={{ display: 'none' }}>🚪</span>
        </button>

        <div style={{
          textAlign: 'center',
          fontSize: '0.65rem',
          color: 'rgba(255, 255, 255, 0.35)',
          marginTop: '0.75rem',
          fontFamily: 'monospace'
        }}>
          v{typeof __APP_VERSION_INFO__ !== 'undefined' ? __APP_VERSION_INFO__.full : '0.1.0'}
        </div>
      </div>
    </aside>
  )
}

function PlatformMain() {
  const { profil, cikisYap } = useAuth()
  const { erisimKurumlar, secilenKurumId, secilenKurum, setSecilenKurumId } = useKurumYonetim()
  const navigate = useNavigate()
  const location = useLocation()

  const rootKurum = erisimKurumlar.find(k => !k.parentId)

  const getInitials = (phrase) => {
    if (!phrase) return ''
    const words = phrase.split(/\s+/).filter(Boolean)
    if (words.length === 1 && words[0].length <= 4) {
      return words[0]
    }
    return words
      .map(word => {
        const char = word.charAt(0)
        if (char === 'I' || char === 'ı') return 'I'
        if (char === 'İ' || char === 'i') return 'İ'
        return char.toUpperCase()
      })
      .filter(Boolean)
      .join('.') + '.'
  }

  const getShortName = (fullName) => {
    if (!fullName) return ''
    const name = fullName.trim()
    const rootName = rootKurum?.ad ? rootKurum.ad.trim() : ''
    
    if (rootName && name !== rootName) {
      const nameWords = name.split(/\s+/).filter(Boolean)
      const rootWords = rootName.split(/\s+/).filter(Boolean)
      
      let commonCount = 0
      while (
        commonCount < nameWords.length &&
        commonCount < rootWords.length &&
        nameWords[commonCount].toLowerCase() === rootWords[commonCount].toLowerCase()
      ) {
        commonCount++
      }
      
      if (commonCount > 0) {
        const commonPrefix = nameWords.slice(0, commonCount).join(' ')
        const initials = getInitials(commonPrefix)
        const rest = nameWords.slice(commonCount).join(' ')
        return `${initials} ${rest}`
      }
    }
    return name
  }

  // Okul seviyesi sıralama: ilkokul → ortaokul → lise
  function okulSira(ad = '') {
    const s = ad.toLocaleLowerCase('tr')
    if (s.includes('ilkokul'))  return 1
    if (s.includes('ortaokul')) return 2
    if (s.includes('lise'))     return 3
    return 4
  }

  const rootKurumlar = erisimKurumlar.filter(
    k => !k.parentId || !erisimKurumlar.some(p => p.id === k.parentId)
  )

  const kurumGruplari = rootKurumlar.map(root => {
    if (root.tip === 'kampus') {
      const altlarUnderKampus = erisimKurumlar.filter(k => k.parentId === root.id && k.tip === 'altKurum')
        .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr'))
      return {
        root,
        kampusGruplari: [
          {
            kampus: root,
            altKurumlar: altlarUnderKampus
          }
        ]
      }
    } else if (root.tip === 'altKurum') {
      return {
        root,
        kampusGruplari: []
      }
    } else {
      const kampuses = erisimKurumlar.filter(k => k.parentId === root.id && k.tip === 'kampus')
        .sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
      return {
        root,
        kampusGruplari: kampuses.map(kp => {
          const altlar = erisimKurumlar.filter(k => k.parentId === kp.id && k.tip === 'altKurum')
            .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr'))
          return {
            kampus: kp,
            altKurumlar: altlar
          }
        })
      }
    }
  })

  const getSayfaEtiketi = () => {
    const allMenus = [
      ...PLATFORM_MENULER,
      ...KURUM_MENULER
    ].reduce((acc, m) => {
      if (m.altMenuler) acc.push(...m.altMenuler)
      else acc.push(m)
      return acc
    }, [])
    const found = allMenus.find(m => m.yol === location.pathname)
    if (found) return found.etiket
    const lastPart = location.pathname.split('/').pop()
    if (lastPart === 'platform') return 'Dashboard'
    return lastPart ? lastPart.charAt(0).toUpperCase() + lastPart.slice(1) : 'Okulmatik'
  }

  async function handleCikis() {
    await cikisYap()
    navigate('/giris')
  }

  const isKurumRoute = location.pathname.includes('/platform/kurum/') || location.pathname === '/platform/kurum'

  if (isKurumRoute && !secilenKurumId) {
    return (
      <main className="sidebar-main" style={{ marginLeft: '240px', flex: 1, padding: '2rem', position: 'relative' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '75vh',
          textAlign: 'center',
          padding: '2rem',
        }}>
          {/* Floating Arrow Animation pointing to sidebar select - desktop only */}
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes float-arrow {
              0% { transform: translate(0, 0) rotate(45deg); }
              50% { transform: translate(-8px, -8px) rotate(45deg); }
              100% { transform: translate(0, 0) rotate(45deg); }
            }
            .pointing-arrow {
              animation: float-arrow 2s infinite ease-in-out;
              font-size: 2.5rem;
              color: #4338CA;
              position: absolute;
              top: 130px;
              left: 40px;
            }
            @media (max-width: 768px) {
              .pointing-arrow {
                display: none !important;
              }
            }
          `}} />
          <div className="pointing-arrow">↖</div>

          <div style={{
            maxWidth: '500px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            borderRadius: '24px',
            padding: '2.5rem 2rem',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem'
          }}>
            <div style={{ fontSize: '3.5rem', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.05))' }}>🏫</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1E293B', margin: 0 }}>
              İşlem Yapılacak Kurumu Seçin
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: '1.6', margin: 0 }}>
              Kurum operasyonlarını yönetmek için lütfen çalışacağınız bir okul veya kampüs seçin.
            </p>

            {/* Central Selector for easy activation (especially on mobile) */}
            <div style={{ width: '100%', marginTop: '0.5rem' }}>
              <select
                value={secilenKurumId || ''}
                onChange={e => setSecilenKurumId(e.target.value || null)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  color: '#1E293B',
                  background: '#fff',
                  border: '1.5px solid #CBD5E1',
                  borderRadius: '12px',
                  outline: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
              >
                <option value="">— Kurum Seçin —</option>
                {kurumGruplari.flatMap(({ root, kampusGruplari }) => [
                  <optgroup key={`root-${root.id}`} label={`🏛 ${root.ad.toUpperCase()}`}>
                    <option value={root.id}>🏛 {root.ad}</option>
                  </optgroup>,
                  ...kampusGruplari.map(({ kampus, altKurumlar: altlar }) => (
                    <optgroup key={kampus.id} label={`  🏫 ${kampus.ad}`}>
                      <option value={kampus.id}>🏫 {kampus.ad}</option>
                      {altlar.map(ak => (
                        <option key={ak.id} value={ak.id}>
                          └ {ak.ad}
                        </option>
                      ))}
                    </optgroup>
                  )),
                ])}
              </select>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'rgba(67, 56, 202, 0.05)',
              color: '#4338CA',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: '700',
              marginTop: '0.25rem'
            }}>
              <span>💡</span> <span>İşlem yapmak istediğiniz kurumu seçip başlayabilirsiniz.</span>
            </div>
          </div>
        </div>
      </main>
    )
  }

  function buildBreadcrumb(kurum) {
    if (!kurum) return []
    const parts = [{ id: kurum.id, ad: kurum.ad }]
    let current = { ...kurum }
    while (current.parentId) {
      const parent = erisimKurumlar.find(k => k.id === current.parentId)
      if (!parent) break
      parts.unshift({ id: parent.id, ad: parent.ad })
      current = parent
    }
    return parts
  }

  const breadcrumb = buildBreadcrumb(secilenKurum)

  const logoUrl = secilenKurum?.logoUrl
    || (secilenKurum?.rootKurumId ? erisimKurumlar.find(k => k.id === secilenKurum.rootKurumId)?.logoUrl : null)
    || erisimKurumlar.find(k => !k.parentId)?.logoUrl

  return (
    <main className="sidebar-main" style={{ marginLeft: '240px', flex: 1, padding: '2rem' }}>
      {/* Mobile Header Bar with Back Button */}
      <div className="mobile-header-bar" style={{
        display: 'none',
        alignItems: 'center',
        gap: '0.75rem',
        background: '#ffffff',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        padding: '0.6rem 1rem',
        marginBottom: '1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#F1F5F9',
            border: 'none',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: '700',
            color: '#475569',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          ⬅
        </button>
        {erisimKurumlar.length > 1 && (
          <select
            value={secilenKurumId || ''}
            onChange={e => setSecilenKurumId(e.target.value || null)}
            style={{
              padding: '0.35rem 0.4rem',
              fontSize: '0.72rem',
              fontWeight: '700',
              color: '#1E293B',
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              flex: 1,
              minWidth: 0,
              outline: 'none',
              marginLeft: '0.25rem',
              textOverflow: 'ellipsis',
              textAlign: 'right',
              textAlignLast: 'right'
            }}
          >
            <option value="">— Kurum Seç —</option>
            {kurumGruplari.flatMap(({ root, campuses, kampusGruplari }) => [
              <optgroup key={`root-${root.id}`} label={`🏛 ${getShortName(root.ad).toUpperCase()}`}>
                <option value={root.id}>🏛 {getShortName(root.ad)}</option>
              </optgroup>,
              ...kampusGruplari.map(({ kampus, altKurumlar: altlar }) => (
                <optgroup key={kampus.id} label={`  🏫 ${getShortName(kampus.ad)}`}>
                  <option value={kampus.id}>🏫 {getShortName(kampus.ad)}</option>
                  {altlar.map(ak => (
                    <option key={ak.id} value={ak.id}>
                      &nbsp;&nbsp;└ {getShortName(ak.ad)}
                    </option>
                  ))}
                </optgroup>
              )),
            ])}
          </select>
        )}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginLeft: 'auto'
        }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              style={{
                height: '32px',
                width: '32px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
            />
          ) : (
            <span style={{
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#64748B'
            }}>
              {getSayfaEtiketi()}
            </span>
          )}
        </div>
      </div>
      {/* Breadcrumb + Logo satırı */}
      {breadcrumb.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748B' }}>
            {breadcrumb.map((item, i, arr) => (
              <span key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  className={i === arr.length - 1 ? '' : 'breadcrumb-link'}
                  onClick={() => {
                    if (i < arr.length - 1) {
                      setSecilenKurumId(item.id);
                    }
                  }}
                  style={i === arr.length - 1 ? {
                    color: '#1E293B',
                    fontWeight: '600',
                    cursor: 'default'
                  } : {
                    fontWeight: '500'
                  }}
                >
                  {item.ad}
                </span>
                {i < arr.length - 1 && <span style={{ color: '#CBD5E1' }}>›</span>}
              </span>
            ))}
          </div>
          {logoUrl && (
            <img src={logoUrl} alt="Kurum Logosu" className="desktop-only-logo"
              style={{ height: '48px', maxWidth: '140px', objectFit: 'contain' }} />
          )}
        </div>
      )}
      <Outlet />
    </main>
  )
}

function PlatformLayoutInner() {
  const { profil, cikisYap } = useAuth()
  const { secilenKurumId, erisimKurumlar } = useKurumYonetim()
  const navigate = useNavigate()
  const location = useLocation()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)

  async function handleCikis() {
    await cikisYap()
    navigate('/giris')
  }

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .breadcrumb-link {
          color: #4F46E5;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.15s ease;
        }
        .breadcrumb-link:hover {
          color: #3730A3;
          text-decoration: underline;
        }
        @media (max-width: 768px) {
          .desktop-only-logo {
            display: none !important;
          }
          .mobile-header-bar {
            display: flex !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            height: 56px !important;
            z-index: 1000 !important;
            margin: 0 !important;
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
            border-top: none !important;
            border-bottom: 1px solid #E2E8F0 !important;
            padding: 0.75rem 1rem !important;
            background: #ffffff !important;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03) !important;
          }
          .sidebar-aside {
            display: none !important;
          }
          .sidebar-main {
            margin-left: 0 !important;
            padding: 4.2rem 1rem 80px 1rem !important;
            overflow-x: hidden !important;
            max-width: 100vw !important;
          }
          .mobile-bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 64px;
            background: #ffffff;
            border-top: 1px solid #E2E8F0;
            box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
            z-index: 999;
            justify-content: space-around;
            align-items: center;
            padding: 0 10px;
          }
          .mobile-nav-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            background: none;
            border: none;
            color: #64748B;
            font-size: 0.65rem;
            font-weight: 600;
            cursor: pointer;
            gap: 4px;
            flex: 1;
            padding: 8px 0;
            transition: all 0.15s;
          }
          .mobile-nav-btn.active {
            color: #4338CA;
          }
          .mobile-nav-icon {
            font-size: 1.25rem;
          }
          .mobile-drawer-overlay {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(4px);
            z-index: 1000;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease-out;
          }
          .mobile-drawer-overlay.open {
            opacity: 1;
            pointer-events: auto;
          }
          .mobile-drawer {
            display: flex !important;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #ffffff;
            border-radius: 20px 20px 0 0;
            box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.12);
            z-index: 1001;
            transform: translateY(100%);
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            flex-direction: column;
            padding: 1.5rem 1.25rem;
            max-height: 80vh;
            overflow-y: auto;
          }
          .mobile-drawer.open {
            transform: translateY(0);
          }
          .mobile-drawer a {
            text-decoration: none !important;
          }
          .drawer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.25rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid #F1F5F9;
          }
          .drawer-title {
            font-size: 0.95rem;
            font-weight: 800;
            color: #1E293B;
          }
          .drawer-close {
            background: none;
            border: none;
            font-size: 1.1rem;
            color: #94A3B8;
            cursor: pointer;
          }
          .drawer-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }
          .drawer-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 12px;
            padding: 12px 8px;
            text-decoration: none;
            color: #334155;
            font-size: 0.72rem;
            font-weight: 700;
            text-align: center;
            gap: 6px;
            transition: all 0.2s;
          }
          .drawer-item:active {
            background: #EEF2FF;
            border-color: #4338CA;
          }
          .drawer-item-icon {
            font-size: 1.5rem;
          }
        }
        .mobile-bottom-nav, .mobile-drawer-overlay, .mobile-drawer {
          display: none;
        }
      `}} />
      <PlatformSidebar />
      <PlatformMain />
    </div>

    {/* Mobil Alt Navigasyon Barı */}
    <div className="mobile-bottom-nav">
      <button
        onClick={() => { navigate('/platform'); setIsDrawerOpen(false); setIsAccountOpen(false); }}
        className={`mobile-nav-btn ${location.pathname === '/platform' ? 'active' : ''}`}
      >
        <span className="mobile-nav-icon">📊</span>
        <span>Dashboard</span>
      </button>

      <button
        onClick={() => { navigate('/platform/kurumlar'); setIsDrawerOpen(false); setIsAccountOpen(false); }}
        className={`mobile-nav-btn ${location.pathname.includes('/kurumlar') ? 'active' : ''}`}
      >
        <span className="mobile-nav-icon">🏛</span>
        <span>Kurumlar</span>
      </button>

      <button
        onClick={() => { navigate('/platform/kullanicilar'); setIsDrawerOpen(false); setIsAccountOpen(false); }}
        className={`mobile-nav-btn ${location.pathname.includes('/kullanicilar') && !location.pathname.includes('/kurum/') ? 'active' : ''}`}
      >
        <span className="mobile-nav-icon">👥</span>
        <span>Kullanıcılar</span>
      </button>

      <button
        onClick={() => { setIsDrawerOpen(!isDrawerOpen); setIsAccountOpen(false); }}
        className={`mobile-nav-btn ${isDrawerOpen ? 'active' : ''}`}
      >
        <span className="mobile-nav-icon">☰</span>
        <span>Modüller</span>
      </button>

      <button
        onClick={() => { setIsAccountOpen(!isAccountOpen); setIsDrawerOpen(false); }}
        className={`mobile-nav-btn ${isAccountOpen ? 'active' : ''}`}
      >
        <span className="mobile-nav-icon">👤</span>
        <span>Hesap</span>
      </button>
    </div>

    {/* Modüller Drawer Çekmecesi */}
    <div
      className={`mobile-drawer-overlay ${isDrawerOpen ? 'open' : ''}`}
      onClick={() => setIsDrawerOpen(false)}
    />
    <div className={`mobile-drawer ${isDrawerOpen ? 'open' : ''}`}>
      <div className="drawer-header">
        <span className="drawer-title">🧩 Platform Modülleri</span>
        <button className="drawer-close" onClick={() => setIsDrawerOpen(false)}>✕</button>
      </div>
      
      <div className="drawer-grid">
        {PLATFORM_MENULER.filter(m => m.yol !== '/platform' && m.yol !== '/platform/kurumlar' && m.yol !== '/platform/kullanicilar').map(link => (
          <NavLink
            key={link.yol}
            to={link.yol}
            onClick={() => setIsDrawerOpen(false)}
            className="drawer-item"
          >
            <span className="drawer-item-icon">{link.ikon}</span>
            <span>{link.etiket}</span>
          </NavLink>
        ))}

        {secilenKurumId && KURUM_MENULER.flatMap(m => {
          if (m.altMenuler) {
            return m.altMenuler.map(sub => ({ yol: sub.yol, etiket: sub.etiket, ikon: sub.ikon }))
          }
          return [{ yol: m.yol, etiket: m.etiket, ikon: m.ikon }]
        }).map(link => (
          <NavLink
            key={link.yol}
            to={link.yol}
            onClick={() => setIsDrawerOpen(false)}
            className="drawer-item"
            style={{ background: '#FFFDF5', borderColor: '#FDE68A' }}
          >
            <span className="drawer-item-icon">{link.ikon}</span>
            <span>{link.etiket}</span>
          </NavLink>
        ))}
      </div>
    </div>

    {/* Hesap/Profil Drawer Çekmecesi */}
    <div
      className={`mobile-drawer-overlay ${isAccountOpen ? 'open' : ''}`}
      onClick={() => setIsAccountOpen(false)}
    />
    <div className={`mobile-drawer ${isAccountOpen ? 'open' : ''}`}>
      <div className="drawer-header" style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <OkulmatikLogo size={24} />
          <span className="drawer-title" style={{ fontSize: '1rem', fontWeight: '800', color: '#1B3A6B' }}>Okulmatik</span>
        </div>
        <button className="drawer-close" onClick={() => setIsAccountOpen(false)}>✕</button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', margin: '1rem 0' }}>
        <div style={{
          width: '60px', height: '60px', borderRadius: '50%',
          background: '#4338CA', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '700', fontSize: '1.25rem', border: '3px solid #E2E8F0'
        }}>
          {(() => {
            const name = profil?.ad || profil?.email || '?';
            const parts = name.split(' ');
            if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            return name[0].toUpperCase();
          })()}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: '800', color: '#1E293B', fontSize: '1rem', textDecoration: 'none' }}>{profil?.ad || 'Platform Yöneticisi'}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px', textDecoration: 'none' }}>{profil?.email}</div>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', margin: '0.5rem 0' }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: '700',
            background: 'rgba(99,102,241,0.15)', color: '#4F46E5', border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: '999px', padding: '3px 10px',
          }}>
            ⚙ Süper Admin
          </span>
        </div>

        <div style={{ width: '100%', borderTop: '1px solid #F1F5F9', margin: '1rem 0' }} />

        <button
          onClick={() => { setIsAccountOpen(false); handleCikis(); }}
          style={{
            width: '100%',
            padding: '12px',
            background: '#FEF2F2',
            color: '#EF4444',
            border: '1px solid #FEE2E2',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#FEE2E2'}
          onMouseLeave={e => e.currentTarget.style.background = '#FEF2F2'}
        >
          <span>🚪</span> <span>Oturumu Kapat</span>
        </button>

        <div style={{
          textAlign: 'center',
          fontSize: '0.7rem',
          color: '#94A3B8',
          marginTop: '1.5rem',
          fontFamily: 'monospace'
        }}>
          v{typeof __APP_VERSION_INFO__ !== 'undefined' ? __APP_VERSION_INFO__.full : '0.1.0'}
        </div>
      </div>
    </div>
  </>
)
}

export default function PlatformLayout() {
  return (
    <KurumYonetimProvider>
      <PlatformLayoutInner />
    </KurumYonetimProvider>
  )
}
