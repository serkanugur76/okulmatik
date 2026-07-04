import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { KurumYonetimProvider, useKurumYonetim } from '../../contexts/KurumYonetimContext'

// Tüm kullanıcılar için menü
const ADMIN_MENULER = [
  { yol: '/kurum',                   etiket: 'Dashboard',        ikon: '📊' },
  { yol: '/kurum/siniflar',          etiket: 'Sınıflar',         ikon: '🏫' },
  { yol: '/kurum/ogrenciler',        etiket: 'Öğrenciler',       ikon: '🎒' },
  {
    etiket: 'Kullanıcılar',
    ikon: '👥',
    altMenuler: [
      { yol: '/kurum/kullanicilar', etiket: 'Kurum Kullanıcıları', ikon: '👤' },
      { yol: '/kurum/ogretmenler',  etiket: 'Öğretmenler',        ikon: '🧑‍🏫' },
    ]
  },
  {
    etiket: 'Rubrik Yönetimi',
    ikon: '📝',
    altMenuler: [
      { yol: '/kurum/rubrikler',         etiket: 'Rubrikler',        ikon: '📋' },
      { yol: '/kurum/degerlendirmeler',  etiket: 'Değerlendirmeler', ikon: '📝' },
    ]
  },
  {
    etiket: 'Resmi İşlemler',
    ikon: '🏛️',
    altMenuler: [
      { yol: '/kurum/resmi-islemler/is-plani', etiket: 'İş Planı & Takip',  ikon: '📋' },
      { yol: '/kurum/resmi-islemler/evraklar', etiket: 'Evrak Üretimi',     ikon: '📄' },
    ]
  },
  { yol: '/kurum/mentor',            etiket: 'Mentor Yönetimi',  ikon: '🎓' },
  { yol: '/kurum/nobet',             etiket: 'Nöbet Yönetimi',   ikon: '🛡️' },
  { yol: '/kurum/kulupler',          etiket: 'Kulüp Yönetimi',   ikon: '🏆' },
  { yol: '/kurum/belirli-gunler',    etiket: 'Belirli Gün & Tatiller', ikon: '📅' },
  { yol: '/kurum/kutuphane',         etiket: 'Kütüphane',        ikon: '📚' },
  { yol: '/kurum/hakkinda',          etiket: 'Hakkında',         ikon: 'ℹ️' },
]

// Öğretmen sadece bu menüleri görür
const OGRETMEN_MENULER = [
  { yol: '/kurum',                   etiket: 'Dashboard',        ikon: '📊' },
  {
    etiket: 'Rubrik Yönetimi',
    ikon: '📝',
    altMenuler: [
      { yol: '/kurum/rubrikler',         etiket: 'Rubrikler',        ikon: '📋' },
      { yol: '/kurum/degerlendirmeler',  etiket: 'Değerlendirmeler', ikon: '📝' },
    ]
  },
  {
    etiket: 'Resmi İşlemler',
    ikon: '🏛️',
    altMenuler: [
      { yol: '/kurum/resmi-islemler/is-plani', etiket: 'İş Planı & Takip',  ikon: '📋' },
      { yol: '/kurum/resmi-islemler/evraklar', etiket: 'Evrak Üretimi',     ikon: '📄' },
    ]
  },
  { yol: '/kurum/mentor',            etiket: 'Mentor Programı',  ikon: '🎓' },
  { yol: '/kurum/kulupler',          etiket: 'Kulüp Yönetimi',   ikon: '🏆' },
  { yol: '/kurum/kutuphane',         etiket: 'Kütüphane',        ikon: '📚' },
  { yol: '/kurum/hakkinda',          etiket: 'Hakkında',         ikon: 'ℹ️' },
]

