import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../services/firebase'

const SENE_BASI_GOREVLER = [
  // 1. Resmi Toplantılar ve Tutanaklar
  {
    id: 1,
    kategori: 'Toplantı & Tutanaklar',
    baslik: 'Sene Başı Öğretmenler Kurulu Toplantısı',
    aciklama: 'Okul müdürü başkanlığında tüm kadronun katıldığı genel kurul ve kararların imza altına alınması.',
    sorumlu: 'Tüm Öğretmenler & Müdür',
    evrakUretimi: true,
    dosyaNo: 'OKM-2026-T01',
    gereksinim: 'Toplantı Tutanağı & İmza Sirküsü'
  },
  {
    id: 2,
    kategori: 'Toplantı & Tutanaklar',
    baslik: 'Sene Başı Zümre Öğretmenler Kurulu',
    aciklama: 'Aynı branştaki öğretmenlerin yıllık müfredat, kaynak kitap ve değerlendirme kriterlerini planladığı kurul.',
    sorumlu: 'Zümre Başkanı / Öğretmenler',
    evrakUretimi: true,
    dosyaNo: 'OKM-2026-T02',
    gereksinim: 'Zümre Tutanağı (Müdür Onaylı)'
  },
  {
    id: 3,
    kategori: 'Toplantı & Tutanaklar',
    baslik: 'Şube Öğretmenler Kurulu (ŞÖK)',
    aciklama: '5. sınıfa yeni başlayan veya risk grubundaki öğrencilerin durumlarının şube bazlı ele alınması.',
    sorumlu: 'Şube Ders Öğretmenleri',
    evrakUretimi: true,
    dosyaNo: 'OKM-2026-T03',
    gereksinim: 'ŞÖK Karar Tutanağı'
  },
  {
    id: 4,
    kategori: 'Toplantı & Tutanaklar',
    baslik: 'Sene Başı Okul Aile Birliği ve Veli Toplantısı',
    aciklama: 'İlk veli toplantısının gerçekleştirilmesi, veli imza sirküsü ve okul-aile işbirliği kararları.',
    sorumlu: 'Sınıf Rehber Öğretmeni',
    evrakUretimi: true,
    dosyaNo: 'OKM-2026-T04',
    gereksinim: 'Gündem Maddeleri & Veli İmza Sirküsü'
  },
  // 2. Planlama ve Hazırlık Çalışmaları
  {
    id: 5,
    kategori: 'Planlama & Dokümantasyon',
    baslik: 'Müfredata Uygun Yıllık Planların Hazırlanması',
    aciklama: 'İş günü takvimine uygun olarak derslerin haftalık konu dağılım planları.',
    sorumlu: 'Branş Öğretmenleri',
    evrakUretimi: true,
    dosyaNo: 'OKM-2026-P01',
    gereksinim: 'Onaylı Yıllık Ders Planı'
  },
  {
    id: 6,
    kategori: 'Planlama & Dokümantasyon',
    baslik: 'BEP (Bireyselleştirilmiş Eğitim Planı)',
    aciklama: 'Sınıftaki kaynaştırma/özel eğitim öğrencilerine yönelik özel yıllık planların hazırlanması.',
    sorumlu: 'Sınıf Öğretmeni & BEP Birimi',
    evrakUretimi: true,
    dosyaNo: 'OKM-2026-P02',
    gereksinim: 'BEP Öğrenci Plan Şablonu'
  },
  {
    id: 7,
    kategori: 'Planlama & Dokümantasyon',
    baslik: 'DYK Kurs Planlarının Hazırlanması',
    aciklama: 'Destekleme ve Yetiştirme Kursu veren öğretmenlerin haftalık ders planlamaları.',
    sorumlu: 'DYK Görevli Öğretmenleri',
    evrakUretimi: true,
    dosyaNo: 'OKM-2026-P03',
    gereksinim: 'DYK Yıllık Planı'
  },
  // 3. Sınıf Rehber Öğretmenliği İşlemleri
  {
    id: 8,
    kategori: 'Sınıf Rehberliği',
    baslik: 'Sınıf Yıllık Rehberlik Planı',
    aciklama: 'Okul rehberlik servisinin çerçeve planına göre şubeye özel hazırlanan rehberlik planı.',
    sorumlu: 'Sınıf Rehber Öğretmeni',
    evrakUretimi: true,
    dosyaNo: 'OKM-2026-R01',
    gereksinim: 'Şube Rehberlik Planı'
  },
  {
    id: 9,
    kategori: 'Sınıf Rehberliği',
    baslik: 'Sosyal Kulüp Seçimleri ve Belgelendirme',
    aciklama: 'Sınıf öğrencilerinin sosyal kulüplere dağıtımı ve listelerin idareye teslimi.',
    sorumlu: 'Sınıf Rehber Öğretmeni',
    evrakUretimi: false,
    dosyaNo: 'OKM-2026-R02',
    gereksinim: 'Kulüp Öğrenci Listesi'
  },
  {
    id: 10,
    kategori: 'Sınıf Rehberliği',
    baslik: 'Öğrenci Tanıma Kartları & Dosyaları',
    aciklama: 'Sınıftaki tüm öğrencilerin güncel aile, sağlık, iletişim formlarının toplanması ve e-Okul güncellemesi.',
    sorumlu: 'Sınıf Rehber Öğretmeni',
    evrakUretimi: false,
    dosyaNo: 'OKM-2026-R03',
    gereksinim: 'Öğrenci Bilgi Formları'
  },
  {
    id: 11,
    kategori: 'Sınıf Rehberliği',
    baslik: 'Sınıf Başkanlığı Seçim Tutanağı',
    aciklama: 'Sınıf başkanlığı seçiminin demokratik usullerle yapılıp sonuçlarının resmileştirilmesi.',
    sorumlu: 'Sınıf Rehber Öğretmeni',
    evrakUretimi: true,
    dosyaNo: 'OKM-2026-R04',
    gereksinim: 'Başkanlık Seçim Tutanağı'
  },
  // 4. Raporlamalar ve Diğer Resmi Görevler
  {
    id: 12,
    kategori: 'Raporlama & Görev',
    baslik: 'Sosyal Kulüp ve Toplum Hizmeti Planı',
    aciklama: 'Danışman olunan kulübün yıllık çalışma planı ve toplum hizmeti hedefleri.',
    sorumlu: 'Danışman Öğretmen',
    evrakUretimi: true,
    dosyaNo: 'OKM-2026-O01',
    gereksinim: 'Kulüp Yıllık Çalışma Planı'
  },
  {
    id: 13,
    kategori: 'Raporlama & Görev',
    baslik: 'Sene Başı Mesleki Çalışma Raporu',
    aciklama: 'Eylül seminer döneminde yapılan bireysel/zümre seminer çalışmalarının raporu.',
    sorumlu: 'Tüm Öğretmenler',
    evrakUretimi: true,
    dosyaNo: 'OKM-2026-O02',
    gereksinim: 'Seminer Çalışma Raporu'
  },
  {
    id: 14,
    kategori: 'Raporlama & Görev',
    baslik: 'Taşınır Mal / Sınıf Demirbaş Teslimi',
    aciklama: 'Sınıftaki akıllı tahta, dolap, sıra vb. demirbaşların kontrol edilerek zimmet devralınması.',
    sorumlu: 'Sınıf Rehber Öğretmeni',
    evrakUretimi: true,
    dosyaNo: 'OKM-2026-O03',
    gereksinim: 'Sınıf Demirbaş Teslim Tutanağı'
  },
  {
    id: 15,
    kategori: 'Raporlama & Görev',
    baslik: 'E-Okul Bilgi Kontrolleri',
    aciklama: 'Haftalık ders programı, seçmeli dersler ve öğrenci fotoğraflarının doğrulanması.',
    sorumlu: 'Sınıf Rehber Öğretmeni',
    evrakUretimi: false,
    dosyaNo: 'OKM-2026-O04',
    gereksinim: 'E-Okul Doğrulama Check'
  }
]

