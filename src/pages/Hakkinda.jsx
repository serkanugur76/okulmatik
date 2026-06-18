import React from 'react'

export default function Hakkinda() {
  const KATEGORILER = [
    {
      baslik: '1. Kurumsal Altyapı & Yetkilendirme',
      ikon: '🔑',
      renk: '#4F46E5', // indigo
      moduller: [
        { ikon: '🏛', ad: 'Kurumlar', aciklama: 'Okul, kampüs ve kök kurum hiyerarşisinin yönetimi; kurum logosu ve temel kimlik tanımları.' },
        { ikon: '👥', ad: 'Kullanıcılar', aciklama: 'Platform Admin, Kurum Admin ve Öğretmen rollerinin davet, yetki ve erişim sınırlarının yönetimi.' }
      ]
    },
    {
      baslik: '2. Eğitsel Düzen ve Yapılanma',
      ikon: '🏫',
      renk: '#0284C7', // sky
      moduller: [
        { ikon: '🏫', ad: 'Sınıflar', aciklama: 'Okul bünyesindeki aktif sınıfların, şubelerin oluşturulması, düzenlenmesi ve arşivlenmesi.' },
        { ikon: '🎒', ad: 'Öğrenciler', aciklama: 'Öğrencilerin kaydedilmesi, sınıflarla eşleştirilmesi ve Excel ile toplu öğrenci yükleme işlemleri.' }
      ]
    },
    {
      baslik: '3. Ölçme, Değerlendirme & Raporlama',
      ikon: '📊',
      renk: '#059669', // emerald
      moduller: [
        { ikon: '📋', ad: 'Rubrik Şablonlar', aciklama: 'Platform genelinde paylaşılan; ders, ana başlık ve alt kriter seviyelerinden oluşan rubrik havuzu.' },
        { ikon: '📝', ad: 'Kurum Rubrikleri', aciklama: 'Kuruma veya öğretmene özel oluşturulan, şablonlardan türetilen ve sınıf seviyesine göre filtrelenen rubrikler.' },
        { ikon: '✅', ad: 'Değerlendirmeler', aciklama: 'Öğretmenlerin rubrik kriterleri üzerinden sınıf bazlı değerlendirme yapması ve öğrenci gelişim karnelerinin raporlanması.' }
      ]
    },
    {
      baslik: '4. Yardımcı & Destekleyici Sistemler',
      ikon: '📚',
      renk: '#D97706', // amber
      moduller: [
        { ikon: '📚', ad: 'Kütüphane', aciklama: 'Okul kütüphanesindeki kitapların Excel ile toplu yüklenmesi, barkodlu ödünç ve iade süreçlerinin takibi.' }
      ]
    }
  ]

  const REHBER_ETIKETLERI = [
    'Serkan Hoca Bilişim 🧑‍🏫',
    'Serkan Uğur Gelecek Koleji 🏫',
    'Yazılımcı Serkan 💻',
    'Bilişim Serkan Hoca ⚙️',
    'Sosyal Teknolog 🌐'
  ]

  return (
    <div style={{ maxWidth: '840px', paddingBottom: '3rem' }}>
      {/* Üst Başlık */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1E293B', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📚 Okulmatik Eğitim Portalı
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.975rem', lineHeight: '1.6', margin: 0 }}>
          Okulmatik; okul, kampüs ve kurum hiyerarşilerini tek bir platformda birleştiren, 
          rubrik tabanlı öğrenci değerlendirmelerini dijitalleştiren ve kütüphane/öğrenci takip süreçlerini kolaylaştıran modern bir eğitim yönetim sistemidir.
        </p>
      </div>

      {/* Geliştirici Profil Kartı (Serkan Uğur) */}
      <div style={{
        background: 'linear-gradient(135deg, #1E1B4B 0%, #1E40AF 100%)',
        borderRadius: '16px', padding: '1.75rem 2rem', marginBottom: '2.5rem',
        color: '#fff', boxShadow: '0 10px 25px -5px rgba(30, 27, 75, 0.25)',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Dekoratif Arka Plan Dairesi */}
        <div style={{
          position: 'absolute', right: '-40px', top: '-40px', width: '180px', height: '180px',
          borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{
              display: 'inline-block', fontSize: '0.68rem', fontWeight: '800', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#93C5FD', background: 'rgba(147,197,253,0.15)',
              padding: '3px 10px', borderRadius: '999px', marginBottom: '0.75rem'
            }}>
              Geliştirici &amp; Bilişim Teknolojileri Öğretmeni
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', margin: 0 }}>
              Serkan Uğur
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#93C5FD', fontWeight: '600', margin: '0.25rem 0 0' }}>
              Mersin Gelecek Koleji BT &amp; Yazılım Öğretmeni · Sosyal Teknolog · Yazılım Geliştirici
            </p>
          </div>

          <p style={{ fontSize: '0.875rem', color: '#E2E8F0', lineHeight: '1.6', margin: 0 }}>
            Eğitim teknolojileri, robotik kodlama, STEM, Arduino, TÜBİTAK ve Teknofest projeleriyle öğrencileri geleceğe hazırlayan bir bilişim eğitimcisidir.
            Okulmatik sisteminin analizi, mimari altyapısı, veritabanı tasarımı, arayüz geliştirmeleri ve tüm modülleri kendisi tarafından özgün olarak kodlanmıştır.
          </p>

          {/* Getcontact Etiketleri Bölümü */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Rehber &amp; Getcontact Dijital Etiketleri
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {REHBER_ETIKETLERI.map((etiket, i) => (
                <span key={i} style={{
                  fontSize: '0.72rem', fontWeight: '600', color: '#fff',
                  background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255,255,255,0.15)',
                  padding: '3px 10px', borderRadius: '6px', cursor: 'default',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
                  {etiket}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* İlişkisel Modül Yapısı (Akış Şeması şeklinde) */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '800', color: '#1E293B', marginBottom: '1.25rem' }}>
          Uygulama Modülleri ve İlişkisel Veri Akışı
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
          {KATEGORILER.map((kat, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              {/* İlişki Akış Oku / Çizgisi */}
              {idx < KATEGORILER.length - 1 && (
                <div style={{
                  position: 'absolute', left: '24px', bottom: '-28px', width: '2px', height: '28px',
                  background: 'linear-gradient(to bottom, #CBD5E1, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1
                }}>
                  <span style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '14px' }}>▼</span>
                </div>
              )}

              {/* Kategori Kartı */}
              <div style={{
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px',
                padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                borderLeft: `4px solid ${kat.renk}`
              }}>
                {/* Kategori Başlığı */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>{kat.ikon}</span>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1E293B', margin: 0 }}>
                    {kat.baslik}
                  </h3>
                </div>

                {/* Kategori İçindeki Modüller */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                  {kat.moduller.map((m, mIdx) => (
                    <div key={mIdx} style={{
                      background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px',
                      padding: '0.875rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                      transition: 'transform 0.15s, border-color 0.15s', cursor: 'default'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = kat.renk + '40';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.borderColor = '#E2E8F0';
                    }}>
                      <span style={{
                        fontSize: '1.25rem', width: '36px', height: '36px', borderRadius: '8px',
                        background: '#fff', border: '1px solid #E2E8F0', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {m.ikon}
                      </span>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#1E293B', marginBottom: '0.15rem' }}>
                          {m.ad}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B', lineHeight: '1.45' }}>
                          {m.aciklama}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Teknik Altyapı */}
      <div style={{
        background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px',
        padding: '1.25rem 1.5rem',
      }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          ⚙️ Teknolojik Altyapı &amp; Stack
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem 1.5rem' }}>
          {[
            ['Frontend Framework', 'React 18 + Vite'],
            ['Stil Yönetimi',      'Vanilla CSS'],
            ['Veritabanı',         'Firebase Firestore'],
            ['Oturum Yönetimi',    'Firebase Authentication'],
            ['İstemci Yönlendirme','React Router v6'],
            ['Dosya Çözümleme',    'XLSX (SheetJS)'],
          ].map(([etiket, deger]) => (
            <div key={etiket} style={{ display: 'flex', flexDirection: 'column', padding: '0.4rem 0', borderBottom: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{etiket}</span>
              <span style={{ fontSize: '0.825rem', color: '#1E293B', fontWeight: '700', marginTop: '0.15rem' }}>{deger}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
