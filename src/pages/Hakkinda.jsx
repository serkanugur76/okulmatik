export default function Hakkinda() {
  const MODULLER = [
    { ikon: '🏛', ad: 'Kurumlar',         aciklama: 'Okul, kampüs ve kurum hiyerarşisinin yönetimi; logo ve temel bilgi tanımları.' },
    { ikon: '👥', ad: 'Kullanıcılar',      aciklama: 'Platform admin, kurum admin ve öğretmen rollerinin oluşturulması ve yönetimi.' },
    { ikon: '🏫', ad: 'Sınıflar',          aciklama: 'Kurum bünyesindeki sınıfların oluşturulması, düzenlenmesi ve arşivlenmesi.' },
    { ikon: '🎒', ad: 'Öğrenciler',        aciklama: 'Öğrenci kaydı, sınıf ataması ve toplu içe aktarma işlemleri.' },
    { ikon: '📋', ad: 'Rubrik Şablonlar',  aciklama: 'Platform genelinde paylaşılan; ana başlık, alt kriter ve puanlama seviyelerinden oluşan değerlendirme şablonları.' },
    { ikon: '📝', ad: 'Rubrikler',         aciklama: 'Kurum ve öğretmen düzeyinde oluşturulan; şablondan türetilebilen, sınıf seviyesine göre filtrelenen rubrikler.' },
    { ikon: '✅', ad: 'Değerlendirmeler',  aciklama: 'Öğrencilerin rubrik kriterleri üzerinden sınıf bazlı değerlendirilmesi ve sonuçların raporlanması.' },
    { ikon: '📚', ad: 'Kütüphane',         aciklama: 'Kurum kütüphanesindeki kitapların kaydı, Excel ile toplu kitap yükleme ve ödünç/iade takip işlemleri.' },
  ]

  return (
    <div style={{ maxWidth: '760px' }}>

      {/* Başlık */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1E293B', marginBottom: '0.375rem' }}>
          📚 Okulmatik Hakkında
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.95rem', lineHeight: '1.6' }}>
          Okulmatik; okul, kampüs ve kurum hiyerarşilerini tek platformda yönetmeye,
          rubrik tabanlı öğrenci değerlendirmelerini dijitalleştirmeye yönelik bir eğitim yönetim sistemidir.
        </p>
      </div>

      {/* Geliştirici Kartı */}
      <div style={{
        background: 'linear-gradient(135deg, #1B3A6B 0%, #1E40AF 100%)',
        borderRadius: '14px', padding: '1.5rem 1.75rem', marginBottom: '2rem',
        color: '#fff',
      }}>
        <div style={{ fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: '0.5rem' }}>
          Geliştirici
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '0.25rem' }}>
          Serkan Uğur
        </div>
        <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)', lineHeight: '1.6' }}>
          Bu uygulama tamamen tarafımdan tasarlanmış ve geliştirilmiştir.
          İçerik, tasarım ve teknik altyapının tamamı özgün çalışmanın ürünüdür.
        </div>
      </div>

      {/* Modüller */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#1E293B', marginBottom: '1rem' }}>
          Uygulama Modülleri
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {MODULLER.map((m, i) => (
            <div key={i} style={{
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px',
              padding: '0.875rem 1.125rem', display: 'flex', gap: '1rem', alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>{m.ikon}</span>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1E293B', marginBottom: '0.2rem' }}>{m.ad}</div>
                <div style={{ fontSize: '0.825rem', color: '#64748B', lineHeight: '1.55' }}>{m.aciklama}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Teknik Bilgiler */}
      <div style={{
        background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px',
        padding: '1.25rem 1.5rem',
      }}>
        <h2 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#475569', marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Teknik Altyapı
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 2rem' }}>
          {[
            ['Arayüz',    'React 18 + Vite'],
            ['Veritabanı','Firebase Firestore'],
            ['Kimlik',    'Firebase Authentication'],
            ['Yönlendirme','React Router v6'],
          ].map(([etiket, deger]) => (
            <div key={etiket} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: '500' }}>{etiket}</span>
              <span style={{ fontSize: '0.8rem', color: '#1E293B', fontWeight: '600' }}>{deger}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