// ── Öğretmen kurum seçici ekranı ─────────────────────────────────────────────
// ── Genel kurum seçici ekranı (Tüm roller için) ─────────────────────────────────
export function GenelKurumSecici({ erisimKurumlar, onSec, profil, onCikis, platformAdmin, ogretmenModu }) {
  const [searchQuery, setSearchQuery] = useState('')

  const isSelectable = (k) => {
    if (platformAdmin) return true
    if (ogretmenModu) return (profil?.erisimKurumIdler || []).includes(k.id)
    if (profil?.rol === 'kurum_admin') {
      const adminKurumId = profil.kurumId
      if (k.id === adminKurumId) return true
      if (k.parentId === adminKurumId) return true
      if (k.rootKurumId === adminKurumId) return true
      const parent = erisimKurumlar.find(item => item.id === k.parentId)
      if (parent && (parent.id === adminKurumId || parent.parentId === adminKurumId)) return true
    }
    return false
  }

  const getBadgeStyle = (k) => {
    if (k.tip === 'kurum') return { bg: '#EEF2FF', color: '#4F46E5', label: '🏛 Ana Kurum' }
    if (k.tip === 'kampus') return { bg: '#E0F2FE', color: '#0369A1', label: '🏫 Kampüs' }
    const nameLower = (k.ad || '').toLowerCase()
    if (nameLower.includes('ilkokul')) return { bg: '#ECFDF5', color: '#047857', label: '🎒 İlkokul' }
    if (nameLower.includes('ortaokul')) return { bg: '#FFFBEB', color: '#B45309', label: '🏫 Ortaokul' }
    if (nameLower.includes('lise')) return { bg: '#FFF1F2', color: '#BE123C', label: '🎓 Lise' }
    return { bg: '#F1F5F9', color: '#475569', label: '🏢 Okul' }
  }

  // Magnifying Glass SVG Icon
  const SearchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#94A3B8' }}>
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  )

  const RootHeader = ({ k }) => {
    return (
      <div style={{
        padding: '1.25rem 1.5rem',
        background: 'linear-gradient(135deg, #1E3A8B 0%, #3B82F6 100%)',
        borderRadius: '16px',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        boxShadow: '0 4px 12px rgba(30, 58, 138, 0.15)'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#93C5FD', fontWeight: '600', marginBottom: '0.15rem' }}>
            Ana Kurum
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800' }}>
            {k.ad}
          </div>
        </div>
        {isSelectable(k) ? (
          <button
            onClick={(e) => { e.stopPropagation(); onSec(k.id); }}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#FFFFFF',
              color: '#1E3A8B',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
          >
            Seç
          </button>
        ) : null}
      </div>
    )
  }

  const KampusContainer = ({ k, children }) => {
    return (
      <div style={{
        background: '#F8FAFC',
        border: '1.5px solid #E2E8F0',
        borderRadius: '18px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          borderBottom: '1px solid #E2E8F0',
          paddingBottom: '0.75rem'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', fontWeight: '600', marginBottom: '0.15rem' }}>
              Kampüs / Şube
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#1E293B' }}>
              {k.ad}
            </div>
          </div>
          {isSelectable(k) ? (
            <button
              onClick={(e) => { e.stopPropagation(); onSec(k.id); }}
              style={{
                padding: '0.4rem 1rem',
                backgroundColor: '#1B3A6B',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.backgroundColor = '#2563EB'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.backgroundColor = '#1B3A6B'; }}
            >
              Kampüsü Seç
            </button>
          ) : null}
        </div>
        {children}
      </div>
    )
  }

  const SelectableCard = ({ k, showParentContext = false }) => {
    const badge = getBadgeStyle(k)
    let parentText = ''
    if (showParentContext && k.parentId) {
      const parent = erisimKurumlar.find(item => item.id === k.parentId)
      if (parent) {
        parentText = parent.ad
        if (parent.parentId) {
          const grandParent = erisimKurumlar.find(item => item.id === parent.parentId)
          if (grandParent) {
            parentText = `${grandParent.ad} › ${parentText}`
          }
        }
      }
    }

    return (
      <div
        className="secici-card"
        onClick={() => onSec(k.id)}
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '1.25rem',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div>
          {parentText && (
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: '500', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {parentText}
            </div>
          )}
          <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1E293B', lineHeight: '1.4', marginBottom: '0.25rem' }}>
            {k.ad}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: '600',
            backgroundColor: badge.bg,
            color: badge.color,
            padding: '4px 10px',
            borderRadius: '999px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            {badge.label}
          </span>
          <span style={{ fontSize: '0.8rem', color: '#1B3A6B', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '2px' }}>
            Seç ➔
          </span>
        </div>
      </div>
    )
  }

  // Flat filtering for search
  const filteredSelectable = erisimKurumlar.filter(k => {
    const isNameMatch = (k.ad || '').toLocaleLowerCase('tr').includes(searchQuery.toLocaleLowerCase('tr'))
    return isNameMatch && isSelectable(k)
  })

  // Group all schools by their parents for the hierarchy view
  const renderHierarchy = () => {
    // Top-level nodes: no parentId OR the parent is not in erisimKurumlar
    const topLevelNodes = erisimKurumlar.filter(
      k => !k.parentId || !erisimKurumlar.some(parent => parent.id === k.parentId)
    )

    if (topLevelNodes.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏫</div>
          <h3 style={{ color: '#1E293B', margin: '0 0 0.5rem 0', fontWeight: '700' }}>Yetkili Olduğunuz Kurum Bulunamadı</h3>
          <p style={{ color: '#64748B', fontSize: '0.9rem', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
            Henüz hiçbir kuruma veya okula atanmamışsınız. Lütfen yöneticinizle iletişime geçin.
          </p>
          <button onClick={onCikis} className="secici-btn-cikis"
            style={{ padding: '0.6rem 1.5rem', background: 'transparent', color: '#EF4444', border: '1.5px solid #FEE2E2', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
            Çıkış Yap
          </button>
        </div>
      )
    }

    return topLevelNodes.map(topNode => {
      // Find direct children
      const level2Nodes = erisimKurumlar.filter(k => k.parentId === topNode.id)

      if (topNode.tip === 'kurum' || !topNode.parentId) {
        const kampusesUnderRoot = level2Nodes.filter(k => k.tip === 'kampus')
        const altsDirectUnderRoot = level2Nodes.filter(k => k.tip === 'altKurum')

        return (
          <div key={topNode.id} style={{ marginBottom: '2rem' }}>
            <RootHeader k={topNode} />
            
            {/* Kampuses under this Root */}
            {kampusesUnderRoot.map(kampus => {
              const altsUnderKampus = erisimKurumlar.filter(k => k.parentId === kampus.id && k.tip === 'altKurum')
              return (
                <KampusContainer key={kampus.id} k={kampus}>
                  {altsUnderKampus.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                      {altsUnderKampus.map(okul => (
                        <SelectableCard key={okul.id} k={okul} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: '#94A3B8', fontStyle: 'italic' }}>
                      Bu kampüse bağlı alt okul bulunmamaktadır.
                    </div>
                  )}
                </KampusContainer>
              )
            })}

            {/* Direct Alt Okullar under this Root (no kampüs) */}
            {altsDirectUnderRoot.length > 0 && (
              <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '18px', padding: '1.25rem', marginTop: '1rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', fontWeight: '600', marginBottom: '0.75rem' }}>
                  Doğrudan Bağlı Okullar
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                  {altsDirectUnderRoot.map(okul => (
                    <SelectableCard key={okul.id} k={okul} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      } else if (topNode.tip === 'kampus') {
        const altsUnderKampus = level2Nodes.filter(k => k.tip === 'altKurum')
        return (
          <KampusContainer key={topNode.id} k={topNode}>
            {altsUnderKampus.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                {altsUnderKampus.map(okul => (
                  <SelectableCard key={okul.id} k={okul} />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#94A3B8', fontStyle: 'italic' }}>
                Bu kampüse bağlı alt okul bulunmamaktadır.
              </div>
            )}
          </KampusContainer>
        )
      } else {
        return (
          <div key={topNode.id} style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
              <SelectableCard k={topNode} showParentContext={true} />
            </div>
          </div>
        )
      }
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #EEF2F6 0%, #E2E8F0 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Dynamic styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .secici-card {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .secici-card:hover {
          transform: translateY(-3px) scale(1.01);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
          border-color: #1B3A6B !important;
        }
        .secici-card:active {
          transform: translateY(-1px) scale(1.0);
        }
        .secici-btn-cikis {
          transition: all 0.2s;
        }
        .secici-btn-cikis:hover {
          background-color: #EF4444 !important;
          color: #fff !important;
          border-color: #EF4444 !important;
        }
        .secici-search-input:focus {
          outline: none;
          border-color: #1B3A6B !important;
          box-shadow: 0 0 0 3px rgba(27, 58, 107, 0.15) !important;
        }
      `}} />

      {/* Decorative background glows */}
      <div style={{ position: 'absolute', width: '400px', height: '400px', background: 'rgba(59, 130, 246, 0.05)', filter: 'blur(100px)', borderRadius: '50%', top: '-100px', left: '-100px', zIndex: 0 }} />
      <div style={{ position: 'absolute', width: '400px', height: '400px', background: 'rgba(139, 92, 246, 0.05)', filter: 'blur(100px)', borderRadius: '50%', bottom: '-100px', right: '-100px', zIndex: 0 }} />

      <div style={{
        width: '100%',
        maxWidth: '860px',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        borderRadius: '24px',
        padding: '2.5rem',
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.06)',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              📚 Okulmatik
            </div>
            <div style={{ fontSize: '0.95rem', color: '#64748B' }}>
              Hoş geldiniz, <strong>{profil?.ad || profil?.email}</strong>. Lütfen devam etmek için bir okul veya kurum seçin.
            </div>
          </div>
          <button onClick={onCikis} className="secici-btn-cikis"
            style={{
              padding: '0.5rem 1.25rem',
              background: '#FFFFFF',
              color: '#64748B',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
            <span>🚪</span> <span>Oturumu Kapat</span>
          </button>
        </div>

        {/* Search bar */}
        {erisimKurumlar.length > 3 && (
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
              <SearchIcon />
            </div>
            <input
              type="text"
              className="secici-search-input"
              placeholder="Kurum veya okul adı ile ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.85rem 1rem 0.85rem 2.75rem',
                fontSize: '0.95rem',
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                background: '#FFFFFF',
                color: '#1E293B',
                boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                transition: 'all 0.15s'
              }}
            />
          </div>
        )}

        {/* Content Area */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
          {searchQuery.trim() ? (
            /* Search results */
            filteredSelectable.length > 0 ? (
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', fontWeight: '600', marginBottom: '1rem' }}>
                  Arama Sonuçları ({filteredSelectable.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                  {filteredSelectable.map(k => (
                    <SelectableCard key={k.id} k={k} showParentContext={true} />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94A3B8' }}>
                Aramanızla eşleşen seçilebilir bir kurum bulunamadı.
              </div>
            )
          ) : (
            /* Structured Hierarchy */
            renderHierarchy()
          )}
        </div>
      </div>
    </div>
  )
}

// ── Ana Layout ────────────────────────────────────────────────────────────────
function KurumLayoutInner() {
  const { profil, cikisYap, platformAdmin } = useAuth()

  const {
    erisimKurumlar, secilenKurumId, secilenKurum,
    setSecilenKurumId, yukleniyor,
    ogretmenModu, ogretmenSinifIdleri,
  } = useKurumYonetim()
  const navigate = useNavigate()
  const location = useLocation()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const getSayfaEtiketi = () => {
    const flatMenus = aktifMenuler.reduce((acc, m) => {
      if (m.altMenuler) acc.push(...m.altMenuler)
      else acc.push(m)
      return acc
    }, [])
    const found = flatMenus.find(m => m.yol === location.pathname)
    if (found) return found.etiket
    const lastPart = location.pathname.split('/').pop()
    if (lastPart === 'kurum') return 'Dashboard'
    return lastPart ? lastPart.charAt(0).toUpperCase() + lastPart.slice(1) : 'Okulmatik'
  }
  const [isAccountOpen, setIsAccountOpen] = useState(false)

  const [acikSubMenuler, setAcikSubMenuler] = useState(() => {
    return {
      'Kullanıcılar': location.pathname.startsWith('/kurum/kullanicilar') || location.pathname.startsWith('/kurum/ogretmenler'),
      'Rubrik Yönetimi': location.pathname.startsWith('/kurum/rubrikler') || location.pathname.startsWith('/kurum/degerlendirmeler'),
      'Resmi İşlemler': location.pathname.startsWith('/kurum/resmi-islemler')
    }
  })

  useEffect(() => {
    const isKullaniciActive = location.pathname.startsWith('/kurum/kullanicilar') || location.pathname.startsWith('/kurum/ogretmenler')
    const isRubrikActive = location.pathname.startsWith('/kurum/rubrikler') || location.pathname.startsWith('/kurum/degerlendirmeler')
    const isResmiActive = location.pathname.startsWith('/kurum/resmi-islemler')
    setAcikSubMenuler(prev => ({
      ...prev,
      'Kullanıcılar': isKullaniciActive ? true : prev['Kullanıcılar'],
      'Rubrik Yönetimi': isRubrikActive ? true : prev['Rubrik Yönetimi'],
      'Resmi İşlemler': isResmiActive ? true : prev['Resmi İşlemler']
    }))
  }, [location.pathname])

  async function handleCikis() { await cikisYap(); navigate('/giris') }

  // Yükleniyor
  if (yukleniyor) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9' }}>
        <div style={{ color: '#64748B', fontSize: '0.9rem' }}>Yükleniyor…</div>
      </div>
    )
  }

  const isSelectable = (k) => {
    if (platformAdmin) return true
    if (ogretmenModu) return (profil?.erisimKurumIdler || []).includes(k.id)
    if (profil?.rol === 'kurum_admin') {
      const adminKurumId = profil.kurumId
      if (k.id === adminKurumId) return true
      if (k.parentId === adminKurumId) return true
      if (k.rootKurumId === adminKurumId) return true
      const parent = erisimKurumlar.find(item => item.id === k.parentId)
      if (parent && (parent.id === adminKurumId || parent.parentId === adminKurumId)) return true
    }
    return false
  }

  // Menü: öğretmene özel mi, yoksa tam menü mü?
  const aktifMenuler = ogretmenModu ? OGRETMEN_MENULER : ADMIN_MENULER

  // Root kurum (parentId yok)
  const rootKurum = erisimKurumlar.find(k => !k.parentId)

  // Seçili kurum için breadcrumb: root → kampüs → altKurum
  function buildBreadcrumb(kurum) {
    if (!kurum) return rootKurum ? [{ id: rootKurum.id, ad: rootKurum.ad }] : []
    const parts = [{ id: kurum.id, ad: kurum.ad }]
    let current = kurum
    while (current.parentId) {
      const parent = erisimKurumlar.find(k => k.id === current.parentId)
      if (!parent) break
      parts.unshift({ id: parent.id, ad: parent.ad })
      current = parent
    }
    return parts
  }

  // ── Rol rozeti ────────────────────────────────────────────
  const kullanicininKurumu = erisimKurumlar.find(k => k.id === profil?.kurumId)
  const rozet = (() => {
    if (ogretmenModu) return { etiket: 'Öğretmen', renk: '#34D399', bg: 'rgba(52,211,153,0.18)' }
    if (profil?.rol === 'kurum_admin') {
      const tip = kullanicininKurumu?.tip
      if (tip === 'kampus')   return { etiket: 'Kampüs Admin',  renk: '#60A5FA', bg: 'rgba(96,165,250,0.18)' }
      if (tip === 'altKurum') return { etiket: 'Okul Admin',    renk: '#C084FC', bg: 'rgba(192,132,252,0.18)' }
      return                          { etiket: 'Kurum Admin',  renk: '#FCD34D', bg: 'rgba(252,211,77,0.18)' }
    }
    return null
  })()

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

  return (
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
          .mobile-header-bar {
            display: flex !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 1000 !important;
            margin-top: -1rem !important;
            margin-left: -1rem !important;
            margin-right: -1rem !important;
            margin-bottom: 1.25rem !important;
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
            padding: 1rem 1rem 80px 1rem !important;
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
            color: #1B3A6B;
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
            background: #EFF6FF;
            border-color: #3B82F6;
          }
          .drawer-item-icon {
            font-size: 1.5rem;
          }
        }
        .mobile-bottom-nav, .mobile-drawer-overlay, .mobile-drawer {
          display: none;
        }
      `}} />
      <aside className="sidebar-aside" style={{
        width: '240px', height: '100vh', background: '#1B3A6B',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0,
        zIndex: 100, transition: 'width 0.2s',
      }}>
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="sidebar-logo-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: rozet ? '0.5rem' : '0' }}>
            <div className="sidebar-logo" style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>
              <span className="logo-emoji">📚</span>
              <span className="logo-text"> Okulmatik</span>
            </div>
            {rozet && (
              <span className="sidebar-badge" style={{
                fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.04em',
                color: rozet.renk, background: rozet.bg,
                border: `1px solid ${rozet.renk}40`,
                borderRadius: '999px', padding: '2px 8px',
                whiteSpace: 'nowrap',
              }}>
                {rozet.etiket}
              </span>
            )}
          </div>
          
          <div className="sidebar-select-container" style={{ marginTop: '0.75rem' }}>
            <div className="sidebar-select-label" style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Kurum / Kampüs Seçimi
            </div>
            
            {(() => {
              const rootlar = erisimKurumlar.filter(k => !k.parentId || !erisimKurumlar.some(p => p.id === k.parentId))
              const kampusler = erisimKurumlar.filter(k => k.tip === 'kampus')
                .sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
              const altlar = erisimKurumlar.filter(k => k.tip === 'altKurum')

              function okulSira(ad = '') {
                const s = ad.toLocaleLowerCase('tr')
                if (s.includes('ilkokul'))  return 1
                if (s.includes('ortaokul')) return 2
                if (s.includes('lise'))     return 3
                return 4
              }

              return (
                <div className="select-wrapper">
                  <select
                    value={secilenKurumId || ''}
                    onChange={e => setSecilenKurumId(e.target.value || null)}
                    className="kurum-select"
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.12)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      padding: '0.5rem',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.2s',
                      marginTop: '0.25rem'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                  >
                    <option value="" style={{ background: '#1B3A6B', color: '#fff' }}>— Seçiniz —</option>
                    
                    {rootlar.map(root => {
                      const kampusAltlar = kampusler.filter(k => k.parentId === root.id)
                      const directOkullar = altlar.filter(k => k.parentId === root.id)
                        .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr'))

                      const options = []
                      
                      if (isSelectable(root)) {
                        options.push(
                          <option key={root.id} value={root.id} style={{ background: '#1B3A6B', color: '#fff' }}>
                            {root.tip === 'kampus' ? '🏫' : (root.tip === 'altKurum' ? '🏢' : '🏛')} {root.ad}
                          </option>
                        )
                      }

                      kampusAltlar.forEach(kp => {
                        if (isSelectable(kp)) {
                          options.push(
                            <option key={kp.id} value={kp.id} style={{ background: '#1B3A6B', color: '#fff' }}>
                              &nbsp;&nbsp;🏫 {kp.ad}
                            </option>
                          )
                        }
                        
                        const kpOkullar = altlar.filter(k => k.parentId === kp.id)
                          .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr'))
                        
                        kpOkullar.forEach(okul => {
                          if (isSelectable(okul)) {
                            options.push(
                              <option key={okul.id} value={okul.id} style={{ background: '#1B3A6B', color: '#fff' }}>
                                &nbsp;&nbsp;&nbsp;&nbsp;└ {okul.ad}
                              </option>
                            )
                          }
                        })
                      })

                      directOkullar.forEach(okul => {
                        if (isSelectable(okul)) {
                          options.push(
                            <option key={okul.id} value={okul.id} style={{ background: '#1B3A6B', color: '#fff' }}>
                              &nbsp;&nbsp;&nbsp;&nbsp;└ {okul.ad}
                            </option>
                          )
                        }
                      })

                      if (options.length === 0) return null

                      return (
                        <optgroup key={root.id} label={root.ad.toUpperCase()} style={{ background: '#1B3A6B', color: '#93C5FD', fontWeight: 'bold' }}>
                          {options}
                        </optgroup>
                      )
                    })}
                  </select>
                  <div className="select-visual" style={{ display: 'none' }}>
                    {selectEmoji}
                  </div>
                </div>
              )
            })()}

            {ogretmenModu && secilenKurumId && (
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem' }}>
                {ogretmenSinifIdleri.length} sınıf atanmış
              </div>
            )}
          </div>
        </div>

        {/* Menü */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '1rem 0' }}>
          {aktifMenuler.map(m => {
            if (m.altMenuler) {
              const isAnyChildActive = m.altMenuler.some(sub => location.pathname.startsWith(sub.yol))
              const isMenuOpen = !!acikSubMenuler[m.etiket]
              return (
                <div key={m.etiket} style={{ opacity: secilenKurumId ? 1 : 0.4 }}>
                  <button
                    onClick={() => {
                      if (secilenKurumId) {
                        setAcikSubMenuler(prev => ({ ...prev, [m.etiket]: !prev[m.etiket] }))
                      }
                    }}
                    className="sidebar-nav-item"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.75rem 1.25rem', background: 'transparent', border: 'none',
                      color: isAnyChildActive && secilenKurumId ? '#fff' : 'rgba(255,255,255,0.65)',
                      cursor: secilenKurumId ? 'pointer' : 'not-allowed',
                      fontSize: '0.9rem',
                      transition: 'all 0.15s', outline: 'none',
                      pointerEvents: secilenKurumId ? 'auto' : 'none'
                    }}
                    onMouseEnter={e => { if (secilenKurumId) e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => {
                      if (!isAnyChildActive && secilenKurumId) e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
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

                  {isMenuOpen && secilenKurumId && (
                    <div className="sidebar-submenu" style={{ background: 'rgba(0,0,0,0.15)', paddingLeft: '0.5rem' }}>
                      {m.altMenuler.map(sub => (
                        <NavLink
                          key={sub.yol}
                          to={sub.yol}
                          className="sidebar-sub-item"
                          style={({ isActive }) => ({
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.65rem 1.25rem', textDecoration: 'none',
                            color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                            background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                            borderLeft: isActive ? '3px solid #60A5FA' : '3px solid transparent',
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
              <NavLink
                key={m.yol}
                to={m.yol}
                end={m.yol === '/kurum'}
                onClick={e => {
                  if (!secilenKurumId) {
                    e.preventDefault()
                  }
                }}
                className="sidebar-nav-item"
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1.25rem', textDecoration: 'none',
                  color: isActive && secilenKurumId ? '#fff' : 'rgba(255,255,255,0.65)',
                  background: isActive && secilenKurumId ? 'rgba(255,255,255,0.12)' : 'transparent',
                  borderLeft: isActive && secilenKurumId ? '3px solid #60A5FA' : '3px solid transparent',
                  fontSize: '0.9rem', fontWeight: isActive && secilenKurumId ? '600' : '400',
                  transition: 'all 0.15s',
                  opacity: secilenKurumId ? 1 : 0.4,
                  cursor: secilenKurumId ? 'pointer' : 'not-allowed',
                  pointerEvents: secilenKurumId ? 'auto' : 'none'
                })}>
                <span className="nav-icon">{m.ikon}</span>
                <span className="nav-text">{m.etiket}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Alt: kullanıcı bilgisi + çıkış */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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
                background: '#1D4ED8', color: '#fff',
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
                {profil?.ad || 'Kullanıcı'}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={profil?.email}>
                {profil?.email}
              </span>
            </div>
          </div>

          {/* Yetki/Rol Rozetleri */}
          <div className="sidebar-badges-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '0.75rem' }}>
            {(() => {
              const r = (() => {
                if (profil?.rol === 'platform_admin') {
                  return { etiket: '⚙ Süper Admin', bg: 'rgba(124,58,237,0.2)', renk: '#C084FC', border: '1px solid rgba(124,58,237,0.3)' }
                }
                if (profil?.rol === 'kurum_admin') {
                  const tip = kullanicininKurumu?.tip
                  if (tip === 'kampus') {
                    return { etiket: '🏫 Kampüs Admin', bg: 'rgba(96,165,250,0.2)', renk: '#93C5FD', border: '1px solid rgba(96,165,250,0.3)' }
                  }
                  if (tip === 'altKurum') {
                    return { etiket: '🏢 Okul Admin', bg: 'rgba(192,132,252,0.2)', renk: '#E9D5FF', border: '1px solid rgba(192,132,252,0.3)' }
                  }
                  return { etiket: '🏛 Kurum Admin', bg: 'rgba(252,211,77,0.2)', renk: '#FDE68A', border: '1px solid rgba(252,211,77,0.3)' }
                }
                if (profil?.rol === 'ogretmen') {
                  return { etiket: '🧑‍🏫 Öğretmen', bg: 'rgba(52,211,153,0.2)', renk: '#A7F3D0', border: '1px solid rgba(52,211,153,0.3)' }
                }
                return null
              })()
              if (!r) return null
              return (
                <span style={{
                  fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.03em',
                  background: r.bg, color: r.renk, border: r.border,
                  padding: '2px 8px', borderRadius: '999px', display: 'inline-block'
                }}>
                  {r.etiket}
                </span>
              )
            })()}
            {profil?.rol === 'ogretmen' && profil?.modulIzinler?.rubrik_olustur && (
              <span style={{
                fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.03em',
                background: 'rgba(245,158,11,0.2)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)',
                padding: '2px 8px', borderRadius: '999px', display: 'inline-block'
              }}>
                ⭐ Koordinatör
              </span>
            )}
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

      <main className="sidebar-main" style={{ marginLeft: '240px', flex: 1, padding: '2rem', position: 'relative' }}>
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
              gap: '0.35rem',
              background: '#F1F5F9',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '700',
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            ⬅ Geri Git
          </button>
          {erisimKurumlar.length > 1 && (
            <select
              value={secilenKurumId || ''}
              onChange={e => setSecilenKurumId(e.target.value || null)}
              style={{
                padding: '0.35rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: '700',
                color: '#1E293B',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                maxWidth: '150px',
                outline: 'none',
                marginLeft: '0.5rem',
                textOverflow: 'ellipsis'
              }}
            >
              <option value="">— Kurum Seç —</option>
              {(() => {
                const rootlar = erisimKurumlar.filter(k => !k.parentId || !erisimKurumlar.some(p => p.id === k.parentId))
                const kampusler = erisimKurumlar.filter(k => k.tip === 'kampus')
                  .sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
                const altlar = erisimKurumlar.filter(k => k.tip === 'altKurum')

                function okulSira(ad = '') {
                  const s = ad.toLocaleLowerCase('tr')
                  if (s.includes('ilkokul'))  return 1
                  if (s.includes('ortaokul')) return 2
                  if (s.includes('lise'))     return 3
                  return 4
                }

                return rootlar.flatMap(root => {
                  const options = []
                  if (isSelectable(root)) {
                    options.push(
                      <option key={root.id} value={root.id}>
                        {root.tip === 'kampus' ? '🏫' : (root.tip === 'altKurum' ? '🏢' : '🏛')} {root.ad}
                      </option>
                    )
                  }
                  
                  const kampusAltlar = kampusler.filter(k => k.parentId === root.id)
                  const directOkullar = altlar.filter(k => k.parentId === root.id)
                    .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr'))

                  kampusAltlar.forEach(kp => {
                    if (isSelectable(kp)) {
                      options.push(
                        <option key={kp.id} value={kp.id}>
                          &nbsp;&nbsp;🏫 {kp.ad}
                        </option>
                      )
                    }
                    
                    const kpOkullar = altlar.filter(k => k.parentId === kp.id)
                      .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr'))
                    
                    kpOkullar.forEach(okul => {
                      if (isSelectable(okul)) {
                        options.push(
                          <option key={okul.id} value={okul.id}>
                            &nbsp;&nbsp;&nbsp;&nbsp;└ {okul.ad}
                          </option>
                        )
                      }
                    })
                  })

                  directOkullar.forEach(okul => {
                    if (isSelectable(okul)) {
                      options.push(
                        <option key={okul.id} value={okul.id}>
                          &nbsp;&nbsp;&nbsp;&nbsp;└ {okul.ad}
                        </option>
                      )
                    }
                  })

                  return options
                })
              })()}
            </select>
          )}
          <div style={{
            fontSize: '0.85rem',
            fontWeight: '600',
            color: '#64748B',
            marginLeft: 'auto'
          }}>
            {getSayfaEtiketi()}
          </div>
        </div>
        {/* Breadcrumb + Logo satırı */}
        {secilenKurumId && (() => {
          const logo = secilenKurum?.logoUrl
            || (secilenKurum?.rootKurumId ? erisimKurumlar.find(k => k.id === secilenKurum.rootKurumId)?.logoUrl : null)
            || rootKurum?.logoUrl
          const breadcrumb = buildBreadcrumb(secilenKurum)
          if (!logo && (ogretmenModu || breadcrumb.length === 0)) return null
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem' }}>
              {/* Breadcrumb: öğretmen modunda gizli */}
              {!ogretmenModu ? (
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
              ) : <div />}
              {/* Kurum logosu */}
              {logo && (
                <img src={logo} alt="Kurum Logosu"
                  style={{ height: '48px', maxWidth: '140px', objectFit: 'contain' }} />
              )}
            </div>
          )
        })()}

        {secilenKurumId ? (
          <Outlet />
        ) : (
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
                color: #1B3A6B;
                position: absolute;
                top: 40px;
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
                Aktif Okul / Kampüs Seçin
              </h2>
              <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: '1.6', margin: 0 }}>
                Uygulama modüllerini ve verileri görüntülemek için lütfen çalışacağınız kurumu veya kampüsü seçin.
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
                  {(() => {
                    const rootlar = erisimKurumlar.filter(k => !k.parentId || !erisimKurumlar.some(p => p.id === k.parentId))
                    const kampusler = erisimKurumlar.filter(k => k.tip === 'kampus')
                      .sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
                    const altlar = erisimKurumlar.filter(k => k.tip === 'altKurum')

                    function okulSira(ad = '') {
                      const s = ad.toLocaleLowerCase('tr')
                      if (s.includes('ilkokul'))  return 1
                      if (s.includes('ortaokul')) return 2
                      if (s.includes('lise'))     return 3
                      return 4
                    }

                    return rootlar.flatMap(root => {
                      const options = []
                      if (isSelectable(root)) {
                        options.push(
                          <option key={root.id} value={root.id}>
                            {root.tip === 'kampus' ? '🏫' : (root.tip === 'altKurum' ? '🏢' : '🏛')} {root.ad}
                          </option>
                        )
                      }
                      
                      const kampusAltlar = kampusler.filter(k => k.parentId === root.id)
                      const directOkullar = altlar.filter(k => k.parentId === root.id)
                        .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr'))

                      kampusAltlar.forEach(kp => {
                        if (isSelectable(kp)) {
                          options.push(
                            <option key={kp.id} value={kp.id}>
                              &nbsp;&nbsp;🏫 {kp.ad}
                            </option>
                          )
                        }
                        
                        const kpOkullar = altlar.filter(k => k.parentId === kp.id)
                          .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr'))
                        
                        kpOkullar.forEach(okul => {
                          if (isSelectable(okul)) {
                            options.push(
                              <option key={okul.id} value={okul.id}>
                                &nbsp;&nbsp;&nbsp;&nbsp;└ {okul.ad}
                              </option>
                            )
                          }
                        })
                      })

                      directOkullar.forEach(okul => {
                        if (isSelectable(okul)) {
                          options.push(
                            <option key={okul.id} value={okul.id}>
                              &nbsp;&nbsp;&nbsp;&nbsp;└ {okul.ad}
                            </option>
                          )
                        }
                      })

                      return options
                    })
                  })()}
                </select>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'rgba(27, 58, 107, 0.05)',
                color: '#1B3A6B',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: '700',
                marginTop: '0.25rem'
              }}>
                <span>💡</span> <span>İşlem yapmak istediğiniz kurumu seçip başlayabilirsiniz.</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobil Alt Navigasyon Barı */}
      {secilenKurumId && (
        <div className="mobile-bottom-nav">
          <button
            onClick={() => { navigate('/kurum'); setIsDrawerOpen(false); setIsAccountOpen(false); }}
            className={`mobile-nav-btn ${location.pathname === '/kurum' ? 'active' : ''}`}
          >
            <span className="mobile-nav-icon">🏠</span>
            <span>Ana Sayfa</span>
          </button>

          <button
            onClick={() => {
              navigate('/kurum/resmi-islemler/is-plani');
              setIsDrawerOpen(false);
              setIsAccountOpen(false);
            }}
            className={`mobile-nav-btn ${location.pathname.includes('/resmi-islemler') ? 'active' : ''}`}
          >
            <span className="mobile-nav-icon">📄</span>
            <span>Resmi Evrak</span>
          </button>

          <button
            onClick={() => {
              navigate('/kurum/rubrikler');
              setIsDrawerOpen(false);
              setIsAccountOpen(false);
            }}
            className={`mobile-nav-btn ${location.pathname.includes('/rubrikler') || location.pathname.includes('/degerlendirmeler') ? 'active' : ''}`}
          >
            <span className="mobile-nav-icon">📝</span>
            <span>Değerlendirme</span>
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
      )}

      {/* Modüller Drawer Çekmecesi */}
      <div
        className={`mobile-drawer-overlay ${isDrawerOpen ? 'open' : ''}`}
        onClick={() => setIsDrawerOpen(false)}
      />
      <div className={`mobile-drawer ${isDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <span className="drawer-title">🧩 Tüm Aktif Modüller</span>
          <button className="drawer-close" onClick={() => setIsDrawerOpen(false)}>✕</button>
        </div>
        <div className="drawer-grid">
          {(() => {
            const drawerLinks = []
            aktifMenuler.forEach(m => {
              if (m.altMenuler) {
                m.altMenuler.forEach(sub => {
                  drawerLinks.push({ yol: sub.yol, etiket: sub.etiket, ikon: sub.ikon })
                })
              } else if (m.yol !== '/kurum') {
                drawerLinks.push({ yol: m.yol, etiket: m.etiket, ikon: m.ikon })
              }
            })
            return drawerLinks.map(link => (
              <NavLink
                key={link.yol}
                to={link.yol}
                onClick={() => setIsDrawerOpen(false)}
                className="drawer-item"
              >
                <span className="drawer-item-icon">{link.ikon}</span>
                <span>{link.etiket}</span>
              </NavLink>
            ))
          })()}
        </div>
      </div>

      {/* Hesap/Profil Drawer Çekmecesi */}
      <div
        className={`mobile-drawer-overlay ${isAccountOpen ? 'open' : ''}`}
        onClick={() => setIsAccountOpen(false)}
      />
      <div className={`mobile-drawer ${isAccountOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <span className="drawer-title">👤 Kullanıcı Hesabı</span>
          <button className="drawer-close" onClick={() => setIsAccountOpen(false)}>✕</button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', margin: '1rem 0' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: '#1B3A6B', color: '#fff',
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
            <div style={{ fontWeight: '800', color: '#1E293B', fontSize: '1rem' }}>{profil?.ad}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>{profil?.email}</div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', margin: '0.5rem 0' }}>
            {rozet && (
              <span style={{
                fontSize: '0.7rem', fontWeight: '700',
                color: rozet.renk, background: rozet.bg,
                border: `1px solid ${rozet.renk}40`,
                borderRadius: '999px', padding: '3px 10px',
              }}>
                {rozet.etiket}
              </span>
            )}
            {profil?.rol === 'ogretmen' && profil?.modulIzinler?.rubrik_olustur && (
              <span style={{
                fontSize: '0.7rem', fontWeight: '700',
                background: 'rgba(245,158,11,0.15)', color: '#D97706', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: '999px', padding: '3px 10px',
              }}>
                ⭐ Koordinatör
              </span>
            )}
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
        </div>
      </div>
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
