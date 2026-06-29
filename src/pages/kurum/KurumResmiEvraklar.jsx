import { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { doc, getDoc, onSnapshot, setDoc, collection, query, where } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { getDescendants, getAncestors } from '../../utils/hierarchy'

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

export default function KurumResmiEvraklar() {
  const { secilenKurum, secilenKurumId, erisimKurumlar, setSecilenKurumId } = useKurumYonetim()
  const { profil, kullanici, platformAdmin } = useAuth()
  const location = useLocation()

  // 1. Şablon Seçimi
  const [seciliSablonId, setSeciliSablonId] = useState(1) // Varsayılan Sene Başı Kurulu (id: 1)
  const [aktifAdim, setAktifAdim] = useState(1) // Sene Başı Kurulu için Wizard adımı (1-4)

  // Rol ve Öğretmen Simülasyonu
  const defaultRol = profil?.rol === 'kurum_admin' || profil?.rol === 'platform_admin' ? 'mudur' : 'ogretmen'
  const [simuleRol, setSimuleRol] = useState(location.state?.simuleRol || defaultRol)
  const [simuleOgretmenAd, setSimuleOgretmenAd] = useState('')

  // Seçili kurum hiyerarşisindeki tüm ID'ler (alt okullar ve üst kampüs/kurumlar dahil)
  const seciliScopeIds = useMemo(() => {
    if (!secilenKurumId) return []
    const descendants = getDescendants(secilenKurumId, erisimKurumlar || []).map(k => k.id)
    const ancestors = getAncestors(secilenKurumId, erisimKurumlar || [])
    return [...new Set([secilenKurumId, ...descendants, ...ancestors])]
  }, [secilenKurumId, erisimKurumlar])

  // Dependency comparison string for seciliScopeIds array
  const seciliScopeIdsStr = useMemo(() => seciliScopeIds.join(','), [seciliScopeIds])

  // Gerçek Öğretmenler listesi
  const [ogretmenler, setOgretmenler] = useState([])
  const [toplantiDurumu, setToplantiDurumu] = useState('yapilmadi')

  // Öğretmenleri Firestore'dan yükle (Hiyerarşideki tüm okullardan)
  useEffect(() => {
    if (!seciliScopeIds.length) {
      setOgretmenler([])
      return
    }
    const parcalar = {}
    const unsubs = seciliScopeIds.map(kid => {
      const colRef = collection(db, 'kurumlar', kid, 'kullanicilar')
      return onSnapshot(colRef, snap => {
        parcalar[kid] = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => u.rol === 'ogretmen')
        
        // Parçaları tekilleştirip ada göre sırala
        const hepsi = [...new Map(
          Object.values(parcalar).flat().map(o => [o.id, o])
        ).values()].sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
        
        setOgretmenler(hepsi)

        // Varsayılan simüle öğretmen belirle
        if (profil?.rol === 'ogretmen' && profil?.ad) {
          setSimuleOgretmenAd(profil.ad)
        } else if (hepsi.length > 0) {
          setSimuleOgretmenAd(prev => {
            if (prev && hepsi.some(o => o.ad === prev)) return prev
            return hepsi[0].ad
          })
        }
      }, err => {
        console.error(`Error loading teachers for institution ${kid}:`, err)
      })
    })
    return () => unsubs.forEach(u => u())
  }, [seciliScopeIdsStr, profil])

  // Eğer URL state üzerinden yönlendirme yapıldıysa o şablonu seç
  useEffect(() => {
    if (location.state?.sablonId) {
      const match = SABLONLAR.some(s => s.id === location.state.sablonId)
      if (match) {
        setSeciliSablonId(location.state.sablonId)
      }
    }
  }, [location.state])
  const [resmiEvraklarDocs, setResmiEvraklarDocs] = useState({})
  useEffect(() => {
    if (!secilenKurumId) return
    const colRef = collection(db, 'kurumlar', secilenKurumId, 'resmiEvraklar')
    const unsub = onSnapshot(colRef, snapshot => {
      const docs = {}
      snapshot.forEach(d => {
        docs[d.id] = d.data()
      })
      setResmiEvraklarDocs(docs)
    })
    return () => unsub()
  }, [secilenKurumId])

  const tumBranslar = useMemo(() => {
    return resmiEvraklarDocs['seneBasiZumreListesi']?.branslar || [
      { id: 'turkce', ad: 'Türkçe', sabit: true },
      { id: 'matematik', ad: 'Matematik', sabit: true },
      { id: 'sosyal_bilgiler', ad: 'Sosyal Bilgiler (İnkılap Tarihi)', sabit: true },
      { id: 'fen_bilimleri', ad: 'Fen Bilimleri', sabit: true },
      { id: 'yabanci_dil', ad: 'Yabancı Dil', sabit: true },
      { id: 'din_kulturu', ad: 'Din Kültürü', sabit: true },
      { id: 'muzik', ad: 'Müzik', sabit: true },
      { id: 'gorsel_sanatlar', ad: 'Görsel Sanatlar', sabit: true },
      { id: 'beden_egitimi', ad: 'Beden Eğitimi', sabit: true },
      { id: 'bilisim_teknolojileri', ad: 'Bilişim Teknolojileri', sabit: true },
      { id: 'uygulamali_dersler', ad: 'Uygulamalı Dersler', sabit: true }
    ]
  }, [resmiEvraklarDocs])

  const [seciliBransId, setSeciliBransId] = useState(location.state?.bransId || '')

  useEffect(() => {
    if (seciliSablonId === 2 && !seciliBransId && tumBranslar.length > 0) {
      setSeciliBransId(tumBranslar[0].id)
    }
  }, [seciliSablonId, seciliBransId, tumBranslar])

  const getOgretmenlerByBrans = (bransId) => {
    if (!bransId) return ogretmenler
    const b = tumBranslar.find(x => x.id === bransId)
    if (!b) return ogretmenler
    
    const bIdNorm = b.id.toLowerCase().trim()
    const bAdNorm = b.ad.toLowerCase().trim()
    
    return ogretmenler.filter(o => {
      const oBranslar = o.branslar || []
      return oBranslar.some(ub => {
        const ubNorm = ub.toLowerCase().trim()
        return bAdNorm.includes(ubNorm) || ubNorm.includes(bAdNorm) || bIdNorm === ubNorm
      })
    })
  }

  const zumreData = useMemo(() => {
    if (!seciliBransId) return null
    return resmiEvraklarDocs[`seneBasiZumre_${seciliBransId}`] || null
  }, [resmiEvraklarDocs, seciliBransId])

  useEffect(() => {
    if (seciliSablonId === 2 && seciliBransId) {
      const currentBransAd = tumBranslar.find(b => b.id === seciliBransId)?.ad || ''
      if (zumreData) {
        setZumreForm(prev => ({
          ...prev,
          ...zumreData,
          brans: zumreData.brans || currentBransAd
        }))
      } else {
        setZumreForm({
          akademikYil: '2025-2026',
          brans: currentBransAd,
          toplantıNo: '1',
          tarih: new Date().toISOString().split('T')[0],
          saat: '10:00',
          yer: 'Öğretmenler Odası',
          katilimcilar: '',
          zumreBaskani: '',
          gundem: '1. Açılış ve yoklama.\n2. Yıllık planların ve müfredat dağılımlarının incelenmesi.\n3. Ölçme ve değerlendirme kriterlerinin belirlenmesi.\n4. Kaynak kitapların seçimi ve dilekler.',
          kararlar: ''
        })
      }
    }
  }, [seciliSablonId, seciliBransId, zumreData, tumBranslar])

  const saveZumreToFirestore = async (newFields = {}, newStatus = null) => {
    if (!secilenKurumId || !seciliBransId) return
    const docRef = doc(db, 'kurumlar', secilenKurumId, 'resmiEvraklar', `seneBasiZumre_${seciliBransId}`)
    const updateData = {
      ...zumreForm,
      ...newFields
    }
    if (newStatus) {
      updateData.status = newStatus
    } else if (zumreData?.status) {
      updateData.status = zumreData.status
    }
    await setDoc(docRef, updateData, { merge: true })
  }


  // 2. Form State'leri
  // A. Sene Başı Öğretmenler Kurulu State (Örnek isimler kaldırıldı, varsayılanlar boş)
  const [kurulForm, setKurulForm] = useState({
    akademikYil: '2025-2026',
    baslatanEmail: '',
    baslatanAd: '',
    kararNo: '',
    tarih: '',
    saat: '',
    yer: '',
    baskan: '',
    yazmanAsil1: '',
    yazmanAsil2: '',
    yazmanYedek1: '',
    yazmanYedek2: '',
    gundem: '1. Açılış, yoklama ve İstiklal Marşı.\n2. Yazman seçimi.\n3. Gündem maddelerinin okunması ve eklemeler.\n4. Okulun genel işleyişi, haftalık ders programları ve nöbet görevlerinin görüşülmesi.\n5. Sınıf rehber öğretmenliklerinin belirlenmesi.\n6. Kurul, Komisyon ve Kulüplere öğretmen seçimlerinin yapılması.\n7. Kapanış.',
    kararlar: '1. Toplantıya tüm zümre ve sınıf öğretmenleri katılım sağlamıştır.\n2. Yazmanlık ve komisyon seçimleri oybirliği ile gerçekleştirilerek karar altına alınmıştır.',
    dilekler: 'Başarılı, huzurlu ve verimli bir eğitim-öğretim yılı geçirilmesi temennisiyle toplantı okul müdürü tarafından kapatılmıştır.',
    // Sınıf Rehber Öğretmenleri
    sinif5A: '', sinif5B: '', sinif6A: '', sinif6B: '', sinif7A: '', sinif7B: '', sinif8A: '', sinif8B: '',
    // 7 Komisyon & Kurul Seçimleri
    komisyonIhaleAsil1: '', komisyonIhaleAsil2: '', komisyonIhaleYedek1: '', komisyonIhaleYedek2: '',
    komisyonMuayeneAsil1: '', komisyonMuayeneAsil2: '', komisyonMuayeneYedek1: '', komisyonMuayeneYedek2: '',
    komisyonRehberlik1: '', komisyonRehberlik2: '', komisyonRehberlik3: '',
    komisyonWeb1: '', komisyonWeb2: '',
    komisyonSosyal1: '', komisyonSosyal2: '',
    komisyonYazi1: '', komisyonYazi2: '',
    komisyonAile1: '', komisyonAile2: ''
  })

  // Sene Başı Kurul Toplantı verilerini Firestore'dan yükle
  useEffect(() => {
    if (!secilenKurumId || seciliSablonId !== 1) return
    const docRef = doc(db, 'kurumlar', secilenKurumId, 'resmiEvraklar', 'seneBasiKurul')
    const unsub = onSnapshot(docRef, docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        setToplantiDurumu(data.status || 'yapilmadi')
        setKurulForm(prev => ({
          ...prev,
          ...data
        }))
      } else {
        setToplantiDurumu('yapilmadi')
        setKurulForm({
          akademikYil: '2025-2026',
          baslatanEmail: '',
          baslatanAd: '',
          kararNo: '',
          tarih: '',
          saat: '',
          yer: '',
          baskan: '',
          yazmanAsil1: '',
          yazmanAsil2: '',
          yazmanYedek1: '',
          yazmanYedek2: '',
          gundem: '1. Açılış, yoklama ve İstiklal Marşı.\n2. Yazman seçimi.\n3. Gündem maddelerinin okunması ve eklemeler.\n4. Okulun genel işleyişi, haftalık ders programları ve nöbet görevlerinin görüşülmesi.\n5. Sınıf rehber öğretmenliklerinin belirlenmesi.\n6. Kurul, Komisyon ve Kulüplere öğretmen seçimlerinin yapılması.\n7. Kapanış.',
          kararlar: '1. Toplantıya tüm zümre ve sınıf öğretmenleri katılım sağlamıştır.\n2. Yazmanlık ve komisyon seçimleri oybirliği ile gerçekleştirilerek karar altına alınmıştır.',
          dilekler: 'Başarılı, huzurlu ve verimli bir eğitim-öğretim yılı geçirilmesi temennisiyle toplantı okul müdürü tarafından kapatılmıştır.',
          sinif5A: '', sinif5B: '', sinif6A: '', sinif6B: '', sinif7A: '', sinif7B: '', sinif8A: '', sinif8B: '',
          komisyonIhaleAsil1: '', komisyonIhaleAsil2: '', komisyonIhaleYedek1: '', komisyonIhaleYedek2: '',
          komisyonMuayeneAsil1: '', komisyonMuayeneAsil2: '', komisyonMuayeneYedek1: '', komisyonMuayeneYedek2: '',
          komisyonRehberlik1: '', komisyonRehberlik2: '', komisyonRehberlik3: '',
          komisyonWeb1: '', komisyonWeb2: '',
          komisyonSosyal1: '', komisyonSosyal2: '',
          komisyonYazi1: '', komisyonYazi2: '',
          komisyonAile1: '', komisyonAile2: ''
        })
      }
    })
    return () => unsub()
  }, [secilenKurumId, seciliSablonId])

  // Verileri Firestore'a kaydet
  const saveToFirestore = async (newFields = {}, newStatus = null) => {
    if (!secilenKurumId || seciliSablonId !== 1) return
    const docRef = doc(db, 'kurumlar', secilenKurumId, 'resmiEvraklar', 'seneBasiKurul')
    const updateData = {
      ...kurulForm,
      ...newFields
    }
    if (newStatus) {
      updateData.status = newStatus
    } else {
      updateData.status = toplantiDurumu
    }
    await setDoc(docRef, updateData, { merge: true })
  }

  // Rol bazlı kontrol yardımcıları
  const isMudur = simuleRol === 'mudur' || profil?.rol === 'kurum_admin' || profil?.rol === 'platform_admin'
  const isYazman = (simuleRol === 'ogretmen' && (
    (simuleOgretmenAd && (
      simuleOgretmenAd === kurulForm.yazmanAsil1 || 
      simuleOgretmenAd === kurulForm.yazmanAsil2 || 
      simuleOgretmenAd === kurulForm.yazmanYedek1 || 
      simuleOgretmenAd === kurulForm.yazmanYedek2
    ))
  )) || (
    profil?.rol === 'ogretmen' && profil?.ad && (
      profil.ad === kurulForm.yazmanAsil1 ||
      profil.ad === kurulForm.yazmanAsil2 ||
      profil.ad === kurulForm.yazmanYedek1 ||
      profil.ad === kurulForm.yazmanYedek2
    )
  )

  const canEditStep = (step) => {
    if (toplantiDurumu === 'onaylandi_kapatildi') return false
    if (isMudur) {
      // Müdür, evrak kapatılmadığı sürece tüm adımları düzenleyebilir (revizyon/düzeltme dahil)
      return true
    }
    if (isYazman) {
      if (toplantiDurumu === 'yazman_doldurma' && (step === 2 || step === 3 || step === 4)) return true
    }
    return false
  }

  // Öğretmen seçim dropdown'larını dolduran fonksiyon
  const renderOgretmenOptions = () => {
    return (
      <>
        <option value="">— Öğretmen Seçiniz —</option>
        {ogretmenler.map(o => (
          <option key={o.id} value={o.ad}>
            {o.ad}
          </option>
        ))}
      </>
    )
  }


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

  const userIsZumreBaskani = useMemo(() => {
    const bBaskan = zumreForm.zumreBaskani || ''
    if (!bBaskan) return false
    return profil?.ad === bBaskan || (simuleRol === 'ogretmen' && simuleOgretmenAd === bBaskan)
  }, [zumreForm.zumreBaskani, profil, simuleRol, simuleOgretmenAd])

  if (!secilenKurumId) {
    return null
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
      return { kampus: kampusObj, altlar }
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
    <div className="evraklar-container" style={{ paddingBottom: '3rem' }}>
      {/* Yazdırma esnasında sadece A4 sayfasını gösteren özel stil */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4;
            margin: 20mm 15mm 20mm 15mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            display: block !important;
            background: #ffffff !important;
            font-size: 11pt !important;
          }
          .evrak-body-content {
            display: block !important;
            flex: none !important;
          }
          .print-no-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table, tr, td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
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
                    <span style={{ fontWeight: '700', fontSize: '0.85rem', color: seciliSablonId === s.id ? '#1B3A6B' : '#1E293B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {platformAdmin && (s.id === 1 || s.id === 2) && <span title="Mutabakat Kilidi">🔒</span>}
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
            {seciliSablonId === 1 && !isMudur && toplantiDurumu === 'yapilmadi' ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 1.5rem',
                textAlign: 'center',
                gap: '1.25rem'
              }}>
                <div style={{ fontSize: '3.5rem', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.05))' }}>⏳</div>
                <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1E293B', margin: 0 }}>Başlatılmadı</h4>
                <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0, lineHeight: '1.6', maxWidth: '320px' }}>
                  Sene Başı Öğretmenler Kurulu Toplantısı süreci henüz okul müdürü tarafından başlatılmamıştır.
                </p>
              </div>
            ) : (
              <>
                {seciliSablonId === 1 && toplantiDurumu !== 'yapilmadi' && (
              <div style={{
                background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                border: '1.5px solid #F59E0B',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1rem',
                color: '#78350F',
                fontSize: '0.8rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                  <span>✉️</span> <span>RESMİ DAVETİYE VE TOPLANTI ÇAĞRISI</span>
                </div>
                <p style={{ margin: '6px 0 0', lineHeight: '1.4', fontWeight: '500' }}>
                  Sayın Meslektaşımız, okulumuz sene başı öğretmenler kurulu toplantısı <strong>{kurulForm.tarih || '—'}</strong> tarihinde saat <strong>{kurulForm.saat || '—'}</strong>'da <strong>{kurulForm.yer || '—'}</strong> bünyesinde gerçekleştirilecektir. Gündem maddelerini inceleyerek katılımınız önemle rica olunur.
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '0.72rem', color: '#B45309', fontWeight: '700' }}>
                  <span>📋 Gündem Maddeleri:</span> <span>Kararlar ve kurul/komisyon seçimleri yapılacaktır.</span>
                </div>
              </div>
            )}

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
                          disabled={!canEditStep(1)}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Akademik Yıl</label>
                        <input
                          type="text"
                          value={kurulForm.akademikYil}
                          onChange={e => setKurulForm({ ...kurulForm, akademikYil: e.target.value })}
                          disabled={!canEditStep(1)}
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
                          disabled={!canEditStep(1)}
                          style={{ width: '100%', padding: '7px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Toplantı Saati</label>
                        <input
                          type="text"
                          value={kurulForm.saat}
                          onChange={e => setKurulForm({ ...kurulForm, saat: e.target.value })}
                          disabled={!canEditStep(1)}
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
                          disabled={!canEditStep(1)}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Kurul Başkanı (Müdür)</label>
                        <input
                          type="text"
                          value={kurulForm.baskan}
                          onChange={e => setKurulForm({ ...kurulForm, baskan: e.target.value })}
                          disabled={!canEditStep(1)}
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
                        disabled={!canEditStep(1)}
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
                    {toplantiDurumu === 'yapilmadi' && (
                      <div style={{
                        background: '#FFF5F5',
                        border: '1px solid #FEB2B2',
                        color: '#C53030',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        padding: '10px',
                        borderRadius: '8px',
                        lineHeight: '1.4',
                        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.05)'
                      }}>
                        ⚠️ Yazman ve Rehber Öğretmen seçimi yapabilmek için lütfen önce <strong>1. Adım</strong>'daki tarih, saat ve salon (yer) bilgilerini girip sol alttaki <strong>"Resmi Süreci Başlat"</strong> butonuna tıklayınız.
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Asil Yazman 1</label>
                        <select
                          value={kurulForm.yazmanAsil1}
                          onChange={e => setKurulForm({ ...kurulForm, yazmanAsil1: e.target.value })}
                          disabled={!(isMudur && toplantiDurumu === 'davet_aktif')}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        >
                          {renderOgretmenOptions()}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Asil Yazman 2</label>
                        <select
                          value={kurulForm.yazmanAsil2}
                          onChange={e => setKurulForm({ ...kurulForm, yazmanAsil2: e.target.value })}
                          disabled={!(isMudur && toplantiDurumu === 'davet_aktif')}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        >
                          {renderOgretmenOptions()}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Yedek Yazman 1</label>
                        <select
                          value={kurulForm.yazmanYedek1}
                          onChange={e => setKurulForm({ ...kurulForm, yazmanYedek1: e.target.value })}
                          disabled={!(isMudur && toplantiDurumu === 'davet_aktif')}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        >
                          {renderOgretmenOptions()}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Yedek Yazman 2</label>
                        <select
                          value={kurulForm.yazmanYedek2}
                          onChange={e => setKurulForm({ ...kurulForm, yazmanYedek2: e.target.value })}
                          disabled={!(isMudur && toplantiDurumu === 'davet_aktif')}
                          style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                        >
                          {renderOgretmenOptions()}
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
                              disabled={!canEditStep(2)}
                              style={{ flex: 1, padding: '4px', fontSize: '0.75rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                            >
                              {renderOgretmenOptions()}
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
                    {(toplantiDurumu === 'yapilmadi' || toplantiDurumu === 'davet_aktif') && (
                      <div style={{
                        background: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        color: '#1E40AF',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        padding: '10px',
                        borderRadius: '8px',
                        lineHeight: '1.4',
                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.05)'
                      }}>
                        ℹ️ Komisyon ve kurul üye seçimleri, toplantı resmi olarak başladıktan ve okul müdürü tarafından <strong>asil/yedek yazmanlar onaylandıktan sonra</strong>, yetkili kılınan yazman öğretmenler tarafından girilecektir.
                      </div>
                    )}
                    
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
                            disabled={!canEditStep(3)}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '2px' }}
                          >
                            {renderOgretmenOptions()}
                          </select>
                          <select
                            value={kurulForm.komisyonIhaleAsil2}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonIhaleAsil2: e.target.value })}
                            disabled={!canEditStep(3)}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '4px' }}
                          >
                            {renderOgretmenOptions()}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.68rem', color: '#64748B' }}>Yedek Üyeler</label>
                          <select
                            value={kurulForm.komisyonIhaleYedek1}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonIhaleYedek1: e.target.value })}
                            disabled={!canEditStep(3)}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '2px' }}
                          >
                            {renderOgretmenOptions()}
                          </select>
                          <select
                            value={kurulForm.komisyonIhaleYedek2}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonIhaleYedek2: e.target.value })}
                            disabled={!canEditStep(3)}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '4px' }}
                          >
                            {renderOgretmenOptions()}
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
                            disabled={!canEditStep(3)}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '2px' }}
                          >
                            {renderOgretmenOptions()}
                          </select>
                          <select
                            value={kurulForm.komisyonMuayeneAsil2}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonMuayeneAsil2: e.target.value })}
                            disabled={!canEditStep(3)}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '4px' }}
                          >
                            {renderOgretmenOptions()}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.68rem', color: '#64748B' }}>Yedek Üyeler</label>
                          <select
                            value={kurulForm.komisyonMuayeneYedek1}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonMuayeneYedek1: e.target.value })}
                            disabled={!canEditStep(3)}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '2px' }}
                          >
                            {renderOgretmenOptions()}
                          </select>
                          <select
                            value={kurulForm.komisyonMuayeneYedek2}
                            onChange={e => setKurulForm({ ...kurulForm, komisyonMuayeneYedek2: e.target.value })}
                            disabled={!canEditStep(3)}
                            style={{ width: '100%', padding: '4px', fontSize: '0.72rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '4px' }}
                          >
                            {renderOgretmenOptions()}
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
                          disabled={!canEditStep(3)}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        >
                          {renderOgretmenOptions()}
                        </select>
                        <select
                          value={kurulForm.komisyonRehberlik2}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonRehberlik2: e.target.value })}
                          disabled={!canEditStep(3)}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '3px' }}
                        >
                          {renderOgretmenOptions()}
                        </select>
                        <select
                          value={kurulForm.komisyonRehberlik3}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonRehberlik3: e.target.value })}
                          disabled={!canEditStep(3)}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '3px' }}
                        >
                          {renderOgretmenOptions()}
                        </select>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
                          🌐 Web Yayın Komisyonu
                        </div>
                        <select
                          value={kurulForm.komisyonWeb1}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonWeb1: e.target.value })}
                          disabled={!canEditStep(3)}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        >
                          {renderOgretmenOptions()}
                        </select>
                        <select
                          value={kurulForm.komisyonWeb2}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonWeb2: e.target.value })}
                          disabled={!canEditStep(3)}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '3px' }}
                        >
                          {renderOgretmenOptions()}
                        </select>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
                          🏆 Sosyal Etkinlikler Kurulu
                        </div>
                        <select
                          value={kurulForm.komisyonSosyal1}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonSosyal1: e.target.value })}
                          disabled={!canEditStep(3)}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        >
                          {renderOgretmenOptions()}
                        </select>
                        <select
                          value={kurulForm.komisyonSosyal2}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonSosyal2: e.target.value })}
                          disabled={!canEditStep(3)}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '3px' }}
                        >
                          {renderOgretmenOptions()}
                        </select>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#1E293B', marginBottom: '4px' }}>
                          📚 Yazı İnceleme Kurulu
                        </div>
                        <select
                          value={kurulForm.komisyonYazi1}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonYazi1: e.target.value })}
                          disabled={!canEditStep(3)}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        >
                          {renderOgretmenOptions()}
                        </select>
                        <select
                          value={kurulForm.komisyonYazi2}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonYazi2: e.target.value })}
                          disabled={!canEditStep(3)}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px', marginTop: '3px' }}
                        >
                          {renderOgretmenOptions()}
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
                          disabled={!canEditStep(3)}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        >
                          {renderOgretmenOptions()}
                        </select>
                        <select
                          value={kurulForm.komisyonAile2}
                          onChange={e => setKurulForm({ ...kurulForm, komisyonAile2: e.target.value })}
                          disabled={!canEditStep(3)}
                          style={{ width: '100%', padding: '3px', fontSize: '0.7rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        >
                          {renderOgretmenOptions()}
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
                        disabled={!canEditStep(4)}
                        style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px', resize: 'vertical', fontFamily: 'sans-serif' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Dilek, Temenniler & Kapanış Notu</label>
                      <textarea
                        rows="3"
                        value={kurulForm.dilekler}
                        onChange={e => setKurulForm({ ...kurulForm, dilekler: e.target.value })}
                        disabled={!canEditStep(4)}
                        style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px', resize: 'vertical', fontFamily: 'sans-serif' }}
                      />
                    </div>
                  </div>
                )}

                {/* Sihirbaz Yönlendirme Düğmeleri */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                  <button
                    disabled={aktifAdim === 1}
                    onClick={() => {
                      if (canEditStep(aktifAdim)) {
                        saveToFirestore()
                      }
                      setAktifAdim(prev => prev - 1)
                    }}
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
                      onClick={() => {
                        if (canEditStep(aktifAdim)) {
                          saveToFirestore()
                        }
                        setAktifAdim(prev => prev + 1)
                      }}
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
                
                {/* Branş Seçim Dropdown */}
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1B3A6B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>📚</span> İşlem Yapılacak Branş Zümresi:
                  </label>
                  <select
                    value={seciliBransId}
                    onChange={e => setSeciliBransId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      border: '1.5px solid #CBD5E1',
                      borderRadius: '6px',
                      backgroundColor: '#FFFFFF',
                      color: '#1E293B',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {tumBranslar.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.ad} {!b.sabit ? '(Seçmeli)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Branş / Zümre</label>
                    <input
                      type="text"
                      value={zumreForm.brans}
                      disabled={true}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px', backgroundColor: '#F1F5F9' }}
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
                  {isMudur && (zumreData?.status || 'yapilmadi') !== 'onaylandi_kapatildi' ? (
                    <select
                      value={zumreForm.zumreBaskani}
                      onChange={e => setZumreForm({ ...zumreForm, zumreBaskani: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px', backgroundColor: '#FFFFFF', cursor: 'pointer', fontWeight: '600' }}
                    >
                      <option value="">— Zümre Başkanı Seçin —</option>
                      {getOgretmenlerByBrans(seciliBransId).map(o => (
                        <option key={o.id} value={o.ad}>
                          {o.ad}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={zumreForm.zumreBaskani}
                      disabled={true}
                      style={{ width: '100%', padding: '8px', fontSize: '0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', marginTop: '4px' }}
                    />
                  )}
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
              {seciliSablonId === 1 ? (
                <>
                  {/* MÜDÜR EYLEMLERİ */}
                  {isMudur && (
                    <>
                      {toplantiDurumu === 'yapilmadi' && (
                        <button
                          onClick={async () => {
                            if (!kurulForm.tarih || !kurulForm.saat || !kurulForm.yer) {
                              alert('Lütfen Adım 1\'deki Tarih, Saat ve Yer (Salon) alanlarını doldurunuz!')
                              return
                            }
                            try {
                              await saveToFirestore({
                                baslatanEmail: kullanici?.email || '',
                                baslatanAd: profil?.ad || kullanici?.displayName || kullanici?.email || ''
                              }, 'davet_aktif')
                              alert('Süreç başlatıldı, öğretmen ekranlarında resmi davetiye mesajı aktif edildi.')
                            } catch (err) {
                              console.error('Hata:', err)
                              alert('Süreç başlatılamadı: ' + err.message)
                            }
                          }}
                          style={{
                            width: '100%', padding: '12px', backgroundColor: '#4F46E5', color: '#FFFFFF',
                            border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem'
                          }}
                        >
                          🚀 Resmi Süreci Başlat
                        </button>
                      )}

                      {toplantiDurumu === 'davet_aktif' && (
                        <button
                          onClick={async () => {
                            if (!kurulForm.yazmanAsil1 || !kurulForm.yazmanAsil2 || !kurulForm.yazmanYedek1 || !kurulForm.yazmanYedek2) {
                              alert('Lütfen Adım 2\'deki Yazman (2 Asil, 2 Yedek) seçimlerini yapınız!')
                              return
                            }
                            try {
                              await saveToFirestore({}, 'yazman_doldurma')
                              alert('Yazman öğretmenler başarıyla onaylandı ve evrağı doldurma yetkileri tanımlandı.')
                            } catch (err) {
                              console.error('Hata:', err)
                              alert('Onaylama başarısız: ' + err.message)
                            }
                          }}
                          style={{
                            width: '100%', padding: '12px', backgroundColor: '#10B981', color: '#FFFFFF',
                            border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem'
                          }}
                        >
                          👥 Yazmanları Onayla ve Yetkilendir
                        </button>
                      )}

                      {toplantiDurumu === 'yazman_doldurma' && (
                        <div style={{
                          padding: '10px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
                          borderRadius: '8px', color: '#1E40AF', fontSize: '0.8rem', fontWeight: '600', textAlign: 'center'
                        }}>
                          ⏳ Yazman öğretmenlerin evrağı doldurması bekleniyor.
                        </div>
                      )}

                      {toplantiDurumu === 'mudur_onay' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <button
                            onClick={async () => {
                              if (kurulForm.baslatanEmail && kullanici?.email && kurulForm.baslatanEmail !== kullanici.email) {
                                alert(`Bu evrağı yalnızca süreci başlatan yönetici (${kurulForm.baslatanEmail}) onaylayıp kapatabilir.`);
                                return;
                              }
                              try {
                                await saveToFirestore({}, 'onaylandi_kapatildi')
                                alert('Toplantı tutanağı resmi olarak onaylandı ve süreç kapatıldı. Çıktı almaya hazırdır.')
                              } catch (err) {
                                console.error('Hata:', err)
                                alert('Kapatma başarısız: ' + err.message)
                              }
                            }}
                            style={{
                              width: '100%', padding: '12px', backgroundColor: '#10B981', color: '#FFFFFF',
                              border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem',
                              opacity: (kurulForm.baslatanEmail && kullanici?.email && kurulForm.baslatanEmail !== kullanici.email) ? 0.6 : 1
                            }}
                          >
                            ✅ Toplantıyı Onayla ve Kapat
                          </button>
                          
                          <button
                            onClick={async () => {
                              if (kurulForm.baslatanEmail && kullanici?.email && kurulForm.baslatanEmail !== kullanici.email) {
                                alert(`Bu evrağı yalnızca süreci başlatan yönetici (${kurulForm.baslatanEmail}) revizyona gönderebilir.`);
                                return;
                              }
                              if (window.confirm('Bu tutanağı düzeltilmesi için yazman öğretmenlere geri göndermek istediğinize emin misiniz?')) {
                                try {
                                  await saveToFirestore({}, 'yazman_doldurma')
                                  alert('Tutanak düzeltilmek üzere yazmanlara geri gönderildi.')
                                } catch (err) {
                                  console.error('Hata:', err)
                                  alert('Geri gönderme başarısız: ' + err.message)
                                }
                              }
                            }}
                            style={{
                              width: '100%', padding: '10px', backgroundColor: '#EF4444', color: '#FFFFFF',
                              border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem',
                              opacity: (kurulForm.baslatanEmail && kullanici?.email && kurulForm.baslatanEmail !== kullanici.email) ? 0.6 : 1
                            }}
                          >
                            ↩️ Düzeltme İçin Geri Gönder (Revizyon)
                          </button>

                          {kurulForm.baslatanEmail && kullanici?.email && kurulForm.baslatanEmail !== kullanici.email && (
                            <div style={{
                              padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5',
                              borderRadius: '8px', color: '#991B1B', fontSize: '0.78rem', fontWeight: '600', textAlign: 'center',
                              lineHeight: '1.4'
                            }}>
                              ⚠️ Bu resmi süreci <strong>{kurulForm.baslatanEmail}</strong> başlattığı için, evrakı yalnızca o onaylayıp kapatabilir.
                            </div>
                          )}
                        </div>
                      )}

                      {toplantiDurumu === 'onaylandi_kapatildi' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{
                            padding: '10px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0',
                            borderRadius: '8px', color: '#065F46', fontSize: '0.8rem', fontWeight: '700', textAlign: 'center'
                          }}>
                            🗃️ Toplantı onaylandı ve arşivlendi.
                          </div>
                          {isMudur && (
                            <button
                              onClick={async () => {
                                if (kurulForm.baslatanEmail && kullanici?.email && kurulForm.baslatanEmail !== kullanici.email) {
                                  alert(`Bu evrağı yalnızca süreci başlatan yönetici (${kurulForm.baslatanEmail}) yeniden düzenlemeye açabilir.`);
                                  return;
                                }
                                if (window.confirm('Onaylanmış tutanağı yeniden düzenlemeye açmak istediğinize emin misiniz? Sorumlu öğretmenler ve siz evrak üzerinde tekrar düzenleme yapabileceksiniz.')) {
                                  try {
                                    await saveToFirestore({}, 'yazman_doldurma')
                                    alert('Tutanak yeniden düzenlemeye açıldı. Yazmanlar ve müdür düzenleme yapabilir.')
                                  } catch (err) {
                                    console.error('Hata:', err)
                                    alert('Yeniden düzenlemeye açma başarısız: ' + err.message)
                                  }
                                }
                              }}
                              style={{
                                width: '100%', padding: '10px', backgroundColor: '#D97706', color: '#FFFFFF',
                                border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem',
                                transition: 'background-color 0.15s',
                                opacity: (kurulForm.baslatanEmail && kullanici?.email && kurulForm.baslatanEmail !== kullanici.email) ? 0.6 : 1
                              }}
                            >
                              🔓 Yeniden Düzenlemeyi Etkinleştir (Revizyon)
                            </button>
                          )}

                          {kurulForm.baslatanEmail && kullanici?.email && kurulForm.baslatanEmail !== kullanici.email && (
                            <div style={{
                              padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5',
                              borderRadius: '8px', color: '#991B1B', fontSize: '0.78rem', fontWeight: '600', textAlign: 'center',
                              lineHeight: '1.4', marginTop: '4px'
                            }}>
                              ⚠️ Bu resmi süreci <strong>{kurulForm.baslatanEmail}</strong> başlattığı için, evrakı yalnızca o yeniden düzenlemeye açabilir.
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* YAZMAN ÖĞRETMEN EYLEMLERİ */}
                  {simuleRol === 'ogretmen' && isYazman && (
                    <>
                      {toplantiDurumu === 'yazman_doldurma' && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                await saveToFirestore()
                                alert('Toplantı evrak taslağı başarıyla kaydedildi.')
                              } catch (err) {
                                console.error('Hata:', err)
                                alert('Taslak kaydedilemedi: ' + err.message)
                              }
                            }}
                            style={{
                              width: '100%', padding: '10px', backgroundColor: '#3B82F6', color: '#FFFFFF',
                              border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem'
                            }}
                          >
                            💾 Taslağı Kaydet
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await saveToFirestore({}, 'mudur_onay')
                                alert('Evrak tamamlandı ve müdür onayına sunuldu.')
                              } catch (err) {
                                console.error('Hata:', err)
                                alert('Onaya sunma başarısız: ' + err.message)
                              }
                            }}
                            style={{
                              width: '100%', padding: '12px', backgroundColor: '#10B981', color: '#FFFFFF',
                              border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem'
                            }}
                          >
                            📤 Doldurmayı Tamamla ve Müdür Onayına Sun
                          </button>
                        </>
                      )}

                      {toplantiDurumu === 'mudur_onay' && (
                        <div style={{
                          padding: '10px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
                          borderRadius: '8px', color: '#1E40AF', fontSize: '0.8rem', fontWeight: '600', textAlign: 'center'
                        }}>
                          ⏳ Evrak müdür onayına sunuldu. Müdürün onaylaması bekleniyor.
                        </div>
                      )}

                      {toplantiDurumu === 'davet_aktif' && (
                        <div style={{
                          padding: '10px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                          borderRadius: '8px', color: '#92400E', fontSize: '0.8rem', fontWeight: '600', textAlign: 'center'
                        }}>
                          ✉️ Toplantı daveti aktif. Müdürün yazmanları yetkilendirmesi bekleniyor.
                        </div>
                      )}
                    </>
                  )}

                  {/* DİĞER ÖĞRETMENLER (YAZMAN OLMAYANLAR) BİLGİLENDİRMESİ */}
                  {simuleRol === 'ogretmen' && !isYazman && (
                    <div style={{
                      padding: '10px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0',
                      borderRadius: '8px', color: '#475569', fontSize: '0.8rem', fontWeight: '600', textAlign: 'center', marginBottom: '8px'
                    }}>
                      🔒 Evrak doldurma yetkisi atanan yazman öğretmenlerdedir.
                    </div>
                  )}

                  {/* YAZDIRMA BUTONU (Kapatılınca veya Müdür rolündeyken aktiftir) */}
                  <button
                    onClick={handleYazdir}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: toplantiDurumu === 'onaylandi_kapatildi' ? '#10B981' : '#1B3A6B',
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
                    <span>🖨️</span> <span>{toplantiDurumu === 'onaylandi_kapatildi' ? 'Resmi Çıktı Al (Yazdır)' : 'Evrak Çıktısı Al (Önizleme)'}</span>
                  </button>
                </>
              ) : seciliSablonId === 2 ? (
                // ZÜMRE TUTANAĞI AKTİF AKSİYON BUTONLARI
                <>
                  {isMudur && (
                    <>
                      {(zumreData?.status || 'yapilmadi') === 'yapilmadi' && (
                        <button
                          onClick={async () => {
                            if (!zumreForm.zumreBaskani) {
                              alert('Lütfen bir Zümre Başkanı seçin!')
                              return
                            }
                            await saveZumreToFirestore({}, 'baskan_secildi')
                            alert('Zümre Başkanı görevlendirildi ve süreç başlatıldı!')
                          }}
                          style={{ width: '100%', padding: '12px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '8px' }}
                        >
                          🚀 Görevlendir ve Süreci Başlat
                        </button>
                      )}
                      {((zumreData?.status) === 'baskan_secildi' || zumreData?.status === 'zumre_doldurma') && (
                        <button
                          onClick={async () => {
                            if (!zumreForm.zumreBaskani) {
                              alert('Lütfen bir Zümre Başkanı seçin!')
                              return
                            }
                            await saveZumreToFirestore({}, zumreData.status)
                            alert('Görevlendirme başarıyla güncellendi!')
                          }}
                          style={{ width: '100%', padding: '12px', backgroundColor: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '8px' }}
                        >
                          💾 Görevlendirmeyi Güncelle
                        </button>
                      )}
                      {zumreData?.status === 'mudur_onay' && (
                        <button
                          onClick={async () => {
                            await saveZumreToFirestore({}, 'onaylandi_kapatildi')
                            alert('Zümre onaylandı ve süreç kapatıldı!')
                          }}
                          style={{ width: '100%', padding: '12px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '8px' }}
                        >
                          ✅ Zümreyi Onayla ve Kapat
                        </button>
                      )}
                    </>
                  )}

                  {!isMudur && userIsZumreBaskani && (
                    <>
                      {zumreData?.status === 'baskan_secildi' && (
                        <button
                          onClick={async () => {
                            await saveZumreToFirestore({}, 'zumre_doldurma')
                            alert('Toplantı planlandı ve zümre doldurma süreci başlatıldı!')
                          }}
                          style={{ width: '100%', padding: '12px', backgroundColor: '#8B5CF6', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '8px' }}
                        >
                          📅 Toplantıyı Planla ve Süreci Başlat
                        </button>
                      )}
                      {zumreData?.status === 'zumre_doldurma' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginBottom: '8px' }}>
                          <button
                            onClick={async () => {
                              await saveZumreToFirestore({}, 'zumre_doldurma')
                              alert('Zümre taslağı başarıyla kaydedildi!')
                            }}
                            style={{ width: '100%', padding: '12px', backgroundColor: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}
                          >
                            💾 Taslağı Kaydet
                          </button>
                          <button
                            onClick={async () => {
                              await saveZumreToFirestore({}, 'mudur_onay')
                              alert('Zümre dolduruldu ve müdür onayına gönderildi!')
                            }}
                            style={{ width: '100%', padding: '12px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}
                          >
                            📤 Müdür Onayına Gönder
                          </button>
                        </div>
                      )}
                    </>
                  )}

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
                </>
              ) : (
                // DİĞER RESMİ EVRAKLAR İÇİN VARSAYILAN BUTONLAR
                <>
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
                </>
              )}
            </div>
              </>
            )}

          </div>
        </div>

        {/* SAĞ SÜTUN: A4 Canlı Önizleme */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          


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
            <div className="evrak-body-content" style={{ flex: 1, fontSize: '0.95rem', textAlign: 'justify', whiteSpace: 'pre-line', padding: '0 0.5rem' }}>
              
              {/* A. SENE BAŞI ÖĞRETMENLER KURULU TUTANAĞI İÇERİĞİ */}
              {seciliSablonId === 1 && (
                <>
                  {!isMudur && toplantiDurumu === 'yapilmadi' ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      minHeight: '200mm',
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#94A3B8',
                      border: '2px dashed #E2E8F0',
                      borderRadius: '8px'
                    }}>
                      Başlatılmadı
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', fontSize: '0.8rem' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold', width: '150px' }}>Eğitim Öğretim Yılı:</td><td>{kurulForm.akademikYil || '—'}</td><td style={{ fontWeight: 'bold', width: '100px' }}>Karar No:</td><td>{kurulForm.kararNo || '—'}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Toplantı Tarihi / Saati:</td><td>{(kurulForm.tarih || '—') + ' - ' + (kurulForm.saat || '—')}</td><td style={{ fontWeight: 'bold' }}>Toplantı Yeri:</td><td>{kurulForm.yer || '—'}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Kurul Başkanı (Müdür):</td><td colSpan="3">{kurulForm.baskan || '—'}</td></tr>
                      <tr style={{ borderBottom: '1px solid #000' }}><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Seçilen Yazmanlar:</td><td colSpan="3">Asil: {kurulForm.yazmanAsil1 || '—'}, {kurulForm.yazmanAsil2 || '—'} | Yedek: {kurulForm.yazmanYedek1 || '—'}, {kurulForm.yazmanYedek2 || '—'}</td></tr>
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
                </>
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
            {!(seciliSablonId === 1 && !isMudur && toplantiDurumu === 'yapilmadi') && (
              <div className="print-no-break" style={{ marginTop: '2.5rem', borderTop: '1px dashed #E2E8F0', paddingTop: '1rem' }}>
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
              <div className="print-no-break" style={{ marginTop: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ border: '1.5px solid #000', padding: '8px 20px', width: '220px', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>ONAYLANDI / UYGUNDUR</div>
                  <div style={{ fontSize: '0.72rem' }}>{seciliSablonId === 1 ? kurulForm.tarih : seciliSablonId === 2 ? zumreForm.tarih : seciliSablonId === 11 ? secimForm.tarih : demirbasForm.tarih}</div>
                  <div style={{ height: '25px' }} />
                  <div style={{ fontWeight: 'bold' }}>{seciliSablonId === 1 ? kurulForm.baskan.split('(')[0].trim() : 'Uğur Serkan'}</div>
                  <div style={{ fontSize: '0.7rem', color: '#444' }}>Okul Müdürü</div>
                </div>
              </div>
            </div>
            )}

          </div>

        </div>

      </div>
    </div>
  )
}
