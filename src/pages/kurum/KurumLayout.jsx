import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { KurumYonetimProvider, useKurumYonetim } from '../../contexts/KurumYonetimContext'

// Tüm kullanıcılar için menü
const ADMIN_MENULER = [
  { yol: '/kurum',                   etiket: 'Dashboard',        ikon: '📊' },
  { yol: '/kurum/siniflar',          etiket: 'Sınıflar',         ikon: '🏫' },
  { yol: '/kurum/ogrenciler',        etiket: 'Öğrenciler',       ikon: '🎒' },
  { yol: '/kurum/kullanicilar',      etiket: 'Kullanıcılar',     ikon: '👥' },
  { yol: '/kurum/rubrikler',         etiket: 'Rubrikler',        ikon: '📋' },
  { yol: '/kurum/degerlendirmeler',  etiket: 'Değerlendirmeler', ikon: '📝' },
]

// Öğretmen sadece bu menüleri görür
const OGRETMEN_MENULER = [
  { yol: '/kurum',                   etiket: 'Dashboard',        ikon: '📊' },
  { yol: '/kurum/rubrikler',         etiket: 'Rubrikler',        ikon: '📋' },
  { yol: '/kurum/degerlendirmeler',  etiket: 'Değerlendirmeler', ikon: '📝' },
]