export default function KurumResmiIslemler() {
  const { secilenKurum, secilenKurumId, erisimKurumlar, setSecilenKurumId } = useKurumYonetim()
  const { profil, kullanici } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // 1. Simüle Edilen Aktif Rol
  const defaultRol = profil?.rol === 'kurum_admin' || profil?.rol === 'platform_admin' ? 'mudur' : 'ogretmen'
  const [simuleRol, setSimuleRol] = useState(location.state?.simuleRol || defaultRol)

  // Profil yüklendiğinde varsayılan rolü eşitle (eğer state'ten gelen yoksa)
  useEffect(() => {
    if (profil && !location.state?.simuleRol) {
      const defRol = profil.rol === 'kurum_admin' || profil.rol === 'platform_admin' ? 'mudur' : 'ogretmen'
      setSimuleRol(defRol)
    }
  }, [profil, location.state])

  // 1.1 Aktif Dönem Tabı
  const [aktifDonem, setAktifDonem] = useState('sene_basi') // sene_basi, donem_sonu, yil_sonu

  // Firestore Sene Başı Öğretmenler Kurulu Belgesi Dinleyicisi
  const [seneBasiStatus, setSeneBasiStatus] = useState('yapilmadi')
  const [seneBasiData, setSeneBasiData] = useState(null)

  useEffect(() => {
    if (!secilenKurumId) return
    const docRef = doc(db, 'kurumlar', secilenKurumId, 'resmiEvraklar', 'seneBasiKurul')
    const unsub = onSnapshot(docRef, docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        setSeneBasiStatus(data.status || 'yapilmadi')
        setSeneBasiData(data)
      } else {
        setSeneBasiStatus('yapilmadi')
        setSeneBasiData(null)
      }
    })
    return () => unsub()
  }, [secilenKurumId])

  // 2. Prototip Durumları (State)
  const [gorevDurumlari, setGorevDurumlari] = useState(() => {
    // Prototip için varsayılan durumlar oluşturalım
    const init = {}
    SENE_BASI_GOREVLER.forEach(g => {
      init[g.id] = {
        ogretmen: g.id === 1 ? 'yapilmadi' : g.id <= 3 ? 'tamamlandi' : g.id === 5 || g.id === 11 || g.id === 14 ? 'onay_bekliyor' : 'yapilmadi',
        zumre: g.id === 1 ? 'yapilmadi' : g.id <= 2 ? 'onaylandi' : g.id === 5 ? 'onay_bekliyor' : 'yapilmadi',
        mudur: g.id === 1 ? 'yapilmadi' : g.id === 1 ? 'onaylandi' : g.id === 2 ? 'imza_bekliyor' : 'yapilmadi',
        imzaDurumu: g.id === 1 ? 'imzalanmadi' : g.id === 1 ? 'imzalandi' : g.id === 2 ? 'cagri_yapildi' : 'imzalanmadi', // imzalanmadi, cagri_yapildi, imzalandi
        sonTarih: '2026-09-30'
      }
    })
    return init
  })

  // Sene Başı Kurulu (ID: 1) durumunu Firestore verisine göre ez
  const finalGorevDurumlari = useMemo(() => {
    const updated = { ...gorevDurumlari }
    
    let ogretmen = 'yapilmadi'
    let zumre = 'yapilmadi'
    let mudur = 'yapilmadi'
    let imzaDurumu = 'imzalanmadi'
    
    if (seneBasiStatus === 'davet_aktif') {
      ogretmen = 'yapilmadi'
      zumre = 'yapilmadi'
      mudur = 'yapilmadi'
      imzaDurumu = 'imzalanmadi'
    } else if (seneBasiStatus === 'yazman_doldurma') {
      ogretmen = 'onay_bekliyor'
      zumre = 'yapilmadi'
      mudur = 'yapilmadi'
      imzaDurumu = 'imzalanmadi'
    } else if (seneBasiStatus === 'mudur_onay') {
      ogretmen = 'tamamlandi'
      zumre = 'yapilmadi'
      mudur = 'imza_bekliyor'
      imzaDurumu = 'cagri_yapildi'
    } else if (seneBasiStatus === 'onaylandi_kapatildi') {
      ogretmen = 'tamamlandi'
      zumre = 'yapilmadi'
      mudur = 'onaylandi'
      imzaDurumu = 'imzalandi'
    }
    
    updated[1] = {
      ...updated[1],
      ogretmen,
      zumre,
      mudur,
      imzaDurumu
    }
    
    return updated
  }, [gorevDurumlari, seneBasiStatus])

  // Arama ve Filtreleme
  const [aramaKelimesi, setAramaKelimesi] = useState('')
  const [seciliKategori, setSeciliKategori] = useState('Hepsi')

  // Toplam Sayılar (Güncel Firestore durumlarıyla)
  const istatistikler = useMemo(() => {
    const values = Object.values(finalGorevDurumlari)
    const toplam = values.length
    const tamamlanan = values.filter(v => v.mudur === 'onaylandi' || v.imzaDurumu === 'imzalandi').length
    const onayBekleyen = values.filter(v => v.ogretmen === 'onay_bekliyor' || v.zumre === 'onay_bekliyor').length
    const imzayaCagrilan = values.filter(v => v.imzaDurumu === 'cagri_yapildi').length
    return { toplam, tamamlanan, onayBekleyen, imzayaCagrilan }
  }, [finalGorevDurumlari])

  // Filtrelenmiş Liste
  const filtrelenmişGorevler = useMemo(() => {
    return SENE_BASI_GOREVLER.filter(g => {
      const katMatch = seciliKategori === 'Hepsi' || g.kategori === seciliKategori
      const aramaMatch = g.baslik.toLowerCase().includes(aramaKelimesi.toLowerCase()) ||
        g.aciklama.toLowerCase().includes(aramaKelimesi.toLowerCase()) ||
        g.dosyaNo.toLowerCase().includes(aramaKelimesi.toLowerCase())
      return katMatch && aramaMatch
    })
  }, [aramaKelimesi, seciliKategori])

  // Eylemleri yöneten yardımcılar
  const handleOgretmenTamamla = (id) => {
    setGorevDurumlari(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ogretmen: 'onay_bekliyor',
        zumre: SENE_BASI_GOREVLER.find(x => x.id === id).sorumlu.includes('Zümre') ? 'onay_bekliyor' : prev[id].zumre
      }
    }))
  }

  const handleZumreOnayla = (id) => {
    setGorevDurumlari(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        zumre: 'onaylandi',
        ogretmen: 'tamamlandi'
      }
    }))
  }

  const handleMudurOnayla = (id) => {
    setGorevDurumlari(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        mudur: 'imza_bekliyor',
        zumre: prev[id].zumre === 'onay_bekliyor' ? 'onaylandi' : prev[id].zumre,
        ogretmen: 'tamamlandi'
      }
    }))
  }

  const handleImzayaCagir = (id) => {
    setGorevDurumlari(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        imzaDurumu: 'cagri_yapildi'
      }
    }))
  }

  const handleEvrakImzala = (id) => {
    setGorevDurumlari(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        imzaDurumu: 'imzalandi',
        mudur: 'onaylandi'
      }
    }))
  }

  const handleYazdir = (gorev) => {
    const basePath = location.pathname.includes('/platform')
      ? '/platform/kurum/resmi-islemler/evraklar'
      : '/kurum/resmi-islemler/evraklar'
    navigate(basePath, { state: { sablonId: gorev.id, simuleRol } })
  }

  if (!secilenKurumId) {
    return null // Zaten KurumLayout compact placeholder gösterecektir.
  }

  const isKampusSeviyesi = secilenKurum?.tip === 'kampus' || secilenKurum?.tip === 'kurum'

  if (isKampusSeviyesi) {
    const altKurumlar = (erisimKurumlar || []).filter(k => 
      k.tip === 'altKurum' && 
      (k.parentId === secilenKurumId || k.rootKurumId === secilenKurumId)
    )

    // Sort order for schools: ilkokul -> ortaokul -> lise
    function okulSira(ad = '') {
      const s = ad.toLocaleLowerCase('tr')
      if (s.includes('ilkokul'))  return 1
      if (s.includes('ortaokul')) return 2
      if (s.includes('lise'))     return 3
      return 4
    }

    const campuses = (erisimKurumlar || []).filter(k => k.tip === 'kampus')
    const kampusIdSet = new Set(campuses.map(c => c.id))

    // Find all unique campus parent IDs among the altKurumlar
    const altKurumCampuses = [...new Set(altKurumlar.map(k => k.parentId).filter(id => kampusIdSet.has(id)))]

    // Group alt schools by campus
    const kampusGruplari = altKurumCampuses.map(kpId => {
      const kampusObj = erisimKurumlar.find(x => x.id === kpId)
      const altlar = altKurumlar
        .filter(k => k.parentId === kpId)
        .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr'))
    }).filter(g => g.kampus)
      .sort((a, b) => (a.kampus.ad || '').localeCompare(b.kampus.ad || '', 'tr'))

    // Direct schools not under any campus
    const directAltOkullar = altKurumlar.filter(k => !k.parentId || !kampusIdSet.has(k.parentId))
      .sort((a, b) => okulSira(a.ad) - okulSira(b.ad) || (a.ad || '').localeCompare(b.ad || '', 'tr'))

    return (
      <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes float-warning {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
            100% { transform: translateY(0px); }
          }
          .alt-kurum-kart {
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .alt-kurum-kart:hover {
            transform: translateY(-4px) scale(1.02);
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.08) !important;
            border-color: #3B82F6 !important;
          }
        `}} />
        
        <div style={{
          maxWidth: '720px',
          width: '100%',
          background: 'linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%)',
          borderRadius: '24px',
          padding: '3rem 2.5rem',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
          border: '1px solid #E2E8F0',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.75rem'
        }}>
          {/* Beautiful warning/info badge icon */}
          <div style={{
            fontSize: '4.5rem',
            animation: 'float-warning 3s ease-in-out infinite',
            filter: 'drop-shadow(0 8px 12px rgba(27, 58, 107, 0.1))'
          }}>
            🏛️
          </div>
          
          <div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#1E293B', margin: '0 0 0.75rem 0', letterSpacing: '-0.02em' }}>
              Resmi İşlemler İçin Okul Seçimi Gerekli
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#64748B', lineHeight: '1.6', margin: 0, maxWidth: '520px' }}>
              Resmi iş planı ve evrak yönetim süreçleri kampüs düzeyinde değil, okul bazında (İlkokul, Ortaokul veya Lise) yürütülmektedir. Lütfen devam etmek için aşağıdan işlem yapacağınız okulu seçiniz.
            </p>
          </div>

          {/* Grouped list of schools by campus */}
          {kampusGruplari.length > 0 || directAltOkullar.length > 0 ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
              {kampusGruplari.map(g => (
                <div key={g.kampus.id} style={{
                  background: 'rgba(248, 250, 252, 0.6)',
                  border: '1px solid #E2E8F0',
                  borderRadius: '20px',
                  padding: '1.25rem 1.5rem 1.5rem 1.5rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                }}>
                  <h4 style={{
                    fontSize: '0.95rem',
                    fontWeight: '800',
                    color: '#475569',
                    margin: '0 0 1rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '0.5rem'
                  }}>
                    <span>🏫</span> {g.kampus.ad}
                  </h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem'
                  }}>
                    {g.altlar.map(k => {
                      const nameLower = (k.ad || '').toLowerCase()
                      let cardStyle = { bg: '#EFF6FF', border: '#BFDBFE', color: '#1E40AF', emoji: '🏢', label: 'Okul' }
                      if (nameLower.includes('ilkokul')) {
                        cardStyle = { bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46', emoji: '🎒', label: 'İlkokul' }
                      } else if (nameLower.includes('ortaokul')) {
                        cardStyle = { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', emoji: '🏫', label: 'Ortaokul' }
                      } else if (nameLower.includes('lise')) {
                        cardStyle = { bg: '#FFF1F2', border: '#FECDD3', color: '#9F1239', emoji: '🎓', label: 'Lise' }
                      }

                      return (
                        <div
                          key={k.id}
                          className="alt-kurum-kart"
                          onClick={() => setSecilenKurumId(k.id)}
                          style={{
                            background: '#FFFFFF',
                            border: `1.5px solid #E2E8F0`,
                            borderRadius: '16px',
                            padding: '1.25rem 1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.01)',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '10px',
                            backgroundColor: cardStyle.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem'
                          }}>
                            {cardStyle.emoji}
                          </div>
                          <div>
                            <div style={{
                              fontSize: '0.68rem',
                              fontWeight: '700',
                              color: cardStyle.color,
                              backgroundColor: cardStyle.bg,
                              padding: '1px 6px',
                              borderRadius: '999px',
                              display: 'inline-block',
                              marginBottom: '0.2rem'
                            }}>
                              {cardStyle.label}
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1E293B', lineHeight: '1.3' }}>
                              {k.ad}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {directAltOkullar.length > 0 && (
                <div style={{
                  background: 'rgba(248, 250, 252, 0.6)',
                  border: '1px solid #E2E8F0',
                  borderRadius: '20px',
                  padding: '1.25rem 1.5rem 1.5rem 1.5rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                }}>
                  <h4 style={{
                    fontSize: '0.95rem',
                    fontWeight: '800',
                    color: '#475569',
                    margin: '0 0 1rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '0.5rem'
                  }}>
                    <span>🏢</span> Doğrudan Bağlı Okullar
                  </h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem'
                  }}>
                    {directAltOkullar.map(k => {
                      const nameLower = (k.ad || '').toLowerCase()
                      let cardStyle = { bg: '#EFF6FF', border: '#BFDBFE', color: '#1E40AF', emoji: '🏢', label: 'Okul' }
                      if (nameLower.includes('ilkokul')) {
                        cardStyle = { bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46', emoji: '🎒', label: 'İlkokul' }
                      } else if (nameLower.includes('ortaokul')) {
                        cardStyle = { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', emoji: '🏫', label: 'Ortaokul' }
                      } else if (nameLower.includes('lise')) {
                        cardStyle = { bg: '#FFF1F2', border: '#FECDD3', color: '#9F1239', emoji: '🎓', label: 'Lise' }
                      }

                      return (
                        <div
                          key={k.id}
                          className="alt-kurum-kart"
                          onClick={() => setSecilenKurumId(k.id)}
                          style={{
                            background: '#FFFFFF',
                            border: `1.5px solid #E2E8F0`,
                            borderRadius: '16px',
                            padding: '1.25rem 1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.01)',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '10px',
                            backgroundColor: cardStyle.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem'
                          }}>
                            {cardStyle.emoji}
                          </div>
                          <div>
                            <div style={{
                              fontSize: '0.68rem',
                              fontWeight: '700',
                              color: cardStyle.color,
                              backgroundColor: cardStyle.bg,
                              padding: '1px 6px',
                              borderRadius: '999px',
                              display: 'inline-block',
                              marginBottom: '0.2rem'
                            }}>
                              {cardStyle.label}
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1E293B', lineHeight: '1.3' }}>
                              {k.ad}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              fontSize: '0.85rem',
              color: '#94A3B8',
              fontStyle: 'italic',
              background: '#F1F5F9',
              padding: '1rem 2rem',
              borderRadius: '12px',
              width: '100%'
            }}>
              Yetkili olduğunuz herhangi bir alt okul (ilkokul, ortaokul, lise) bulunmamaktadır.
            </div>
          )}

          <div style={{
            fontSize: '0.8rem',
            color: '#94A3B8',
            marginTop: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>💡</span>
            <span>Kurum seçiminizi sol üstteki menüden de değiştirebilirsiniz.</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Title tag and SEO styling simulation */}
      <h1 id="resmi-islemler-title" style={{ display: 'none' }}>Sene Başı Resmi İşlemleri ve Evrak Takibi</h1>

      {/* Üst Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1B3A6B 0%, #3B82F6 100%)',
        borderRadius: '16px',
        padding: '1.75rem 2rem',
        color: '#FFFFFF',
        boxShadow: '0 10px 25px rgba(27, 58, 107, 0.15)',
        marginBottom: '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative elements */}
        <div style={{ position: 'absolute', width: '300px', height: '300px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '50%', right: '-50px', top: '-100px' }} />
        <div style={{ position: 'absolute', width: '150px', height: '150px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '50%', right: '150px', bottom: '-50px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.1em', color: '#93C5FD', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Resmi İşlemler & Mevzuat Takibi
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0 }}>
              Sene Başı Hazırlık Süreçleri
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#E0F2FE', marginTop: '0.5rem', maxWidth: '600px', lineHeight: '1.5' }}>
              Okul müdürü, zümre başkanları ve öğretmenlerin sene başında tamamlaması gereken yasal evrak, kurul ve planlama süreçlerini buradan koordine edebilirsiniz.
            </p>
          </div>

          {/* Rol Seçici Simülatör */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            padding: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            minWidth: '240px'
          }}>
            <div style={{ fontSize: '0.72rem', color: '#E0F2FE', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              👤 Aktif Rolü Simüle Et:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
              <button
                onClick={() => setSimuleRol('ogretmen')}
                style={{
                  padding: '6px 4px', fontSize: '0.75rem', fontWeight: '700', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  backgroundColor: simuleRol === 'ogretmen' ? '#FFFFFF' : 'transparent',
                  color: simuleRol === 'ogretmen' ? '#1B3A6B' : '#FFFFFF',
                  transition: 'all 0.15s'
                }}
              >
                Öğretmen
              </button>
              <button
                onClick={() => setSimuleRol('zumre')}
                style={{
                  padding: '6px 4px', fontSize: '0.75rem', fontWeight: '700', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  backgroundColor: simuleRol === 'zumre' ? '#FFFFFF' : 'transparent',
                  color: simuleRol === 'zumre' ? '#1B3A6B' : '#FFFFFF',
                  transition: 'all 0.15s'
                }}
              >
                Zümre Bşk.
              </button>
              <button
                onClick={() => setSimuleRol('mudur')}
                style={{
                  padding: '6px 4px', fontSize: '0.75rem', fontWeight: '700', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  backgroundColor: simuleRol === 'mudur' ? '#FFFFFF' : 'transparent',
                  color: simuleRol === 'mudur' ? '#1B3A6B' : '#FFFFFF',
                  transition: 'all 0.15s'
                }}
              >
                Müdür
              </button>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#93C5FD', marginTop: '0.5rem', fontStyle: 'italic', textAlign: 'center' }}>
              Seçilen role göre işlem yetkileri ve butonlar değişir.
            </div>
          </div>
        </div>
      </div>

      {/* Toplantı Davetiye Alert Banner */}
      {seneBasiData && (seneBasiStatus === 'davet_aktif' || seneBasiStatus === 'yazman_doldurma' || seneBasiStatus === 'mudur_onay') && (profil?.rol === 'ogretmen' || simuleRol === 'ogretmen') && (
        <div style={{
          background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
          border: '1.5px solid #F59E0B',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '2rem',
          color: '#78350F',
          boxShadow: '0 4px 15px rgba(245, 158, 11, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
            <span>✉️</span> <span>SENE BAŞI ÖĞRETMENLER KURULU TOPLANTI DAVETİYESİ</span>
          </div>
          <p style={{ margin: 0, lineHeight: '1.5', fontSize: '0.875rem', fontWeight: '500' }}>
            Sayın Öğretmenimiz, okulumuz sene başı öğretmenler kurulu toplantısı <strong>{seneBasiData.tarih || '—'}</strong> tarihinde saat <strong>{seneBasiData.saat || '—'}</strong>'da <strong>{seneBasiData.yer || '—'}</strong> bünyesinde gerçekleştirilecektir. Gündem maddelerini inceleyerek toplantıya katılımınız önemle rica olunur.
          </p>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#B45309', fontWeight: '700' }}>
            <span>📍 Konum: {seneBasiData.yer || '—'}</span>
            <span>⏰ Saat: {seneBasiData.saat || '—'}</span>
            <span>📅 Tarih: {seneBasiData.tarih || '—'}</span>
          </div>
          <button
            onClick={() => handleYazdir({ id: 1 })}
            style={{
              alignSelf: 'flex-start',
              padding: '6px 14px',
              backgroundColor: '#1B3A6B',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(27, 58, 107, 0.1)',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#112244'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
          >
            Toplantı Gündemi & Evrakı Görüntüle
          </button>
        </div>
      )}

      {/* Dönem Tabları */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #CBD5E1',
        marginBottom: '2rem',
        gap: '2rem',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        {[
          { id: 'sene_basi', etiket: '📅 Sene Başı İşlemleri' },
          { id: 'donem_sonu', etiket: '📑 Dönem Ortası / Sonu İşlemleri' },
          { id: 'yil_sonu', etiket: '🗃️ Sene Sonu İşlemleri' }
        ].map(tab => {
          const aktif = aktifDonem === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setAktifDonem(tab.id)}
              style={{
                padding: '0.75rem 0.5rem',
                fontSize: '0.9rem',
                fontWeight: '700',
                color: aktif ? '#1B3A6B' : '#64748B',
                border: 'none',
                background: 'none',
                borderBottom: aktif ? '3px solid #1B3A6B' : '3px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                marginBottom: '-2px'
              }}
            >
              {tab.etiket}
            </button>
          )
        })}
      </div>

      {aktifDonem === 'sene_basi' ? (
        <>
          {/* İstatistik Kartları */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: '600' }}>Toplam Görev / Evrak</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1E293B', marginTop: '4px' }}>{istatistikler.toplam}</div>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>MEB Mevzuatı standardı</div>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: '600' }}>Tamamlanan / Arşivlenen</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#10B981', marginTop: '4px' }}>{istatistikler.tamamlanan}</div>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>Islak imzalı ve onaylılar dahil</div>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.8rem', color: '#F59E0B', fontWeight: '600' }}>İmza ve Onay Bekleyen</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#F59E0B', marginTop: '4px' }}>{istatistikler.onayBekleyen}</div>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>Kontrolü yapılması gerekenler</div>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.8rem', color: '#3B82F6', fontWeight: '600' }}>İmza Çağrısı Yapılan</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#3B82F6', marginTop: '4px' }}>{istatistikler.imzayaCagrilan}</div>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>Öğretmenler imzaya bekleniyor</div>
            </div>
          </div>

      {/* Arama ve Filtreleme Paneli */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        padding: '1rem',
        border: '1px solid #E2E8F0',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '280px' }}>
          <span style={{ fontSize: '1.2rem' }}>🔍</span>
          <input
            type="text"
            placeholder="İşlem adı, dosya kodu veya açıklama ara..."
            value={aramaKelimesi}
            onChange={(e) => setAramaKelimesi(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '0.875rem',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['Hepsi', 'Toplantı & Tutanaklar', 'Planlama & Dokümantasyon', 'Sınıf Rehberliği', 'Raporlama & Görev'].map(kat => (
            <button
              key={kat}
              onClick={() => setSeciliKategori(kat)}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: '600',
                border: '1px solid',
                borderColor: seciliKategori === kat ? '#1B3A6B' : '#E2E8F0',
                borderRadius: '20px',
                cursor: 'pointer',
                backgroundColor: seciliKategori === kat ? '#1B3A6B' : '#F8FAFC',
                color: seciliKategori === kat ? '#FFFFFF' : '#64748B',
                transition: 'all 0.15s'
              }}
            >
              {kat}
            </button>
          ))}
        </div>
      </div>

      {/* Görev ve Evrak Listesi */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
              <th style={{ padding: '1rem' }}>Dosya / Kategori</th>
              <th style={{ padding: '1rem' }}>Süreç ve Gereksinim</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>Süreç Adımları (Onay Hattı)</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>İmza / Arşiv</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filtrelenmişGorevler.length > 0 ? (
              filtrelenmişGorevler.map((gorev) => {
                const durum = finalGorevDurumlari[gorev.id]
                return (
                  <tr
                    key={gorev.id}
                    style={{
                      borderBottom: '1px solid #E2E8F0',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {/* Dosya Kodu & Kategori */}
                    <td style={{ padding: '1.25rem 1rem', width: '200px', verticalAlign: 'top' }}>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: '800', color: '#1B3A6B', background: '#EFF6FF',
                        padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '6px',
                        fontFamily: 'monospace'
                      }}>
                        {gorev.dosyaNo}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' }}>
                        {gorev.kategori}
                      </div>
                    </td>

                    {/* Süreç ve Gereksinim */}
                    <td style={{ padding: '1.25rem 1rem', maxWidth: '350px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: '700', color: '#1E293B', marginBottom: '4px' }}>{gorev.baslik}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4', marginBottom: '8px' }}>{gorev.aciklama}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.72rem' }}>
                        <span style={{ color: '#0369A1', background: '#E0F2FE', padding: '1px 6px', borderRadius: '4px', fontWeight: '500' }}>
                          👤 Sorumlu: {gorev.sorumlu}
                        </span>
                        <span style={{ color: '#475569', background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px', fontWeight: '500' }}>
                          📄 Gereksinim: {gorev.gereksinim}
                        </span>
                      </div>
                    </td>

                    {/* Onay Pipeline (Adımlar) */}
                    <td style={{ padding: '1.25rem 1rem', verticalAlign: 'middle', width: '250px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {/* 1. Öğretmen Adımı */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{
                            width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: '700',
                            backgroundColor: durum.ogretmen === 'tamamlandi' || durum.ogretmen === 'onay_bekliyor' ? '#10B981' : '#E2E8F0',
                            color: '#FFFFFF'
                          }}>
                            {durum.ogretmen === 'tamamlandi' || durum.ogretmen === 'onay_bekliyor' ? '✓' : '1'}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: '600' }}>Öğretmen</span>
                        </div>

                        {/* Bağlantı çizgisi 1 */}
                        <div style={{ flex: 1, height: '2px', backgroundColor: durum.ogretmen === 'tamamlandi' || durum.ogretmen === 'onay_bekliyor' ? '#10B981' : '#E2E8F0', minWidth: '20px' }} />

                        {/* 2. Zümre Başkanı Adımı */}
                        {gorev.sorumlu.includes('Zümre') && (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: '700',
                                backgroundColor: durum.zumre === 'onaylandi' ? '#10B981' : durum.zumre === 'onay_bekliyor' ? '#F59E0B' : '#E2E8F0',
                                color: '#FFFFFF'
                              }}>
                                {durum.zumre === 'onaylandi' ? '✓' : '2'}
                              </span>
                              <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: '600' }}>Zümre Bşk.</span>
                            </div>
                            <div style={{ flex: 1, height: '2px', backgroundColor: durum.zumre === 'onaylandi' ? '#10B981' : '#E2E8F0', minWidth: '20px' }} />
                          </>
                        )}

                        {/* 3. Müdür Adımı */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{
                            width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: '700',
                            backgroundColor: durum.mudur === 'onaylandi' ? '#10B981' : durum.mudur === 'imza_bekliyor' ? '#3B82F6' : '#E2E8F0',
                            color: '#FFFFFF'
                          }}>
                            {durum.mudur === 'onaylandi' ? '✓' : 'M'}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: '600' }}>Müdür</span>
                        </div>
                      </div>
                    </td>

                    {/* İmza / Arşiv Durumu */}
                    <td style={{ padding: '1.25rem 1rem', textAlign: 'center', verticalAlign: 'middle', width: '120px' }}>
                      {durum.imzaDurumu === 'imzalandi' ? (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '1.2rem', color: '#10B981' }}>🗃️</span>
                          <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: '700' }}>İmzalandı & Arşiv</span>
                        </div>
                      ) : durum.imzaDurumu === 'cagri_yapildi' ? (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '1.2rem', color: '#3B82F6', animation: 'float 2s infinite ease-in-out' }}>✍️</span>
                          <span style={{ fontSize: '0.7rem', color: '#3B82F6', fontWeight: '700' }}>İmzaya Çağrıldı</span>
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', opacity: 0.4 }}>
                          <span style={{ fontSize: '1.2rem', color: '#94A3B8' }}>⏳</span>
                          <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: '600' }}>Beklemede</span>
                        </div>
                      )}
                    </td>

                    {/* İşlemler (Rol Bazlı) */}
                    <td style={{ padding: '1.25rem 1rem', textAlign: 'right', verticalAlign: 'middle', width: '180px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                        {/* ÖĞRETMEN ROLÜ AKSİYONLARI */}
                        {simuleRol === 'ogretmen' && (
                          <>
                            {durum.ogretmen === 'yapilmadi' && (
                              <button
                                onClick={() => gorev.evrakUretimi ? handleYazdir(gorev) : handleOgretmenTamamla(gorev.id)}
                                style={{
                                  padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                  backgroundColor: '#1B3A6B', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer'
                                }}
                              >
                                {gorev.evrakUretimi ? '📝 Evrak Doldur' : '✓ Tamamlandı Yap'}
                              </button>
                            )}
                            {durum.ogretmen === 'onay_bekliyor' && (
                              <span style={{ fontSize: '0.72rem', color: '#F59E0B', fontWeight: '700', fontStyle: 'italic' }}>
                                Onay Bekliyor
                              </span>
                            )}
                            {durum.imzaDurumu === 'cagri_yapildi' && (
                              <button
                                onClick={() => handleEvrakImzala(gorev.id)}
                                style={{
                                  padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                  backgroundColor: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer'
                                }}
                              >
                                ✍️ Evrakı İmzala
                              </button>
                            )}
                            {durum.imzaDurumu === 'imzalandi' && (
                              <button
                                onClick={() => handleYazdir(gorev)}
                                style={{
                                  padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                  backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer'
                                }}
                              >
                                📄 Önizle / Yazdır
                              </button>
                            )}
                          </>
                        )}

                        {/* ZÜMRE BAŞKANI ROLÜ AKSİYONLARI */}
                        {simuleRol === 'zumre' && (
                          <>
                            {gorev.sorumlu.includes('Zümre') && (
                              <>
                                {durum.zumre === 'onay_bekliyor' && (
                                  <button
                                    onClick={() => handleZumreOnayla(gorev.id)}
                                    style={{
                                      padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                      backgroundColor: '#F59E0B', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer'
                                    }}
                                  >
                                    📋 Zümreyi Onayla
                                  </button>
                                )}
                                {durum.zumre === 'onaylandi' && durum.mudur !== 'onaylandi' && (
                                  <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: '700' }}>
                                    Zümre Onaylı
                                  </span>
                                )}
                              </>
                            )}
                            {!gorev.sorumlu.includes('Zümre') && (
                              <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontStyle: 'italic' }}>
                                Zümre yetki dışı
                              </span>
                            )}
                          </>
                        )}

                        {/* MÜDÜR ROLÜ AKSİYONLARI */}
                        {simuleRol === 'mudur' && (
                          <>
                            {durum.mudur === 'yapilmadi' && (
                              <button
                                onClick={() => handleYazdir(gorev)}
                                style={{
                                  padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                  backgroundColor: '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer'
                                }}
                              >
                                🚀 Süreci Başlat / Düzenle
                              </button>
                            )}
                            {durum.ogretmen === 'onay_bekliyor' && (
                              <button
                                onClick={() => handleMudurOnayla(gorev.id)}
                                style={{
                                  padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                  backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer'
                                }}
                              >
                                ✅ İncele & Onayla
                              </button>
                            )}
                            {durum.mudur === 'imza_bekliyor' && durum.imzaDurumu === 'imzalanmadi' && (
                              <button
                                onClick={() => handleImzayaCagir(gorev.id)}
                                style={{
                                  padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                  backgroundColor: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer'
                                }}
                              >
                                ✍️ İmzaya Çağır
                              </button>
                            )}
                            {durum.imzaDurumu === 'cagri_yapildi' && (
                              <span style={{ fontSize: '0.72rem', color: '#3B82F6', fontWeight: '700', fontStyle: 'italic' }}>
                                İmza Bekleniyor
                              </span>
                            )}
                            {(durum.mudur === 'onaylandi' || durum.imzaDurumu === 'imzalandi') && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  onClick={() => handleYazdir(gorev)}
                                  style={{
                                    padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                    backgroundColor: '#1B3A6B', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer'
                                  }}
                                >
                                  🖨️ Çıktı Al
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
                  Arama kriterlerinize uygun yasal süreç bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  ) : (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '4rem 2rem',
          textAlign: 'center',
          border: '1px dashed #CBD5E1',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem'
        }}>
          <div style={{ fontSize: '4rem', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.05))' }}>
            {aktifDonem === 'donem_sonu' ? '📑' : '🗃️'}
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', margin: 0 }}>
            {aktifDonem === 'donem_sonu' ? 'Dönem Ortası / Sonu Resmi İşlemleri' : 'Sene Sonu Resmi İşlemleri'}
          </h3>
          <p style={{ fontSize: '0.925rem', color: '#64748B', lineHeight: '1.6', margin: 0, maxWidth: '520px' }}>
            {aktifDonem === 'donem_sonu' 
              ? 'Dönem sonu yaklaştığında not fişleri, gelişim raporları, dönem sonu kurul ve ŞÖK toplantısı gibi yasal süreçler burada aktif olacaktır.' 
              : 'Eğitim-öğretim yılı sonunda yapılması gereken sene sonu öğretmenler kurulu kararları, faaliyet raporları ve sınıf demirbaş teslim/iade işlemleri bu sekmede yer alacaktır.'}
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'rgba(27, 58, 107, 0.05)',
            color: '#1B3A6B',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: '700',
            marginTop: '0.5rem'
          }}>
            <span>⏳</span> <span>Zamanı geldiğinde bu sekme doldurulup aktif edilecektir.</span>
          </div>
        </div>
      )}
    </div>
  )
}
