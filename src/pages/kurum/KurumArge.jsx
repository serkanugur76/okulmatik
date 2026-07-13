import React, { useState, useEffect } from 'react'
import { collection, query, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

export default function KurumArge() {
  const { kullanici, profil } = useAuth()
  const { secilenKurumId, secilenKurum, ogretmenModu } = useKurumYonetim()

  const [aktifSekme, setAktifSekme] = useState('genelBakis') // 'genelBakis' | 'sihirbaz' | 'yolHaritasi'
  const [projeler, setProjeler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)

  // Sihirbaz State'leri
  const [sihirbazAdim, setSihirbazAdim] = useState(1)
  const [projeForm, setProjeForm] = useState({
    alan: '',
    tema: '',
    baslik: '',
    ozet: '',
    anahtarKelimeler: '',
    amac: '',
    giris: '',
    yontemTip: 'deney', // 'deney' | 'anket' | 'yazilim'
    yontemDetay: '',
    bulgular: '',
    sonuc: '',
    oneriler: '',
    kaynaklar: []
  })

  // Grafik verileri (Adım 5 için)
  const [grafikVerileri, setGrafikVerileri] = useState([
    { etiket: 'Kontrol Grubu', deger: 65 },
    { etiket: 'Deney Grubu', deger: 85 }
  ])
  const [yeniEtiket, setYeniEtiket] = useState('')
  const [yeniDeger, setYeniDeger] = useState('')

  // Kaynakça ekleme girdileri (Adım 7 için)
  const [kaynakYazar, setKaynakYazar] = useState('')
  const [kaynakYil, setKaynakYil] = useState('')
  const [kaynakBaslik, setKaynakBaslik] = useState('')
  const [kaynakYayinci, setKaynakYayinci] = useState('')

  // Yapay Zeka Denetim State'leri
  const [aiDenetimYukleniyor, setAiDenetimYukleniyor] = useState(false)
  const [aiAnalizTamamlandi, setAiAnalizTamamlandi] = useState(false)
  const [aiBulgular, setAiBulgular] = useState([])

  // Öğretmen Aidiyet & Performans Takip Sistemi State'leri
  const [testRolu, setTestRolu] = useState(() => {
    if (profil?.rol === 'platform_admin' || profil?.rol === 'kurum_admin') return 'idare'
    return 'ogretmen'
  })
  const [selectedProjeId, setSelectedProjeId] = useState(null)
  const [showTaahhutForm, setShowTaahhutForm] = useState(false)
  const [taahhutFormVeri, setTaahhutFormVeri] = useState({
    turnuvaAdi: '',
    ogrenciListesiText: '',
    ortakOgretmen: '',
    ortakProje: '',
    prTipi: 'veli_lansmani',
    kanitUrl: '',
    butceTalebi: ''
  })
  const [seciliDetayProje, setSeciliDetayProje] = useState(null)

  const MOCK_OGRETMENLER = [
    { id: 'mock_teacher_hasan', ad: 'Hasan Yılmaz' },
    { id: 'mock_teacher_melis', ad: 'Melis Aksoy' },
    { id: 'mock_teacher_ayse', ad: 'Ayşe Kaya (Bilişim)' },
    { id: 'mock_teacher_serkan', ad: 'Serkan Uğur' }
  ]

  // Mock Projeler Fallback
  const MOCK_PROJELER = [
    {
      id: 'mock_1',
      baslik: 'Akıllı Sulama Sistemi ile Tarımsal Su Tasarrufu',
      alan: 'Yazılım & Bilişim',
      tema: 'Akıllı Tarım ve Gıda Güvenliği',
      danisman: 'Hasan Yılmaz (Bilişim Öğretmeni)',
      sorumluOgretmenId: 'mock_teacher_hasan',
      ogrenciler: 'Efe Y., Zeynep K., Melih A., Elif B., Mert G., Ada K., Can S.',
      durum: 'Yazım Aşamasında',
      ilerleme: 65,
      tarih: '12.01.2027',
      overallProgress: 33,
      pozisyonDurumu: 'in_progress',
      hedefler: {
        temelHedef: {
          tanim: "En az 7 kişilik resmi bir turnuva/proje takımı kurmak",
          turnuvaAdi: "TÜBİTAK 2204-B Bilim Projesi",
          ogrenciListesi: ['Efe Y.', 'Zeynep K.', 'Melih A.', 'Elif B.', 'Mert G.', 'Ada K.', 'Can S.'],
          tamamlandi: true,
          zumreOnayi: true
        },
        ortaHedef: {
          tanim: "Okulda kurulmuş başka bir takım ile ortak proje yapmak",
          ortakOgretmenId: 'mock_teacher_melis',
          ortakProjeId: 'mock_2',
          istekDurumu: 'pending',
          tamamlandi: false,
          zumreOnayi: false
        },
        ustHedef: {
          tanim: "Projenin veli lansmanı, turnuva katılımı veya dış PR çıktısı üretmesi",
          prTipi: 'veli_lansmani',
          kanitUrl: 'https://okulmatik.com.tr/kanitlar/akilli-sulama.pdf',
          bütçeTalebi: '2500 TL',
          idareOnayi: false,
          tamamlandi: false
        }
      },
      logs: [
        { tarih: "2026-09-15T10:00:00Z", islem: "Hedefler taahhüt edildi.", rol: "ogretmen" }
      ]
    },
    {
      id: 'mock_2',
      baslik: 'Atık Meyve Kabuklarından Biyoplastik Sentezi',
      alan: 'Fen Bilimleri',
      tema: 'Ekoloji ve Çevre Yönetimi',
      danisman: 'Melis Aksoy (Fen Bilgisi Öğretmeni)',
      sorumluOgretmenId: 'mock_teacher_melis',
      ogrenciler: 'Ali V. , Celin D.',
      durum: 'Veri Toplama Aşamasında',
      ilerleme: 45,
      tarih: '10.01.2027',
      overallProgress: 0,
      pozisyonDurumu: 'in_progress',
      logs: []
    }
  ]

  // Projeleri Getir
  useEffect(() => {
    if (!secilenKurumId) return
    setYukleniyor(true)

    const q = query(collection(db, 'kurumlar', secilenKurumId, 'argeProjeleri'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setProjeler(list.length > 0 ? list : MOCK_PROJELER)
      setYukleniyor(false)
    }, (error) => {
      console.warn("Firestore argeProjeleri yüklenemedi, yerel mock veriler devrede:", error)
      setProjeler(MOCK_PROJELER)
      setYukleniyor(false)
    })

    return () => unsubscribe()
  }, [secilenKurumId])

  // Word ve Harf Sınırı Kontrolleri
  const getWordCount = (text) => {
    if (!text) return 0
    return text.trim().split(/\s+/).filter(Boolean).length
  }

  // Grafik Verisi Ekle
  const handleGrafikVeriEkle = (e) => {
    e.preventDefault()
    if (!yeniEtiket.trim() || !yeniDeger) return
    setGrafikVerileri([...grafikVerileri, { etiket: yeniEtiket, deger: Number(yeniDeger) }])
    setYeniEtiket('')
    setYeniDeger('')
  }

  // Kaynakça Ekle
  const handleKaynakEkle = (e) => {
    e.preventDefault()
    if (!kaynakYazar.trim() || !kaynakBaslik.trim() || !kaynakYil.trim()) return
    // APA Formatı: Yazar, A. (Yıl). Kitap Adı. Yayıncı.
    const yeniKaynak = `${kaynakYazar} (${kaynakYil}). ${kaynakBaslik}. ${kaynakYayinci || 'Yayın Evi'}.`
    setProjeForm({
      ...projeForm,
      kaynaklar: [...projeForm.kaynaklar, yeniKaynak]
    })
    setKaynakYazar('')
    setKaynakYil('')
    setKaynakBaslik('')
    setKaynakYayinci('')
  }

  // Yapay Zeka Denetimi Tetikle
  const handleAiDenetimCalistir = async () => {
    setAiDenetimYukleniyor(true)
    setAiAnalizTamamlandi(false)
    
    // Simüle yüklenme
    await new Promise(r => setTimeout(r, 2000))

    const bulgularListesi = []
    
    // Özet kelime kontrolü
    const kelimeSayisi = getWordCount(projeForm.ozet)
    if (kelimeSayisi < 150) {
      bulgularListesi.push({
        id: 'w_word_low',
        tip: 'hata',
        mesaj: `Özetiniz ${kelimeSayisi} kelime. TÜBİTAK rehberine göre en az 150 kelime olmalıdır.`,
        alan: 'ozet'
      })
    } else if (kelimeSayisi > 250) {
      bulgularListesi.push({
        id: 'w_word_high',
        tip: 'hata',
        mesaj: `Özetiniz ${kelimeSayisi} kelime. TÜBİTAK rehberine göre en fazla 250 kelime olmalıdır.`,
        alan: 'ozet'
      })
    }

    // Yasaklı marka isimleri kontrolü
    const metinler = (projeForm.baslik + ' ' + projeForm.ozet + ' ' + projeForm.yontemDetay + ' ' + projeForm.amac).toLowerCase()
    
    if (metinler.includes('lego')) {
      bulgularListesi.push({
        id: 'brand_lego',
        tip: 'kritik_marka',
        mesaj: `Metinde ticari marka olan 'Lego' ifadesi tespit edildi. TÜBİTAK jürisi projeyi marka öne çıkarma gerekçesiyle eleyebilir.`,
        cozum: `'birbirine geçmeli plastik oyuncak bloklar' ifadesiyle değiştirin.`,
        hedefDiger: 'lego',
        yerine: 'birbirine geçmeli plastik oyuncak bloklar'
      })
    }

    if (metinler.includes('arduino')) {
      bulgularListesi.push({
        id: 'brand_arduino',
        tip: 'kritik_marka',
        mesaj: `Metinde ticari marka olan 'Arduino' ifadesi tespit edildi.`,
        cozum: `'açık kaynak kodlu mikrodenetleyici geliştirme kartı' ifadesiyle değiştirin.`,
        hedefDiger: 'arduino',
        yerine: 'açık kaynak kodlu mikrodenetleyici geliştirme kartı'
      })
    }

    // Etik Kurul İzni Kontrolü
    if (projeForm.yontemTip === 'anket' || metinler.includes('anket') || metinler.includes('soru formu') || metinler.includes('katılımcı')) {
      bulgularListesi.push({
        id: 'ethical_permission',
        tip: 'bilgi',
        mesaj: `Projenizde anket/insan katılımcı tespiti yapıldı. Başvuru aşamasında 'Veli İzin Muvafakatnamesi' ve 'Okul Mühendislik/Etik İzin Yazısı' eklemeniz zorunludur.`,
        belgeLink: 'https://tubitak.gov.tr'
      })
    }

    if (bulgularListesi.length === 0) {
      bulgularListesi.push({
        id: 'clear',
        tip: 'basarili',
        mesaj: 'Harika! Bilimsel raporunuzda herhangi bir marka ihlali, kelime sınırı aşımı veya etik kurul riski bulunamadı. Raporunuz TÜBİTAK formatına uygun görünüyor.'
      })
    }

    setAiBulgular(bulgularListesi)
    setAiDenetimYukleniyor(false)
    setAiAnalizTamamlandi(true)
  }

  // AI Marka Düzeltme Uygula
  const applyBrandFix = (targetBrand, replacement) => {
    const rx = new RegExp(targetBrand, 'gi')
    setProjeForm(prev => ({
      ...prev,
      baslik: prev.baslik.replace(rx, replacement),
      ozet: prev.ozet.replace(rx, replacement),
      amac: prev.amac.replace(rx, replacement),
      yontemDetay: prev.yontemDetay.replace(rx, replacement),
    }))
    // Listeden kaldır
    setAiBulgular(prev => prev.filter(x => x.hedefDiger !== targetBrand))
    alert(`'${targetBrand}' markası '${replacement}' bilimsel ifadesiyle değiştirildi.`)
  }

  // Yeni Projeyi Kaydet
  const handleProjeKaydet = async () => {
    if (!projeForm.baslik.trim()) {
      alert("Lütfen projenize bir başlık girin!")
      return
    }

    const yeniVeri = {
      baslik: projeForm.baslik,
      alan: projeForm.alan || 'Genel Araştırma',
      tema: projeForm.tema || 'Diğer',
      danisman: profil?.ad || kullanici?.email || 'Öğretmen',
      ogrenciler: 'Belirlenmedi',
      durum: 'Yazım Aşamasında',
      ilerleme: Math.min(Math.round((sihirbazAdim / 8) * 100), 100),
      tarih: new Date().toLocaleDateString('tr-TR'),
      formVerisi: projeForm,
      olusturmaTarihi: serverTimestamp()
    }

    try {
      await addDoc(collection(db, 'kurumlar', secilenKurumId, 'argeProjeleri'), yeniVeri)
      alert("Proje başarıyla Ar-Ge merkezine kaydedildi!")
      setAktifSekme('genelBakis')
      // Reset form
      setProjeForm({
        alan: '',
        tema: '',
        baslik: '',
        ozet: '',
        anahtarKelimeler: '',
        amac: '',
        giris: '',
        yontemTip: 'deney',
        yontemDetay: '',
        bulgular: '',
        sonuc: '',
        oneriler: '',
        kaynaklar: []
      })
      setSihirbazAdim(1)
    } catch (e) {
      console.error(e)
      alert("Kaydedilirken bir hata oluştu. Lütfen bağlantınızı kontrol edin.")
    }
  }

  const calculateProgress = (hedefler) => {
    if (!hedefler) return 0
    let score = 0
    if (hedefler.temelHedef?.tamamlandi) score += 33
    if (hedefler.ortaHedef?.tamamlandi && hedefler.ortaHedef?.istekDurumu === 'approved') score += 33
    if (hedefler.ustHedef?.tamamlandi && hedefler.ustHedef?.idareOnayi) score += 34
    return score
  }

  const handleUpdateProject = async (projectId, fieldsToUpdate) => {
    if (projectId.startsWith('mock_')) {
      setProjeler(prev => prev.map(p => {
        if (p.id === projectId) {
          const updated = { ...p, ...fieldsToUpdate }
          if (fieldsToUpdate.hedefler) {
            updated.overallProgress = calculateProgress(fieldsToUpdate.hedefler)
          }
          return updated
        }
        return p
      }))
      // If we are currently showing details of this project, update the details modal state
      setSeciliDetayProje(prev => {
        if (prev && prev.id === projectId) {
          const updated = { ...prev, ...fieldsToUpdate }
          if (fieldsToUpdate.hedefler) {
            updated.overallProgress = calculateProgress(fieldsToUpdate.hedefler)
          }
          return updated
        }
        return prev
      })
    } else {
      try {
        const ref = doc(db, 'kurumlar', secilenKurumId, 'argeProjeleri', projectId)
        let data = { ...fieldsToUpdate }
        if (fieldsToUpdate.hedefler) {
          data.overallProgress = calculateProgress(fieldsToUpdate.hedefler)
        }
        await updateDoc(ref, data)
      } catch (err) {
        console.error("Firestore güncelleme hatası:", err)
        alert("Firestore güncellenirken bir hata oluştu.")
      }
    }
  }

  const handleCommitmentSave = async (e) => {
    e.preventDefault()
    if (!selectedProjeId) return

    // Validate student names list (comma separated, min 7)
    const ogrList = taahhutFormVeri.ogrenciListesiText
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)

    if (ogrList.length < 7) {
      alert("TÜBİTAK ve FLL kuralları gereği temel hedef için en az 7 öğrenci eklenmelidir! Girilen: " + ogrList.length)
      return
    }

    const targetProject = projeler.find(p => p.id === selectedProjeId)
    const currentLogs = targetProject?.logs || []

    const yeniHedefler = {
      temelHedef: {
        tanim: "En az 7 kişilik resmi bir turnuva/proje takımı kurmak",
        turnuvaAdi: taahhutFormVeri.turnuvaAdi || "TÜBİTAK 2204-B Projesi",
        ogrenciListesi: ogrList,
        tamamlandi: true,
        zumreOnayi: true
      },
      ortaHedef: {
        tanim: "Okulda kurulmuş başka bir takım ile ortak proje yapmak",
        ortakOgretmenId: taahhutFormVeri.ortakOgretmen || "Belirlenmedi",
        ortakProjeId: taahhutFormVeri.ortakProje || "Belirlenmedi",
        istekDurumu: taahhutFormVeri.ortakOgretmen ? 'pending' : 'approved',
        tamamlandi: taahhutFormVeri.ortakOgretmen ? false : true,
        zumreOnayi: taahhutFormVeri.ortakOgretmen ? false : true
      },
      ustHedef: {
        tanim: "Projenin veli lansmanı, turnuva katılımı veya dış PR çıktısı üretmesi",
        prTipi: taahhutFormVeri.prTipi,
        kanitUrl: taahhutFormVeri.kanitUrl || '',
        bütçeTalebi: taahhutFormVeri.butceTalebi || '0 TL',
        idareOnayi: false,
        tamamlandi: false
      }
    }

    const yeniLogs = [
      ...currentLogs,
      { tarih: new Date().toISOString(), islem: "Hedefler taahhüt edildi.", rol: "ogretmen" }
    ]

    await handleUpdateProject(selectedProjeId, {
      hedefler: yeniHedefler,
      logs: yeniLogs,
      ogrenciler: ogrList.join(', '),
      pozisyonDurumu: 'in_progress'
    })

    alert("Taahhütler başarıyla kaydedildi!")
    setShowTaahhutForm(false)
    setSelectedProjeId(null)
  }

  const handleZumreApprove = async (proje, status) => {
    if (!proje.hedefler) return
    const isApprove = status === 'approved'
    const updatedHedefler = {
      ...proje.hedefler,
      ortaHedef: {
        ...proje.hedefler.ortaHedef,
        istekDurumu: status,
        tamamlandi: isApprove,
        zumreOnayi: isApprove
      }
    }

    const yeniLogs = [
      ...(proje.logs || []),
      {
        tarih: new Date().toISOString(),
        islem: isApprove ? "Zümre başkanı ortaklık talebini onayladı." : "Zümre başkanı ortaklık talebini reddetti.",
        rol: "zumre_head"
      }
    ]

    await handleUpdateProject(proje.id, {
      hedefler: updatedHedefler,
      logs: yeniLogs
    })
  }

  const handleIdareApprove = async (proje, approve) => {
    if (!proje.hedefler) return
    const updatedHedefler = {
      ...proje.hedefler,
      ustHedef: {
        ...proje.hedefler.ustHedef,
        idareOnayi: approve,
        tamamlandi: approve
      }
    }

    const yeniLogs = [
      ...(proje.logs || []),
      {
        tarih: new Date().toISOString(),
        islem: approve ? "İdare bütçe ve PR hedefini onayladı." : "İdare projeyi riskli olarak işaretledi.",
        rol: "idare"
      }
    ]

    await handleUpdateProject(proje.id, {
      hedefler: updatedHedefler,
      logs: yeniLogs,
      pozisyonDurumu: approve ? 'approved' : 'at_risk'
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ── ÜST BAŞLIK VE HIZLI ÖZET KARTLARI ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1B3A6B', fontWeight: '800' }}>
            🔬 Bilimsel Araştırma & Ar-Ge Merkezi
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748B', fontWeight: '500' }}>
            TÜBİTAK 2204-B Ortaokul Araştırma Projeleri hazırlık, yazım ve denetim hub'ı.
          </p>
        </div>
        
        {/* Sekme Değiştirici */}
        <div style={{ display: 'flex', gap: '6px', background: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setAktifSekme('genelBakis')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700',
              cursor: 'pointer', background: aktifSekme === 'genelBakis' ? '#FFF' : 'transparent',
              color: aktifSekme === 'genelBakis' ? '#1E40AF' : '#64748B', boxShadow: aktifSekme === 'genelBakis' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            📊 Genel Bakış
          </button>
          <button
            onClick={() => setAktifSekme('sihirbaz')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700',
              cursor: 'pointer', background: aktifSekme === 'sihirbaz' ? '#FFF' : 'transparent',
              color: aktifSekme === 'sihirbaz' ? '#1E40AF' : '#64748B', boxShadow: aktifSekme === 'sihirbaz' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            ✨ TÜBİTAK Sihirbazı
          </button>
          <button
            onClick={() => setAktifSekme('yolHaritasi')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700',
              cursor: 'pointer', background: aktifSekme === 'yolHaritasi' ? '#FFF' : 'transparent',
              color: aktifSekme === 'yolHaritasi' ? '#1E40AF' : '#64748B', boxShadow: aktifSekme === 'yolHaritasi' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            📅 8 Haftalık Yol Haritası
          </button>
          <button
            onClick={() => setAktifSekme('performans')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700',
              cursor: 'pointer', background: aktifSekme === 'performans' ? '#FFF' : 'transparent',
              color: aktifSekme === 'performans' ? '#1E40AF' : '#64748B', boxShadow: aktifSekme === 'performans' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            🎯 Aidiyet & Performans
          </button>
        </div>
      </div>

      {/* 🛠️ ROL SİMÜLASYONU SEÇİCİ (Demo / Test İçin) */}
      <div style={{
        background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
        borderRadius: '12px', padding: '10px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', border: '1px solid #4F46E5'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '1.1rem' }}>⚙️</span>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#FFF' }}>Sistem Simülasyon Ajanı</div>
            <div style={{ fontSize: '0.65rem', color: '#C7D2FE' }}>Farklı RBAC (Öğretmen, Zümre Başkanı, İdare) ekranlarını anında test edin.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'ogretmen', etiket: '🧑‍🏫 Öğretmen', aciklama: 'Taahhüt verir, ortaklık ister' },
            { id: 'zumre_baskani', etiket: '👥 Zümre Başkanı', aciklama: 'Ortaklık onaylar' },
            { id: 'idare', etiket: '🏛️ Okul Müdürü (İdare)', aciklama: 'Bütçe & PR onaylar' }
          ].map(rolItem => (
            <button
              key={rolItem.id}
              onClick={() => setTestRolu(rolItem.id)}
              style={{
                padding: '6px 12px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800',
                border: 'none', cursor: 'pointer',
                background: testRolu === rolItem.id ? '#4F46E5' : 'rgba(255,255,255,0.08)',
                color: '#FFF', transition: 'all 0.15s'
              }}
              title={rolItem.aciklama}
            >
              {rolItem.etiket}
            </button>
          ))}
        </div>
      </div>

      {/* ── SEKMELERİN GÖSTERİMİ ── */}

      {/* 1. GENEL BAKIŞ SEKMESİ */}
      {aktifSekme === 'genelBakis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* İstatistik Özet Kartları */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2rem', padding: '10px', background: '#EFF6FF', borderRadius: '12px' }}>🔬</div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Aktif Projeler</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1E293B', marginTop: '4px' }}>{projeler.length} Proje</div>
              </div>
            </div>
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2rem', padding: '10px', background: '#F5F3FF', borderRadius: '12px' }}>🧑‍🏫</div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Danışman Öğretmenler</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1E293B', marginTop: '4px' }}>3 Danışman</div>
              </div>
            </div>
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2rem', padding: '10px', background: '#ECFDF5', borderRadius: '12px' }}>📅</div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>TÜBİTAK Son Başvuru</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#059669', marginTop: '4px' }}>Şubat 2027 (Kılavuz Bekleniyor)</div>
              </div>
            </div>
          </div>

          {/* Proje Listesi */}
          <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1E293B', fontWeight: '800' }}>
                📂 Kurum Araştırma Projeleri Havuzu
              </h3>
              <button
                onClick={() => setAktifSekme('sihirbaz')}
                style={{
                  padding: '6px 12px', background: '#1E40AF', color: '#FFF', border: 'none', borderRadius: '8px',
                  fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                + Yeni Proje Başlat
              </button>
            </div>

            {yukleniyor ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>Yükleniyor...</div>
            ) : projeler.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🧪</div>
                Kayıtlı herhangi bir Ar-Ge projesi bulunmuyor. Yeni bir proje başlatarak danışmanlık rehberini aktifleştirebilirsiniz.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {projeler.map(p => (
                  <div key={p.id} style={{
                    border: '1.5px solid #F1F5F9', borderRadius: '12px', padding: '1rem',
                    display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#FAFAFA'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.65rem', background: '#EFF6FF', color: '#1E40AF', padding: '2px 8px', borderRadius: '999px', fontWeight: '800' }}>
                          {p.alan}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: '600' }}>{p.tarih}</span>
                      </div>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800', color: '#1E293B', lineHeight: '1.4' }}>{p.baslik}</h4>
                      <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px', fontWeight: '500' }}>
                        📌 Tema: <strong>{p.tema}</strong>
                      </div>
                    </div>

                    <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px', fontSize: '0.7rem', color: '#64748B' }}>
                      <div>👨‍🏫 Danışman: <span style={{ color: '#1E293B', fontWeight: '600' }}>{p.danisman}</span></div>
                      <div style={{ marginTop: '2px' }}>👥 Öğrenciler: <span style={{ color: '#1E293B', fontWeight: '600' }}>{p.ogrenciler}</span></div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748B', marginBottom: '4px', fontWeight: '700' }}>
                        <span>İlerleme Durumu</span>
                        <span>%{p.ilerleme}</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${p.ilerleme}%`, height: '100%', background: '#10B981', borderRadius: '999px' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: '800', background: '#ECFDF5', padding: '2px 8px', borderRadius: '6px' }}>
                        {p.durum || 'Yazım Aşamasında'}
                      </span>
                      <button
                        onClick={() => {
                          setProjeForm(p.formVerisi || p);
                          setAktifSekme('sihirbaz');
                          setSihirbazAdim(8); // Doğrudan AI denetçiye git
                        }}
                        style={{
                          padding: '4px 8px', background: 'transparent', border: '1.5px solid #1E40AF', color: '#1E40AF',
                          borderRadius: '6px', fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer'
                        }}
                      >
                        İncele & AI Denetle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. TÜBİTAK 2204-B SİHİRBAZI SEKMESİ */}
      {aktifSekme === 'sihirbaz' && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Sol Kolon: Sihirbaz Adımları Form İçeriği */}
          <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01)' }}>
            
            {/* Adım İlerleyicisi (Progress Step Indicators) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '1rem', marginBottom: '1.5rem', overflowX: 'auto', gap: '10px' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                <button
                  key={num}
                  onClick={() => setSihirbazAdim(num)}
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    minWidth: '50px', opacity: sihirbazAdim === num ? 1 : 0.45
                  }}
                >
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%', background: sihirbazAdim >= num ? '#1E40AF' : '#E2E8F0',
                    color: sihirbazAdim >= num ? '#FFF' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '800'
                  }}>
                    {num}
                  </div>
                  <span style={{ fontSize: '0.6rem', fontWeight: '800', color: sihirbazAdim === num ? '#1E40AF' : '#475569', whiteSpace: 'nowrap' }}>
                    {num === 1 && '1. Alan'}
                    {num === 2 && '2. Özet'}
                    {num === 3 && '3. Amaç'}
                    {num === 4 && '4. Yöntem'}
                    {num === 5 && '5. Bulgular'}
                    {num === 6 && '6. Sonuç'}
                    {num === 7 && '7. Kaynakça'}
                    {num === 8 && '8. AI Denetim'}
                  </span>
                </button>
              ))}
            </div>

            {/* ADIM İÇERİKLERİ */}

            {/* ADIM 1: ALAN VE TEMA */}
            {sihirbazAdim === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#1B3A6B', fontWeight: '800' }}>🧬 Adım 1: Proje Ana Alanı ve Tematik Alan Seçimi</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4' }}>
                  Projenizin konusuna en uygun ana bilim dalını ve ardından projenin hedefine uyan tematik odağı seçin. Yanlış alan seçimi projenin ilk aşamada elenmesine neden olabilir!
                </p>

                {/* Ana Alan Seçenekleri */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {[
                    { ad: 'Fen Bilimleri', ikon: '🔬', renk: '#EFF6FF', yazi: '#1E40AF', sinirlar: 'Biyoçeşitlilik, Ekoloji, Kimya Teknolojileri' },
                    { ad: 'Yazılım & Bilişim', ikon: '💻', renk: '#F5F3FF', yazi: '#6D28D9', sinirlar: 'Algoritma, Akıllı Ulaşım, Yapay Zeka' },
                    { ad: 'Matematik', ikon: '📐', renk: '#FEF3C7', yazi: '#D97706', sinirlar: 'Sayılar Teorisi, Mantıksal Tasarım' },
                    { ad: 'Değerler Eğitimi', ikon: '🧠', renk: '#ECFDF5', yazi: '#059669', sinirlar: 'Kültürel Miras, Aile Değerleri' }
                  ].map(item => (
                    <div
                      key={item.ad}
                      onClick={() => setProjeForm({ ...projeForm, alan: item.ad })}
                      style={{
                        background: item.renk, border: projeForm.alan === item.ad ? `2px solid ${item.yazi}` : '1.5px solid transparent',
                        borderRadius: '14px', padding: '1rem', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ fontSize: '2rem', marginBottom: '6px' }}>{item.ikon}</div>
                      <div style={{ fontWeight: '800', fontSize: '0.85rem', color: item.yazi }}>{item.ad}</div>
                      <div style={{ fontSize: '0.625rem', color: '#64748B', marginTop: '4px', lineHeight: '1.3' }}>{item.sinirlar}</div>
                    </div>
                  ))}
                </div>

                {/* Tematik Alan Girişi */}
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>Tematik Alan (Detay)</label>
                  <input
                    type="text"
                    placeholder="Örn: Yapay Zeka Uygulamaları, Ekoloji ve Çevre Yönetimi..."
                    value={projeForm.tema}
                    onChange={e => setProjeForm({ ...projeForm, tema: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                  />
                </div>
              </div>
            )}

            {/* ADIM 2: BAŞLIK & ÖZET */}
            {sihirbazAdim === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#1B3A6B', fontWeight: '800' }}>✍️ Adım 2: Proje Başlığı ve Özet Metni</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4' }}>
                  TÜBİTAK kurallarına göre proje özeti **en az 150, en fazla 250 kelime** arasında olmalıdır. Kelime sınırını aşan veya yetersiz kalan projeler jüri tarafından elenebilir.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>Projenin Adı / Başlığı</label>
                  <input
                    type="text"
                    placeholder="Örn: Akıllı Sulama Sistemleri ile Tarımsal Su Tasarrufu Sağlanması"
                    value={projeForm.baslik}
                    onChange={e => setProjeForm({ ...projeForm, baslik: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', fontWeight: '700' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: '800', color: '#475569' }}>Proje Özeti (Özet Raporu)</label>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: '800', padding: '2px 8px', borderRadius: '6px',
                      background: (getWordCount(projeForm.ozet) >= 150 && getWordCount(projeForm.ozet) <= 250) ? '#D1FAE5' : '#FEE2E2',
                      color: (getWordCount(projeForm.ozet) >= 150 && getWordCount(projeForm.ozet) <= 250) ? '#065F46' : '#991B1B'
                    }}>
                      Kelime Sayısı: {getWordCount(projeForm.ozet)} / Limit (150-250)
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    placeholder="Projenin amacını, yöntemini, elde edilen temel bulguları ve sonuçları anlatan özet yazınız..."
                    value={projeForm.ozet}
                    onChange={e => setProjeForm({ ...projeForm, ozet: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', lineHeight: '1.4', resize: 'vertical' }}
                  />
                  <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '4px', fontStyle: 'italic' }}>
                    * İpucu: Özetinizde marka adı (Lego, Arduino vb.) veya okul/şahıs ismi kullanmamaya özen gösterin.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>Anahtar Kelimeler</label>
                  <input
                    type="text"
                    placeholder="Örn: Akıllı Sulama, IoT, Su Tasarrufu (En fazla 5 kelime)"
                    value={projeForm.anahtarKelimeler}
                    onChange={e => setProjeForm({ ...projeForm, anahtarKelimeler: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                  />
                </div>
              </div>
            )}

            {/* ADIM 3: PROJENİN AMACI & GİRİŞ */}
            {sihirbazAdim === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#1B3A6B', fontWeight: '800' }}>🎯 Adım 3: Projenin Amacı ve Giriş</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4' }}>
                  Bu bölümde projenin hangi temel problemi çözmek üzere yola çıktığını ve literatürde (akademik geçmişte) bu alanda neler yapıldığını anlatmalısınız.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>Projenin Amacı</label>
                  <textarea
                    rows={4}
                    placeholder="Bu çalışma, ... problemini çözmeyi ve ... hedefine ulaşmayı amaçlamaktadır..."
                    value={projeForm.amac}
                    onChange={e => setProjeForm({ ...projeForm, amac: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', lineHeight: '1.4', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>Giriş (Literatür Taraması)</label>
                  <textarea
                    rows={5}
                    placeholder="Literatürde yapılan araştırmalara göre ... yöntemleri kullanılmış ancak ... kısıtı görülmüştür. Bu çalışma bu kısıtı gidermektedir..."
                    value={projeForm.giris}
                    onChange={e => setProjeForm({ ...projeForm, giris: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', lineHeight: '1.4', resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* ADIM 4: YÖNTEM */}
            {sihirbazAdim === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#1B3A6B', fontWeight: '800' }}>🧪 Adım 4: Bilimsel Yöntem (Deney, Anket, Yazılım)</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4' }}>
                  Projeyi hangi adımlarla gerçekleştirdiğinizi açıklayın. TÜBİTAK jürisi yöntem bölümünde objektiflik, kontrol grupları ve bilimsel aşamaların titizliğini arar.
                </p>

                {/* Yöntem Türü Seçimi */}
                <div style={{ display: 'flex', gap: '10px', margin: '4px 0' }}>
                  {[
                    { id: 'deney', etiket: '🧪 Deney & Gözlem', ipucu: 'Kontrol grubu, deney grubu, bağımsız değişkenler...' },
                    { id: 'anket', etiket: '📊 Anket & Ölçek', ipucu: 'Katılımcı sayısı, veli izinleri, demografik sorular...' },
                    { id: 'yazilim', etiket: '💻 Yazılım & Tasarım', ipucu: 'Uygulama kod mimarisi, testler, 3D çizimler...' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setProjeForm({ ...projeForm, yontemTip: t.id })}
                      style={{
                        flex: 1, padding: '10px', border: projeForm.yontemTip === t.id ? '2px solid #1E40AF' : '1px solid #CBD5E1',
                        borderRadius: '10px', background: projeForm.yontemTip === t.id ? '#EFF6FF' : '#FFF',
                        color: projeForm.yontemTip === t.id ? '#1E40AF' : '#475569', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer'
                      }}
                    >
                      {t.etiket}
                    </button>
                  ))}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>Yöntem Detayları (Aşama Aşama)</label>
                  <textarea
                    rows={6}
                    placeholder={
                      projeForm.yontemTip === 'deney' ? "1. Aşama: Deney ve kontrol gruplarının ayrılması...\n2. Aşama: Bağımsız değişken olarak ... eklenmesi...\n3. Aşama: Gözlemlerin yapılması..." :
                      projeForm.yontemTip === 'anket' ? "1. Aşama: 50 kişilik kontrol grubuna anket uygulanması...\n2. Aşama: İzinlerin alınması...\n3. Aşama: SPSS / istatistiksel analizlerin çıkarılması..." :
                      "1. Aşama: Sistem mimarisinin tasarlanması...\n2. Aşama: Python / C++ programlama geliştirme kartı ile kodlama...\n3. Aşama: Entegrasyon ve kararlılık testleri..."
                    }
                    value={projeForm.yontemDetay}
                    onChange={e => setProjeForm({ ...projeForm, yontemDetay: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', lineHeight: '1.4', resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* ADIM 5: BULGULAR & GRAFİK */}
            {sihirbazAdim === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#1B3A6B', fontWeight: '800' }}>📊 Adım 5: Bulgular ve Canlı Grafik Üreteci</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4' }}>
                  Araştırmanızdan elde ettiğiniz ham verileri girin. Aşağıdaki mini araç verilerinizi otomatik olarak şık bir karşılaştırma grafiğine dönüştürerek raporunuza ekler.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
                  
                  {/* Veri Ekleme Formu */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <form onSubmit={handleGrafikVeriEkle} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#1B3A6B' }}>Grafik Verisi Ekle</span>
                      <input
                        type="text"
                        placeholder="Örn: Deney Grubu"
                        value={yeniEtiket}
                        onChange={e => setYeniEtiket(e.target.value)}
                        style={{ padding: '6px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                      />
                      <input
                        type="number"
                        placeholder="Başarı / Skor (%)"
                        value={yeniDeger}
                        onChange={e => setYeniDeger(e.target.value)}
                        style={{ padding: '6px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                      />
                      <button
                        type="submit"
                        style={{ padding: '6px', background: '#1E40AF', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Veriyi Grafiğe Ekle
                      </button>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {grafikVerileri.map((v, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', background: '#F8FAFC', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                          <span>{v.etiket}</span>
                          <span style={{ fontWeight: '800', color: '#1E40AF' }}>{v.deger} Skoru</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SVG Bar Chart Grafiği */}
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#475569', marginBottom: '10px' }}>📊 Rapor Karşılaştırma Grafiği (Önizleme)</span>
                    
                    {/* SVG Çizimi */}
                    <svg width="220" height="150" style={{ overflow: 'visible' }}>
                      {/* Eksenler */}
                      <line x1="30" y1="120" x2="200" y2="120" stroke="#94A3B8" strokeWidth="2" />
                      <line x1="30" y1="10" x2="30" y2="120" stroke="#94A3B8" strokeWidth="2" />
                      
                      {/* Barlar */}
                      {grafikVerileri.map((v, idx) => {
                        const barWidth = 28
                        const spacing = 45
                        const startX = 50 + idx * spacing
                        const height = Math.min((v.deger / 100) * 100, 100) // max 100px
                        const startY = 120 - height
                        return (
                          <g key={idx}>
                            <rect
                              x={startX}
                              y={startY}
                              width={barWidth}
                              height={height}
                              fill={idx % 2 === 0 ? '#3B82F6' : '#818CF8'}
                              rx="3"
                            />
                            {/* Değer Yazısı */}
                            <text x={startX + barWidth/2} y={startY - 6} textAnchor="middle" fontSize="9" fontWeight="800" fill="#1E293B">
                              {v.deger}%
                            </text>
                            {/* Etiket Yazısı */}
                            <text x={startX + barWidth/2} y="132" textAnchor="middle" fontSize="8" fontWeight="600" fill="#64748B">
                              {v.etiket}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>Bulguların Yazılı Açıklaması</label>
                  <textarea
                    rows={4}
                    placeholder="Grafik 1'de görüldüğü üzere, deney grubundaki öğrencilerin başarı ortalaması kontrol grubuna göre %20 oranında bir artış göstermiştir..."
                    value={projeForm.bulgular}
                    onChange={e => setProjeForm({ ...projeForm, bulgular: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', lineHeight: '1.4', resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* ADIM 6: SONUÇ VE ÖNERİLER */}
            {sihirbazAdim === 6 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#1B3A6B', fontWeight: '800' }}>💡 Adım 6: Sonuç ve Öneriler</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4' }}>
                  Sonuç bölümünde çalışmanızdan çıkan nihai kararı özetleyin. Öneriler kısmında ise projenin gelecekte farklı şartlarda nasıl genişletilebileceğini açıklayın.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>Tartışma ve Sonuç</label>
                  <textarea
                    rows={4}
                    placeholder="Araştırma sonucunda elde edilen bulgular, geliştirilen modelin su tasarrufunda son derece kararlı çalıştığını kanıtlamıştır..."
                    value={projeForm.sonuc}
                    onChange={e => setProjeForm({ ...projeForm, sonuc: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', lineHeight: '1.4', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>Geleceğe Yönelik Öneriler</label>
                  <textarea
                    rows={4}
                    placeholder="Bu çalışma, sonraki aşamada güneş paneli destekli enerji yönetim sistemleri entegre edilerek tamamen otonom hale getirilebilir..."
                    value={projeForm.oneriler}
                    onChange={e => setProjeForm({ ...projeForm, oneriler: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', lineHeight: '1.4', resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* ADIM 7: KAYNAKÇA */}
            {sihirbazAdim === 7 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#1B3A6B', fontWeight: '800' }}>📚 Adım 7: Kaynakça Sihirbazı (APA 7 Formatı)</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4' }}>
                  TÜBİTAK jürisi akademik dürüstlük gereği kaynakça formatına çok dikkat eder. Kaynak bilgilerinizi girerek otomatik olarak **APA standartlarında** kaynakça girdileri oluşturun.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
                  
                  {/* Kaynak Formu */}
                  <form onSubmit={handleKaynakEkle} style={{ border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px', background: '#FAFAFA' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1B3A6B' }}>Yeni Akademik Atıf Ekle</span>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Yazar Soyadı, Adı (Örn: Yılmaz, A.)"
                        value={kaynakYazar}
                        onChange={e => setKaynakYazar(e.target.value)}
                        style={{ padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.75rem', outline: 'none' }}
                      />
                      <input
                        type="text"
                        placeholder="Yayın Yılı (Örn: 2025)"
                        value={kaynakYil}
                        onChange={e => setKaynakYil(e.target.value)}
                        style={{ padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.75rem', outline: 'none' }}
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Kitap veya Makale Başlığı"
                      value={kaynakBaslik}
                      onChange={e => setKaynakBaslik(e.target.value)}
                      style={{ padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.75rem', outline: 'none' }}
                    />

                    <input
                      type="text"
                      placeholder="Yayın Evi / Dergi Adı"
                      value={kaynakYayinci}
                      onChange={e => setKaynakYayinci(e.target.value)}
                      style={{ padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.75rem', outline: 'none' }}
                    />

                    <button
                      type="submit"
                      style={{ padding: '8px', background: '#1E40AF', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      + Kaynağı Formatlayıp Ekle
                    </button>
                  </form>

                  {/* Kaynak Listesi */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>Eklenmiş Kaynaklar (Önizleme)</span>
                    
                    {projeForm.kaynaklar.length === 0 ? (
                      <div style={{ padding: '2rem', border: '1px dashed #CBD5E1', borderRadius: '12px', textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem' }}>
                        Henüz kaynak eklenmedi.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {projeForm.kaynaklar.map((k, idx) => (
                          <div key={idx} style={{
                            padding: '8px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px',
                            fontSize: '0.72rem', color: '#1E293B', lineHeight: '1.4'
                          }}>
                            {idx + 1}. {k}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ADIM 8: YAPAY ZEKA DENETİMİ (AI PRE-CHECK) */}
            {sihirbazAdim === 8 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#1B3A6B', fontWeight: '800' }}>⚡ Adım 8: AI Rapor Denetleyicisi & Etik Kontrol Ajanı</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4' }}>
                  TÜBİTAK başvurusundan önce projenizi yapay zekaya analiz ettirin. Ajanımız marka isimlerini, özet limitlerini ve etik kurul gerekliliklerini otomatik denetler.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
                  <button
                    type="button"
                    onClick={handleAiDenetimCalistir}
                    disabled={aiDenetimYukleniyor}
                    style={{
                      padding: '0.75rem 2rem',
                      background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
                      border: '2px solid #4F46E5',
                      borderRadius: '12px',
                      color: '#FFF',
                      fontSize: '0.85rem',
                      fontWeight: '800',
                      cursor: aiDenetimYukleniyor ? 'not-allowed' : 'pointer',
                      boxShadow: '0 8px 20px rgba(79, 70, 229, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {aiDenetimYukleniyor ? '🔄 Rapor Analiz Ediliyor...' : '⚡ Yapay Zeka Denetimini Başlat'}
                  </button>
                </div>

                {/* AI Denetim Sonuçları Görünümü */}
                {aiDenetimYukleniyor && (
                  <div style={{ textAlign: 'center', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px', border: '3.5px solid rgba(0,0,0,0.05)', borderTop: '3.5px solid #4F46E5',
                      borderRadius: '50%', animation: 'spin 1s linear infinite'
                    }} />
                    <span style={{ fontSize: '0.8rem', color: '#4F46E5', fontWeight: '700' }}>Rapor detayları TÜBİTAK kılavuzları ile eşleştiriliyor...</span>
                  </div>
                )}

                {aiAnalizTamamlandi && (
                  <div style={{ border: '1.5px solid #F1F5F9', borderRadius: '16px', padding: '1.25rem', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h5 style={{ margin: 0, fontSize: '0.85rem', color: '#1E293B', fontWeight: '800' }}>🔬 Analiz Bulguları ve Rapor Karnesi</h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {aiBulgular.map((b, i) => (
                        <div
                          key={i}
                          style={{
                            border: '1.5px solid transparent',
                            borderColor: b.tip === 'hata' ? '#FCA5A5' : b.tip === 'kritik_marka' ? '#FCA5A5' : b.tip === 'basarili' ? '#A7F3D0' : '#BFDBFE',
                            background: b.tip === 'hata' ? '#FEF2F2' : b.tip === 'kritik_marka' ? '#FEF2F2' : b.tip === 'basarili' ? '#ECFDF5' : '#EFF6FF',
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '1rem'
                          }}
                        >
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{
                              alignSelf: 'flex-start', fontSize: '0.625rem', fontWeight: '800', padding: '2px 8px', borderRadius: '999px',
                              background: b.tip === 'hata' ? '#EF4444' : b.tip === 'kritik_marka' ? '#EF4444' : b.tip === 'basarili' ? '#10B981' : '#3B82F6',
                              color: '#FFF',
                              textTransform: 'uppercase'
                            }}>
                              {b.tip === 'hata' ? '⚠️ Kelime Sınırı' : b.tip === 'kritik_marka' ? '🚨 Kritik Marka İhlali' : b.tip === 'basarili' ? '✅ Başarılı' : 'ℹ️ Etik İzin Gerekli'}
                            </span>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#1F2937', fontWeight: '600', lineHeight: '1.4' }}>{b.mesaj}</p>
                            {b.cozum && (
                              <p style={{ margin: 0, fontSize: '0.72rem', color: '#991B1B', fontStyle: 'italic', fontWeight: '500' }}>
                                Öneri: {b.cozum}
                              </p>
                            )}
                          </div>

                          {/* Aksiyon Butonları */}
                          {b.tip === 'kritik_marka' && (
                            <button
                              type="button"
                              onClick={() => applyBrandFix(b.hedefDiger, b.yerine)}
                              style={{
                                padding: '6px 12px', background: '#EF4444', color: '#FFF', border: 'none', borderRadius: '6px',
                                fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer'
                              }}
                            >
                              Tek Tıkla Bilimsel Terime Dönüştür
                            </button>
                          )}

                          {b.belgeLink && (
                            <a
                              href={b.belgeLink}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                padding: '6px 12px', background: '#3B82F6', color: '#FFF', textDecoration: 'none', borderRadius: '6px',
                                fontSize: '0.72rem', fontWeight: '700', display: 'inline-block'
                              }}
                            >
                              Muvafakatname Şablonunu İndir
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Alt Gezinme Butonları */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', borderTop: '1px solid #F1F5F9', paddingTop: '1.25rem' }}>
              <button
                type="button"
                disabled={sihirbazAdim === 1}
                onClick={() => setSihirbazAdim(prev => prev - 1)}
                style={{
                  padding: '8px 16px', background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569',
                  borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: sihirbazAdim === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                ◀ Geri
              </button>
              
              {sihirbazAdim < 8 ? (
                <button
                  type="button"
                  onClick={() => setSihirbazAdim(prev => prev + 1)}
                  style={{
                    padding: '8px 16px', background: '#1E40AF', color: '#FFF', border: 'none',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Sonraki Adım ▶
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleProjeKaydet}
                  style={{
                    padding: '8px 20px', background: '#10B981', color: '#FFF', border: 'none',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  🚀 Projeyi Kaydet ve Ar-Ge'ye Ekle
                </button>
              )}
            </div>

          </div>

          {/* Sağ Kolon: Rehber / TÜBİTAK Şablon Kuralları */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📖</span> <span>Adım Kılavuzu & Püf Noktaları</span>
              </div>
              
              <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sihirbazAdim === 1 && (
                  <>
                    <p style={{ margin: 0 }}>* 2204-B Ortaokul kategorisinde 10 ana bilim alanı bulunmaktadır.</p>
                    <p style={{ margin: 0 }}>* Tematik alan seçimi tamamen projenizin **odaklandığı nihai faydaya** göre yapılmalıdır. Örneğin, bir sulama yazılımı yapıyorsanız alan "Yazılım", tema ise "Akıllı Tarım" olmalıdır.</p>
                  </>
                )}
                {sihirbazAdim === 2 && (
                  <>
                    <p style={{ margin: 0 }}>* Özet raporu en az 150 kelime ile yazılmalıdır.</p>
                    <p style={{ margin: 0 }}>* Raporun tamamında asla şahıs isimleri (örn: 'Veli hocamız eşliğinde') veya okul ismi (örn: 'Özel Kolejinde yaptığımız') geçmemelidir.</p>
                    <p style={{ margin: 0 }}>* Aksi takdirde jüri projenizi anında diskalifiye eder.</p>
                  </>
                )}
                {sihirbazAdim === 3 && (
                  <>
                    <p style={{ margin: 0 }}>* Proje amacınızı en fazla 2-3 cümleyle netçe açıklayın.</p>
                    <p style={{ margin: 0 }}>* Giriş kısmında benzer akademik çalışmaları belirtip, sizin projenizin neden daha yenilikçi/özgün olduğunu kanıtlayın.</p>
                  </>
                )}
                {sihirbazAdim === 4 && (
                  <>
                    <p style={{ margin: 0 }}>* Deney yapıyorsanız, mutlaka kontrol ve deney gruplarını ayırın.</p>
                    <p style={{ margin: 0 }}>* Anket çalışmalarında örneklem büyüklüğünü (katılımcı sayısını) belirtmelisiniz.</p>
                  </>
                )}
                {sihirbazAdim === 5 && (
                  <>
                    <p style={{ margin: 0 }}>* Elde ettiğiniz ölçüm verilerini tablo veya grafiklerle sunmanız puanınızı büyük oranda artırır.</p>
                    <p style={{ margin: 0 }}>* Ham veri giriş formumuzu doldurarak yan taraftaki grafiği raporunuza ekleyebilirsiniz.</p>
                  </>
                )}
                {sihirbazAdim === 6 && (
                  <>
                    <p style={{ margin: 0 }}>* Bulgularınızın hipotezi destekleyip desteklemediğini objektif yazın.</p>
                    <p style={{ margin: 0 }}>* Başarısız veya beklentiyi karşılamayan deney sonuçları da bilimsel değer taşır, jüriden puan kırmaz.</p>
                  </>
                )}
                {sihirbazAdim === 7 && (
                  <>
                    <p style={{ margin: 0 }}>* Atıfta bulunulan tüm web siteleri, kitaplar ve makaleler kaynakçada yer almalıdır.</p>
                    <p style={{ margin: 0 }}>* APA 7 formatı: Soyadı, A. (Yıl). Çalışma Adı. Yayıncı şeklinde düzenlenmelidir.</p>
                  </>
                )}
                {sihirbazAdim === 8 && (
                  <>
                    <p style={{ margin: 0 }}>* Raporunuzu tamamlamadan önce son bir kez AI Denetimini çalıştırın.</p>
                    <p style={{ margin: 0 }}>* Bu denetim jüri elenmelerini %95 oranında önleyecektir.</p>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 3. 8 HAFTALIK YOL HARİTASI SEKMESİ */}
      {aktifSekme === 'yolHaritasi' && (
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#1B3A6B', fontWeight: '800' }}>
            📅 8 Haftalık TÜBİTAK Proje Hazırlık ve Başvuru Takvimi
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4' }}>
            Öğretmenlerimizin zaman baskısı hissetmemesi ve çalışmalarını planlı yürütebilmesi için tasarlanmış ideal süreç takvimi:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
            
            {/* Timeline Çizgisi */}
            <div style={{ position: 'absolute', left: '20px', top: '15px', bottom: '15px', width: '2px', background: '#E2E8F0', zIndex: 1 }} />

            {[
              { hafta: 'Hafta 1-2', baslik: '🧠 Fikir Arama & Literatür Taraması', detay: 'Çözülecek problem tespit edilir. Google Akademik (Scholar) ve dergilerden benzer projeler araştırılır. Hipotez netleştirilir.', aktif: true },
              { hafta: 'Hafta 3-4', baslik: '🔬 Yöntem Tasarımı & İzinlerin Alınması', detay: 'Deney düzeneği kurulur veya anket soruları hazırlanır. Gerekli etik kurul/veli muvafakatname izin süreçleri okul idaresi ile başlatılır.', aktif: true },
              { hafta: 'Hafta 5-6', baslik: '📊 Deney Aşaması & Veri Toplama', detay: 'Deneyler veya anketler uygulanır. Elde edilen ölçümler, skorlar ve veriler tablolara dökülür.', aktif: false },
              { hafta: 'Hafta 7', baslik: '✍️ Raporun Sihirbazda Yazılması & AI Denetimi', detay: 'Özet, yöntem ve bulgular yazılıp grafikleştirilir. Okulmatik AI denetleyicisi ile marka ve kurallar kontrol edilir.', aktif: false },
              { hafta: 'Hafta 8', baslik: '🚀 ARBİS Kaydı & Proje Yükleme', detay: 'Projeyi hazırlayan öğrencilerin ve danışman öğretmenin ARBİS kayıtları tamamlanır. Proje raporu TÜBİTAK portalına yüklenerek başvuru kesinleştirilir.', aktif: false }
            ].map((step, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '1.25rem', position: 'relative', zIndex: 2 }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%', background: step.aktif ? '#1E40AF' : '#E2E8F0',
                  color: step.aktif ? '#FFF' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: '800', flexShrink: 0, border: '4px solid #FFF'
                }}>
                  {step.hafta.split(' ')[1]}
                </div>

                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800', color: '#1E293B' }}>{step.baslik}</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748B', lineHeight: '1.4' }}>{step.detay}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ÖĞRETMEN AİDİYET & PERFORMANS TAKİP SİSTEMİ SEKMESİ */}
      {aktifSekme === 'performans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* İstatistik Özet Kartları */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2rem', padding: '10px', background: '#EFF6FF', borderRadius: '12px' }}>🎯</div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Taahhüt Oranı</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1E293B', marginTop: '4px' }}>
                  {projeler.filter(p => p.hedefler).length} / {projeler.length} Proje
                </div>
              </div>
            </div>
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2rem', padding: '10px', background: '#ECFDF5', borderRadius: '12px' }}>📈</div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Ortalama İlerleme</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#10B981', marginTop: '4px' }}>
                  %{Math.round(projeler.reduce((acc, p) => acc + (p.overallProgress || 0), 0) / (projeler.length || 1)) || 0}
                </div>
              </div>
            </div>
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2rem', padding: '10px', background: '#EEF2F6', borderRadius: '12px' }}>💰</div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Onaylanan Toplam Bütçe</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#6366F1', marginTop: '4px' }}>
                  {projeler.reduce((acc, p) => {
                    if (p.hedefler?.ustHedef?.idareOnayi && p.hedefler?.ustHedef?.bütçeTalebi) {
                      const num = parseInt(p.hedefler.ustHedef.bütçeTalebi.replace(/\D/g, '')) || 0
                      return acc + num
                    }
                    return acc
                  }, 0)} TL
                </div>
              </div>
            </div>
          </div>

          {/* Ana Gövde İki Kolon Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Sol Kolon: Projeler ve Taahhüt Kartları */}
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1E293B', fontWeight: '800' }}>
                📂 Proje Taahhüt ve Hedef Durumları
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {projeler.map(p => {
                  const hasHedef = !!p.hedefler
                  const overallStatusColor = p.pozisyonDurumu === 'approved' ? '#10B981' : p.pozisyonDurumu === 'at_risk' ? '#EF4444' : '#3B82F6'
                  const overallStatusBg = p.pozisyonDurumu === 'approved' ? '#ECFDF5' : p.pozisyonDurumu === 'at_risk' ? '#FEF2F2' : '#EFF6FF'
                  const overallStatusLabel = p.pozisyonDurumu === 'approved' ? 'Tamamlandı' : p.pozisyonDurumu === 'at_risk' ? 'Risk Altında' : 'İlerliyor'

                  return (
                    <div key={p.id} style={{
                      border: '1.5px solid #F1F5F9', borderRadius: '14px', padding: '1.25rem', background: '#FAFAFA',
                      display: 'flex', flexDirection: 'column', gap: '10px'
                    }}>
                      
                      {/* Kart Üst Başlık */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: '#1E293B' }}>{p.baslik}</h4>
                          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '500' }}>Sorumlu: <strong>{p.danisman}</strong></span>
                        </div>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: '800', padding: '3px 10px', borderRadius: '20px',
                          color: overallStatusColor, background: overallStatusBg
                        }}>
                          {overallStatusLabel}
                        </span>
                      </div>

                      {/* Hedef Rozetleri */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '4px 0' }}>
                        <div style={{
                          fontSize: '0.75rem', fontWeight: '700', padding: '6px 12px', borderRadius: '10px',
                          background: hasHedef && p.hedefler.temelHedef?.tamamlandi ? '#ECFDF5' : '#F1F5F9',
                          color: hasHedef && p.hedefler.temelHedef?.tamamlandi ? '#047857' : '#64748B',
                          border: hasHedef && p.hedefler.temelHedef?.tamamlandi ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                          display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                          <span>🏫</span> Temel Katılım {hasHedef && p.hedefler.temelHedef?.tamamlandi ? '✓' : ''}
                        </div>
                        <div style={{
                          fontSize: '0.75rem', fontWeight: '700', padding: '6px 12px', borderRadius: '10px',
                          background: hasHedef && p.hedefler.ortaHedef?.tamamlandi ? '#ECFDF5' : hasHedef && p.hedefler.ortaHedef?.istekDurumu === 'pending' ? '#FFFBEB' : '#F1F5F9',
                          color: hasHedef && p.hedefler.ortaHedef?.tamamlandi ? '#047857' : hasHedef && p.hedefler.ortaHedef?.istekDurumu === 'pending' ? '#B45309' : '#64748B',
                          border: hasHedef && p.hedefler.ortaHedef?.tamamlandi ? '1px solid #A7F3D0' : hasHedef && p.hedefler.ortaHedef?.istekDurumu === 'pending' ? '1px solid #FDE68A' : '1px solid #E2E8F0',
                          display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                          <span>👥</span> Sinerji {hasHedef && p.hedefler.ortaHedef?.tamamlandi ? '✓' : hasHedef && p.hedefler.ortaHedef?.istekDurumu === 'pending' ? '⌛' : ''}
                        </div>
                        <div style={{
                          fontSize: '0.75rem', fontWeight: '700', padding: '6px 12px', borderRadius: '10px',
                          background: hasHedef && p.hedefler.ustHedef?.tamamlandi ? '#ECFDF5' : '#F1F5F9',
                          color: hasHedef && p.hedefler.ustHedef?.tamamlandi ? '#047857' : '#64748B',
                          border: hasHedef && p.hedefler.ustHedef?.tamamlandi ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                          display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                          <span>📢</span> Vitrin & PR {hasHedef && p.hedefler.ustHedef?.tamamlandi ? '✓' : ''}
                        </div>
                      </div>

                      {/* İlerleme Barı */}
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#475569', marginBottom: '4px', fontWeight: '800' }}>
                          <span>Taahhüt Gerçekleşme İlerlemesi</span>
                          <span>%{p.overallProgress || 0}</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${p.overallProgress || 0}%`, height: '100%', background: '#6366F1', borderRadius: '999px', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>

                      {/* İşlem Butonları */}
                      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '10px', marginTop: '6px', justifyContent: 'flex-end' }}>
                        {testRolu === 'ogretmen' && (!p.sorumluOgretmenId || p.sorumluOgretmenId === 'mock_teacher_hasan') && (
                          <button
                            onClick={() => {
                              setSelectedProjeId(p.id)
                              setTaahhutFormVeri({
                                turnuvaAdi: p.hedefler?.temelHedef?.turnuvaAdi || '',
                                ogrenciListesiText: p.hedefler?.temelHedef?.ogrenciListesi?.join(', ') || '',
                                ortakOgretmen: p.hedefler?.ortaHedef?.ortakOgretmenId || '',
                                ortakProje: p.hedefler?.ortaHedef?.ortakProjeId || '',
                                prTipi: p.hedefler?.ustHedef?.prTipi || 'veli_lansmani',
                                kanitUrl: p.hedefler?.ustHedef?.kanitUrl || '',
                                butceTalebi: p.hedefler?.ustHedef?.bütçeTalebi || ''
                              })
                              setShowTaahhutForm(true)
                            }}
                            style={{
                              padding: '6px 12px', background: '#1E40AF', color: '#FFF', border: 'none',
                              borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer'
                            }}
                          >
                            🎯 {hasHedef ? 'Taahhütleri Düzenle' : 'Hedefleri Taahhüt Et'}
                          </button>
                        )}
                        
                        <button
                          onClick={() => setSeciliDetayProje(p)}
                          style={{
                            padding: '6px 12px', background: 'transparent', border: '1.5px solid #CBD5E1', color: '#475569',
                            borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer'
                          }}
                        >
                          🔍 Detay & Geçmiş Zaman Tüneli
                        </button>
                      </div>

                    </div>
                  )
                })}
              </div>
            </div>

            {/* Sağ Kolon: Rol Bazlı İşlemler Paneli */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* ZÜMRE BAŞKANI EYLEMLERİ */}
              {testRolu === 'zumre_baskani' && (
                <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#B45309', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>👥</span> <span>Zümre Onayı Bekleyen İstekler</span>
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B', lineHeight: '1.4' }}>
                    Zümre üyelerinizin diğer takımlarla ortak yürüteceği "Sinerji" hedeflerini inceleyip onaylayın.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                    {projeler.filter(p => p.hedefler?.ortaHedef?.istekDurumu === 'pending').length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', border: '1px dashed #E2E8F0', borderRadius: '12px', color: '#94A3B8', fontSize: '0.72rem' }}>
                        Onay bekleyen sinerji isteği bulunmuyor.
                      </div>
                    ) : (
                      projeler.filter(p => p.hedefler?.ortaHedef?.istekDurumu === 'pending').map(p => (
                        <div key={p.id} style={{ background: '#FFF8F1', border: '1px solid #FDE68A', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#78350F' }}>{p.baslik}</div>
                          <div style={{ fontSize: '0.68rem', color: '#451A03' }}>
                            Talep: <strong>{p.danisman}</strong>, okulun diğer projelerinden ortaklık talep ediyor.
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handleZumreApprove(p, 'approved')}
                              style={{ flex: 1, padding: '5px', background: '#10B981', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                            >
                              ✅ Sinerjiyi Onayla
                            </button>
                            <button
                              onClick={() => handleZumreApprove(p, 'rejected')}
                              style={{ padding: '5px 10px', background: '#EF4444', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                            >
                              Reddet
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* İDARE (OKUL MÜDÜRÜ) EYLEMLERİ */}
              {testRolu === 'idare' && (
                <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#6366F1', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🏛️</span> <span>İdare Onayı & Bütçe Yönetimi</span>
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B', lineHeight: '1.4' }}>
                    Öğretmenlerin turnuva katılımı ve dış PR lansmanları için talep ettikleri bütçe ve vitrin onay süreçleri.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                    {projeler.filter(p => p.hedefler && !p.hedefler.ustHedef?.idareOnayi).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', border: '1px dashed #E2E8F0', borderRadius: '12px', color: '#94A3B8', fontSize: '0.72rem' }}>
                        Onay bekleyen bütçe veya lansman talebi bulunmuyor.
                      </div>
                    ) : (
                      projeler.filter(p => p.hedefler && !p.hedefler.ustHedef?.idareOnayi).map(p => (
                        <div key={p.id} style={{ background: '#EEF2F6', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1E293B' }}>{p.baslik}</div>
                          <div style={{ fontSize: '0.68rem', color: '#475569' }}>
                            Bütçe Talebi: <strong style={{ color: '#4F46E5', fontSize: '0.8rem' }}>{p.hedefler.ustHedef.bütçeTalebi}</strong>
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#475569' }}>
                            PR Tipi: <strong>{p.hedefler.ustHedef.prTipi === 'veli_lansmani' ? 'Veli Lansmanı' : p.hedefler.ustHedef.prTipi === 'turnuva_katilimi' ? 'Turnuva Katılımı' : 'Kalite Etiketi / PR'}</strong>
                          </div>
                          {p.hedefler.ustHedef.kanitUrl && (
                            <a href={p.hedefler.ustHedef.kanitUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.65rem', color: '#4F46E5', textDecoration: 'underline' }}>
                              🔗 Dosya / Kanıt Önizle
                            </a>
                          )}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            <button
                              onClick={() => handleIdareApprove(p, true)}
                              style={{ flex: 1, padding: '5px', background: '#10B981', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                            >
                              ✅ Bütçe ve PR Onayla
                            </button>
                            <button
                              onClick={() => handleIdareApprove(p, false)}
                              style={{ padding: '5px 10px', background: '#EF4444', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                              title="Risk altında olarak işaretle"
                            >
                              ⚠️ Riskli
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAAHHÜT REHBERİ KARTI (Öğretmenler için) */}
              {testRolu === 'ogretmen' && (
                <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>💡</span> <span>Taahhüt Kılavuzu & Koşullar</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#475569', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ margin: 0 }}><strong>1. Temel Hedef:</strong> FLL veya TÜBİTAK kapsamında en az 7 öğrenciden oluşan aktif bir takım kurulmalıdır. Sistem öğrenci sayısı 7'den az olursa hata verir.</p>
                    <p style={{ margin: 0 }}><strong>2. Orta Hedef (Sinerji):</strong> Okul içindeki başka bir zümre ile ortak proje veya takım çalışması başlatıp, Zümre Başkanı onayına göndermelisiniz.</p>
                    <p style={{ margin: 0 }}><strong>3. Üst Hedef (PR):</strong> Projeyi dışa tanıtacak bir PR çıktısı (veli sunumu, lansman veya basında yer alma) hazırlayıp bütçe talebini İdare onayına sunmalısınız.</p>
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>
      )}

      {/* ── 5. HEDEFLERİ TAAHHÜT ETME FORMU MODALI (ÖĞRETMEN) ── */}
      {showTaahhutForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }} onClick={e => e.target === e.currentTarget && setShowTaahhutForm(false)}>
          
          <div style={{
            background: '#FFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '1.5rem',
            width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            display: 'flex', flexDirection: 'column', gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1B3A6B', fontWeight: '800' }}>🎯 Performans ve Aidiyet Taahhüt Girişi</h3>
              <button onClick={() => setShowTaahhutForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#94A3B8' }}>✕</button>
            </div>

            <form onSubmit={handleCommitmentSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Temel Hedef */}
              <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1E293B', display: 'block', marginBottom: '6px' }}>🏫 1. Temel Hedef: Resmi Takım & Turnuva Katılımı</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="Turnuva / Proje Adı (Örn: FIRST LEGO League)"
                    value={taahhutFormVeri.turnuvaAdi}
                    onChange={e => setTaahhutFormVeri({ ...taahhutFormVeri, turnuvaAdi: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                  />
                  <textarea
                    rows={2}
                    placeholder="Öğrenci İsimleri (En az 7 öğrenciyi virgülle ayırarak yazın. Örn: Ahmet Y., Mehmet K., Ayşe L...)"
                    value={taahhutFormVeri.ogrenciListesiText}
                    onChange={e => setTaahhutFormVeri({ ...taahhutFormVeri, ogrenciListesiText: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none', resize: 'vertical' }}
                  />
                  <span style={{ fontSize: '0.625rem', color: '#64748B' }}>
                    * Sistem girilen isimlerin virgüllerle ayrılmış en az 7 kişi olup olmadığını kontrol eder.
                  </span>
                </div>
              </div>

              {/* Orta Hedef */}
              <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1E293B', display: 'block', marginBottom: '6px' }}>👥 2. Orta Hedef: Kurum İçi Sinerji ve Ortak Proje</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: '#64748B', display: 'block', marginBottom: '3px' }}>Ortak Çalışılacak Öğretmen</label>
                    <select
                      value={taahhutFormVeri.ortakOgretmen}
                      onChange={e => setTaahhutFormVeri({ ...taahhutFormVeri, ortakOgretmen: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                    >
                      <option value="">Seçiniz (isteğe bağlı)</option>
                      {MOCK_OGRETMENLER.map(t => (
                        <option key={t.id} value={t.id}>{t.ad}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: '#64748B', display: 'block', marginBottom: '3px' }}>Ortak Çalışılacak Proje</label>
                    <select
                      value={taahhutFormVeri.ortakProje}
                      onChange={e => setTaahhutFormVeri({ ...taahhutFormVeri, ortakProje: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                    >
                      <option value="">Seçiniz (isteğe bağlı)</option>
                      {projeler.filter(p => p.id !== selectedProjeId).map(p => (
                        <option key={p.id} value={p.id}>{p.baslik.substring(0, 30)}...</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Üst Hedef */}
              <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1E293B', display: 'block', marginBottom: '6px' }}>📢 3. Üst Hedef: Vitrin, Dış Lansman ve Bütçe Talebi</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.65rem', color: '#64748B', display: 'block', marginBottom: '3px' }}>PR / Çıktı Tipi</label>
                      <select
                        value={taahhutFormVeri.prTipi}
                        onChange={e => setTaahhutFormVeri({ ...taahhutFormVeri, prTipi: e.target.value })}
                        style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                      >
                        <option value="veli_lansmani">Veli Lansmanı</option>
                        <option value="turnuva_katilimi">Resmi Turnuva Katılımı</option>
                        <option value="kalite_etiketi">Kalite Etiketi / PR Haberi</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', color: '#64748B', display: 'block', marginBottom: '3px' }}>Bütçe Talebi (TL)</label>
                      <input
                        type="text"
                        placeholder="Örn: 2500 TL"
                        value={taahhutFormVeri.butceTalebi}
                        onChange={e => setTaahhutFormVeri({ ...taahhutFormVeri, butceTalebi: e.target.value })}
                        style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                      />
                    </div>
                  </div>
                  <input
                    type="url"
                    placeholder="Kanıt PDF / Döküman URL'i (Örn: drive.google.com/...)"
                    value={taahhutFormVeri.kanitUrl}
                    onChange={e => setTaahhutFormVeri({ ...taahhutFormVeri, kanitUrl: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Form Butonları */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowTaahhutForm(false)} style={{ padding: '8px 16px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer', color: '#475569' }}>İptal</button>
                <button type="submit" style={{ padding: '8px 20px', background: '#10B981', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}>Taahhütleri Kaydet</button>
              </div>

            </form>

          </div>

        </div>
      )}

      {/* ── 6. DETAY VE GEÇMİŞ ZAMAN TÜNELİ MODALI ── */}
      {seciliDetayProje && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }} onClick={e => e.target === e.currentTarget && setSeciliDetayProje(null)}>
          
          <div style={{
            background: '#FFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '1.5rem',
            width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            display: 'flex', flexDirection: 'column', gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1B3A6B', fontWeight: '800' }}>🔬 Hedef ve Zaman Tüneli Detayları</h3>
              <button onClick={() => setSeciliDetayProje(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#94A3B8' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1E293B', fontWeight: '800' }}>{seciliDetayProje.baslik}</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>Danışman: <strong>{seciliDetayProje.danisman}</strong> | İlerleme: <strong>%{seciliDetayProje.overallProgress || 0}</strong></p>
              </div>

              {/* Hedef Detayları */}
              {seciliDetayProje.hedefler ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1B3A6B' }}>🎯 Taahhüt Edilen Hedefler</span>
                  
                  {/* Temel */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.75rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '1rem' }}>{seciliDetayProje.hedefler.temelHedef?.tamamlandi ? '✅' : '⬜'}</span>
                    <div>
                      <strong>Temel Katılım:</strong> {seciliDetayProje.hedefler.temelHedef?.tanim} ({seciliDetayProje.hedefler.temelHedef?.turnuvaAdi})
                      <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '2px' }}>
                        Öğrenciler: {seciliDetayProje.hedefler.temelHedef?.ogrenciListesi?.join(', ')}
                      </div>
                    </div>
                  </div>

                  {/* Sinerji */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.75rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '1rem' }}>{seciliDetayProje.hedefler.ortaHedef?.tamamlandi ? '✅' : seciliDetayProje.hedefler.ortaHedef?.istekDurumu === 'pending' ? '⌛' : '⬜'}</span>
                    <div>
                      <strong>Orta Sinerji:</strong> {seciliDetayProje.hedefler.ortaHedef?.tanim}
                      <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '2px' }}>
                        Ortak Öğretmen ID: {seciliDetayProje.hedefler.ortaHedef?.ortakOgretmenId} | Durum: <strong style={{ color: seciliDetayProje.hedefler.ortaHedef?.istekDurumu === 'approved' ? '#10B981' : '#B45309' }}>{seciliDetayProje.hedefler.ortaHedef?.istekDurumu === 'approved' ? 'Zümre Onaylı' : seciliDetayProje.hedefler.ortaHedef?.istekDurumu === 'pending' ? 'Zümre Onayı Bekliyor' : 'Beklemede'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* PR */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.75rem' }}>
                    <span style={{ fontSize: '1rem' }}>{seciliDetayProje.hedefler.ustHedef?.tamamlandi ? '✅' : '⬜'}</span>
                    <div>
                      <strong>Üst Vitrin & PR:</strong> {seciliDetayProje.hedefler.ustHedef?.tanim}
                      <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '2px' }}>
                        PR Tipi: {seciliDetayProje.hedefler.ustHedef?.prTipi} | Bütçe Talebi: <strong style={{ color: '#4F46E5' }}>{seciliDetayProje.hedefler.ustHedef?.bütçeTalebi}</strong>
                      </div>
                      {seciliDetayProje.hedefler.ustHedef?.kanitUrl && (
                        <a href={seciliDetayProje.hedefler.ustHedef.kanitUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.65rem', color: '#4F46E5', textDecoration: 'underline', display: 'block', marginTop: '2px' }}>
                          🔗 Kanıt URL Önizle
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '1.5rem', background: '#FEF3C7', color: '#D97706', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600', border: '1px solid #FDE68A' }}>
                  ⚠️ Bu proje için henüz aidiyet hedefleri taahhüt edilmemiştir.
                </div>
              )}

              {/* Logs Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#475569' }}>📜 Onay ve Değişiklik Zaman Tüneli (Loglar)</span>
                
                {(!seciliDetayProje.logs || seciliDetayProje.logs.length === 0) ? (
                  <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>
                    Kayıtlı herhangi bir geçmiş log kaydı bulunmamaktadır.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#F8FAFC', padding: '10px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    {seciliDetayProje.logs.map((log, index) => (
                      <div key={index} style={{ display: 'flex', justifyBetween: 'space-between', fontSize: '0.7rem', color: '#475569', borderBottom: index < seciliDetayProje.logs.length - 1 ? '1px solid #E2E8F0' : 'none', paddingBottom: '4px', paddingTop: '4px' }}>
                        <span style={{ flex: 1 }}>
                          🕒 {new Date(log.tarih).toLocaleDateString('tr-TR')} {new Date(log.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} - <strong>{log.islem}</strong>
                        </span>
                        <span style={{
                          fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: log.rol === 'idare' ? '#FEE2E2' : log.rol === 'zumre_head' ? '#FEF3C7' : '#EFF6FF',
                          color: log.rol === 'idare' ? '#991B1B' : log.rol === 'zumre_head' ? '#B45309' : '#1E40AF',
                          fontWeight: '800', height: 'fit-content'
                        }}>
                          {log.rol === 'idare' ? 'İdare' : log.rol === 'zumre_head' ? 'Zümre Head' : 'Öğretmen'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '10px', marginTop: '10px' }}>
              <button onClick={() => setSeciliDetayProje(null)} style={{ padding: '8px 20px', background: '#1E40AF', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}>Kapat</button>
            </div>

          </div>

        </div>
      )}

      {/* Spinner Animasyon CSS'i */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />

    </div>
  )
}