// ── Öğretmen kurum seçici ekranı ─────────────────────────────────────────────
function OgretmenKurumSecici({ erisimKurumlar, atananKurumIds, onSec, profil, onCikis }) {
  if (erisimKurumlar.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏫</div>
          <h2 style={{ color: '#1E293B', marginBottom: '0.5rem' }}>Sınıf Ataması Yok</h2>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Henüz hiçbir sınıfa atanmamışsınız. Kurum yöneticinizle iletişime geçin.
          </p>
          <button onClick={onCikis}
            style={{ padding: '0.6rem 1.5rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
            Çıkış Yap
          </button>
        </div>
      </div>
    )
  }

  // Kampüsler (parentKurumIdler'den yüklenenler — sadece başlık/gruplandırma için)
  const kampusler = erisimKurumlar.filter(k => k.tip === 'kampus')
  // Seçilebilir kurumlar: sadece öğretmene atanan kurumlar (root/kampüs dışlar)
  const secilebilir = erisimKurumlar.filter(k => atananKurumIds.includes(k.id))

  // Kampüs altında gruplanmış okul listesi
  const gruplar = kampusler
    .map(kp => ({
      kampus: kp,
      okullar: secilebilir.filter(k => k.parentId === kp.id),
    }))
    .filter(g => g.okullar.length > 0)

  // Hiçbir kampüse bağlı olmayan direkt kurumlar
  const kampussuz = secilebilir.filter(k => !kampusler.find(kp => kp.id === k.parentId))

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      {/* Başlık */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>
          📚 Okulmatik
        </div>
        <div style={{ fontSize: '1rem', color: '#64748B' }}>
          Merhaba <strong>{profil?.ad || profil?.email}</strong>, hangi okulda çalışacaksınız?
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', width: '100%', maxWidth: '840px' }}>

        {/* Kampüs kartları — içinde okullar listelenir */}
        {gruplar.map(({ kampus, okullar }) => (
          <div key={kampus.id} style={{
            background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '14px',
            overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            {/* Kampüs başlığı */}
            <div style={{ padding: '1rem 1.25rem', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.3rem' }}>🏫</div>
              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#1E293B' }}>{kampus.ad}</div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '0.15rem' }}>
                {okullar.length} okul
              </div>
            </div>
            {/* Okul butonları */}
            <div style={{ padding: '0.5rem' }}>
              {okullar.map(okul => (
                <button key={okul.id} onClick={() => onSec(okul.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 0.875rem', background: 'none', border: 'none',
                    borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                  <span style={{ fontSize: '1.2rem' }}>🏢</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1E293B' }}>{okul.ad}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Kampüssüz direkt kurumlar (kampüs hiyerarşisi yoksa) */}
        {kampussuz.map(k => (
          <button key={k.id} onClick={() => onSec(k.id)}
            style={{
              background: '#fff', border: '2px solid #E2E8F0', borderRadius: '14px',
              padding: '1.5rem 1.25rem', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#1B3A6B'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(27,58,107,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🏢</div>
            <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1E293B' }}>{k.ad}</div>
          </button>
        ))}

      </div>

      <button onClick={onCikis}
        style={{ marginTop: '2rem', padding: '0.5rem 1.25rem', background: 'none', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem', color: '#64748B', cursor: 'pointer' }}>
        Çıkış Yap
      </button>
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

  async function handleCikis() { await cikisYap(); navigate('/giris') }

  // Yükleniyor
  if (yukleniyor) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9' }}>
        <div style={{ color: '#64748B', fontSize: '0.9rem' }}>Yükleniyor…</div>
      </div>
    )
  }

  // ── Öğretmen: çoklu kurum seçici ──────────────────────────────────────────
  if (ogretmenModu && !secilenKurumId) {
    return (
      <OgretmenKurumSecici
        erisimKurumlar={erisimKurumlar}
        atananKurumIds={profil?.erisimKurumIdler || []}
        onSec={setSecilenKurumId}
        profil={profil}
        onCikis={handleCikis}
      />
    )
  }

  // Menü: öğretmene özel mi, yoksa tam menü mü?
  const aktifMenuler = ogretmenModu ? OGRETMEN_MENULER : ADMIN_MENULER

  // Root kurum (parentId yok)
  const rootKurum = erisimKurumlar.find(k => !k.parentId)

  // Admin için kurum seçici — hiyerarşi yapısı
  const secilebilir = platformAdmin
    ? erisimKurumlar
    : erisimKurumlar.filter(k => k.parentId)

  // optgroup yapısı: root → [ { kampus, altlar[] } ]
  const rootlar   = erisimKurumlar.filter(k => !k.parentId)
  const kampusler = erisimKurumlar.filter(k => k.tip === 'kampus')
  const altlar    = erisimKurumlar.filter(k => k.tip === 'altKurum')
  const kurumGruplari = rootlar.map(root => ({
    root,
    kampusGruplari: kampusler
      .filter(k => k.parentId === root.id)
      .map(kp => ({ kampus: kp, altKurumlar: altlar.filter(k => k.parentId === kp.id) })),
  }))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9' }}>
      <aside style={{
        width: '240px', minHeight: '100vh', background: '#1B3A6B',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0,
      }}>
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>📚 Okulmatik</div>

          {/* ── Öğretmen modu: okul bilgisi + değiştir butonu ── */}
          {ogretmenModu ? (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Aktif Okul
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#fff', marginBottom: '0.25rem' }}>
                {secilenKurum?.ad || '—'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>
                {ogretmenSinifIdleri.length} sınıf atanmış
              </div>
              {erisimKurumlar.length > 1 && (
                <button onClick={() => setSecilenKurumId(null)}
                  style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '5px', padding: '3px 10px', cursor: 'pointer' }}>
                  ⇄ Okul Değiştir
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Admin modu: root kurum başlığı + dropdown */}
              {!platformAdmin && (
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: '0.5rem' }}>
                  {rootKurum?.ad || '—'}
                </div>
              )}
              {secilebilir.length > 0 && (
                <select
                  value={secilenKurumId || ''}
                  onChange={e => setSecilenKurumId(e.target.value || rootKurum?.id)}
                  style={{
                    marginTop: '0.5rem', width: '100%',
                    background: 'rgba(255,255,255,0.12)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
                    padding: '0.375rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer',
                  }}>
                  {!platformAdmin && (
                    <option value="" style={{ background: '#1B3A6B' }}>— Kurum seçin —</option>
                  )}
                  {kurumGruplari.flatMap(({ root, kampusGruplari }) => [
                    /* Root seviyesi */
                    platformAdmin && (
                      <optgroup key={`root-${root.id}`} label={`🏛 ${root.ad.toUpperCase()}`}>
                        <option value={root.id} style={{ background: '#1B3A6B' }}>🏛 {root.ad}</option>
                      </optgroup>
                    ),
                    /* Kampüs ve altKurumlar */
                    ...kampusGruplari.map(({ kampus, altKurumlar }) => (
                      <optgroup key={kampus.id} label={`  🏫 ${kampus.ad}`}>
                        <option value={kampus.id} style={{ background: '#1B3A6B' }}>🏫 {kampus.ad}</option>
                        {altKurumlar.map(ak => (
                          <option key={ak.id} value={ak.id} style={{ background: '#1B3A6B' }}>
                            {'  '}└ {ak.ad}
                          </option>
                        ))}
                      </optgroup>
                    )),
                  ].filter(Boolean))}
                </select>
              )}
            </>
          )}
        </div>

        {/* Menü */}
        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {aktifMenuler.map(m => (
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
              })}>
              <span>{m.ikon}</span>
              <span>{m.etiket}</span>
            </NavLink>
          ))}
        </nav>

        {/* Alt: kullanıcı bilgisi + çıkış */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {ogretmenModu && profil?.modulIzinler?.rubrik_olustur && (
            <div style={{ fontSize: '0.68rem', background: 'rgba(251,191,36,0.2)', color: '#FDE68A', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '5px', padding: '2px 8px', marginBottom: '0.5rem', textAlign: 'center', fontWeight: '600' }}>
              ⭐ Koordinatör
            </div>
          )}
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
