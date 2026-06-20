import { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

const SABLONLAR = [
  {
    id: 1,
    baslik: 'Sene Başı Öğretmenler Kurulu Karar Tutanağı',
    kod: 'OKM-2026-T01',
    aciklama: 'Kurul ve komisyon atamalarını barındıran sene başı toplantı kararı.'
  },
  {
    id: 2,
    baslik: 'Zümre Öğretmenler Kurulu Tutanağı',
    kod: 'OKM-2026-T02',
    aciklama: 'Aynı branştaki öğretmenlerin yıllık toplantı kararları.'
  },
  {
    id: 11,
    baslik: 'Sınıf Başkanlığı Seçim Tutanağı',
    kod: 'OKM-2026-R04',
    aciklama: 'Sınıf başkanlığı seçim sonuçlarının kayıt altına alınması.'
  },
  {
    id: 14,
    baslik: 'Sınıf Demirbaş Teslim Tutanağı',
    kod: 'OKM-2026-O03',
    aciklama: 'Sınıf demirbaş malzemelerinin teslim alınması ve zimmetlenmesi.'
  }
]

const OGRETMEN_LISTESI = [
  'Serkan Uğur',
  'Ahmet Yılmaz',
  'Selin Şahin',
  'Hasan Kaya',
  'Ayşe Demir',
  'Elif Aksoy',
  'Mert Yılmaz',
  'Mustafa Kaya'
]

export default function KurumResmiEvraklar() {
  const { secilenKurum, secilenKurumId } = useKurumYonetim()
  const location = useLocation()

  // 1. Şablon Seçimi
  const [seciliSablonId, setSeciliSablonId] = useState(1) // Varsayılan Sene Başı Kurulu (id: 1)
  const [aktifAdim, setAktifAdim] = useState(1) // Sene Başı Kurulu için Wizard adımı (1-4)

  // Eğer URL state üzerinden yönlendirme yapıldıysa o şablonu seç
  useEffect(() => {
    if (location.state?.sablonId) {
      const match = SABLONLAR.some(s => s.id === location.state.sablonId)
      if (match) {
        setSeciliSablonId(location.state.sablonId)
      }
    }
  }, [location.state])

  // 2. Form State'leri
  // A. Sene Başı Öğretmenler Kurulu State
  const [kurulForm, setKurulForm] = useState({
    akademikYil: '2025-2026',
    kararNo: '2025/01',
    tarih: '2025-09-08',
    saat: '09:30',
    yer: 'Okul Konferans Salonu',
    baskan: 'Uğur Serkan (Okul Müdürü)',
    yazmanAsil1: 'Ahmet Yılmaz',
    yazmanAsil2: 'Selin Şahin',
    yazmanYedek1: 'Hasan Kaya',
    yazmanYedek2: 'Ayşe Demir',
    gundem: '1. Açılış, yoklama ve İstiklal Marşı.\n2. Yazman seçimi.\n3. Gündem maddelerinin okunması ve eklemeler.\n4. Okulun genel işleyişi, haftalık ders programları ve nöbet görevlerinin görüşülmesi.\n5. Sınıf rehber öğretmenliklerinin belirlenmesi.\n6. Kurul, Komisyon ve Kulüplere öğretmen seçimlerinin yapılması.\n7. Kapanış.',
    kararlar: '1. Toplantıya tüm zümre ve sınıf öğretmenleri katılım sağlamıştır.\n2. Yazmanlığa asil olarak Ahmet Yılmaz ve Selin Şahin, yedek olarak Hasan Kaya ve Ayşe Demir seçilmiştir.\n3. Haftalık taslak ders programları ve nöbet günleri onaylanarak tebliğ edilmiştir.\n4. Sınıf rehber öğretmenlikleri şube bazlı olarak belirlenmiş ve karar altına alınmıştır.\n5. Aşağıda dökümü sunulan komisyon üyeleri oybirliği ile seçilmiştir.',
    dilekler: 'Başarılı, huzurlu ve verimli bir eğitim-öğretim yılı geçirilmesi temennisiyle toplantı okul müdürü tarafından kapatılmıştır.',
    // Sınıf Rehber Öğretmenleri
    sinif5A: 'Ahmet Yılmaz',
    sinif5B: 'Selin Şahin',
    sinif6A: 'Hasan Kaya',
    sinif6B: 'Ayşe Demir',
    sinif7A: 'Elif Aksoy',
    sinif7B: 'Mert Yılmaz',
    sinif8A: 'Serkan Uğur',
    sinif8B: 'Mustafa Kaya',
    // 7 Komisyon & Kurul Seçimleri
    komisyonIhaleAsil1: 'Serkan Uğur',
    komisyonIhaleAsil2: 'Ahmet Yılmaz',
    komisyonIhaleYedek1: 'Hasan Kaya',
    komisyonIhaleYedek2: 'Ayşe Demir',
    
    komisyonMuayeneAsil1: 'Selin Şahin',
    komisyonMuayeneAsil2: 'Elif Aksoy',
    komisyonMuayeneYedek1: 'Mert Yılmaz',
    komisyonMuayeneYedek2: 'Mustafa Kaya',

    komisyonRehberlik1: 'Serkan Uğur',
    komisyonRehberlik2: 'Selin Şahin',
    komisyonRehberlik3: 'Ayşe Demir',

    komisyonWeb1: 'Serkan Uğur',
    komisyonWeb2: 'Mert Yılmaz',

    komisyonSosyal1: 'Ahmet Yılmaz',
    komisyonSosyal2: 'Elif Aksoy',

    komisyonYazi1: 'Selin Şahin',
    komisyonYazi2: 'Hasan Kaya',

    komisyonAile1: 'Ayşe Demir',
    komisyonAile2: 'Mustafa Kaya'
  })

  // B. Zümre Tutanağı State
  const [zumreForm, setZumreForm] = useState({
    akademikYil: '2025-2026',
    brans: 'Bilişim Teknolojileri',
    toplantıNo: '1',
    tarih: '2025-09-18',
    saat: '10:00',
    yer: 'Öğretmenler Odası',
    katilimcilar: 'Serkan Uğur (Bilişim Öğrt.), Ahmet Yılmaz (Bilişim Öğrt.)',
    zumreBaskani: 'Serkan Uğur',
    gundem: '1. Açılış ve yoklama.\n2. Yıllık planların ve müfredat dağılımlarının incelenmesi.\n3. Ölçme ve değerlendirme kriterlerinin belirlenmesi.\n4. Kaynak kitapların seçimi ve dilekler.',
    kararlar: '1. Toplantıya tüm zümre öğretmenleri eksiksiz katılmıştır.\n2. Yıllık planların MEB çalışma takvimine göre hazırlanarak 25 Eylül tarihine kadar okul idaresine sunulmasına karar verilmiştir.\n3. Dönem içinde her sınıf düzeyinde 2 yazılı sınav yapılması kararlaştırılmıştır.\n4. Ders araç gereci olarak kodlama kitlerinin kullanımına devam edilmesi uygun bulunmuştur.'
  })

  // C. Seçim Tutanağı State
  const [secimForm, setSecimForm] = useState({
    sube: '5/A',
    tarih: '2025-09-22',
    katilanUyeSayisi: '24',
    baskanAdaylari: 'Elif Aksoy (12 Oy), Mert Yılmaz (8 Oy), Selin Şahin (4 Oy)',
    secilenBaskan: 'Elif Aksoy',
    secilenYardimci: 'Mert Yılmaz',
    rehberOgretmen: 'Serkan Uğur'
  })

  // D. Demirbaş Tutanağı State
  const [demirbasForm, setDemirbasForm] = useState({
    sube: '7/B',
    tarih: '2025-09-15',
    teslimAlan: 'Ahmet Yılmaz',
    teslimEden: 'Mustafa Kaya (Müdür Yardımcısı)',
    akilliTahta: 'Çalışıyor - Sorunsuz',
    siraSayisi: '22 Adet (Sağlam)',
    kursuDurumu: 'Sorunsuz',
    panoPerde: 'Pano sağlam, stor perdeler çalışır durumda.'
  })

  const [onayaGonderildi, setOnayaGonderildi] = useState(false)

  // Seçili şablona ait metadata
  const aktifSablon = useMemo(() => {
    return SABLONLAR.find(s => s.id === seciliSablonId) || SABLONLAR[0]
  }, [seciliSablonId])

  // Yazdırma İşlemi
  const handleYazdir = () => {
    window.print()
  }

  // Onaya Gönderme
  const handleOnayaGonder = () => {
    setOnayaGonderildi(true)
    setTimeout(() => {
      setOnayaGonderildi(false)
      alert(`${aktifSablon.baslik} başarıyla dolduruldu ve ${aktifSablon.kod} dosya koduyla okul müdürlüğünün onayına sunuldu.`)
    }, 800)
  }

  if (!secilenKurumId) {
    return null
  }

  return (
    <div className="evraklar-container" style={{ paddingBottom: '3rem' }}>
      {/* Yazdırma esnasında sadece A4 sayfasını gösteren özel stil */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
            background: none !important;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            padding: 20mm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .evraklar-container {
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}} />

      <h1 id="resmi-evraklar-title" style={{ display: 'none' }}>Evrak Üretimi ve Şablon Formu</h1>

      {/* İki Sütunlu Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem', alignItems: 'start' }} className="no-print">
        
        {/* SOL SÜTUN: Şablon Seçici & Form Alanı */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Şablon Seçim Kartı */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '1.25rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.75rem' }}>
              📄 Resmi Evrak Şablonu Seçin
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {SABLONLAR.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSeciliSablonId(s.id); setOnayaGonderildi(false); setAktifAdim(1); }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid',
                    borderColor: seciliSablonId === s.id ? '#1B3A6B' : '#E2E8F0',
                    backgroundColor: seciliSablonId === s.id ? '#F0F5FF' : '#FFFFFF',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.85rem', color: seciliSablonId === s.id ? '#1B3A6B' : '#1E293B' }}>
                      {s.baslik}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px', color: '#475569', fontWeight: '600' }}>
                      {s.kod}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
                    {s.aciklama}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Form Alanı (Seçili şablona göre dinamikleşir) */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            {/* Şablon Başlığı */}
            <div style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#1E293B', margin: 0 }}>
                ✏️ Evrak İçerik Bilgileri
              </h3>
              {seciliSablonId === 1 && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[1, 2, 3, 4].map(adim => (
                    <span
                      key={adim}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        backgroundColor: aktifAdim === adim ? '#1B3A6B' : aktifAdim > adim ? '#10B981' : '#E2E8F0',
                        color: '#FFFFFF'
                      }}
                    >
                      {adim}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* A. SENE BAŞI ÖĞRETMENLER KURULU FORMU (WIZARD) */}
            {seciliSablonId === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* 1. ADIM: Çağrı ve Gündem Taslağı */}
                {aktifAdim === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1B3A6B', paddingBottom: '4px', borderBottom: '1.5px solid #F0F5FF' }}>
                      Adım 1: Toplantı Çağrısı, Genel Bilgiler & Gündem
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Karar / Toplantı No</label>
                        <input
                          type="text"
                          value={kurulForm.kararNo}
                          onChange={e => setKurulForm({ ...kurulForm, kararNo: e.target.value })}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Akademik Yıl</label>
                        <input
                          type="text"
                          value={kurulForm.akademikYil}
                          onChange={e => setKurulForm({ ...kurulForm, akademikYil: e.target.value })}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Toplantı Tarihi</label>
                        <input
                          type="date"
                          value={kurulForm.tarih}
                          onChange={e => setKurulForm({ ...kurulForm, tarih: e.target.value })}
                          style={{ width: '100%', padding: '7px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Toplantı Saati</label>
                        <input
                          type="text"
                          value={kurulForm.saat}
                          onChange={e => setKurulForm({ ...kurulForm, saat: e.target.value })}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Toplantı Yeri</label>
                        <input
                          type="text"
                          value={kurulForm.yer}
                          onChange={e => setKurulForm({ ...kurulForm, yer: e.target.value })}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Kurul Başkanı (Müdür)</label>
                        <input
                          type="text"
                          value={kurulForm.baskan}
                          onChange={e => setKurulForm({ ...kurulForm, baskan: e.target.value })}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Gündem Taslağı (Toplantı Öncesi Duyurulan)</label>
                      <textarea
                        rows="6"
                        value={kurulForm.gundem}
                        onChange={e => setKurulForm({ ...kurulForm, gundem: e.target.value })}
                        style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px', resize: 'vertical', fontFamily: 'sans-serif' }}
                      />
                    </div>
                  </div>
                )}

                {/* 2. ADIM: Yazmanlar ve Sınıflar */}
                {aktifAdim === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1B3A6B', paddingBottom: '4px', borderBottom: '1.5px solid #F0F5FF' }}>
                      Adım 2: Yazman Seçimi & Sınıf Rehber Öğretmenliği Atamaları
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Asil Yazman 1</label>
                        <select
                          value={kurulForm.yazmanAsil1}
                          onChange={e => setKurulForm({ ...kurulForm, yazmanAsil1: e.target.value })}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Asil Yazman 2</label>
                        <select
                          value={kurulForm.yazmanAsil2}
                          onChange={e => setKurulForm({ ...kurulForm, yazmanAsil2: e.target.value })}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Yedek Yazman 1</label>
                        <select
                          value={kurulForm.yazmanYedek1}
                          onChange={e => setKurulForm({ ...kurulForm, yazmanYedek1: e.target.value })}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Yedek Yazman 2</label>
                        <select
                          value={kurulForm.yazmanYedek2}
                          onChange={e => setKurulForm({ ...kurulForm, yazmanYedek2: e.target.value })}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.5rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1E293B', display: 'block', marginBottom: '8px' }}>
                        🏫 Sınıf Rehber Öğretmenleri (Şube Atamaları)
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        {['5A', '5B', '6A', '6B', '7A', '7B', '8A', '8B'].map(sinif => (
                          <div key={sinif} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', minWidth: '40px' }}>
                              {sinif.replace('A', '/A').replace('B', '/B')}:
                            </span>
                            <select
                              value={kurulForm[`sinif${sinif}`]}
                              onChange={e => setKurulForm({ ...kurulForm, [`sinif${sinif}`]: e.target.value })}
                              style={{ flex: 1, padding: '4px', fontSize: '0.75rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                            >
                              {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. ADIM: Kurul & Komisyon Atamaları */}
                {aktifAdim === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1B3A6B', paddingBottom: '4px', borderBottom: '1.5px solid #F0F5FF' }}>
                      Adım 3: Yıllık Kurul & Komisyon Öğretmen Seçimleri
                    </div>
                    
                    {/* İhale Komisyonu */}
                    <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1E293B', marginBottom: '6px' }}>
                        ⚖️ Okul İhale / Satın Alma Komisyonu
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.68rem', color: '#64748B' }}>Asil Üyeler</label>
                          <select
                            value={kurulForm.komisyonIhaleAsil1}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonIhaleAsil1: e.target.value })}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '2px' }}
                          >
                            {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <select
                            value={kurulForm.komisyonIhaleAsil2}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonIhaleAsil2: e.target.value })}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '4px' }}
                          >
                            {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.68rem', color: '#64748B' }}>Yedek Üyeler</label>
                          <select
                            value={kurulForm.komisyonIhaleYedek1}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonIhaleYedek1: e.target.value })}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '2px' }}
                          >
                            {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <select
                            value={kurulForm.komisyonIhaleYedek2}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonIhaleYedek2: e.target.value })}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '4px' }}
                          >
                            {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Muayene ve Kabul Komisyonu */}
                    <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1E293B', marginBottom: '6px' }}>
                        🔎 Muayene ve Kabul Komisyonu
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.68rem', color: '#64748B' }}>Asil Üyeler</label>
                          <select
                            value={kurulForm.komisyonMuayeneAsil1}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonMuayeneAsil1: e.target.value })}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '2px' }}
                          >
                            {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <select
                            value={kurulForm.komisyonMuayeneAsil2}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonMuayeneAsil2: e.target.value })}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '4px' }}
                          >
                            {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.68rem', color: '#64748B' }}>Yedek Üyeler</label>
                          <select
                            value={kurulForm.komisyonMuayeneYedek1}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonMuayeneYedek1: e.target.value })}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '2px' }}
                          >
                            {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <select
                            value={kurulForm.komisyonMuayeneYedek2}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonMuayeneYedek2: e.target.value })}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '4px' }}
                          >
                            {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Diğer Kurul Atamaları */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ background: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
                          🧠 Rehberlik Yürütme Komisyonu
                        </div>
                        <select
                          value={kurulForm.komisyonRehberlik1}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonRehberlik1: e.target.value })}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <select
                          value={kurulForm.komisyonRehberlik2}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonRehberlik2: e.target.value })}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '3px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <select
                          value={kurulForm.komisyonRehberlik3}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonRehberlik3: e.target.value })}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '3px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
                          🌐 Web Yayın Komisyonu
                        </div>
                        <select
                          value={kurulForm.komisyonWeb1}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonWeb1: e.target.value })}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <select
                          value={kurulForm.komisyonWeb2}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonWeb2: e.target.value })}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '3px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
                          🏆 Sosyal Etkinlikler Kurulu
                        </div>
                        <select
                          value={kurulForm.komisyonSosyal1}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonSosyal1: e.target.value })}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <select
                          value={kurulForm.komisyonSosyal2}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonSosyal2: e.target.value })}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '3px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
                          📚 Yazı İnceleme Kurulu
                        </div>
                        <select
                          value={kurulForm.komisyonYazi1}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonYazi1: e.target.value })}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <select
                          value={kurulForm.komisyonYazi2}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonYazi2: e.target.value })}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '3px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
                        🏛️ Okul Aile Birliği Denetleme Kurulu
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <select
                          value={kurulForm.komisyonAile1}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonAile1: e.target.value })}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <select
                          value={kurulForm.komisyonAile2}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonAile2: e.target.value })}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        >
                          {OGRETMEN_LISTESI.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. ADIM: Kararlar ve Kapanış */}
                {aktifAdim === 4 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1B3A6B', paddingBottom: '4px', borderBottom: '1.5px solid #F0F5FF' }}>
                      Adım 4: Kurul Kararları & Kapanış Bölümü
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Kurulda Alınan Resmi Kararlar</label>
                      <textarea
                        rows="6"
                        value={kurulForm.kararlar}
                        onChange={e => setKurulForm({ ...kurulForm, kararlar: e.target.value })}
                        style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px', resize: 'vertical', fontFamily: 'sans-serif' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Dilek, Temenniler & Kapanış Notu</label>
                      <textarea
                        rows="3"
                        value={kurulForm.dilekler}
                        onChange={e => setKurulForm({ ...kurulForm, dilekler: e.target.value })}
                        style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px', resize: 'vertical', fontFamily: 'sans-serif' }}
                      />
                    </div>
                  </div>
                )}

                {/* Sihirbaz Yönlendirme Düğmeleri */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                  <button
                    disabled={aktifAdim === 1}
                    onClick={() => setAktifAdim(prev => prev - 1)}
                    style={{
                      padding: '6px 14px', fontSize: '0.8rem', fontWeight: '600',
                      backgroundColor: '#FFFFFF', color: aktifAdim === 1 ? '#94A3B8' : '#475569',
                      border: '1px solid #CBD5E1', borderRadius: '6px', cursor: aktifAdim === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    ⬅ Geri
                  </button>
                  {aktifAdim < 4 ? (
                    <button
                      onClick={() => setAktifAdim(prev => prev + 1)}
                      style={{
                        padding: '6px 14px', fontSize: '0.8rem', fontWeight: '600',
                        backgroundColor: '#1B3A6B', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer'
                      }}
                    >
                      İleri ➡
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: '700', alignSelf: 'center' }}>
                      ✓ Tüm adımlar hazır!
                    </span>
                  )}
                </div>

              </div>
            )}

            {/* B. ZÜMRE TUTANAĞI FORMU */}
            {seciliSablonId === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Branş / Zümre</label>
                    <input
                      type="text"
                      value={zumreForm.brans}
                      onChange={e => setZumreForm({ ...zumreForm, brans: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Akademik Yıl</label>
                    <input
                      type="text"
                      value={zumreForm.akademikYil}
                      onChange={e => setZumreForm({ ...zumreForm, akademikYil: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Toplantı No</label>
                    <input
                      type="text"
                      value={zumreForm.toplantıNo}
                      onChange={e => setZumreForm({ ...zumreForm, toplantıNo: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Tarih</label>
                    <input
                      type="date"
                      value={zumreForm.tarih}
                      onChange={e => setZumreForm({ ...zumreForm, tarih: e.target.value })}
                      style={{ width: '100%', padding: '7px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Saat</label>
                    <input
                      type="text"
                      value={zumreForm.saat}
                      onChange={e => setZumreForm({ ...zumreForm, saat: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Toplantı Yeri</label>
                  <input
                    type="text"
                    value={zumreForm.yer}
                    onChange={e => setZumreForm({ ...zumreForm, yer: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Katılan Öğretmenler</label>
                  <input
                    type="text"
                    value={zumreForm.katilimcilar}
                    onChange={e => setZumreForm({ ...zumreForm, katilimcilar: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Zümre Başkanı</label>
                  <input
                    type="text"
                    value={zumreForm.zumreBaskani}
                    onChange={e => setZumreForm({ ...zumreForm, zumreBaskani: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Gündem Maddeleri</label>
                  <textarea
                    rows="3"
                    value={zumreForm.gundem}
                    onChange={e => setZumreForm({ ...zumreForm, gundem: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px', resize: 'vertical', fontFamily: 'sans-serif' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Alınan Kararlar</label>
                  <textarea
                    rows="4"
                    value={zumreForm.kararlar}
                    onChange={e => setZumreForm({ ...zumreForm, kararlar: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px', resize: 'vertical', fontFamily: 'sans-serif' }}
                  />
                </div>
              </div>
            )}

            {/* C. SEÇİM TUTANAĞI FORMU */}
            {seciliSablonId === 11 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Şube / Sınıf</label>
                    <input
                      type="text"
                      value={secimForm.sube}
                      onChange={e => setSecimForm({ ...secimForm, sube: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Seçim Tarihi</label>
                    <input
                      type="date"
                      value={secimForm.tarih}
                      onChange={e => setSecimForm({ ...secimForm, tarih: e.target.value })}
                      style={{ width: '100%', padding: '7px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Katılan Üye Sayısı (Veli/Öğrenci)</label>
                  <input
                    type="text"
                    value={secimForm.katilanUyeSayisi}
                    onChange={e => setSecimForm({ ...secimForm, katilanUyeSayisi: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Başkan Adayları ve Oylar</label>
                  <input
                    type="text"
                    value={secimForm.baskanAdaylari}
                    onChange={e => setSecimForm({ ...secimForm, baskanAdaylari: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Seçilen Başkan</label>
                    <input
                      type="text"
                      value={secimForm.secilenBaskan}
                      onChange={e => setSecimForm({ ...secimForm, secilenBaskan: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Seçilen Başkan Yard.</label>
                    <input
                      type="text"
                      value={secimForm.secilenYardimci}
                      onChange={e => setSecimForm({ ...secimForm, secilenYardimci: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Sınıf Rehber Öğretmeni</label>
                  <input
                    type="text"
                    value={secimForm.rehberOgretmen}
                    onChange={e => setSecimForm({ ...secimForm, rehberOgretmen: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                  />
                </div>
              </div>
            )}

            {/* D. DEMİRBAŞ TUTANAĞI FORMU */}
            {seciliSablonId === 14 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Sınıf / Şube</label>
                    <input
                      type="text"
                      value={demirbasForm.sube}
                      onChange={e => setTransitForm({ ...demirbasForm, sube: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Tarih</label>
                    <input
                      type="date"
                      value={demirbasForm.tarih}
                      onChange={e => setDemirbasForm({ ...demirbasForm, tarih: e.target.value })}
                      style={{ width: '100%', padding: '7px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Teslim Alan (Öğrt.)</label>
                    <input
                      type="text"
                      value={demirbasForm.teslimAlan}
                      onChange={e => setDemirbasForm({ ...demirbasForm, teslimAlan: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Teslim Eden (Yetkili)</label>
                    <input
                      type="text"
                      value={demirbasForm.teslimEden}
                      onChange={e => setDemirbasForm({ ...demirbasForm, teslimEden: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Akıllı Tahta Durumu</label>
                  <input
                    type="text"
                    value={demirbasForm.akilliTahta}
                    onChange={e => setDemirbasForm({ ...demirbasForm, akilliTahta: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Sıra / Masa Sayısı</label>
                    <input
                      type="text"
                      value={demirbasForm.siraSayisi}
                      onChange={e => setDemirbasForm({ ...demirbasForm, siraSayisi: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Öğretmen Kürsüsü</label>
                    <input
                      type="text"
                      value={demirbasForm.kursuDurumu}
                      onChange={e => setDemirbasForm({ ...demirbasForm, kursuDurumu: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Pano, Perdeler ve Diğer Donanım</label>
                  <input
                    type="text"
                    value={demirbasForm.panoPerde}
                    onChange={e => setDemirbasForm({ ...demirbasForm, panoPerde: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                  />
                </div>
              </div>
            )}

            {/* Eylemler */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1.5rem' }}>
              <button
                onClick={handleOnayaGonder}
                disabled={onayaGonderildi}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'background 0.2s'
                }}
              >
                {onayaGonderildi ? 'Gönderiliyor…' : '📤 Müdür Onayına Gönder'}
              </button>

              <button
                onClick={handleYazdir}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#1B3A6B',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>🖨️</span> <span>Evrak Çıktısı Al (Yazdır)</span>
              </button>
            </div>

          </div>
        </div>

        {/* SAĞ SÜTUN: A4 Canlı Önizleme */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: '700' }}>
              👁️ A4 Sayfa Ön İzleme (Canlı Güncellenir)
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
              Yazıcı çıktısı bu şablona göre birebir A4 formatında ayarlanır.
            </span>
          </div>

          {/* A4 Kağıt Konteyneri */}
          <div
            id="print-area"
            style={{
              width: '100%',
              maxWidth: '210mm',
              minHeight: '297mm',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
              borderRadius: '8px',
              padding: '2.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              fontFamily: '"Times New Roman", Times, serif',
              color: '#000000',
              lineHeight: '1.5',
              boxSizing: 'border-box',
              position: 'relative'
            }}
          >
            {/* Resmi Evrak Üst Başlık */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.05rem', letterSpacing: '1px' }}>T.C.</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.05rem', textTransform: 'uppercase' }}>
                MİLLÎ EĞİTİM BAKANLIĞI
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem', textTransform: 'uppercase', marginTop: '4px' }}>
                {secilenKurum?.ad || 'Örnek Ortaokulu Müdürlüğü'}
              </div>
              <div style={{ width: '80px', height: '1.5px', background: '#000000', margin: '0.75rem auto 0.25rem' }} />
              
              {/* Tarih ve Sayı Bilgisi */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '1rem', width: '100%', textAlign: 'left', padding: '0 0.5rem' }}>
                <div>
                  <strong>Sayı :</strong> B.08.4.MEM.2.06 - {aktifSablon.kod}
                </div>
                <div>
                  <strong>Tarih:</strong> {seciliSablonId === 1 ? kurulForm.tarih : seciliSablonId === 2 ? zumreForm.tarih : seciliSablonId === 11 ? secimForm.tarih : demirbasForm.tarih}
                </div>
              </div>
            </div>

            {/* Evrak Başlığı */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', textTransform: 'uppercase', textDecoration: 'underline', marginBottom: '1.5rem', padding: '0 1rem' }}>
              {aktifSablon.baslik}
            </div>

            {/* Evrak İçerik Gövdesi */}
            <div style={{ flex: 1, fontSize: '0.95rem', textAlign: 'justify', whiteSpace: 'pre-line', padding: '0 0.5rem' }}>
              
              {/* A. SENE BAŞI ÖĞRETMENLER KURULU TUTANAĞI İÇERİĞİ */}
              {seciliSablonId === 1 && (
                <div style={{ fontSize: '0.85rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', fontSize: '0.8rem' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold', width: '150px' }}>Eğitim Öğretim Yılı:</td><td>{kurulForm.akademikYil}</td><td style={{ fontWeight: 'bold', width: '100px' }}>Karar No:</td><td>{kurulForm.kararNo}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Toplantı Tarihi / Saati:</td><td>{kurulForm.tarih} - {kurulForm.saat}</td><td style={{ fontWeight: 'bold' }}>Toplantı Yeri:</td><td>{kurulForm.yer}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Kurul Başkanı (Müdür):</td><td colSpan="3">{kurulForm.baskan}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Seçilen Yazmanlar:</td><td colSpan="3">Asil: {kurulForm.yazmanAsil1}, {kurulForm.yazmanAsil2} | Yedek: {kurulForm.yazmanYedek1}, {kurulForm.yazmanYedek2}</td></tr>
                    </tbody>
                  </table>

                  <div style={{ fontWeight: 'bold', marginTop: '0.75rem', textDecoration: 'underline' }}>GÜNDEM MADDELERİ:</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', paddingLeft: '0.5rem' }}>{kurulForm.gundem}</div>

                  <div style={{ fontWeight: 'bold', marginTop: '0.75rem', textDecoration: 'underline' }}>KURULDA ALINAN KARARLAR:</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', paddingLeft: '0.5rem' }}>{kurulForm.kararlar}</div>

                  {/* Sınıf Rehber Öğretmenleri Listesi */}
                  <div style={{ fontWeight: 'bold', marginTop: '0.75rem', textDecoration: 'underline' }}>SINIF REHBER ÖĞRETMENLİKLERİ (ŞUBE GÖREVLERİ):</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.25rem', fontSize: '0.75rem', border: '1px solid #000' }}>
                    <thead>
                      <tr style={{ background: '#F2F2F2', borderBottom: '1.5px solid #000' }}>
                        <th style={{ border: '1px solid #000', padding: '4px' }}>Şube / Sınıf</th>
                        <th style={{ border: '1px solid #000', padding: '4px' }}>Sınıf Rehber Öğretmeni</th>
                        <th style={{ border: '1px solid #000', padding: '4px' }}>Şube / Sınıf</th>
                        <th style={{ border: '1px solid #000', padding: '4px' }}>Sınıf Rehber Öğretmeni</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>5/A</td><td style={{ border: '1px solid #000', padding: '4px' }}>{kurulForm.sinif5A}</td>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>5/B</td><td style={{ border: '1px solid #000', padding: '4px' }}>{kurulForm.sinif5B}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>6/A</td><td style={{ border: '1px solid #000', padding: '4px' }}>{kurulForm.sinif6A}</td>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>6/B</td><td style={{ border: '1px solid #000', padding: '4px' }}>{kurulForm.sinif6B}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>7/A</td><td style={{ border: '1px solid #000', padding: '4px' }}>{kurulForm.sinif7A}</td>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>7/B</td><td style={{ border: '1px solid #000', padding: '4px' }}>{kurulForm.sinif7B}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>8/A</td><td style={{ border: '1px solid #000', padding: '4px' }}>{kurulForm.sinif8A}</td>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>8/B</td><td style={{ border: '1px solid #000', padding: '4px' }}>{kurulForm.sinif8B}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Kurul ve Komisyon Seçim Tablosu */}
                  <div style={{ fontWeight: 'bold', marginTop: '0.75rem', textDecoration: 'underline' }}>OYBİRLİĞİ İLE SEÇİLEN KURUL VE KOMİSYONLAR:</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.25rem', fontSize: '0.72rem', border: '1px solid #000' }}>
                    <thead>
                      <tr style={{ background: '#F2F2F2', borderBottom: '1.5px solid #000' }}>
                        <th style={{ border: '1px solid #000', padding: '4px', width: '250px' }}>Resmi Kurul veya Komisyon Adı</th>
                        <th style={{ border: '1px solid #000', padding: '4px' }}>Asil Üyeler / Görevli Öğretmenler</th>
                        <th style={{ border: '1px solid #000', padding: '4px' }}>Yedek Üyeler</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>Okul İhale / Satın Alma Komisyonu</td>
                        <td style={{ border: '1px solid #000', padding: '4px' }}>{kurulForm.komisyonIhaleAsil1}, {kurulForm.komisyonIhaleAsil2}</td>
                        <td style={{ border: '1px solid #000', padding: '4px' }}>{kurulForm.komisyonIhaleYedek1}, {kurulForm.komisyonIhaleYedek2}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>Muayene ve Kabul Komisyonu</td>
                        <td style={{ border: '1px solid #000', padding: '4px' }}>{kurulForm.komisyonMuayeneAsil1}, {kurulForm.komisyonMuayeneAsil2}</td>
                        <td style={{ border: '1px solid #000', padding: '4px' }}>{kurulForm.komisyonMuayeneYedek1}, {kurulForm.komisyonMuayeneYedek2}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>Rehberlik Hizmetleri Yürütme Kurulu</td>
                        <td style={{ border: '1px solid #000', padding: '4px' }} colSpan="2">{kurulForm.komisyonRehberlik1}, {kurulForm.komisyonRehberlik2}, {kurulForm.komisyonRehberlik3}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>Web Yayın Komisyonu</td>
                        <td style={{ border: '1px solid #000', padding: '4px' }} colSpan="2">{kurulForm.komisyonWeb1}, {kurulForm.komisyonWeb2}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>Sosyal Etkinlikler Kurulu</td>
                        <td style={{ border: '1px solid #000', padding: '4px' }} colSpan="2">{kurulForm.komisyonSosyal1}, {kurulForm.komisyonSosyal2}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>Yazı İnceleme ve Seçme Kurulu</td>
                        <td style={{ border: '1px solid #000', padding: '4px' }} colSpan="2">{kurulForm.komisyonYazi1}, {kurulForm.komisyonYazi2}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>Okul Aile Birliği Denetleme Kurulu</td>
                        <td style={{ border: '1px solid #000', padding: '4px' }} colSpan="2">{kurulForm.komisyonAile1}, {kurulForm.komisyonAile2}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ fontWeight: 'bold', marginTop: '0.75rem', textDecoration: 'underline' }}>KAPANIŞ, DİLEK VE TEMENNİLER:</div>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.25rem', textIndent: '1.5em', margin: 0 }}>{kurulForm.dilekler}</p>
                </div>
              )}

              {/* B. ZÜMRE TUTANAĞI İÇERİĞİ */}
              {seciliSablonId === 2 && (
                <div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold', width: '150px' }}>Eğitim Öğretim Yılı:</td><td>{zumreForm.akademikYil}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Branş / Zümre:</td><td>{zumreForm.brans}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Toplantı No / Tarih:</td><td>{zumreForm.toplantıNo}. Toplantı / {zumreForm.tarih} - Saat {zumreForm.saat}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Toplantı Yeri:</td><td>{zumreForm.yer}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Katılımcılar:</td><td>{zumreForm.katilimcilar}</td></tr>
                    </tbody>
                  </table>

                  <div style={{ fontWeight: 'bold', marginTop: '1rem', textDecoration: 'underline' }}>GÜNDEM MADDELERİ:</div>
                  <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', paddingLeft: '0.5rem' }}>{zumreForm.gundem}</div>

                  <div style={{ fontWeight: 'bold', marginTop: '1.5rem', textDecoration: 'underline' }}>ALINAN KARARLAR:</div>
                  <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', paddingLeft: '0.5rem' }}>{zumreForm.kararlar}</div>

                  <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', textIndent: '1.5em' }}>
                    Yukarıda zikredilen gündem maddeleri çerçevesinde toplanan zümremiz, gündem maddelerini detaylıca müzakere etmiş ve alınan kararların {zumreForm.akademikYil} eğitim-öğretim yılı boyunca titizlikle uygulanmasını kararlaştırmıştır.
                  </p>
                </div>
              )}

              {/* C. SEÇİM TUTANAĞI İÇERİĞİ */}
              {seciliSablonId === 11 && (
                <div>
                  <p style={{ textIndent: '1.5em' }}>
                    {secilenKurum?.ad || 'Okulumuz'} bünyesindeki <strong>{secimForm.sube}</strong> sınıfında, {secimForm.tarih} tarihinde sınıf rehber öğretmeni <strong>{secimForm.rehberOgretmen}</strong> gözetiminde, sınıf başkanlığı ve sınıf başkan yardımcılığı seçimleri demokratik usullerle yapılmıştır.
                  </p>

                  <p style={{ textIndent: '1.5em' }}>
                    Yapılan oylama neticesinde toplam <strong>{secimForm.katilanUyeSayisi}</strong> öğrenci oy kullanmış olup, adayların aldıkları oy dağılımı aşağıda gösterilmiştir:
                  </p>

                  <div style={{ border: '1px solid #000', padding: '10px', margin: '1rem 0', fontSize: '0.9rem', background: '#FAF9F6' }}>
                    <strong>Aday Oyları:</strong> {secimForm.baskanAdaylari}
                  </div>

                  <p style={{ textIndent: '1.5em' }}>
                    Seçim sonucuna göre en yüksek oyu alan <strong>{secimForm.secilenBaskan}</strong> Sınıf Başkanı, en yüksek ikinci oyu alan <strong>{secimForm.secilenYardimci}</strong> ise Sınıf Başkan Yardımcısı olarak seçilmiştir.
                  </p>
                  
                  <p style={{ textIndent: '1.5em', marginTop: '1rem' }}>
                    İşbu tutanak tarafımızca imza altına alınmıştır.
                  </p>
                </div>
              )}

              {/* D. DEMİRBAŞ TUTANAĞI İÇERİĞİ */}
              {seciliSablonId === 14 && (
                <div>
                  <p style={{ textIndent: '1.5em' }}>
                    {secilenKurum?.ad || 'Okulumuz'} <strong>{demirbasForm.sube}</strong> sınıfı sınıf rehber öğretmeni <strong>{demirbasForm.teslimAlan}</strong>, {demirbasForm.tarih} tarihinde okul müdür yardımcısı/taşınır yetkilisi <strong>{demirbasForm.teslimEden}</strong>'den sınıfın fiziki alanını ve demirbaş eşyalarını kontrol ederek teslim almıştır.
                  </p>

                  <div style={{ fontWeight: 'bold', marginTop: '1rem', textDecoration: 'underline' }}>SINIF DEMİRBAŞ DURUMU:</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #000', textAlign: 'left' }}>
                        <th style={{ padding: '6px 0' }}>Demirbaş Malzeme</th>
                        <th style={{ padding: '6px 0' }}>Mevcut / Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '6px 0', fontWeight: 'bold' }}>Etkileşimli Tahta / Projektör:</td><td>{demirbasForm.akilliTahta}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '6px 0', fontWeight: 'bold' }}>Öğrenci Sırası ve Masası:</td><td>{demirbasForm.siraSayisi}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '6px 0', fontWeight: 'bold' }}>Öğretmen Kürsüsü ve Sandalyesi:</td><td>{demirbasForm.kursuDurumu}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '6px 0', fontWeight: 'bold' }}>Sınıf Panosu & Stor Perdeler:</td><td>{demirbasForm.panoPerde}</td></tr>
                    </tbody>
                  </table>

                  <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', textIndent: '1.5em' }}>
                    Sınıf rehber öğretmeni, eğitim-öğretim dönemi süresince sınıf demirbaşlarının korunması, temiz tutulması ve hasar durumunda anında okul idaresine bilgi verilmesi hususunda sorumludur.
                  </p>
                </div>
              )}

            </div>

            {/* İMZALAR */}
            <div style={{ marginTop: '2.5rem', borderTop: '1px dashed #E2E8F0', paddingTop: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', textAlign: 'center', fontSize: '0.8rem' }}>
                
                {/* Sol İmza Grubu (Öğretmenler) */}
                <div>
                  <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '1rem' }}>Teslim Eden / Kurul Üyeleri</div>
                  <div style={{ height: '30px' }} /> {/* Boşluk imza için */}
                  <div style={{ fontSize: '0.75rem', color: '#333' }}>
                    {seciliSablonId === 1 ? kurulForm.yazmanAsil1 : seciliSablonId === 2 ? zumreForm.katilimcilar.split(',')[1]?.trim() || 'Üye Öğretmen' : seciliSablonId === 11 ? 'Öğrenci Temsilcisi' : demirbasForm.teslimEden.split('(')[0].trim()}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#666', fontStyle: 'italic' }}>İmza / Tarih</div>
                </div>

                {/* Sağ İmza Grubu (Öğretmen / Zümre Başkanı) */}
                <div>
                  <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '1rem' }}>Teslim Alan / Kurul Yazmanı</div>
                  <div style={{ height: '30px' }} /> {/* Boşluk imza için */}
                  <div style={{ fontSize: '0.75rem', color: '#333' }}>
                    {seciliSablonId === 1 ? kurulForm.yazmanAsil2 : seciliSablonId === 2 ? zumreForm.zumreBaskani : demirbasForm.teslimAlan}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#666', fontStyle: 'italic' }}>İmza / Tarih</div>
                </div>

              </div>

              {/* Okul Müdürü Onay Bloku */}
              <div style={{ marginTop: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ border: '1.5px solid #000', padding: '8px 20px', width: '220px', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>ONAYLANDI / UYGUNDUR</div>
                  <div style={{ fontSize: '0.72rem' }}>{seciliSablonId === 1 ? kurulForm.tarih : seciliSablonId === 2 ? zumreForm.tarih : seciliSablonId === 11 ? secimForm.tarih : demirbasForm.tarih}</div>
                  <div style={{ height: '25px' }} />
                  <div style={{ fontWeight: 'bold' }}>{seciliSablonId === 1 ? kurulForm.baskan.split('(')[0].trim() : 'Uğur Serkan'}</div>
                  <div style={{ fontSize: '0.7rem', color: '#444' }}>Okul Müdürü</div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
