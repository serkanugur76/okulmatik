import React, { useState } from 'react'

export default function Hakkinda() {
  const [aktifModul, setAktifModul] = useState(null)

  const KATEGORILER = [
    {
      baslik: '1. Kurumsal Altyapı & Yetkilendirme',
      ikon: '🔑',
      renk: '#4F46E5',
      moduller: [
        {
          ikon: '🏛',
          ad: 'Kurumlar',
          aciklama: 'Okulmatik hiyerarşisinin temel taşıdır. İlkokul, ortaokul, lise gibi farklı düzeylerdeki okul ve kampüs yapılarını tek çatı altında toplar. Kurum logoları ve temel kimlik tanımları bu modülde yapılır.',
          iliskiler: 'Bu modül tanımlandıktan sonra Kullanıcılar, Sınıflar ve Kütüphane modülleri bu kurum ID\'sine bağlanarak aktifleşir.'
        },
        {
          ikon: '👥',
          ad: 'Kullanıcılar',
          aciklama: 'Sistemdeki rol ve yetkilendirmeleri yönetir. Platform Yöneticisi (Süper Admin), Kurum/Kampüs/Okul Yöneticileri ve Öğretmenlerin sisteme davet edilmesi, şifre süreçleri ve modül izinlerinin atanması burada yapılır.',
          iliskiler: 'Kullanıcılar doğrudan bir Kuruma bağlanır. Öğretmenler ise kendi yetki alanlarına göre Sınıflar, Mentorluklar, Kulüpler ve Nöbetler ile ilişkilendirilir.'
        }
      ]
    },
    {
      baslik: '2. Eğitsel Düzen ve Yapılanma',
      ikon: '🏫',
      renk: '#0284C7',
      moduller: [
        {
          ikon: '🏫',
          ad: 'Sınıflar',
          aciklama: 'Kurum altındaki akademik grupları (şubeleri) yönetir. Hangi okul düzeyinde hangi sınıfların aktif olduğunu ve şube detaylarını saklar.',
          iliskiler: 'Sınıflar bir Kuruma bağlıdır. Öğrenciler bu sınıflara atanır ve Öğretmenler bu sınıflarda ders vermek üzere yetkilendirilir.'
        },
        {
          ikon: '🎒',
          ad: 'Öğrenciler',
          aciklama: 'Öğrenci kimlik kayıtlarını ve sınıf eşleşmelerini yönetir. Excel (.xlsx, .csv) şablonları aracılığıyla yüzlerce öğrencinin tek tıkla sisteme aktarılmasını sağlar.',
          iliskiler: 'Öğrenciler doğrudan Sınıflara atanır. Rubrik değerlendirmeleri, kulüp üyelikleri ve mentorluk takipleri öğrenci bazlı yapılır.'
        },
        {
          ikon: '📅',
          ad: 'Belirli Gün & Tatiller',
          aciklama: 'Eğitim-öğretim yılı resmi tatillerini, MEB çalışma takvimini ve belirli günleri yönetir. Derslerin çakışma ve blokaj durumlarını kontrol etmek için kullanılır.',
          iliskiler: 'Sistem genelinde tanımlanır, öğretmenlerin yıllık iş planları ve ders takvimleri ile entegre çalışır.'
        }
      ]
    },
    {
      baslik: '3. Ölçme, Değerlendirme & Gelişim',
      ikon: '📊',
      renk: '#059669',
      moduller: [
        {
          ikon: '📋',
          ad: 'Rubrik Şablonlar',
          aciklama: 'Ölçme kriterlerinin standartlaştırılmasını sağlar. Kriterler ve başarı düzeylerini içeren genel şablon havuzudur. Platform yöneticisi tarafından tüm sistem genelinde paylaşılır.',
          iliskiler: 'Kurum Rubrikleri modülü, bu genel şablonları kopyalayarak kendi okul düzeylerine uygun özel rubrikler türetir.'
        },
        {
          ikon: '📝',
          ad: 'Kurum Rubrikleri',
          aciklama: 'Öğretmenlerin ve kurum yöneticilerinin ders veya kazanım bazında özelleştirdiği değerlendirme ölçekleridir. Sınıf seviyelerine ve branşlara göre filtrelenir.',
          iliskiler: 'Değerlendirmeler modülünde öğrencileri puanlamak için ana şablon olarak kullanılır.'
        },
        {
          ikon: '✅',
          ad: 'Değerlendirmeler',
          aciklama: 'Öğretmenlerin sınıflarındaki öğrencileri, atanan rubrik kriterlerine göre puanladığı, karne çıktısı veya dijital kazanım raporu ürettiği operasyonel modüldür.',
          iliskiler: 'Doğrudan Öğrenciler, Sınıflar ve Kurum Rubrikleri modülleriyle tam entegre çalışır.'
        },
        {
          ikon: '🎓',
          ad: 'Mentor Programı',
          aciklama: 'Rehberlik ve mentor öğretmenlerin, kendilerine atanan öğrencilerin gelişim süreçlerini dönem bazında Likert ölçekleri ve nitel yorumlar ile değerlendirdiği modüldür.',
          iliskiler: 'Öğrenciler, sınıf bilgileri ve mentor atamalarıyla ilişkili olarak çalışır; veli/yönetim bilgilendirmeleri için temel oluşturur.'
        }
      ]
    },
    {
      baslik: '4. Sosyal Etkinlik & Operasyonel Modüller',
      ikon: '🏆',
      renk: '#D97706',
      moduller: [
        {
          ikon: '🏆',
          ad: 'Kulüp Yönetimi',
          aciklama: 'Öğrenci kulüplerinin planlanması, üye öğrenci seçimleri, haftalık yoklamalar, kulüp etkinlik girişleri ve dönem sonu kulüp değerlendirme raporlarının oluşturulması sürecini yönetir.',
          iliskiler: 'Öğrenciler ve sorumlu Öğretmenler veritabanıyla entegre çalışır.'
        },
        {
          ikon: '🛡️',
          ad: 'Nöbet Yönetimi',
          aciklama: 'Okuldaki nöbet noktalarını (katlar, bahçe vb.) tanımlar, öğretmenleri nöbet günlerine atar ve nöbet esnasında durum bildirimleri ile yoklama süreçlerini takip eder.',
          iliskiler: 'Kurum öğretmenleri ve okul fiziksel alanları ile entegre çalışarak okul güvenliğini artırır.'
        },
        {
          ikon: '📚',
          ad: 'Kütüphane',
          aciklama: 'Okulun kitap envanterini yönetir. Barkodlu ve hızlı arama ile öğrencilere/öğretmenlere kitap ödünç verme, iade alma süreçlerini dijitalleştirir. Excel ile toplu yükleme desteği vardır.',
          iliskiler: 'Kitap alan kişileri doğrulamak için Öğrenciler ve Kullanıcılar listesiyle entegre çalışır.'
        },
        {
          ikon: '🏛️',
          ad: 'Resmi İşlemler',
          aciklama: 'Eğitim kurumunun resmi iş planı ve görev takiplerini yürütür. Ayrıca sistemdeki verileri kullanarak dilekçe, resmi yazı ve raporlar gibi evrakları dinamik şablonlarla otomatik üretir.',
          iliskiler: 'Sınıf, öğrenci, öğretmen ve kurum bilgileriyle dinamik değişkenler üzerinden haberleşir.'
        }
      ]
    }
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <div style={{
              display: 'inline-block', fontSize: '0.68rem', fontWeight: '800', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#93C5FD', background: 'rgba(147,197,253,0.15)',
              padding: '3px 10px', borderRadius: '999px', marginBottom: '0.5rem'
            }}>
              Geliştirici &amp; Bilişim Teknolojileri Öğretmeni
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', margin: 0 }}>
              Serkan Uğur
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#93C5FD', fontWeight: '600', margin: '0.2rem 0 0' }}>
              Mersin Gelecek Koleji BT &amp; Yazılım Öğretmeni · Yazılım Geliştirici &amp; Sosyal Teknolog
            </p>
          </div>

          <p style={{ fontSize: '0.875rem', color: '#E2E8F0', lineHeight: '1.6', margin: 0 }}>
            Eğitim teknolojileri, robotik kodlama, STEM, Arduino, TÜBİTAK ve Teknofest projeleriyle öğrencileri geleceğe hazırlayan bir bilişim eğitimcisidir.
            Okulmatik sisteminin analizi, mimari altyapısı, veritabanı tasarımı, arayüz geliştirmeleri ve tüm modülleri kendisi tarafından özgün olarak kodlanmıştır.
          </p>
        </div>
      </div>

      {/* İlişkisel Modül Yapısı */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '800', color: '#1E293B', margin: '0 0 0.25rem' }}>
            Uygulama Modülleri ve İlişkisel Yapı
          </h2>
          <p style={{ color: '#64748B', fontSize: '0.85rem', margin: 0 }}>
            Modüllerin üzerine tıklayarak ne işe yaradıklarını ve diğer modüllerle olan ilişkilerini detaylı olarak görebilirsiniz.
          </p>
        </div>

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

                {/* Tıklanabilir Buton Grupları */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {kat.moduller.map((m, mIdx) => (
                    <button
                      key={mIdx}
                      onClick={() => setAktifModul({ ...m, kategori: kat.baslik, renk: kat.renk })}
                      style={{
                        background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '10px',
                        padding: '0.625rem 1rem', display: 'flex', gap: '0.625rem', alignItems: 'center',
                        cursor: 'pointer', transition: 'all 0.15s ease', outline: 'none'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = kat.renk;
                        e.currentTarget.style.background = '#fff';
                        e.currentTarget.style.boxShadow = `0 4px 12px ${kat.renk}15`;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.borderColor = '#E2E8F0';
                        e.currentTarget.style.background = '#F8FAFC';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <span style={{
                        fontSize: '1.1rem', width: '28px', height: '28px', borderRadius: '6px',
                        background: '#fff', border: '1px solid #E2E8F0', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {m.ikon}
                      </span>
                      <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#1E293B' }}>
                        {m.ad}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: '0.25rem' }}>➔</span>
                    </button>
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

      {/* MODAL (AÇILIR PENCERE) */}
      {aktifModul && (
        <div 
          onClick={e => e.target === e.currentTarget && setAktifModul(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000, padding: '1rem'
          }}
        >
          <div style={{
            background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '480px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #E2E8F0',
            overflow: 'hidden', animation: 'scaleUp 0.2s ease-out'
          }}>
            {/* Modal Üst Renk Bandı */}
            <div style={{ height: '6px', background: aktifModul.renk }} />

            {/* Modal İçerik */}
            <div style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    fontSize: '1.5rem', width: '48px', height: '48px', borderRadius: '12px',
                    background: '#F8FAFC', border: '1.5px solid #E2E8F0', display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                  }}>
                    {aktifModul.ikon}
                  </span>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#1E293B', margin: 0 }}>
                      {aktifModul.ad} Modülü
                    </h3>
                    <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {aktifModul.kategori.split('. ')[1]}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setAktifModul(null)}
                  style={{
                    background: 'none', border: 'none', fontSize: '1.5rem', color: '#94A3B8',
                    cursor: 'pointer', outline: 'none', padding: '4px', display: 'flex'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modül Açıklaması */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                    Modül Amacı ve Fonksiyonu
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: '1.6', margin: 0 }}>
                    {aktifModul.aciklama}
                  </p>
                </div>

                {/* Modüller Arası İlişki */}
                <div style={{
                  background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px',
                  padding: '1rem', borderLeft: `3px solid ${aktifModul.renk}`
                }}>
                  <h4 style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    🔗 İlişkili Olduğu Modüller
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                    {aktifModul.iliskiler}
                  </p>
                </div>
              </div>

              {/* Modal Kapat Butonu */}
              <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setAktifModul(null)}
                  style={{
                    padding: '0.55rem 1.5rem', background: '#1E293B', color: '#fff',
                    border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600',
                    cursor: 'pointer', transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#0F172A'}
                  onMouseLeave={e => e.currentTarget.style.background = '#1E293B'}
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animasyon CSS */}
      <style>{`
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
