import { useState, useMemo, useEffect, Fragment } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { doc, onSnapshot, deleteDoc, collection, setDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { getDescendants, getAncestors } from '../../utils/hierarchy'

const VARSAYILAN_BRANSLAR = [
  { id: 'turkce', ad: 'Türkçe', sabit: true },
  { id: 'matematik', ad: 'Matematik', sabit: true },
  { id: 'sosyal_bilgiler', ad: 'Sosyal Bilgiler (İnkılap Tarihi)', sabit: true },
  { id: 'fen_bilimleri', ad: 'Fen Bilimleri', sabit: true },
  { id: 'ingilizce', ad: 'İngilizce', sabit: true },
  { id: 'secmeli_yabanci_dil', ad: 'Seçmeli Yabancı Dil', sabit: true },
  { id: 'din_kulturu', ad: 'Din Kültürü', sabit: true },
  { id: 'muzik', ad: 'Müzik', sabit: true },
  { id: 'gorsel_sanatlar', ad: 'Görsel Sanatlar', sabit: true },
  { id: 'beden_egitimi', ad: 'Beden Eğitimi', sabit: true },
  { id: 'bilisim_teknolojileri', ad: 'Bilişim Teknolojileri', sabit: true },
  { id: 'uygulamali_dersler', ad: 'Uygulamalı Dersler', sabit: true }
]

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
  const { profil, kullanici, platformAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // 1. Simüle Edilen Aktif Rol
  const defaultRol = profil?.rol === 'kurum_admin' || profil?.rol === 'platform_admin' ? 'mudur' : 'ogretmen'
  const [simuleRol, setSimuleRol] = useState(location.state?.simuleRol || defaultRol)
  const [simuleOgretmenAd, setSimuleOgretmenAd] = useState(location.state?.simuleOgretmenAd || '')
  const [ogretmenler, setOgretmenler] = useState([])

  const isMudur = useMemo(() => {
    return simuleRol === 'mudur' || profil?.rol === 'kurum_admin' || profil?.rol === 'platform_admin'
  }, [simuleRol, profil])

  // Seçili kurum hiyerarşisindeki tüm ID'ler (alt okullar ve üst kampüs/kurumlar dahil)
  const seciliScopeIds = useMemo(() => {
    if (!secilenKurumId) return []
    const descendants = getDescendants(secilenKurumId, erisimKurumlar || []).map(k => k.id)
    const ancestors = getAncestors(secilenKurumId, erisimKurumlar || [])
    return [...new Set([secilenKurumId, ...descendants, ...ancestors])]
  }, [secilenKurumId, erisimKurumlar])

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
        if (location.state?.simuleOgretmenAd) {
          setSimuleOgretmenAd(location.state.simuleOgretmenAd)
        } else if (profil?.rol === 'ogretmen' && profil?.ad) {
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
  }, [seciliScopeIds, profil, location.state])

  // Profil yüklendiğinde varsayılan rolü eşitle (eğer state'ten gelen yoksa)
  useEffect(() => {
    if (profil && !location.state?.simuleRol) {
      const defRol = profil.rol === 'kurum_admin' || profil.rol === 'platform_admin' ? 'mudur' : 'ogretmen'
      setSimuleRol(defRol)
    }
  }, [profil, location.state])

  // 1.1 Aktif Dönem Tabı
  const [aktifDonem, setAktifDonem] = useState('sene_basi') // sene_basi, donem_sonu, yil_sonu

  // 1.2 Firestore Resmi Evraklar Koleksiyon Dinleyicisi (Tüm belgeler tek kanaldan)
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

  const seneBasiData = useMemo(() => resmiEvraklarDocs['seneBasiKurul'] || null, [resmiEvraklarDocs])
  const seneBasiStatus = useMemo(() => seneBasiData?.status || 'yapilmadi', [seneBasiData])

  const isYazman = useMemo(() => {
    if (!seneBasiData) return false
    const y1 = seneBasiData.yazmanAsil1 || ''
    const y2 = seneBasiData.yazmanAsil2 || ''
    const y3 = seneBasiData.yazmanYedek1 || ''
    const y4 = seneBasiData.yazmanYedek2 || ''
    
    const ad = profil?.ad || ''
    if (!ad) return false
    
    return ad === y1 || ad === y2 || ad === y3 || ad === y4
  }, [seneBasiData, profil])
    
  const tumBranslar = useMemo(() => {
    return resmiEvraklarDocs['seneBasiZumreListesi']?.branslar || VARSAYILAN_BRANSLAR
  }, [resmiEvraklarDocs])

  const branslar = useMemo(() => {
    if (isMudur) return tumBranslar

    let userBranslar = []
    if (simuleRol === 'ogretmen' && simuleOgretmenAd) {
      if (ogretmenler.length === 0) return tumBranslar // loading bypass
      const o = ogretmenler.find(x => x.ad === simuleOgretmenAd)
      userBranslar = o?.branslar || []
    } else if (profil?.rol === 'ogretmen') {
      userBranslar = profil?.branslar || []
    } else if (simuleRol === 'zumre') {
      if (ogretmenler.length === 0) return tumBranslar // loading bypass
      const o = ogretmenler.find(x => x.ad === simuleOgretmenAd)
      userBranslar = o?.branslar || profil?.branslar || []
    }
    return tumBranslar.filter(b => 
      userBranslar.some(ub => {
        const ubNorm = ub.toLowerCase().trim()
        const bAdNorm = b.ad.toLowerCase().trim()
        const bIdNorm = b.id.toLowerCase().trim()
        return bAdNorm.includes(ubNorm) || ubNorm.includes(bAdNorm) || bIdNorm === ubNorm
      })
    )
  }, [tumBranslar, simuleRol, simuleOgretmenAd, profil, ogretmenler, isMudur])

  const getBransZumreData = (bransId) => resmiEvraklarDocs[`seneBasiZumre_${bransId}`] || null

  const aktifZumreDavetleri = useMemo(() => {
    if (simuleRol === 'mudur') return []
    const list = []
    branslar.forEach(b => {
      const bData = resmiEvraklarDocs[`seneBasiZumre_${b.id}`]
      const bStatus = bData?.status || 'yapilmadi'
      const bBaskan = bData?.zumreBaskani || ''
      const isBaskan = (simuleRol === 'ogretmen' && simuleOgretmenAd === bBaskan) || 
                       (profil?.rol === 'ogretmen' && profil?.ad === bBaskan) || 
                       simuleRol === 'zumre'
      
      if (isBaskan && bStatus === 'zumre_doldurma') {
        list.push({ brans: b, data: bData })
      }
    })
    return list
  }, [branslar, resmiEvraklarDocs, simuleRol, simuleOgretmenAd, profil])

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

    // ID: 2 (Zümre Öğretmenler Kurulu Toplantı Tutanağı - Branşların Toplu Durumu)
    const branslarData = tumBranslar.map(b => resmiEvraklarDocs[`seneBasiZumre_${b.id}`])
    const statuses = branslarData.map(d => d?.status || 'yapilmadi')

    let ogretmen2 = 'yapilmadi'
    let zumre2 = 'yapilmadi'
    let mudur2 = 'yapilmadi'
    let imzaDurumu2 = 'imzalanmadi'

    if (statuses.length > 0 && statuses.every(s => s === 'onaylandi_kapatildi')) {
      ogretmen2 = 'tamamlandi'
      zumre2 = 'onaylandi'
      mudur2 = 'onaylandi'
      imzaDurumu2 = 'imzalandi'
    } else if (statuses.length > 0 && statuses.every(s => s === 'yapilmadi')) {
      ogretmen2 = 'yapilmadi'
      zumre2 = 'yapilmadi'
      mudur2 = 'yapilmadi'
      imzaDurumu2 = 'imzalanmadi'
    } else if (statuses.length > 0) {
      const hasMudurOnay = statuses.some(s => s === 'mudur_onay')
      const hasZumreDoldurma = statuses.some(s => s === 'zumre_doldurma')
      const hasBaskanSecildi = statuses.some(s => s === 'baskan_secildi')
      
      if (hasMudurOnay) {
        ogretmen2 = 'tamamlandi'
        zumre2 = 'onaylandi'
        mudur2 = 'imza_bekliyor'
        imzaDurumu2 = 'cagri_yapildi'
      } else if (hasZumreDoldurma) {
        ogretmen2 = 'onay_bekliyor'
        zumre2 = 'onay_bekliyor'
        mudur2 = 'yapilmadi'
        imzaDurumu2 = 'imzalanmadi'
      } else if (hasBaskanSecildi) {
        ogretmen2 = 'yapilmadi'
        zumre2 = 'yapilmadi'
        mudur2 = 'yapilmadi'
        imzaDurumu2 = 'imzalanmadi'
      } else {
        ogretmen2 = 'yapilmadi'
        zumre2 = 'yapilmadi'
        mudur2 = 'yapilmadi'
        imzaDurumu2 = 'imzalanmadi'
      }
    }

    updated[2] = {
      ...updated[2],
      ogretmen: ogretmen2,
      zumre: zumre2,
      mudur: mudur2,
      imzaDurumu: imzaDurumu2
    }
    
    return updated
  }, [gorevDurumlari, seneBasiStatus, resmiEvraklarDocs, tumBranslar])

  // Arama ve Filtreleme
  const [aramaKelimesi, setAramaKelimesi] = useState('')
  const [seciliKategori, setSeciliKategori] = useState('Hepsi')
  const [expandedCardKey, setExpandedCardKey] = useState(null)

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

  const handleSüreçSil = async (gorev) => {
    if (!window.confirm(`"${gorev.baslik}" sürecini silmek ve sıfırlamak istediğinize emin misiniz?`)) return
    try {
      if (gorev.id === 1) {
        const docRef = doc(db, 'kurumlar', secilenKurumId, 'resmiEvraklar', 'seneBasiKurul')
        await deleteDoc(docRef)
      } else if (gorev.id === 2) {
        // Zümre listesini ve tüm zümre branş evraklarını sil
        const listRef = doc(db, 'kurumlar', secilenKurumId, 'resmiEvraklar', 'seneBasiZumreListesi')
        await deleteDoc(listRef)
        for (const b of branslar) {
          const docRef = doc(db, 'kurumlar', secilenKurumId, 'resmiEvraklar', `seneBasiZumre_${b.id}`)
          await deleteDoc(docRef)
        }
      }
      setGorevDurumlari(prev => ({
        ...prev,
        [gorev.id]: {
          ogretmen: 'yapilmadi',
          zumre: 'yapilmadi',
          mudur: 'yapilmadi',
          imzaDurumu: 'imzalanmadi',
          sonTarih: '2026-09-30'
        }
      }))
      alert('Süreç başarıyla silindi ve sıfırlandı.')
    } catch (err) {
      console.error('Süreç silinirken hata oluştu:', err)
      alert('Süreç silinirken bir hata oluştu: ' + err.message)
    }
  }

  const handleBransEkle = async (yeniAd) => {
    if (!yeniAd.trim()) return
    const id = 'secmeli_' + Date.now()
    const mevcutBranslar = resmiEvraklarDocs['seneBasiZumreListesi']?.branslar || VARSAYILAN_BRANSLAR
    // Eğer aynı isimde varsa ekleme
    if (mevcutBranslar.some(x => x.ad.toLowerCase() === yeniAd.toLowerCase())) {
      alert('Bu ders zaten kayıtlıdır.')
      return
    }
    const guncel = [...mevcutBranslar, { id, ad: yeniAd, sabit: false }]
    try {
      const docRef = doc(db, 'kurumlar', secilenKurumId, 'resmiEvraklar', 'seneBasiZumreListesi')
      await setDoc(docRef, { branslar: guncel }, { merge: true })
      alert(`"${yeniAd}" zümre süreci başarıyla oluşturuldu.`)
    } catch (err) {
      console.error('Branş eklenemedi:', err)
      alert('Branş eklenemedi: ' + err.message)
    }
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
    <div style={{ paddingBottom: '3rem' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .desktop-task-table {
            display: none !important;
          }
          .mobile-task-accordion {
            display: block !important;
          }
          .desktop-tabs {
            display: none !important;
          }
          .mobile-tabs-dropdown {
            display: block !important;
          }
          .istatistik-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.65rem !important;
          }
          .istatistik-kart {
            padding: 0.85rem 0.65rem !important;
            text-align: center;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            min-height: 100px !important;
          }
          .istatistik-kart-baslik {
            font-size: 0.72rem !important;
            font-weight: 700 !important;
            line-height: 1.3 !important;
          }
          .istatistik-kart-sayi {
            font-size: 1.5rem !important;
            font-weight: 800 !important;
            margin-top: 4px !important;
          }
          .istatistik-kart-alt {
            display: none !important;
          }
        }
        @media (min-width: 769px) {
          .desktop-task-table {
            display: block !important;
          }
          .mobile-task-accordion {
            display: none !important;
          }
          .desktop-tabs {
            display: flex !important;
          }
          .mobile-tabs-dropdown {
            display: none !important;
          }
        }
      `}} />
      {/* Title tag and SEO styling simulation */}
      <h1 id="resmi-islemler-title" style={{ display: 'none' }}>Sene Başı Resmi İşlemleri ve Evrak Takibi</h1>



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

      {/* Zümre Toplantı Davetiyeleri */}
      {aktifZumreDavetleri.map(inv => (
        <div key={inv.brans.id} style={{
          background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
          border: '1.5px solid #10B981',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '2rem',
          color: '#065F46',
          boxShadow: '0 4px 15px rgba(16, 185, 129, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
            <span>👑</span> <span>ZÜMRE ÖĞRETMENLER KURULU TOPLANTISI ({inv.brans.ad})</span>
          </div>
          <p style={{ margin: 0, lineHeight: '1.5', fontSize: '0.875rem', fontWeight: '500' }}>
            Sayın Öğretmenimiz, okulumuz <strong>{inv.brans.ad}</strong> branşı zümre öğretmenler kurulu toplantısı <strong>{inv.data.tarih || '—'}</strong> tarihinde saat <strong>{inv.data.saat || '—'}</strong>'da <strong>{inv.data.yer || '—'}</strong> bünyesinde gerçekleştirilecektir.
            Toplantı Zümre Başkanı olarak sizin yönetiminizde yapılacaktır. Toplantı kararlarını doldurmanız ve onaylamanız rica olunur.
          </p>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#047857', fontWeight: '700' }}>
            <span>📍 Konum: {inv.data.yer || '—'}</span>
            <span>⏰ Saat: {inv.data.saat || '—'}</span>
            <span>📅 Tarih: {inv.data.tarih || '—'}</span>
          </div>
          <button
            onClick={() => navigate(location.pathname.includes('/platform') ? '/platform/kurum/resmi-islemler/evraklar' : '/kurum/resmi-islemler/evraklar', { state: { sablonId: 2, bransId: inv.brans.id, simuleRol, simuleOgretmenAd } })}
            style={{
              alignSelf: 'flex-start',
              padding: '6px 14px',
              backgroundColor: '#065F46',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(6, 95, 70, 0.1)',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#044e34'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#065F46'}
          >
            Zümre Tutanağını Doldur & Yönet
          </button>
        </div>
      ))}

      {/* Dönem Tabları - Masaüstü */}
      <div className="desktop-tabs" style={{
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

      {/* Dönem Seçici Dropdown - Mobil */}
      <div className="mobile-tabs-dropdown" style={{ display: 'none', marginBottom: '2rem' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', display: 'block', marginBottom: '6px' }}>
          📂 İşlem Dönemi
        </label>
        <div style={{ position: 'relative' }}>
          <select
            value={aktifDonem}
            onChange={e => setAktifDonem(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '0.85rem',
              fontWeight: '700',
              color: '#1B3A6B',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #CBD5E1',
              borderRadius: '10px',
              appearance: 'none',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.01)'
            }}
          >
            <option value="sene_basi">📅 Sene Başı İşlemleri</option>
            <option value="donem_sonu">📑 Dönem Ortası / Sonu İşlemleri</option>
            <option value="yil_sonu">🗃️ Sene Sonu İşlemleri</option>
          </select>
          <div style={{
            position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
            pointerEvents: 'none', color: '#1B3A6B', fontSize: '0.8rem'
          }}>
            ▼
          </div>
        </div>
      </div>

      {aktifDonem === 'sene_basi' ? (
        <>
          {/* İstatistik Kartları */}
          <div className="istatistik-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="istatistik-kart" style={{ background: '#FFFFFF', borderRadius: '12px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div className="istatistik-kart-baslik" style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: '600' }}>Toplam Görev / Evrak</div>
              <div className="istatistik-kart-sayi" style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1E293B', marginTop: '4px' }}>{istatistikler.toplam}</div>
              <div className="istatistik-kart-alt" style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>MEB Mevzuatı standardı</div>
            </div>
            <div className="istatistik-kart" style={{ background: '#FFFFFF', borderRadius: '12px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div className="istatistik-kart-baslik" style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: '600' }}>Tamamlanan / Arşivlenen</div>
              <div className="istatistik-kart-sayi" style={{ fontSize: '1.75rem', fontWeight: '800', color: '#10B981', marginTop: '4px' }}>{istatistikler.tamamlanan}</div>
              <div className="istatistik-kart-alt" style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>Islak imzalı ve onaylılar dahil</div>
            </div>
            <div className="istatistik-kart" style={{ background: '#FFFFFF', borderRadius: '12px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div className="istatistik-kart-baslik" style={{ fontSize: '0.8rem', color: '#F59E0B', fontWeight: '600' }}>İmza ve Onay Bekleyen</div>
              <div className="istatistik-kart-sayi" style={{ fontSize: '1.75rem', fontWeight: '800', color: '#F59E0B', marginTop: '4px' }}>{istatistikler.onayBekleyen}</div>
              <div className="istatistik-kart-alt" style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>Kontrolü yapılması gerekenler</div>
            </div>
            <div className="istatistik-kart" style={{ background: '#FFFFFF', borderRadius: '12px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div className="istatistik-kart-baslik" style={{ fontSize: '0.8rem', color: '#3B82F6', fontWeight: '600' }}>İmza Çağrısı Yapılan</div>
              <div className="istatistik-kart-sayi" style={{ fontSize: '1.75rem', fontWeight: '800', color: '#3B82F6', marginTop: '4px' }}>{istatistikler.imzayaCagrilan}</div>
              <div className="istatistik-kart-alt" style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>Öğretmenler imzaya bekleniyor</div>
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
      <div className="desktop-task-table" style={{
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
              filtrelenmişGorevler.flatMap((gorev) => {
                const durum = finalGorevDurumlari[gorev.id]

                // Eğer görev Zümre Kurulu (id: 2) ise ve müdür değilse (öğretmen ise)
                // her bir yetkili branşı için ayrı bir satır olarak çiz
                if (gorev.id === 2 && !isMudur) {
                  return branslar.map((brans) => {
                    const bData = getBransZumreData(brans.id)
                    const bStatus = bData?.status || 'yapilmadi'
                    const bBaskan = bData?.zumreBaskani || 'Seçilmedi'

                    // Onay hattı renkleri
                    let stepOgretmen = '#E2E8F0'
                    let stepZumre = '#E2E8F0'
                    let stepMudur = '#E2E8F0'
                    let stepImza = '⏳'
                    let stepImzaColor = '#94A3B8'
                    
                    if (bStatus === 'zumre_doldurma') {
                      stepOgretmen = '#F59E0B'
                      stepZumre = '#F59E0B'
                    } else if (bStatus === 'mudur_onay') {
                      stepOgretmen = '#10B981'
                      stepZumre = '#10B981'
                      stepMudur = '#3B82F6'
                      stepImza = '✍️'
                      stepImzaColor = '#3B82F6'
                    } else if (bStatus === 'onaylandi_kapatildi') {
                      stepOgretmen = '#10B981'
                      stepZumre = '#10B981'
                      stepMudur = '#10B981'
                      stepImza = '🗃️'
                      stepImzaColor = '#10B981'
                    }

                    const userIsZumreBaskani = (simuleRol === 'ogretmen' && simuleOgretmenAd === bBaskan) || 
                                               (profil?.rol === 'ogretmen' && profil?.ad === bBaskan) || 
                                               simuleRol === 'zumre'

                    const evrakUrl = location.pathname.includes('/platform') 
                      ? '/platform/kurum/resmi-islemler/evraklar' 
                      : '/kurum/resmi-islemler/evraklar'

                    return (
                      <tr
                        key={`${gorev.id}_${brans.id}`}
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
                          <div style={{ fontWeight: '700', color: '#1E293B', marginBottom: '4px' }}>
                            {gorev.baslik} ({brans.ad}) {!brans.sabit && <span style={{ fontSize: '0.65rem', background: '#FEF3C7', color: '#D97706', padding: '1px 6px', borderRadius: '4px', marginLeft: '4px' }}>Seçmeli</span>}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4', marginBottom: '8px' }}>{gorev.aciklama}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.72rem' }}>
                            <span style={{ color: '#0369A1', background: '#E0F2FE', padding: '1px 6px', borderRadius: '4px', fontWeight: '500' }}>
                              👤 Sorumlu: {userIsZumreBaskani ? 'Siz (Zümre Başkanı)' : `Zümre Başkanı (${bBaskan})`}
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
                                backgroundColor: stepOgretmen,
                                color: '#FFFFFF'
                              }}>
                                {stepOgretmen === '#10B981' ? '✓' : '1'}
                              </span>
                              <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: '600' }}>Öğretmen</span>
                            </div>

                            <div style={{ flex: 1, height: '2px', backgroundColor: stepOgretmen, minWidth: '20px' }} />

                            {/* 2. Zümre Başkanı Adımı */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: '700',
                                backgroundColor: stepZumre,
                                color: '#FFFFFF'
                              }}>
                                {stepZumre === '#10B981' ? '✓' : '2'}
                              </span>
                              <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: '600' }}>Zümre Bşk.</span>
                            </div>

                            <div style={{ flex: 1, height: '2px', backgroundColor: stepZumre, minWidth: '20px' }} />

                            {/* 3. Müdür Adımı */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: '700',
                                backgroundColor: stepMudur,
                                color: '#FFFFFF'
                              }}>
                                {stepMudur === '#10B981' ? '✓' : 'M'}
                              </span>
                              <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: '600' }}>Müdür</span>
                            </div>
                          </div>
                        </td>

                        {/* İmza / Arşiv Durumu */}
                        <td style={{ padding: '1.25rem 1rem', textAlign: 'center', verticalAlign: 'middle', width: '120px' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.2rem', color: stepImzaColor }}>{stepImza}</span>
                            <span style={{ fontSize: '0.7rem', color: stepImzaColor, fontWeight: '700' }}>
                              {bStatus === 'onaylandi_kapatildi' ? 'İmzalandı & Arşiv' : bStatus === 'mudur_onay' ? 'İmzaya Çağrıldı' : 'Beklemede'}
                            </span>
                          </div>
                        </td>

                        {/* İşlemler */}
                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right', verticalAlign: 'middle', width: '180px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                            {userIsZumreBaskani && bStatus === 'zumre_doldurma' ? (
                              <button
                                onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                style={{
                                  padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                  backgroundColor: '#1B3A6B', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer'
                                }}
                              >
                                📝 Evrak Doldur
                              </button>
                            ) : userIsZumreBaskani && bStatus === 'baskan_secildi' ? (
                              <button
                                onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                style={{
                                  padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                  backgroundColor: '#8B5CF6', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer'
                                }}
                              >
                                📅 Toplantıyı Planla
                              </button>
                            ) : bStatus === 'yapilmadi' ? (
                              <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: '700', fontStyle: 'italic', background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px' }}>
                                Başlatılmadı
                              </span>
                            ) : bStatus === 'baskan_secildi' ? (
                              <span style={{ fontSize: '0.72rem', color: '#8B5CF6', fontWeight: '700', fontStyle: 'italic', background: '#F5F3FF', padding: '4px 8px', borderRadius: '6px' }}>
                                Planlanıyor
                              </span>
                            ) : (
                              <button
                                onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                style={{
                                  padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                  backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer'
                                }}
                              >
                                📄 Görüntüle
                              </button>
                            )}
                            {platformAdmin && (bStatus === 'onaylandi_kapatildi' || bStatus === 'mudur_onay') && (
                              <button
                                onClick={async () => {
                                  if (window.confirm(`"${brans.ad}" branşına ait tamamlanmış/onaydaki zümre evrakını silmek ve sıfırlamak istediğinize emin misiniz?`)) {
                                    const docRef = doc(db, 'kurumlar', secilenKurumId, 'resmiEvraklar', `seneBasiZumre_${brans.id}`)
                                    await deleteDoc(docRef)
                                  }
                                }}
                                style={{ padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600', backgroundColor: '#EF4444', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                              >
                                🗑️ Evrakı Sil
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                }

                return [
                  <Fragment key={gorev.id}>
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
                        <div style={{ fontWeight: '700', color: '#1E293B', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {platformAdmin && (gorev.id === 1 || gorev.id === 2) && <span title="Mutabakat Kilidi" style={{ cursor: 'help' }}>🔒</span>}
                          {gorev.baslik}
                        </div>
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
                          {gorev.id === 2 ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#1B3A6B', fontStyle: 'italic', background: '#EFF6FF', padding: '4px 8px', borderRadius: '6px' }}>
                              👇 Branş Tablosundan Yönetin
                            </span>
                          ) : (
                            <>
                              {/* ÖĞRETMEN ROLÜ AKSİYONLARI */}
                              {simuleRol === 'ogretmen' && (
                                <>
                                  {gorev.id === 1 ? (
                                    <>
                                      {/* Sene Başı Öğretmenler Kurulu için Özel Kısıtlamalar */}
                                      {seneBasiStatus === 'yapilmadi' ? (
                                        <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: '700', fontStyle: 'italic', background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px' }}>
                                          Başlatılmadı
                                        </span>
                                      ) : (
                                        <>
                                          {isYazman ? (
                                            <>
                                              {(seneBasiStatus === 'davet_aktif' || seneBasiStatus === 'yazman_doldurma') && (
                                                <button
                                                  onClick={() => handleYazdir(gorev)}
                                                  style={{
                                                    padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                                    backgroundColor: '#1B3A6B', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer'
                                                  }}
                                                >
                                                  📝 Evrak Doldur
                                                </button>
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
                                          ) : (
                                            <>
                                              {/* Yazman olmayan öğretmenler için */}
                                              {(seneBasiStatus === 'davet_aktif' || seneBasiStatus === 'yazman_doldurma') && (
                                                <button
                                                  onClick={() => handleYazdir(gorev)}
                                                  style={{
                                                    padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600',
                                                    backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer'
                                                  }}
                                                >
                                                  📄 Görüntüle
                                                </button>
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
                                        </>
                                      )}
                                    </>
                                  ) : (
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

                              {/* MASTER ADMIN (PLATFORM ADMIN) SILME AKSİYONU */}
                              {platformAdmin && (durum.mudur === 'onaylandi' || durum.imzaDurumu === 'imzalandi') && (
                                <button
                                  onClick={() => handleSüreçSil(gorev)}
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    backgroundColor: '#EF4444',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#DC2626'}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#EF4444'}
                                >
                                  🗑️ Süreci Sil
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ZÜMRE BRANŞLARI LİSTESİ (SUB-ROW) */}
                    {gorev.id === 2 && isMudur && (
                      <tr style={{ backgroundColor: '#F8FAFC' }}>
                        <td colSpan="5" style={{ padding: '1rem 1.5rem 1.5rem 1.5rem' }}>
                          <div style={{
                            background: '#FFFFFF',
                            border: '1.5px solid #E2E8F0',
                            borderRadius: '16px',
                            padding: '1.5rem',
                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.02)'
                          }}>
                            {/* Branch header, add elective subject button, and summary */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#1B3A6B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>📚</span> Branş Zümre Toplantı Süreçleri {platformAdmin && <span title="Mutabakat Kilidi" style={{ cursor: 'help', fontSize: '0.9rem' }}>🔒</span>}
                                </h4>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
                                  Her zümrenin kendi toplantı kaydını, zümre başkanını ve onay durumunu aşağıdan yönetebilirsiniz.
                                </p>
                              </div>
                              {simuleRol === 'mudur' && (
                                <button
                                  onClick={() => {
                                    const ad = prompt('Eklenecek Seçmeli Dersin Adı:')
                                    if (ad) handleBransEkle(ad)
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    backgroundColor: '#10B981',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.1)'
                                  }}
                                >
                                  <span>➕</span> Seçmeli Ders Zümresi Ekle
                                </button>
                              )}
                            </div>

                            {/* Branches Table / Grid */}
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                                <thead>
                                  <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
                                    <th style={{ padding: '8px 4px' }}>Branş / Ders</th>
                                    <th style={{ padding: '8px 4px' }}>Zümre Başkanı</th>
                                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>Süreç Durumu</th>
                                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>Onay Hattı</th>
                                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>İşlemler</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {branslar.map(brans => {
                                    const bData = getBransZumreData(brans.id)
                                    const bStatus = bData?.status || 'yapilmadi'
                                    const bBaskan = bData?.zumreBaskani || 'Seçilmedi'
                                    
                                    // Calculate pipeline step highlights for this branch
                                    let stepOgretmen = '#E2E8F0'
                                    let stepZumre = '#E2E8F0'
                                    let stepMudur = '#E2E8F0'
                                    let stepImza = '⏳'
                                    let stepImzaColor = '#94A3B8'
                                    
                                    if (bStatus === 'zumre_doldurma') {
                                      stepOgretmen = '#F59E0B'
                                      stepZumre = '#F59E0B'
                                    } else if (bStatus === 'mudur_onay') {
                                      stepOgretmen = '#10B981'
                                      stepZumre = '#10B981'
                                      stepMudur = '#3B82F6'
                                      stepImza = '✍️'
                                      stepImzaColor = '#3B82F6'
                                    } else if (bStatus === 'onaylandi_kapatildi') {
                                      stepOgretmen = '#10B981'
                                      stepZumre = '#10B981'
                                      stepMudur = '#10B981'
                                      stepImza = '🗃️'
                                      stepImzaColor = '#10B981'
                                    }

                                    // Check user simulation permissions
                                    const userIsZumreBaskani = (simuleRol === 'ogretmen' && simuleOgretmenAd === bBaskan) || 
                                                               (profil?.rol === 'ogretmen' && profil?.ad === bBaskan) || 
                                                               simuleRol === 'zumre'

                                    const evrakUrl = location.pathname.includes('/platform') 
                                      ? '/platform/kurum/resmi-islemler/evraklar' 
                                      : '/kurum/resmi-islemler/evraklar'

                                    return (
                                      <tr key={brans.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                        <td style={{ padding: '10px 4px', fontWeight: '700', color: '#1E293B' }}>
                                          {brans.ad} {!brans.sabit && <span style={{ fontSize: '0.65rem', background: '#FEF3C7', color: '#D97706', padding: '1px 6px', borderRadius: '4px', marginLeft: '4px' }}>Seçmeli</span>}
                                        </td>
                                        <td style={{ padding: '10px 4px', color: bBaskan === 'Seçilmedi' ? '#94A3B8' : '#334155', fontWeight: '600' }}>
                                          👤 {bBaskan}
                                        </td>
                                        <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                                          <span style={{
                                            fontSize: '0.7rem',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            fontWeight: '700',
                                            backgroundColor: bStatus === 'yapilmadi' ? '#F1F5F9' : bStatus === 'baskan_secildi' ? '#F5F3FF' : bStatus === 'zumre_doldurma' ? '#FFFBEB' : bStatus === 'mudur_onay' ? '#EFF6FF' : '#ECFDF5',
                                            color: bStatus === 'yapilmadi' ? '#64748B' : bStatus === 'baskan_secildi' ? '#8B5CF6' : bStatus === 'zumre_doldurma' ? '#D97706' : bStatus === 'mudur_onay' ? '#1D4ED8' : '#047857'
                                          }}>
                                            {bStatus === 'yapilmadi' ? 'Başlatılmadı' : bStatus === 'baskan_secildi' ? 'Başkan Görevlendirildi' : bStatus === 'zumre_doldurma' ? 'Zümre Doldurma' : bStatus === 'mudur_onay' ? 'Müdür Onayında' : 'Onaylandı'}
                                          </span>
                                        </td>
                                        <td style={{ padding: '10px 4px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: stepOgretmen, color: '#FFFFFF', fontSize: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }} title="1. Öğretmen Doldurma">
                                              {stepOgretmen === '#10B981' ? '✓' : '1'}
                                            </span>
                                            <span style={{ fontSize: '0.6rem', color: '#94A3B8' }}>→</span>
                                            <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: stepZumre, color: '#FFFFFF', fontSize: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }} title="2. Zümre Onay">
                                              {stepZumre === '#10B981' ? '✓' : '2'}
                                            </span>
                                            <span style={{ fontSize: '0.6rem', color: '#94A3B8' }}>→</span>
                                            <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: stepMudur, color: '#FFFFFF', fontSize: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }} title="M. Müdür Onayı">
                                              {stepMudur === '#10B981' ? '✓' : 'M'}
                                            </span>
                                            <span style={{ fontSize: '0.6rem', color: '#94A3B8' }}>→</span>
                                            <span style={{ fontSize: '0.9rem', color: stepImzaColor }} title="Resmi Arşiv / İmza">
                                              {stepImza}
                                            </span>
                                          </div>
                                        </td>
                                        <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                                            {/* Müdür Butonları */}
                                            {simuleRol === 'mudur' && (
                                              <>
                                                {bStatus === 'yapilmadi' && (
                                                  <button
                                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                                    style={{ padding: '3px 8px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                  >
                                                    🚀 Görevlendir
                                                  </button>
                                                )}
                                                {bStatus === 'baskan_secildi' && (
                                                  <button
                                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                                    style={{ padding: '3px 8px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: '#8B5CF6', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                  >
                                                    🔍 İncele
                                                  </button>
                                                )}
                                                {bStatus === 'zumre_doldurma' && (
                                                  <button
                                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                                    style={{ padding: '3px 8px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                  >
                                                    🔍 İncele / Düzenle
                                                  </button>
                                                )}
                                                {bStatus === 'mudur_onay' && (
                                                  <button
                                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                                    style={{ padding: '3px 8px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                  >
                                                    ✅ İncele & Onayla
                                                  </button>
                                                )}
                                                {bStatus === 'onaylandi_kapatildi' && (
                                                  <button
                                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                                    style={{ padding: '3px 8px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: '#1B3A6B', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                  >
                                                    🖨️ Çıktı Al
                                                  </button>
                                                )}
                                              </>
                                            )}

                                            {/* Zümre Başkanı / Öğretmen Butonları */}
                                            {simuleRol !== 'mudur' && (
                                              <>
                                                {userIsZumreBaskani && bStatus === 'zumre_doldurma' ? (
                                                  <button
                                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                                    style={{ padding: '3px 8px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: '#1B3A6B', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                  >
                                                    📝 Evrak Doldur
                                                  </button>
                                                ) : userIsZumreBaskani && bStatus === 'baskan_secildi' ? (
                                                  <button
                                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                                    style={{ padding: '3px 8px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: '#8B5CF6', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                  >
                                                    📅 Toplantıyı Planla
                                                  </button>
                                                ) : bStatus === 'yapilmadi' ? (
                                                  <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: '700', fontStyle: 'italic', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>
                                                    Başlatılmadı
                                                  </span>
                                                ) : bStatus === 'baskan_secildi' ? (
                                                  <span style={{ fontSize: '0.68rem', color: '#8B5CF6', fontWeight: '700', fontStyle: 'italic', background: '#F5F3FF', padding: '2px 6px', borderRadius: '4px' }}>
                                                    Planlanıyor
                                                  </span>
                                                ) : (
                                                  <button
                                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                                    style={{ padding: '3px 8px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '4px', cursor: 'pointer' }}
                                                  >
                                                    📄 Görüntüle
                                                  </button>
                                                )}
                                              </>
                                            )}

                                            {/* Seçmeli Ders Silme (Müdür için) */}
                                            {simuleRol === 'mudur' && !brans.sabit && (
                                              <button
                                                onClick={async () => {
                                                  if (window.confirm(`"${brans.ad}" seçmeli ders zümresini silmek istediğinize emin misiniz?`)) {
                                                    const guncel = branslar.filter(x => x.id !== brans.id)
                                                    const listRef = doc(db, 'kurumlar', secilenKurumId, 'resmiEvraklar', 'seneBasiZumreListesi')
                                                    await setDoc(listRef, { branslar: guncel }, { merge: true })
                                                    
                                                    // Alt evrak belgesini de sil
                                                    const docRef = doc(db, 'kurumlar', secilenKurumId, 'resmiEvraklar', `seneBasiZumre_${brans.id}`)
                                                    await deleteDoc(docRef)
                                                  }
                                                }}
                                                style={{ padding: '3px 6px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: '#EF4444', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                title="Zümreyi Sil"
                                              >
                                                🗑️
                                              </button>
                                            )}
                                            {/* Master Kullanıcı (Platform Admin) Evrak Silme Yetkisi */}
                                            {platformAdmin && (bStatus === 'onaylandi_kapatildi' || bStatus === 'mudur_onay') && (
                                              <button
                                                onClick={async () => {
                                                  if (window.confirm(`"${brans.ad}" branşına ait tamamlanmış/onaydaki zümre evrakını silmek ve sıfırlamak istediğinize emin misiniz?`)) {
                                                    const docRef = doc(db, 'kurumlar', secilenKurumId, 'resmiEvraklar', `seneBasiZumre_${brans.id}`)
                                                    await deleteDoc(docRef)
                                                  }
                                                }}
                                                style={{ padding: '3px 8px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: '#EF4444', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                              >
                                                🗑️ Evrakı Sil
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ]
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

      {/* Mobil Akordeon Görünümü */}
      <div className="mobile-task-accordion" style={{ display: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtrelenmişGorevler.length > 0 ? (
            filtrelenmişGorevler.flatMap((gorev) => {
              const durum = finalGorevDurumlari[gorev.id]

              // Eğer görev Zümre Kurulu (id: 2) ise ve müdür değilse (öğretmen ise)
              if (gorev.id === 2 && !isMudur) {
                return branslar.map((brans) => {
                  const bData = getBransZumreData(brans.id)
                  const bStatus = bData?.status || 'yapilmadi'
                  const bBaskan = bData?.zumreBaskani || 'Seçilmedi'

                  let stepOgretmen = '#E2E8F0'
                  let stepZumre = '#E2E8F0'
                  let stepMudur = '#E2E8F0'
                  let stepImza = '⏳'
                  let stepImzaColor = '#94A3B8'
                  
                  if (bStatus === 'zumre_doldurma') {
                    stepOgretmen = '#F59E0B'
                    stepZumre = '#F59E0B'
                  } else if (bStatus === 'mudur_onay') {
                    stepOgretmen = '#10B981'
                    stepZumre = '#10B981'
                    stepMudur = '#3B82F6'
                    stepImza = '✍️'
                    stepImzaColor = '#3B82F6'
                  } else if (bStatus === 'onaylandi_kapatildi') {
                    stepOgretmen = '#10B981'
                    stepZumre = '#10B981'
                    stepMudur = '#10B981'
                    stepImza = '🗃️'
                    stepImzaColor = '#10B981'
                  }

                  const userIsZumreBaskani = (simuleRol === 'ogretmen' && simuleOgretmenAd === bBaskan) || 
                                             (profil?.rol === 'ogretmen' && profil?.ad === bBaskan) || 
                                             simuleRol === 'zumre'

                  const evrakUrl = location.pathname.includes('/platform') 
                    ? '/platform/kurum/resmi-islemler/evraklar' 
                    : '/kurum/resmi-islemler/evraklar'

                  const cardKey = `${gorev.id}_${brans.id}`
                  const isExpanded = expandedCardKey === cardKey

                  return (
                    <div
                      key={cardKey}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {/* Kart Başlığı */}
                      <div
                        onClick={() => setExpandedCardKey(isExpanded ? null : cardKey)}
                        style={{
                          padding: '12px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          background: isExpanded ? '#F8FAFC' : '#FFFFFF',
                          borderBottom: isExpanded ? '1px solid #E2E8F0' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              fontSize: '0.62rem', fontWeight: '800', color: '#1B3A6B', background: '#EFF6FF',
                              padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace'
                            }}>
                              {gorev.dosyaNo}
                            </span>
                            <span style={{ fontSize: '0.62rem', color: '#94A3B8', fontWeight: '700' }}>
                              {gorev.kategori}
                            </span>
                          </div>
                          <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {gorev.baslik} ({brans.ad})
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ fontSize: '1rem' }}>{stepImza}</span>
                          <span style={{ fontSize: '0.85rem', color: '#64748B', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                        </div>
                      </div>

                      {/* Kart Detayı */}
                      {isExpanded && (
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#FFFFFF' }}>
                          <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.4' }}>
                            {gorev.aciklama}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', background: '#F8FAFC', padding: '8px 12px', borderRadius: '8px' }}>
                            <div style={{ color: '#0369A1', fontWeight: '600' }}>
                              👤 Sorumlu: {userIsZumreBaskani ? 'Siz (Zümre Başkanı)' : `Zümre Başkanı (${bBaskan})`}
                            </div>
                            <div style={{ color: '#475569', fontWeight: '600' }}>
                              📄 Gereksinim: {gorev.gereksinim}
                            </div>
                            <div style={{ color: stepImzaColor, fontWeight: '700' }}>
                              ✍️ Durum: {bStatus === 'onaylandi_kapatildi' ? 'İmzalandı & Arşiv' : bStatus === 'mudur_onay' ? 'İmzaya Çağrıldı' : 'Beklemede'}
                            </div>
                          </div>

                          {/* Mobil Onay Hattı Gösterimi */}
                          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#F8FAFC', padding: '10px 6px', borderRadius: '8px', margin: '4px 0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', fontWeight: '700', backgroundColor: stepOgretmen, color: '#FFFFFF'
                              }}>
                                {stepOgretmen === '#10B981' ? '✓' : '1'}
                              </span>
                              <span style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: '700' }}>Öğretmen</span>
                            </div>
                            <div style={{ width: '40px', height: '2px', backgroundColor: stepOgretmen }} />
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', fontWeight: '700', backgroundColor: stepZumre, color: '#FFFFFF'
                              }}>
                                {stepZumre === '#10B981' ? '✓' : '2'}
                              </span>
                              <span style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: '700' }}>Zümre Bşk</span>
                            </div>
                            <div style={{ width: '40px', height: '2px', backgroundColor: stepZumre }} />
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', fontWeight: '700', backgroundColor: stepMudur, color: '#FFFFFF'
                              }}>
                                {stepMudur === '#10B981' ? '✓' : 'M'}
                              </span>
                              <span style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: '700' }}>Müdür</span>
                            </div>
                          </div>

                          {/* Mobil İşlem Butonu */}
                          <div style={{ marginTop: '4px' }}>
                            {userIsZumreBaskani && bStatus === 'zumre_doldurma' ? (
                              <button
                                onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                style={{
                                  width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700',
                                  backgroundColor: '#1B3A6B', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer'
                                }}
                              >
                                📝 Evrakı Doldur
                              </button>
                            ) : userIsZumreBaskani && bStatus === 'baskan_secildi' ? (
                              <button
                                onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                style={{
                                  width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700',
                                  backgroundColor: '#8B5CF6', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer'
                                }}
                              >
                                📅 Toplantıyı Planla
                              </button>
                            ) : bStatus === 'yapilmadi' ? (
                              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94A3B8', fontWeight: '700', fontStyle: 'italic', background: '#F1F5F9', padding: '8px', borderRadius: '8px' }}>
                                Süreç Başlatılmadı
                              </div>
                            ) : bStatus === 'baskan_secildi' ? (
                              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#8B5CF6', fontWeight: '700', fontStyle: 'italic', background: '#F5F3FF', padding: '8px', borderRadius: '8px' }}>
                                Planlanıyor
                              </div>
                            ) : (
                              <button
                                onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                style={{
                                  width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700',
                                  backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer'
                                }}
                              >
                                📄 Belgeyi Görüntüle
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              }

              // Normal görevler
              const isZumreMudur = gorev.id === 2 && isMudur
              let stepOgretmen = '#E2E8F0'
              let stepYazman = '#E2E8F0'
              let stepMudur = '#E2E8F0'
              let stepImza = '⏳'
              let stepImzaColor = '#94A3B8'
              
              if (durum === 'yazman_doldurma') {
                stepOgretmen = '#10B981'
                stepYazman = '#F59E0B'
              } else if (durum === 'mudur_onay') {
                stepOgretmen = '#10B981'
                stepYazman = '#10B981'
                stepMudur = '#3B82F6'
                stepImza = '✍️'
                stepImzaColor = '#3B82F6'
              } else if (durum === 'onaylandi_kapatildi') {
                stepOgretmen = '#10B981'
                stepYazman = '#10B981'
                stepMudur = '#10B981'
                stepImza = '🗃️'
                stepImzaColor = '#10B981'
              }

              const userIsYazman = (simuleRol === 'ogretmen' && simuleOgretmenAd === seneBasiData?.yazman) || 
                                   (profil?.rol === 'ogretmen' && profil?.ad === seneBasiData?.yazman) ||
                                   simuleRol === 'yazman'

              const evrakUrl = location.pathname.includes('/platform') 
                ? '/platform/kurum/resmi-islemler/evraklar' 
                : '/kurum/resmi-islemler/evraklar'

              const cardKey = `${gorev.id}`
              const isExpanded = expandedCardKey === cardKey

              return (
                <div
                  key={cardKey}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Kart Başlığı */}
                  <div
                    onClick={() => setExpandedCardKey(isExpanded ? null : cardKey)}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: isExpanded ? '#F8FAFC' : '#FFFFFF',
                      borderBottom: isExpanded ? '1px solid #E2E8F0' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '0.62rem', fontWeight: '800', color: '#1B3A6B', background: '#EFF6FF',
                          padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace'
                        }}>
                          {gorev.dosyaNo}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: '#94A3B8', fontWeight: '700' }}>
                          {gorev.kategori}
                        </span>
                      </div>
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {gorev.baslik}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '1rem' }}>{stepImza}</span>
                      <span style={{ fontSize: '0.85rem', color: '#64748B', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                    </div>
                  </div>

                  {/* Kart Detayı */}
                  {isExpanded && (
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#FFFFFF' }}>
                      <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.4' }}>
                        {gorev.aciklama}
                      </div>
                      
                      {isZumreMudur ? (
                        <>
                          {simuleRol === 'mudur' && (
                            <button
                              onClick={() => {
                                const ad = prompt('Eklenecek Seçmeli Dersin Adı:')
                                if (ad) handleBransEkle(ad)
                              }}
                              style={{
                                width: '100%', padding: '8px 12px', fontSize: '0.75rem', fontWeight: '700',
                                backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '4px', marginBottom: '8px'
                              }}
                            >
                              ➕ Seçmeli Ders Zümresi Ekle
                            </button>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {branslar.map((brans) => {
                              const bData = getBransZumreData(brans.id)
                              const bStatus = bData?.status || 'yapilmadi'
                              const bBaskan = bData?.zumreBaskani || 'Seçilmedi'

                              let stepOgretmen = '#E2E8F0'
                              let stepZumre = '#E2E8F0'
                              let stepMudur = '#E2E8F0'
                              let stepImza = '⏳'
                              let stepImzaColor = '#94A3B8'
                              
                              if (bStatus === 'zumre_doldurma') {
                                stepOgretmen = '#F59E0B'
                                stepZumre = '#F59E0B'
                              } else if (bStatus === 'mudur_onay') {
                                stepOgretmen = '#10B981'
                                stepZumre = '#10B981'
                                stepMudur = '#3B82F6'
                                stepImza = '✍️'
                                stepImzaColor = '#3B82F6'
                              } else if (bStatus === 'onaylandi_kapatildi') {
                                stepOgretmen = '#10B981'
                                stepZumre = '#10B981'
                                stepMudur = '#10B981'
                                stepImza = '🗃️'
                                stepImzaColor = '#10B981'
                              }

                              const evrakUrl = location.pathname.includes('/platform') 
                                ? '/platform/kurum/resmi-islemler/evraklar' 
                                : '/kurum/resmi-islemler/evraklar'

                              return (
                                <div key={brans.id} style={{ padding: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: '800', fontSize: '0.8rem', color: '#1B3A6B' }}>
                                      {brans.ad} {!brans.sabit && <span style={{ fontSize: '0.6rem', background: '#FEF3C7', color: '#D97706', padding: '1px 4px', borderRadius: '4px' }}>Seçmeli</span>}
                                    </span>
                                    <span style={{
                                      fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px', fontWeight: '700',
                                      backgroundColor: bStatus === 'yapilmadi' ? '#E2E8F0' : bStatus === 'baskan_secildi' ? '#F5F3FF' : bStatus === 'zumre_doldurma' ? '#FFFBEB' : bStatus === 'mudur_onay' ? '#EFF6FF' : '#ECFDF5',
                                      color: bStatus === 'yapilmadi' ? '#64748B' : bStatus === 'baskan_secildi' ? '#8B5CF6' : bStatus === 'zumre_doldurma' ? '#D97706' : bStatus === 'mudur_onay' ? '#1D4ED8' : '#047857'
                                    }}>
                                      {bStatus === 'yapilmadi' ? 'Başlatılmadı' : bStatus === 'baskan_secildi' ? 'Başkan Atandı' : bStatus === 'zumre_doldurma' ? 'Taslak' : bStatus === 'mudur_onay' ? 'Müdür Onayı' : 'Onaylandı'}
                                    </span>
                                  </div>
                                  
                                  <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '8px', fontWeight: '600' }}>
                                    👤 Başkan: {bBaskan}
                                  </div>

                                  {/* Mobil Onay Hattı */}
                                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#FFFFFF', padding: '8px 4px', borderRadius: '6px', marginBottom: '8px', border: '1px solid #F1F5F9' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: '700', backgroundColor: stepOgretmen, color: '#FFFFFF' }}>
                                        {stepOgretmen === '#10B981' ? '✓' : '1'}
                                      </span>
                                      <span style={{ fontSize: '0.5rem', color: '#64748B' }}>Öğretmen</span>
                                    </div>
                                    <div style={{ width: '20px', height: '1.5px', backgroundColor: stepOgretmen }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: '700', backgroundColor: stepZumre, color: '#FFFFFF' }}>
                                        {stepZumre === '#10B981' ? '✓' : '2'}
                                      </span>
                                      <span style={{ fontSize: '0.5rem', color: '#64748B' }}>Zümre Bşk</span>
                                    </div>
                                    <div style={{ width: '20px', height: '1.5px', backgroundColor: stepZumre }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: '700', backgroundColor: stepMudur, color: '#FFFFFF' }}>
                                        {stepMudur === '#10B981' ? '✓' : 'M'}
                                      </span>
                                      <span style={{ fontSize: '0.5rem', color: '#64748B' }}>Müdür</span>
                                    </div>
                                  </div>

                                  {/* Aksiyon Butonları */}
                                  <div>
                                    {bStatus === 'yapilmadi' ? (
                                      <button
                                        onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                        style={{ width: '100%', padding: '6px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                      >
                                        🚀 Görevlendir
                                      </button>
                                    ) : bStatus === 'baskan_secildi' ? (
                                      <button
                                        onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                        style={{ width: '100%', padding: '6px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#8B5CF6', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                      >
                                        🔍 İncele
                                      </button>
                                    ) : bStatus === 'zumre_doldurma' ? (
                                      <button
                                        onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                        style={{ width: '100%', padding: '6px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                      >
                                        🔍 İncele / Düzenle
                                      </button>
                                    ) : bStatus === 'mudur_onay' ? (
                                      <button
                                        onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                        style={{ width: '100%', padding: '6px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                      >
                                        ✅ İncele & Onayla
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => navigate(evrakUrl, { state: { sablonId: 2, bransId: brans.id, simuleRol, simuleOgretmenAd } })}
                                        style={{ width: '100%', padding: '6px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer' }}
                                      >
                                        📄 Görüntüle / Çıktı Al
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', background: '#F8FAFC', padding: '8px 12px', borderRadius: '8px' }}>
                            <div style={{ color: '#0369A1', fontWeight: '600' }}>
                              👤 Sorumlu: {gorev.id === 1 ? `Yazman (${seneBasiData?.yazman || 'Seçilmedi'})` : (gorev.sorumlu || 'Belirtilmedi')}
                            </div>
                            <div style={{ color: '#475569', fontWeight: '600' }}>
                              📄 Gereksinim: {gorev.gereksinim}
                            </div>
                            <div style={{ color: stepImzaColor, fontWeight: '700' }}>
                              ✍️ Durum: {durum === 'onaylandi_kapatildi' ? 'İmzalandı & Arşiv' : durum === 'mudur_onay' ? 'İmzaya Çağrıldı' : 'Beklemede'}
                            </div>
                          </div>

                          {/* Mobil Onay Hattı Gösterimi */}
                          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#F8FAFC', padding: '10px 6px', borderRadius: '8px', margin: '4px 0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', fontWeight: '700', backgroundColor: stepOgretmen, color: '#FFFFFF'
                              }}>
                                {stepOgretmen === '#10B981' ? '✓' : '1'}
                              </span>
                              <span style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: '700' }}>Öğretmen</span>
                            </div>
                            <div style={{ width: '80px', height: '2px', backgroundColor: stepMudur === '#10B981' ? '#10B981' : '#E2E8F0' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', fontWeight: '700', backgroundColor: stepMudur, color: '#FFFFFF'
                              }}>
                                {stepMudur === '#10B981' ? '✓' : 'M'}
                              </span>
                              <span style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: '700' }}>Müdür</span>
                            </div>
                          </div>

                          {/* Mobil İşlem Butonu */}
                          <div style={{ marginTop: '4px' }}>
                            {simuleRol === 'mudur' ? (
                              // MÜDÜR AKSİYONLARI
                              gorev.id === 1 ? (
                                seneBasiStatus === 'yapilmadi' ? (
                                  <button
                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 1, simuleRol, simuleOgretmenAd } })}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    🚀 Süreci Başlat / Düzenle
                                  </button>
                                ) : seneBasiStatus === 'mudur_onay' ? (
                                  <button
                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 1, simuleRol, simuleOgretmenAd } })}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    ✅ İncele & Onayla
                                  </button>
                                ) : seneBasiStatus === 'davet_aktif' || seneBasiStatus === 'yazman_doldurma' ? (
                                  <button
                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 1, simuleRol, simuleOgretmenAd } })}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#8B5CF6', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    🔍 Süreci İncele / Yazman Ata
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 1, simuleRol, simuleOgretmenAd } })}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    📄 Belgeyi Görüntüle
                                  </button>
                                )
                              ) : (
                                // Diğer Normal Görevler için Standart Müdür Aksiyonları
                                durum.mudur === 'yapilmadi' ? (
                                  <button
                                    onClick={() => navigate(evrakUrl, { state: { sablonId: gorev.id, simuleRol, simuleOgretmenAd } })}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    🚀 Süreci Başlat / Düzenle
                                  </button>
                                ) : durum.ogretmen === 'onay_bekliyor' || durum.zumre === 'onay_bekliyor' ? (
                                  <button
                                    onClick={() => navigate(evrakUrl, { state: { sablonId: gorev.id, simuleRol, simuleOgretmenAd } })}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    ✅ İncele & Onayla
                                  </button>
                                ) : durum.mudur === 'imza_bekliyor' && durum.imzaDurumu === 'imzalanmadi' ? (
                                  <button
                                    onClick={() => handleImzayaCagir(gorev.id)}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    ✍️ İmzaya Çağır
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => navigate(evrakUrl, { state: { sablonId: gorev.id, simuleRol, simuleOgretmenAd } })}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    📄 Belgeyi Görüntüle
                                  </button>
                                )
                              )
                            ) : (
                              // ÖĞRETMEN / YAZMAN AKSİYONLARI
                              gorev.id === 1 ? (
                                userIsYazman && (seneBasiStatus === 'davet_aktif' || seneBasiStatus === 'yazman_doldurma') ? (
                                  <button
                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 1, simuleRol, simuleOgretmenAd } })}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#1B3A6B', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    📝 Evrakı Doldur
                                  </button>
                                ) : seneBasiStatus === 'yapilmadi' ? (
                                  <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94A3B8', fontWeight: '700', fontStyle: 'italic', background: '#F1F5F9', padding: '8px', borderRadius: '8px' }}>
                                    Süreç Başlatılmadı
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => navigate(evrakUrl, { state: { sablonId: 1, simuleRol, simuleOgretmenAd } })}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    📄 Belgeyi Görüntüle
                                  </button>
                                )
                              ) : (
                                durum.ogretmen === 'yapilmadi' ? (
                                  <button
                                    onClick={() => gorev.evrakUretimi ? navigate(evrakUrl, { state: { sablonId: gorev.id, simuleRol, simuleOgretmenAd } }) : handleOgretmenTamamla(gorev.id)}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#1B3A6B', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    {gorev.evrakUretimi ? '📝 Evrak Doldur' : '✓ Tamamlandı Yap'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => navigate(evrakUrl, { state: { sablonId: gorev.id, simuleRol, simuleOgretmenAd } })}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    📄 Belgeyi Görüntüle
                                  </button>
                                )
                              )
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8', background: '#FFFFFF', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
              Arama kriterlerinize uygun yasal süreç bulunamadı.
            </div>
          )}
        </div>
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
