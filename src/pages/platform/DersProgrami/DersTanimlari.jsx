import React, { useState, useEffect } from 'react'
import { useKurumYonetim } from '../../../contexts/KurumYonetimContext'
import { db } from '../../../services/firebase'
import { collection, onSnapshot, setDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore'

export const BRANSLAR = [
  'Sınıf Öğretmeni', 'Sınıf Öğretmeni / Türkçe', 'Sınıf Öğretmeni / Matematik', 'Sınıf Öğretmeni / Fen Bilimleri', 'Sınıf Öğretmeni / Sosyal Bilgiler',
  'Türkçe', 'Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler',
  'İngilizce', 'Din Kültürü', 'Görsel Sanatlar', 'Müzik', 'Beden Eğitimi',
  'Teknoloji Tasarım', 'Bilişim Teknolojileri', 'Rehber Öğretmen'
]
export const TIPLER = [
  'Zorunlu', 
  'Seçmeli',
  'Seçmeli (İnsan, Toplum ve Bilim)', 
  'Seçmeli (Din, Ahlak ve Değer)', 
  'Seçmeli (Kültür, Sanat ve Spor)', 
  'Kurum Dersi'
]

const MEB_COURSES = [
  // Zorunlu Dersler
  { ad: 'Türkçe', tip: 'Zorunlu', atanabilirBranslar: ['Türkçe', 'Sınıf Öğretmeni / Türkçe'], saatler: { "1": 10, "2": 10, "3": 8, "4": 8, "5": 6, "6": 6, "7": 5, "8": 5 } },
  { ad: 'Matematik', tip: 'Zorunlu', atanabilirBranslar: ['Matematik', 'İlköğretim Matematik', 'Sınıf Öğretmeni / Matematik'], saatler: { "1": 5, "2": 5, "3": 5, "4": 5, "5": 5, "6": 5, "7": 5, "8": 5 } },
  { ad: 'Hayat Bilgisi', tip: 'Zorunlu', atanabilirBranslar: ['Sınıf Öğretmeni'], saatler: { "1": 4, "2": 4, "3": 3 } },
  { ad: 'Fen Bilimleri', tip: 'Zorunlu', atanabilirBranslar: ['Fen Bilimleri', 'Sınıf Öğretmeni / Fen Bilimleri'], saatler: { "3": 3, "4": 3, "5": 4, "6": 4, "7": 4, "8": 4 } },
  { ad: 'Sosyal Bilgiler', tip: 'Zorunlu', atanabilirBranslar: ['Sosyal Bilgiler'], saatler: { "4": 3, "5": 3, "6": 3, "7": 3 } },
  { ad: 'T.C. İnkılap Tarihi ve Atatürkçülük', tip: 'Zorunlu', atanabilirBranslar: ['Sosyal Bilgiler'], saatler: { "8": 2 } },
  { ad: 'Yabancı Dil', tip: 'Zorunlu', atanabilirBranslar: ['İngilizce'], saatler: { "2": 2, "3": 2, "4": 2, "5": 3, "6": 3, "7": 4, "8": 4 } },
  { ad: 'Din Kültürü ve Ahlak Bilgisi', tip: 'Zorunlu', atanabilirBranslar: ['Din Kültürü'], saatler: { "4": 2, "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Görsel Sanatlar', tip: 'Zorunlu', atanabilirBranslar: ['Görsel Sanatlar'], saatler: { "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "7": 1, "8": 1 } },
  { ad: 'Müzik', tip: 'Zorunlu', atanabilirBranslar: ['Müzik'], saatler: { "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "7": 1, "8": 1 } },
  { ad: 'Beden Eğitimi ve Oyun', tip: 'Zorunlu', atanabilirBranslar: ['Sınıf Öğretmeni', 'Beden Eğitimi'], saatler: { "1": 5, "2": 5, "3": 5, "4": 2 } },
  { ad: 'Beden Eğitimi ve Spor', tip: 'Zorunlu', atanabilirBranslar: ['Beden Eğitimi'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Teknoloji ve Tasarım', tip: 'Zorunlu', atanabilirBranslar: ['Teknoloji Tasarım'], saatler: { "7": 2, "8": 2 } },
  { ad: 'Trafik Güvenliği', tip: 'Zorunlu', atanabilirBranslar: ['Sınıf Öğretmeni', 'Sosyal Bilgiler'], saatler: { "4": 1 } },
  { ad: 'İnsan Hakları, Vatandaşlık ve Demokrasi', tip: 'Zorunlu', atanabilirBranslar: ['Sınıf Öğretmeni', 'Sosyal Bilgiler'], saatler: { "4": 2 } },
  { ad: 'Bilişim Teknolojileri ve Yazılım', tip: 'Zorunlu', atanabilirBranslar: ['Bilişim Teknolojileri'], saatler: { "5": 2, "6": 2 } },
  { ad: 'Rehberlik ve Yönlendirme', tip: 'Zorunlu', atanabilirBranslar: ['Rehber Öğretmen'], saatler: { "5": 1, "6": 1, "7": 1, "8": 1 } },
  
  // İnsan, Toplum ve Bilim (Seçmeli)
  { ad: 'Matematik ve Bilim Uygulamaları', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Matematik', 'İlköğretim Matematik', 'Fen Bilimleri'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Okuma Becerileri', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Türkçe'], saatler: { "5": 2, "6": 2 } },
  { ad: 'Yazarlık ve Yazma Becerileri', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Türkçe'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Yaşayan Diller ve Lehçeler', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Türkçe'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Yabancı Dil (Seçmeli)', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['İngilizce'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Çevre Eğitimi ve İklim Değişikliği', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Fen Bilimleri', 'Sosyal Bilgiler'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Şehrimiz ...', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Sosyal Bilgiler'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Hukuk ve Adalet', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Sosyal Bilgiler'], saatler: { "6": 2, "7": 2, "8": 2 } },
  { ad: 'Düşünme Eğitimi', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Sosyal Bilgiler', 'Türkçe', 'Din Kültürü'], saatler: { "7": 2, "8": 2 } },
  { ad: 'Robotik Kodlama', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Bilişim Teknolojileri', 'Matematik', 'Fen Bilimleri'], saatler: { "5": 2, "6": 2 } },
  { ad: 'Yapay Zeka Uygulamaları', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Bilişim Teknolojileri', 'Matematik', 'Fen Bilimleri'], saatler: { "7": 2, "8": 2 } },
  { ad: 'Proje Tasarımı ve Uygulamaları', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Teknoloji Tasarım', 'Fen Bilimleri'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Okul Temelli Sosyal Sorumluluk Çalışmaları', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Sosyal Bilgiler'], saatler: { "6": 2, "7": 2, "8": 2 } },
  { ad: 'Medya Okuryazarlığı', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Sosyal Bilgiler', 'Türkçe', 'Bilişim Teknolojileri'], saatler: { "7": 2, "8": 2 } },
  { ad: 'Afet Bilinci', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Sosyal Bilgiler'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Temel Yaşam Becerileri', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Sınıf Öğretmeni', 'Teknoloji Tasarım'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Türk Sosyal Hayatında Aile', tip: 'Seçmeli (İnsan, Toplum ve Bilim)', atanabilirBranslar: ['Sosyal Bilgiler'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  
  // Din, Ahlak ve Değer (Seçmeli)
  { ad: 'Kur\'an-ı Kerim', tip: 'Seçmeli (Din, Ahlak ve Değer)', atanabilirBranslar: ['Din Kültürü'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Peygamberimizin Hayatı', tip: 'Seçmeli (Din, Ahlak ve Değer)', atanabilirBranslar: ['Din Kültürü'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Temel Dinî Bilgiler', tip: 'Seçmeli (Din, Ahlak ve Değer)', atanabilirBranslar: ['Din Kültürü'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Kültür ve Medeniyetimize Yön Verenler', tip: 'Seçmeli (Din, Ahlak ve Değer)', atanabilirBranslar: ['Din Kültürü'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Ahlak ve Vatandaşlık Eğitimi', tip: 'Seçmeli (Din, Ahlak ve Değer)', atanabilirBranslar: ['Din Kültürü', 'Sosyal Bilgiler'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  
  // Kültür, Sanat ve Spor (Seçmeli)
  { ad: 'Görgü Kuralları ve Nezaket', tip: 'Seçmeli (Kültür, Sanat ve Spor)', atanabilirBranslar: ['Sosyal Bilgiler', 'Türkçe', 'Din Kültürü'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Müzik (Seçmeli)', tip: 'Seçmeli (Kültür, Sanat ve Spor)', atanabilirBranslar: ['Müzik'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Spor ve Fizikî Etkinlikler', tip: 'Seçmeli (Kültür, Sanat ve Spor)', atanabilirBranslar: ['Beden Eğitimi'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Oyun ve Oyun Etkinlikleri', tip: 'Seçmeli (Kültür, Sanat ve Spor)', atanabilirBranslar: ['Beden Eğitimi'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Dijital Sanatlar', tip: 'Seçmeli (Kültür, Sanat ve Spor)', atanabilirBranslar: ['Görsel Sanatlar', 'Bilişim Teknolojileri'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Masal ve Destanlarımız', tip: 'Seçmeli (Kültür, Sanat ve Spor)', atanabilirBranslar: ['Türkçe', 'Sosyal Bilgiler'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Geleneksel Sanatlar', tip: 'Seçmeli (Kültür, Sanat ve Spor)', atanabilirBranslar: ['Görsel Sanatlar'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Halk Oyunları', tip: 'Seçmeli (Kültür, Sanat ve Spor)', atanabilirBranslar: ['Beden Eğitimi'], saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } }
]

const createSlug = (text) => {
  const charMap = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u' };
  let slug = text.trim().toLowerCase().replace(/[çğıöşüÇĞİÖŞÜ]/g, m => charMap[m]);
  slug = slug.replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '_');
  return slug;
}

export default function DersTanimlari() {
  const { secilenKurum } = useKurumYonetim()
  const [dersler, setDersler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)

  // Form States
  const [ad, setAd] = useState('')
  const [brans, setBrans] = useState(BRANSLAR[0])
  const [tip, setTip] = useState(TIPLER[0])
  const [saatler, setSaatler] = useState({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '' })
  
  const [islemYapiliyor, setIslemYapiliyor] = useState(false)
  const [hata, setHata] = useState(null)

  // Düzenleme State'leri
  const [duzenlenenDersId, setDuzenlenenDersId] = useState(null)
  const [seciliBranslar, setSeciliBranslar] = useState([])

  useEffect(() => {
    const q = collection(db, 'sistemDersleri')
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      // Sıralama
      data.sort((a, b) => {
        if (a.tip < b.tip) return 1;
        if (a.tip > b.tip) return -1;
        if (a.ad < b.ad) return -1;
        if (a.ad > b.ad) return 1;
        return 0;
      })
      setDersler(data)
      setYukleniyor(false)
    }, (err) => {
      console.error(err)
      setHata('Hata (Yükleme): ' + err.message)
      setYukleniyor(false)
    })
    return () => unsub()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!ad.trim()) return

    setIslemYapiliyor(true)
    setHata(null)
    
    const docId = `ders_${createSlug(ad)}`;
    const temizSaatler = {}
    Object.keys(saatler).forEach(lvl => {
      if (saatler[lvl] && Number(saatler[lvl]) > 0) {
        temizSaatler[lvl] = Number(saatler[lvl])
      }
    })

    try {
      await setDoc(doc(db, 'sistemDersleri', docId), {
        ad: ad.trim(),
        tip,
        brans, // Primary
        atanabilirBranslar: [brans], // Default fallback for custom courses
        saatler: temizSaatler,
        eklenmeTarihi: serverTimestamp()
      })
      setAd('')
      setSaatler({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '' })
    } catch (error) {
      console.error(error)
      setHata('Hata: ' + error.message)
    } finally {
      setIslemYapiliyor(false)
    }
  }

  const handleSil = async (id) => {
    if (!window.confirm('Bu dersi silmek istediğinize emin misiniz?')) return
    try {
      await deleteDoc(doc(db, 'sistemDersleri', id))
    } catch (error) {
      console.error(error)
      alert('Silinirken hata oluştu.')
    }
  }

  const handleBransGuncelle = async (dersId) => {
    if (!seciliBranslar || seciliBranslar.length === 0) {
      alert('En az bir branş seçmelisiniz.')
      return
    }
    setIslemYapiliyor(true)
    try {
      await updateDoc(doc(db, 'sistemDersleri', dersId), {
        atanabilirBranslar: seciliBranslar
      })
      setDuzenlenenDersId(null)
    } catch (err) {
      console.error(err)
      alert('Güncelleme sırasında hata oluştu.')
    } finally {
      setIslemYapiliyor(false)
    }
  }

  const toggleBrans = (brans) => {
    if (seciliBranslar.includes(brans)) {
      setSeciliBranslar(prev => prev.filter(b => b !== brans))
    } else {
      setSeciliBranslar(prev => [...prev, brans])
    }
  }

  const loadMEBCourses = async () => {
    if (!window.confirm('Eski derslerin tümü SİLİNİP yerine güncel MEB İlkokul/Ortaokul müfredatı (Tüm Zorunlu + Seçmeli Dersler) eklenecektir. Onaylıyor musunuz?')) return
    setIslemYapiliyor(true)
    setHata(null)
    try {
      const snap = await getDocs(collection(db, 'sistemDersleri'))
      for (const d of snap.docs) {
        await deleteDoc(d.ref)
      }
      
      for (const c of MEB_COURSES) {
        const docId = `meb_${createSlug(c.ad)}`
        await setDoc(doc(db, 'sistemDersleri', docId), {
          ad: c.ad,
          tip: c.tip,
          brans: c.atanabilirBranslar[0],
          atanabilirBranslar: c.atanabilirBranslar,
          saatler: c.saatler,
          eklenmeTarihi: serverTimestamp()
        })
      }
      alert('Tüm MEB dersleri (Zorunlu ve Seçmeli) başarıyla sisteme yüklendi!')
    } catch (error) {
      console.error(error)
      setHata('Hata (Yükleme): ' + error.message)
    } finally {
      setIslemYapiliyor(false)
    }
  }

  // Gruplama Mantığı
  const grupluDersler = { 'İlkokul': [], 'Ortaokul': [], 'Tanımsız Kademe': [] }
  dersler.forEach(ders => {
    const s = Object.keys(ders.saatler || {}).map(Number)
    const varIlk = s.some(k => k >= 1 && k <= 4)
    const varOrta = s.some(k => k >= 5 && k <= 8)
    
    if (varIlk) grupluDersler['İlkokul'].push(ders)
    if (varOrta) grupluDersler['Ortaokul'].push(ders)
    if (!varIlk && !varOrta) grupluDersler['Tanımsız Kademe'].push(ders)
  })

  // Gösterim sırası
  const getKurumKademeleri = (kurum) => {
    if (!kurum || !kurum.ad) return ['İlkokul', 'Ortaokul', 'Lise']
    const ad = kurum.ad.toLocaleLowerCase('tr')
    const kademeler = []
    if (ad.includes('ilkokul')) kademeler.push('İlkokul')
    if (ad.includes('ortaokul')) kademeler.push('Ortaokul')
    if (ad.includes('lise')) kademeler.push('Lise')
    
    if (kademeler.length === 0) return ['İlkokul', 'Ortaokul', 'Lise']
    return kademeler
  }

  const aktifKademeler = getKurumKademeleri(secilenKurum)
  
  const KADEME_SIRASI = ['İlkokul', 'Ortaokul', 'Tanımsız Kademe'].filter(k => 
    aktifKademeler.includes(k) || k === 'Tanımsız Kademe'
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Yatay Form Alanı */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1E293B' }}>Yeni Ders Ekle</h3>
          <button 
            onClick={loadMEBCourses} disabled={islemYapiliyor}
            style={{ padding: '0.6rem 1rem', background: '#10B981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: islemYapiliyor ? 'not-allowed' : 'pointer' }}
          >
            MEB Standart Derslerini Yükle
          </button>
        </div>
        
        {hata && <div style={{ padding: '0.75rem', background: '#FEE2E2', color: '#B91C1C', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1rem' }}>{hata}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Ders Adı</label>
              <input 
                type="text" value={ad} onChange={e => setAd(e.target.value)} required placeholder="Örn: Matematik"
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Branş</label>
              <select 
                value={brans} onChange={e => setBrans(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
              >
                {BRANSLAR.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Ders Tipi</label>
              <select 
                value={tip} onChange={e => setTip(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
              >
                {TIPLER.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Haftalık Saatler (Sınıf Seviyesine Göre)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              {[1,2,3,4,5,6,7,8].map(lvl => (
                <div key={lvl} style={{ flex: '1 1 60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>{lvl}. Snf</div>
                  <input 
                    type="number" value={saatler[lvl]} onChange={e => setSaatler({...saatler, [lvl]: e.target.value})} min="0" max="20" placeholder="-"
                    style={{ width: '100%', maxWidth: '60px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', outline: 'none', textAlign: 'center', fontSize: '0.9rem' }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              type="submit" disabled={islemYapiliyor}
              style={{ padding: '0.75rem 2rem', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: islemYapiliyor ? 'not-allowed' : 'pointer' }}
            >
              {islemYapiliyor ? 'Ekleniyor...' : 'Dersi Kaydet'}
            </button>
          </div>
        </form>
      </div>

      {/* Ders Listesi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {yukleniyor ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Yükleniyor...</div>
        ) : dersler.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Henüz ders tanımlanmamış.</div>
        ) : (
          KADEME_SIRASI.map(kademeAd => {
            const liste = grupluDersler[kademeAd]
            if (!liste || liste.length === 0) return null

            // İçeride tipe göre grupla (TIPLER listesindeki sıraya göre)
            return (
              <div key={kademeAd} style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ background: '#F1F5F9', padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#334155' }}>{kademeAd} Dersleri ({liste.length})</h4>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>Ders Adı & Saatler</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', borderBottom: '1px solid #E2E8F0', width: '200px' }}>Branş</th>
                      <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', width: '80px', textAlign: 'center' }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIPLER.map(tipAdi => {
                      const tipDersleri = liste.filter(d => d.tip === tipAdi)
                      if (tipDersleri.length === 0) return null
                      return (
                        <React.Fragment key={tipAdi}>
                          <tr>
                            <td colSpan={3} style={{ padding: '0.75rem 1.5rem', background: '#F8FAFC', color: '#475569', fontWeight: '700', fontSize: '0.85rem', borderBottom: '1px solid #E2E8F0' }}>
                              {tipAdi.toUpperCase()}
                            </td>
                          </tr>
                          {tipDersleri.map(d => (
                            <tr key={d.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '1rem 1.5rem' }}>
                                <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#0F172A' }}>{d.ad}</div>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                  {d.saatler && Object.keys(d.saatler).sort().map(lvl => {
                                    // Sadece bu kademeye ait olan saatleri göster
                                    const l = Number(lvl)
                                    if (kademeAd === 'İlkokul' && (l < 1 || l > 4)) return null;
                                    if (kademeAd === 'Ortaokul' && (l < 5 || l > 8)) return null;
                                    return (
                                      <span key={lvl} style={{ background: '#E2E8F0', color: '#475569', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', fontWeight: '500' }}>
                                        {lvl}.S: {d.saatler[lvl]}s
                                      </span>
                                    )
                                  })}
                                </div>
                              </td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#475569' }}>
                                {duzenlenenDersId === d.id ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.5rem', background: '#fff' }}>
                                      {BRANSLAR.map(b => (
                                        <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer' }}>
                                          <input 
                                            type="checkbox" 
                                            checked={seciliBranslar.includes(b)}
                                            onChange={() => toggleBrans(b)}
                                          />
                                          {b}
                                        </label>
                                      ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button onClick={() => setDuzenlenenDersId(null)} style={{ flex: 1, padding: '0.4rem', background: '#F1F5F9', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>İptal</button>
                                      <button onClick={() => handleBransGuncelle(d.id)} disabled={islemYapiliyor} style={{ flex: 1, padding: '0.4rem', background: '#10B981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Kaydet</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                    <span>{d.atanabilirBranslar ? d.atanabilirBranslar.join(', ') : d.brans}</span>
                                    <button 
                                      onClick={() => {
                                        setDuzenlenenDersId(d.id)
                                        setSeciliBranslar(d.atanabilirBranslar || [d.brans])
                                      }}
                                      style={{ background: 'transparent', border: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}
                                      title="Düzenle"
                                    >
                                      ✏️ Düzenle
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                                <button onClick={() => handleSil(d.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.5rem', fontSize: '1.2rem' }} title="Sil">🗑️</button>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
