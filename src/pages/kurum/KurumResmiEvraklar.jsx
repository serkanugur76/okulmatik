import { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

const SABLONLAR = [
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

export default function KurumResmiEvraklar() {
  const { secilenKurum, secilenKurumId } = useKurumYonetim()
  const location = useLocation()

  // 1. Şablon Seçimi
  const [seciliSablonId, setSeciliSablonId] = useState(2) // Varsayılan Zümre (id: 2)

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
  // A. Zümre Tutanağı State
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

  // B. Seçim Tutanağı State
  const [secimForm, setSecimForm] = useState({
    sube: '5/A',
    tarih: '2025-09-22',
    katilanUyeSayisi: '24',
    baskanAdaylari: 'Elif Aksoy (12 Oy), Mert Yılmaz (8 Oy), Selin Şahin (4 Oy)',
    secilenBaskan: 'Elif Aksoy',
    secilenYardimci: 'Mert Yılmaz',
    rehberOgretmen: 'Serkan Uğur'
  })

  // C. Demirbaş Tutanağı State
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
                  onClick={() => { setSeciliSablonId(s.id); setOnayaGonderildi(false); }}
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
            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#1E293B', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              ✏️ Evrak İçerik Bilgileri
            </h3>

            {/* A. ZÜMRE TUTANAĞI FORMU */}
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

            {/* B. SEÇİM TUTANAĞI FORMU */}
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

            {/* C. DEMİRBAŞ TUTANAĞI FORMU */}
            {seciliSablonId === 14 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Sınıf / Şube</label>
                    <input
                      type="text"
                      value={demirbasForm.sube}
                      onChange={e => setDemirbasForm({ ...demirbasForm, sube: e.target.value })}
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
              lineHeight: '1.6',
              boxSizing: 'border-box',
              position: 'relative'
            }}
          >
            {/* Resmi Evrak Üst Başlık */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
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
                  <strong>Tarih:</strong> {seciliSablonId === 2 ? zumreForm.tarih : seciliSablonId === 11 ? secimForm.tarih : demirbasForm.tarih}
                </div>
              </div>
            </div>

            {/* Evrak Başlığı */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', textTransform: 'uppercase', textDecoration: 'underline', marginBottom: '1.5rem', padding: '0 1rem' }}>
              {aktifSablon.baslik}
            </div>

            {/* Evrak İçerik Gövdesi */}
            <div style={{ flex: 1, fontSize: '0.95rem', textAlign: 'justify', whiteSpace: 'pre-line', padding: '0 0.5rem' }}>
              
              {/* A. ZÜMRE TUTANAĞI İÇERİĞİ */}
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

              {/* B. SEÇİM TUTANAĞI İÇERİĞİ */}
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

              {/* C. DEMİRBAŞ TUTANAĞI İÇERİĞİ */}
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
            <div style={{ marginTop: '3rem', borderTop: '1px dashed #E2E8F0', paddingTop: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', textAlign: 'center', fontSize: '0.85rem' }}>
                
                {/* Sol İmza Grubu (Öğretmenler) */}
                <div>
                  <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '1.5rem' }}>Teslim Eden / Zümre Üyeleri</div>
                  <div style={{ height: '35px' }} /> {/* Boşluk imza için */}
                  <div style={{ fontSize: '0.8rem', color: '#333' }}>
                    {seciliSablonId === 2 ? zumreForm.katilimcilar.split(',')[1]?.trim() || 'Üye Öğretmen' : seciliSablonId === 11 ? 'Öğrenci Seçim Temsilcisi' : demirbasForm.teslimEden.split('(')[0].trim()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#666', fontStyle: 'italic' }}>İmza / Tarih</div>
                </div>

                {/* Sağ İmza Grubu (Öğretmen / Zümre Başkanı) */}
                <div>
                  <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '1.5rem' }}>Teslim Alan / Zümre Başkanı</div>
                  <div style={{ height: '35px' }} /> {/* Boşluk imza için */}
                  <div style={{ fontSize: '0.8rem', color: '#333' }}>
                    {seciliSablonId === 2 ? zumreForm.zumreBaskani : seciliSablonId === 11 ? secimForm.rehberOgretmen : demirbasForm.teslimAlan}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#666', fontStyle: 'italic' }}>İmza / Tarih</div>
                </div>

              </div>

              {/* Okul Müdürü Onay Bloku (Müdürün Onaylaması Gereken Yapı) */}
              <div style={{ marginTop: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ border: '1.5px solid #000', padding: '10px 25px', width: '220px', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>UYGUNDUR</div>
                  <div style={{ fontSize: '0.78rem' }}>{seciliSablonId === 2 ? zumreForm.tarih : seciliSablonId === 11 ? secimForm.tarih : demirbasForm.tarih}</div>
                  <div style={{ height: '30px' }} />
                  <div style={{ fontWeight: 'bold' }}>Uğur Serkan</div>
                  <div style={{ fontSize: '0.75rem', color: '#444' }}>Okul Müdürü</div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
