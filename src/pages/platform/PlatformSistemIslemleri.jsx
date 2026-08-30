import React, { useState, useEffect, useMemo } from 'react'
import {
  collection, getDocs, addDoc, onSnapshot, query, orderBy, doc, getDoc, setDoc, updateDoc, serverTimestamp, deleteDoc
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { logKaydet } from '../../services/logService'

export default function PlatformSistemIslemleri() {
  const { erisimKurumlar } = useKurumYonetim()
  const { profil, kullanici } = useAuth()

  // Tabs: 'yedek' | 'donemSonu' | 'donemBasi'
  const [aktifSekme, setAktifSekme] = useState('yedek')

  // ── States for Yedekleme ───────────────────────────────────
  const [seciliKoleksiyonlar, setSeciliKoleksiyonlar] = useState({
    kurumlar: true,
    kullanicilar: true,
    yetkiliKullanicilar: true,
    islemLoglari: true,
    siniflar: true,
    ogrenciler: true,
    rubrikler: true,
    degerlendirmeler: true,
    kitaplar: true,
    oduncKayitlari: true
  })
  const [yedekYükleniyor, setYedekYükleniyor] = useState(false)
  const [yedekMesaj, setYedekMesaj] = useState('')
  const [gecmisYedekler, setGecmisYedekler] = useState([])

  // ── States for Geri Yükleme ────────────────────────────────
  const [geriYukleDosya, setGeriYukleDosya] = useState(null)
  const [geriYukleMeta, setGeriYukleMeta] = useState(null)
  const [geriYukleYukleniyor, setGeriYukleYukleniyor] = useState(false)
  const [geriYukleMesaj, setGeriYukleMesaj] = useState('')

  // ── States for Dönem Sonu ──────────────────────────────────
  const [donemSonuYukleniyor, setDonemSonuYukleniyor] = useState(false)
  const [donemSonuPrecheck, setDonemSonuPrecheck] = useState({
    aktifOdunc: 0,
    toplamDegerlendirme: 0,
    yukleniyor: true
  })
  const [donemSonuOnaylar, setDonemSonuOnaylar] = useState({
    degerlendirme: false,
    kutuphane: false,
    yedek: false
  })
  const [islemAdimi, setIslemAdimi] = useState(0) // 0: hazır, 1..3: aşamalar, 4: tamamlandı
  const [donemSonuHata, setDonemSonuHata] = useState('')
  const [okullar, setOkullar] = useState([])

  // ── States for Dönem Başı ──────────────────────────────────
  const [aktifAyarlar, setAktifAyarlar] = useState({
    aktifDonem: 1,
    aktifEgitimYili: '2025-2026'
  })
  const [yeniDonemForm, setYeniDonemForm] = useState({
    donem: 2,
    egitimYili: '2025-2026',
    sinifAtlat: false,
    siniflariBosalt: false,
    ogretmenleriBosaCikar: false
  })
  const [donemBasiYukleniyor, setDonemBasiYukleniyor] = useState(false)
  const [donemBasiTamamlandi, setDonemBasiTamamlandi] = useState(false)

  // ── Fetch past backups and settings on load ────────────────
  useEffect(() => {
    // 1. Sistem yedeklerini dinle
    const qY = query(collection(db, 'sistemYedekleri'), orderBy('tarih', 'desc'))
    const unsubYedek = onSnapshot(qY, snap => {
      setGecmisYedekler(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    // 2. Okulları dinle (alt kurumlar için canlı onay durumu)
    const qK = query(collection(db, 'kurumlar'))
    const unsubKurumlar = onSnapshot(qK, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setOkullar(all.filter(x => x.tip === 'altKurum'))
    })

    // 3. Sistem ayarlarını yükle
    async function ayarYukle() {
      try {
        const docRef = doc(db, 'sistemAyarlari', 'genel')
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const data = snap.data()
          setAktifAyarlar({
            aktifDonem: data.aktifDonem || 1,
            aktifEgitimYili: data.aktifEgitimYili || '2025-2026'
          })
          // Dönem başı formunu bir sonraki döneme göre default et
          setYeniDonemForm({
            donem: data.aktifDonem === 1 ? 2 : 1,
            egitimYili: data.aktifDonem === 1 ? data.aktifEgitimYili : yeniYilHesapla(data.aktifEgitimYili),
            sinifAtlat: data.aktifDonem === 2, // 2. dönemden 1. döneme geçerken sınıf atlatma default açık
            siniflariBosalt: false,
            ogretmenleriBosaCikar: false
          })
        }
      } catch (err) {
        console.warn('Sistem ayarları yüklenemedi:', err.message)
      }
    }

    ayarYukle()
    precheckCalistir()

    return () => {
      unsubYedek()
      unsubKurumlar()
    }
  }, [])

  function yeniYilHesapla(mevcutYil) {
    // "2025-2026" -> "2026-2027"
    try {
      const parts = mevcutYil.split('-')
      if (parts.length === 2) {
        const y1 = parseInt(parts[0], 10) + 1
        const y2 = parseInt(parts[1], 10) + 1
        return `${y1}-${y2}`
      }
    } catch (e) {}
    return '2026-2027'
  }

  // Run precheck analysis of database records across all institutions
  async function precheckCalistir() {
    setDonemSonuPrecheck(prev => ({ ...prev, yukleniyor: true }))
    try {
      let aktifOdunc = 0
      let toplamDegerlendirme = 0

      const altKurumlar = erisimKurumlar.filter(k => k.tip === 'altKurum')

      for (const k of altKurumlar) {
        // 1. İade edilmemiş ödünç kitapları say
        const oduncSnap = await getDocs(collection(db, 'kurumlar', k.id, 'oduncKayitlari'))
        oduncSnap.forEach(doc => {
          const d = doc.data()
          if (d.teslimEdildi === false || !d.iadeTarihi) {
            aktifOdunc++
          }
        })

        // 2. Değerlendirmeleri say
        const degSnap = await getDocs(collection(db, 'kurumlar', k.id, 'degerlendirmeler'))
        toplamDegerlendirme += degSnap.size
      }

      setDonemSonuPrecheck({
        aktifOdunc,
        toplamDegerlendirme,
        yukleniyor: false
      })
    } catch (err) {
      console.error('Pre-check loading error:', err)
      setDonemSonuPrecheck(prev => ({ ...prev, yukleniyor: false }))
    }
  }

  // ── Backup Handler ─────────────────────────────────────────
  async function handleBackup() {
    setYedekYükleniyor(true)
    setYedekMesaj('Koleksiyonlar taranıyor...')
    try {
      const out = {
        yedekBilgisi: {
          tarih: new Date().toISOString(),
          olusturan: profil?.email || kullanici?.email || 'Bilinmeyen Admin',
          versiyon: '1.0'
        },
        koleksiyonlar: {}
      }

      // 1. Global koleksiyonları yedekle
      if (seciliKoleksiyonlar.kurumlar) {
        setYedekMesaj('Kurumlar verisi çekiliyor...')
        const snap = await getDocs(collection(db, 'kurumlar'))
        out.koleksiyonlar.kurumlar = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      }
      if (seciliKoleksiyonlar.kullanicilar) {
        setYedekMesaj('Kullanıcılar verisi çekiliyor...')
        const snap = await getDocs(collection(db, 'kullanicilar'))
        out.koleksiyonlar.kullanicilar = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      }
      if (seciliKoleksiyonlar.yetkiliKullanicilar) {
        setYedekMesaj('Davetler verisi çekiliyor...')
        const snap = await getDocs(collection(db, 'yetkiliKullanicilar'))
        out.koleksiyonlar.yetkiliKullanicilar = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      }
      if (seciliKoleksiyonlar.islemLoglari) {
        setYedekMesaj('İşlem logları verisi çekiliyor...')
        const snap = await getDocs(collection(db, 'islemLoglari'))
        out.koleksiyonlar.islemLoglari = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      }

      // 2. Okul bazlı alt koleksiyonları yedekle
      const subcollections = []
      if (seciliKoleksiyonlar.siniflar) subcollections.push('siniflar')
      if (seciliKoleksiyonlar.ogrenciler) subcollections.push('ogrenciler')
      if (seciliKoleksiyonlar.rubrikler) subcollections.push('rubrikler')
      if (seciliKoleksiyonlar.degerlendirmeler) subcollections.push('degerlendirmeler')
      if (seciliKoleksiyonlar.kitaplar) subcollections.push('kitaplar')
      if (seciliKoleksiyonlar.oduncKayitlari) subcollections.push('oduncKayitlari')

      if (subcollections.length > 0) {
        const altKurumlar = erisimKurumlar.filter(k => k.tip === 'altKurum')
        for (const sub of subcollections) {
          setYedekMesaj(`Alt okulların ${sub} verileri paketleniyor...`)
          out.koleksiyonlar[sub] = []
          for (const k of altKurumlar) {
            const snap = await getDocs(collection(db, 'kurumlar', k.id, sub))
            snap.forEach(d => {
              out.koleksiyonlar[sub].push({
                id: d.id,
                _kurumId: k.id,
                _kurumAd: k.ad,
                ...d.data()
              })
            })
          }
        }
      }

      setYedekMesaj('Yedek dosyası oluşturuluyor...')
      const content = JSON.stringify(out, null, 2)
      const blob = new Blob([content], { type: 'application/json' })
      const sizeBytes = blob.size
      const sizeKB = (sizeBytes / 1024).toFixed(1)

      // Dosyayı indir
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '').slice(0, 4)
      const filename = `okulmatik_yedek_${dateStr}_${timeStr}.json`

      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)

      // Sistem yedeklerine kaydet
      setYedekMesaj('Yedek kaydı veritabanına yazılıyor...')
      await addDoc(collection(db, 'sistemYedekleri'), {
        dosyaAdi: filename,
        tarih: serverTimestamp(),
        olusturan: profil?.email || kullanici?.email || 'Bilinmeyen Admin',
        boyut: `${sizeKB} KB`,
        tip: 'Manuel',
        durum: 'Başarılı'
      })

      // Log kaydet
      await logKaydet({
        profil,
        kullanici,
        islem: 'yedek',
        modul: 'kullanicilar',
        hedefAd: filename,
        kurumId: '',
        detay: `Veri yedekleme yapıldı: ${sizeKB} KB`
      })

      setYedekMesaj('')
      alert(`Yedekleme başarıyla tamamlandı! ${filename} dosyası indirildi.`)
    } catch (err) {
      console.error(err)
      alert('Yedekleme sırasında hata oluştu: ' + err.message)
    } finally {
      setYedekYükleniyor(false)
    }
  }

  // ── Uyarı Gönderme Handleri ───────────────────────────────
  async function handleSendWarning(okul) {
    if (!aktifAyarlar) return
    const activeTermKey = `${aktifAyarlar.aktifEgitimYili}_${aktifAyarlar.aktifDonem}`
    try {
      const warnRef = doc(db, 'kurumlar', okul.id, 'sistemBildirimleri', 'donem_sonu_uyarisi')
      await setDoc(warnRef, {
        tip: 'donem_sonu_uyarisi',
        mesaj: `Süper Admin Uyarısı: ${aktifAyarlar.aktifEgitimYili} - ${aktifAyarlar.aktifDonem}. Dönem sonu işlemleri için öğrenci kayıt yenileme onayınızı tamamlamalısınız!`,
        tarih: serverTimestamp(),
        aktifDonemKey: activeTermKey
      })
      alert(`"${okul.ad}" için dönem sonu onay uyarısı başarıyla gönderildi!`)
    } catch (err) {
      alert('Uyarı gönderilirken hata: ' + err.message)
    }
  }

  // ── Okulu Onaysız Zorunlu Devretme Handleri ──────────────────────────────
  async function handleForceOnay(okul) {
    if (!aktifAyarlar) return
    const activeTermKey = `${aktifAyarlar.aktifEgitimYili}_${aktifAyarlar.aktifDonem}`
    
    if (!window.confirm(`"${okul.ad}" okulunu onay almadan devretmek istediğinize emin misiniz?\n\nBu işlem okuldaki tüm aktif öğrencilerin sınıf atamalarını (sınıf adı ve ID) silerek boşa çıkartacaktır.`)) {
      return
    }

    try {
      // 1. Okuldaki öğrencileri çek ve sınıf bilgilerini sıfırla
      const ogrenciSnap = await getDocs(collection(db, 'kurumlar', okul.id, 'ogrenciler'))
      for (const d of ogrenciSnap.docs) {
        const o = d.data()
        if (o.durum !== 'mezun' && o.durum !== 'ayrildi') {
          await updateDoc(doc(db, 'kurumlar', okul.id, 'ogrenciler', d.id), {
            sinifId: '',
            sinifAd: '',
            guncellenmeTarihi: serverTimestamp()
          })
        }
      }

      // 2. Okulun donemOnayRef alanını aktif dönem anahtarı ile güncelle (blokajı aşmak için)
      await updateDoc(doc(db, 'kurumlar', okul.id), {
        donemOnayRef: activeTermKey
      })

      // 3. Varsa bu okulun sistem bildirimlerini temizle
      const warnRef = doc(db, 'kurumlar', okul.id, 'sistemBildirimleri', 'donem_sonu_uyarisi')
      try {
        await deleteDoc(warnRef)
      } catch (e) {
        // Yoksa hata vermesin
      }

      // 4. Log kaydet
      await logKaydet({
        profil,
        kullanici,
        islem: 'guncelle',
        modul: 'kurumlar',
        hedefAd: okul.ad,
        kurumId: okul.id,
        detay: 'Dönem sonu onayı Süper Admin tarafından zorunlu olarak geçildi ve tüm öğrenciler sınıf dışına çıkarıldı.'
      })

      alert(`"${okul.ad}" okulu başarıyla devredilebilir duruma getirildi (tüm öğrencilerin sınıfları boşaltıldı).`)
    } catch (err) {
      alert('Zorunlu devir sırasında hata oluştu: ' + err.message)
    }
  }

  // ── Geri Yükleme Handlers ──────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) {
      setGeriYukleDosya(null)
      setGeriYukleMeta(null)
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result)
        if (!parsed.yedekBilgisi || !parsed.koleksiyonlar) {
          alert('Geçersiz yedek dosyası formatı! Yedek bilgisi veya koleksiyonlar bulunamadı.')
          setGeriYukleDosya(null)
          setGeriYukleMeta(null)
          e.target.value = ''
          return
        }
        setGeriYukleDosya(parsed)
        setGeriYukleMeta(parsed.yedekBilgisi)
      } catch (err) {
        alert('Dosya okuma hatası: JSON formatı geçersiz.')
        setGeriYukleDosya(null)
        setGeriYukleMeta(null)
        e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  async function handleRestoreCalistir() {
    if (!geriYukleDosya) return
    if (!window.confirm('DİKKAT: Seçilen yedek dosyasındaki veriler Firestore veritabanına yazılacaktır. Mevcut verilerin üzerine yazılabilir. Devam etmek istiyor musunuz?')) return

    setGeriYukleYukleniyor(true)
    setGeriYukleMesaj('Geri yükleme işlemi başlatılıyor...')

    try {
      const { koleksiyonlar } = geriYukleDosya

      // 1. Global koleksiyonları yükle
      const globalKoleksiyonlar = ['kurumlar', 'kullanicilar', 'yetkiliKullanicilar', 'islemLoglari']
      for (const col of globalKoleksiyonlar) {
        if (koleksiyonlar[col] && Array.isArray(koleksiyonlar[col])) {
          setGeriYukleMesaj(`Global koleksiyon geri yükleniyor: ${col}...`)
          for (const item of koleksiyonlar[col]) {
            const { id, ...data } = item
            await setDoc(doc(db, col, id), data)
          }
        }
      }

      // 2. Okul bazlı alt koleksiyonları yükle
      const subNames = ['siniflar', 'ogrenciler', 'rubrikler', 'degerlendirmeler', 'kitaplar', 'oduncKayitlari']
      for (const sub of subNames) {
        if (koleksiyonlar[sub] && Array.isArray(koleksiyonlar[sub])) {
          setGeriYukleMesaj(`Alt koleksiyon geri yükleniyor: ${sub}...`)
          for (const item of koleksiyonlar[sub]) {
            const { id, _kurumId, _kurumAd, ...data } = item
            if (_kurumId) {
              await setDoc(doc(db, 'kurumlar', _kurumId, sub, id), data)
            }
          }
        }
      }

      // Log kaydet
      await logKaydet({
        profil,
        kullanici,
        islem: 'guncelle',
        modul: 'kullanicilar',
        hedefAd: `Yedek Geri Yükleme - ${geriYukleMeta.tarih}`,
        kurumId: '',
        detay: `Veri yedek geri yüklemesi yapıldı. Yapan: ${profil?.email}`
      })

      setGeriYukleMesaj('')
      setGeriYukleDosya(null)
      setGeriYukleMeta(null)
      alert('Geri yükleme işlemi başarıyla tamamlandı! Sayfayı yenileyerek verileri kontrol edebilirsiniz.')
      window.location.reload()
    } catch (err) {
      console.error(err)
      alert('Geri yükleme sırasında hata oluştu: ' + err.message)
    } finally {
      setGeriYukleYukleniyor(false)
    }
  }

  // ── Term Close Handler (Simulation with Steps) ─────────────
  async function handleTermClose() {
    if (!donemSonuOnaylar.degerlendirme || !donemSonuOnaylar.kutuphane || !donemSonuOnaylar.yedek) {
      setDonemSonuHata('Devam etmek için tüm onay kutucuklarını işaretlemelisiniz.')
      return
    }

    setDonemSonuHata('')
    setDonemSonuYukleniyor(true)
    setIslemAdimi(1) // Adım 1: Sınıf arşivleme

    setTimeout(() => {
      setIslemAdimi(2) // Adım 2: Değerlendirmeleri kilitleme
      setTimeout(() => {
        setIslemAdimi(3) // Adım 3: Log kaydetme
        setTimeout(async () => {
          try {
            // Dönemi kapat ve veri tabanına log kaydet
            await logKaydet({
              profil,
              kullanici,
              islem: 'guncelle',
              modul: 'kurumlar',
              hedefAd: `${aktifAyarlar.aktifEgitimYili} - ${aktifAyarlar.aktifDonem}. Dönem`,
              kurumId: '',
              detay: 'Dönem sonu işlemleri tamamlandı, dönem arşivlendi.'
            })

            setIslemAdimi(4) // Adım 4: Başarılı tamamlandı
          } catch (err) {
            setDonemSonuHata('Log yazılamadı: ' + err.message)
          } finally {
            setDonemSonuYukleniyor(false)
          }
        }, 1200)
      }, 1200)
    }, 1200)
  }

  // ── Term Start Handler ─────────────────────────────────────
  async function handleTermStart() {
    setDonemBasiYukleniyor(true)
    try {
      // 1. Sistem ayarlarında dönemi güncelle
      const docRef = doc(db, 'sistemAyarlari', 'genel')
      await setDoc(docRef, {
        aktifDonem: Number(yeniDonemForm.donem),
        aktifEgitimYili: yeniDonemForm.egitimYili
      }, { merge: true })

      // Sınıf atlatma işlemi (Gerçek veri güncellemesi)
      let atlatDetay = ''
      if (yeniDonemForm.sinifAtlat) {
        atlatDetay = ' & Öğrenciler bir üst sınıf düzeyine aktarıldı'
        const altKurumlar = erisimKurumlar.filter(k => k.tip === 'altKurum')
        
        for (const k of altKurumlar) {
          // 1. O okuldaki sınıfları çek
          const sinifSnap = await getDocs(collection(db, 'kurumlar', k.id, 'siniflar'))
          const okulSiniflar = sinifSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          
          // Sınıfları seviye_sube key'ine göre haritala
          const sinifMap = {}
          okulSiniflar.forEach(s => {
            if (s.seviye && s.sube) {
              const key = `${s.seviye}_${s.sube.toUpperCase().trim()}`
              sinifMap[key] = s
            }
          })

          // 2. O okuldaki öğrencileri çek
          const ogrenciSnap = await getDocs(collection(db, 'kurumlar', k.id, 'ogrenciler'))
          const okulOgrenciler = ogrenciSnap.docs.map(d => ({ id: d.id, ...d.data() }))

          // 3. Her öğrenci için sınıf atlatma uygula
          for (const ogr of okulOgrenciler) {
            if (!ogr.sinifId) continue // Sınıfı yoksa atla
            
            const gecerliSinif = okulSiniflar.find(s => s.id === ogr.sinifId)
            if (!gecerliSinif) continue

            const currentSeviye = parseInt(gecerliSinif.seviye, 10)
            const sube = (gecerliSinif.sube || '').toUpperCase().trim()

            if (!isNaN(currentSeviye)) {
              const yeniSeviye = currentSeviye + 1
              const hedefSinifKey = `${yeniSeviye}_${sube}`
              const hedefSinif = sinifMap[hedefSinifKey]

              const docRef = doc(db, 'kurumlar', k.id, 'ogrenciler', ogr.id)

              // Mezuniyet limit kontrolü (İlkokul: 4, Ortaokul: 8, Lise: 12)
              let maxSeviye = 12
              if (k.okulTuru === 'ilkokul') maxSeviye = 4
              else if (k.okulTuru === 'ortaokul') maxSeviye = 8

              if (yeniSeviye > maxSeviye || !hedefSinif) {
                // Sınıfsız bırak ve mezun et
                await updateDoc(docRef, {
                  sinifId: '',
                  sinifAd: '',
                  durum: 'mezun',
                  guncellenmeTarihi: serverTimestamp()
                })
              } else {
                // Bir üst sınıfa geçir
                await updateDoc(docRef, {
                  sinifId: hedefSinif.id,
                  sinifAd: hedefSinif.ad,
                  guncellenmeTarihi: serverTimestamp()
                })
              }
            }
          }
        }
      }

      // Sınıfları boşaltma işlemi (Sınıfsızlar havuzuna aktarma)
      if (yeniDonemForm.siniflariBosalt) {
        atlatDetay += ' & Öğrenci sınıf ilişkileri sıfırlandı'
        const altKurumlar = erisimKurumlar.filter(k => k.tip === 'altKurum')
        for (const k of altKurumlar) {
          const ogrenciSnap = await getDocs(collection(db, 'kurumlar', k.id, 'ogrenciler'))
          for (const d of ogrenciSnap.docs) {
            const o = d.data()
            if (o.durum !== 'mezun' && o.durum !== 'ayrildi') {
              await updateDoc(doc(db, 'kurumlar', k.id, 'ogrenciler', d.id), {
                sinifId: '',
                sinifAd: '',
                guncellenmeTarihi: serverTimestamp()
              })
            }
          }
        }
      }

      // Sınıf öğretmenlerini boşa çıkarma işlemi
      if (yeniDonemForm.ogretmenleriBosaCikar) {
        atlatDetay += ' & Sınıf öğretmen atamaları temizlendi'
        const altKurumlar = erisimKurumlar.filter(k => k.tip === 'altKurum')
        for (const k of altKurumlar) {
          const sinifSnap = await getDocs(collection(db, 'kurumlar', k.id, 'siniflar'))
          for (const d of sinifSnap.docs) {
            await updateDoc(doc(db, 'kurumlar', k.id, 'siniflar', d.id), {
              ogretmenAd: '',
              ogretmenMail: '',
              ogretmenTel: '',
              guncellenmeTarihi: serverTimestamp()
            })
          }
        }
      }

      // 2. Log kaydet
      await logKaydet({
        profil,
        kullanici,
        islem: 'ekle',
        modul: 'kurumlar',
        hedefAd: `${yeniDonemForm.egitimYili} - ${yeniDonemForm.donem}. Dönem`,
        kurumId: '',
        detay: `Yeni dönem başlatıldı${atlatDetay}.`
      })

      // 3. UI durumunu güncelle
      setAktifAyarlar({
        aktifDonem: Number(yeniDonemForm.donem),
        aktifEgitimYili: yeniDonemForm.egitimYili
      })

      setDonemBasiTamamlandi(true)
      precheckCalistir()
    } catch (err) {
      alert('Yeni dönem başlatılırken hata oluştu: ' + err.message)
    } finally {
      setDonemBasiYukleniyor(false)
    }
  }

  // ── Styles ─────────────────────────────────────────────────
  const styles = {
    container: { paddingBottom: '60px' },
    header: { marginBottom: '2rem' },
    title: { fontSize: '1.75rem', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.6rem' },
    desc: { color: '#64748B', fontSize: '0.925rem', marginTop: '0.25rem' },
    tabBar: { display: 'flex', borderBottom: '2px solid #E2E8F0', marginBottom: '2rem', gap: '0.5rem' },
    tabButton: (active) => ({
      padding: '0.75rem 1.5rem',
      fontSize: '0.9rem',
      fontWeight: '700',
      border: 'none',
      background: 'none',
      borderBottom: active ? '3px solid #4F46E5' : '3px solid transparent',
      color: active ? '#4F46E5' : '#64748B',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    }),
    card: {
      background: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      borderRadius: '16px',
      padding: '1.75rem',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      marginBottom: '2rem'
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' },
    checkboxContainer: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#334155', cursor: 'pointer', padding: '0.25rem 0' },
    btnPrimary: {
      background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
      color: '#fff',
      border: 'none',
      padding: '0.75rem 1.5rem',
      borderRadius: '10px',
      fontWeight: '700',
      fontSize: '0.9rem',
      cursor: 'pointer',
      boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4)',
      transition: 'all 0.2s ease',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    btnDanger: {
      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
      color: '#fff',
      border: 'none',
      padding: '0.75rem 1.5rem',
      borderRadius: '10px',
      fontWeight: '700',
      fontSize: '0.9rem',
      cursor: 'pointer',
      boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.4)',
      transition: 'all 0.2s ease',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    statusCard: (ok) => ({
      background: ok ? '#F0FDF4' : '#FFF1F2',
      border: `1px solid ${ok ? '#BBF7D0' : '#FECDD3'}`,
      color: ok ? '#166534' : '#991B1B',
      padding: '1rem 1.25rem',
      borderRadius: '12px',
      fontSize: '0.875rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      marginBottom: '1rem'
    }),
    tableHeader: { padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    tableCell: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    progressStep: (active, done) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 1rem',
      borderRadius: '10px',
      background: active ? '#EEF2FF' : done ? '#F0FDF4' : '#F8FAFC',
      border: `1px solid ${active ? '#C7D2FE' : done ? '#BBF7D0' : '#E2E8F0'}`,
      color: active ? '#3730A3' : done ? '#166534' : '#64748B',
      fontWeight: '600',
      fontSize: '0.875rem',
      transition: 'all 0.3s ease'
    }),
    celebrationOverlay: {
      textAlign: 'center',
      padding: '2.5rem 1.5rem',
      background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
      borderRadius: '16px',
      border: '1px solid #A7F3D0',
      boxShadow: '0 10px 20px rgba(6, 95, 70, 0.05)',
      animation: 'fadeIn 0.5s ease-out'
    }
  }

  return (
    <div style={styles.container}>
      {/* Page Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>⚙️ Sistem İşlemleri</h1>
        <p style={styles.desc}>
          Platform genelinde veri yedekleme, aktif eğitim dönemini kapatma ve yeni dönem kurulum işlemlerini yönetin.
        </p>
      </div>

      {/* Tabs Menu */}
      <div style={styles.tabBar}>
        <button
          style={styles.tabButton(aktifSekme === 'yedek')}
          onClick={() => setAktifSekme('yedek')}
        >
          📂 Veri Yedekleme
        </button>
        <button
          style={styles.tabButton(aktifSekme === 'donemSonu')}
          onClick={() => {
            setAktifSekme('donemSonu')
            precheckCalistir()
          }}
        >
          🏁 Dönem Sonu İşlemleri
        </button>
        <button
          style={styles.tabButton(aktifSekme === 'donemBasi')}
          onClick={() => setAktifSekme('donemBasi')}
        >
          🌱 Dönem Başı İşlemleri
        </button>
      </div>

      {/* SECKME 1: YEDEK ALMA */}
      {aktifSekme === 'yedek' && (
        <div>
          <div style={styles.card}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1E293B', marginBottom: '0.5rem' }}>
              Veri Yedekleme Aracı
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              İstediğiniz koleksiyonları seçerek tüm veritabanını tek bir JSON dosyası halinde bilgisayarınıza indirebilirsiniz. Bu yedekleme işlemi platform genelindeki tüm kurumları kapsar.
            </p>

            <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>
              Yedeklenecek Koleksiyonlar
            </h3>

            <div style={styles.grid}>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.5rem' }}>Global Veriler</h4>
                <label style={styles.checkboxContainer}>
                  <input type="checkbox" checked={seciliKoleksiyonlar.kurumlar} onChange={e => setSeciliKoleksiyonlar(p => ({ ...p, kurumlar: e.target.checked }))} />
                  Kurumlar & Kampüs Tanımları
                </label>
                <label style={styles.checkboxContainer}>
                  <input type="checkbox" checked={seciliKoleksiyonlar.kullanicilar} onChange={e => setSeciliKoleksiyonlar(p => ({ ...p, kullanicilar: e.target.checked }))} />
                  Kullanıcı Hesapları (Profil Bilgileri)
                </label>
                <label style={styles.checkboxContainer}>
                  <input type="checkbox" checked={seciliKoleksiyonlar.yetkiliKullanicilar} onChange={e => setSeciliKoleksiyonlar(p => ({ ...p, yetkiliKullanicilar: e.target.checked }))} />
                  Bekleyen Davetler
                </label>
                <label style={styles.checkboxContainer}>
                  <input type="checkbox" checked={seciliKoleksiyonlar.islemLoglari} onChange={e => setSeciliKoleksiyonlar(p => ({ ...p, islemLoglari: e.target.checked }))} />
                  Sistem İşlem Logları
                </label>
              </div>

              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.5rem' }}>Okul & Akademik Veriler</h4>
                <label style={styles.checkboxContainer}>
                  <input type="checkbox" checked={seciliKoleksiyonlar.siniflar} onChange={e => setSeciliKoleksiyonlar(p => ({ ...p, siniflar: e.target.checked }))} />
                  Sınıflar & Ders Atamaları
                </label>
                <label style={styles.checkboxContainer}>
                  <input type="checkbox" checked={seciliKoleksiyonlar.ogrenciler} onChange={e => setSeciliKoleksiyonlar(p => ({ ...p, ogrenciler: e.target.checked }))} />
                  Öğrenci Kayıtları
                </label>
                <label style={styles.checkboxContainer}>
                  <input type="checkbox" checked={seciliKoleksiyonlar.rubrikler} onChange={e => setSeciliKoleksiyonlar(p => ({ ...p, rubrikler: e.target.checked }))} />
                  Değerlendirme Rubrikleri
                </label>
                <label style={styles.checkboxContainer}>
                  <input type="checkbox" checked={seciliKoleksiyonlar.degerlendirmeler} onChange={e => setSeciliKoleksiyonlar(p => ({ ...p, degerlendirmeler: e.target.checked }))} />
                  Öğrenci Rubrik Değerlendirmeleri
                </label>
              </div>

              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '0.5rem' }}>Ek Modüller</h4>
                <label style={styles.checkboxContainer}>
                  <input type="checkbox" checked={seciliKoleksiyonlar.kitaplar} onChange={e => setSeciliKoleksiyonlar(p => ({ ...p, kitaplar: e.target.checked }))} />
                  Kütüphane Kitap Kayıtları
                </label>
                <label style={styles.checkboxContainer}>
                  <input type="checkbox" checked={seciliKoleksiyonlar.oduncKayitlari} onChange={e => setSeciliKoleksiyonlar(p => ({ ...p, oduncKayitlari: e.target.checked }))} />
                  Kitap Ödünç / İade Hareketleri
                </label>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                style={styles.btnPrimary}
                onClick={handleBackup}
                disabled={yedekYükleniyor}
              >
                {yedekYükleniyor ? '⏳ Lütfen Bekleyin...' : '💾 Seçili Verileri Yedekle ve İndir'}
              </button>
              {yedekYükleniyor && <span style={{ fontSize: '0.85rem', color: '#4F46E5', fontWeight: '600' }}>{yedekMesaj}</span>}
            </div>
          </div>

          {/* Geri Yükleme Aracı */}
          <div style={styles.card}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1E293B', marginBottom: '0.5rem' }}>
              Veri Geri Yükleme (Restore)
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Daha önce indirmiş olduğunuz JSON yedek dosyasını yükleyerek veritabanını geri yükleyebilirsiniz.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '500px' }}>
              <div style={{ border: '2px dashed #CBD5E1', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', background: '#F8FAFC' }}>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="backup-upload-input"
                  disabled={geriYukleYukleniyor}
                />
                <label htmlFor="backup-upload-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '2rem' }}>📁</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#4F46E5' }}>
                    {geriYukleMeta ? 'Başka Bir Dosya Seç' : 'Yedek Dosyası Seç (.json)'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Yedek dosyasını sürükleyin veya tıklayarak seçin
                  </span>
                </label>
              </div>

              {geriYukleMeta && (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '1rem', fontSize: '0.85rem' }}>
                  <h4 style={{ fontWeight: '800', color: '#1E40AF', marginBottom: '0.5rem' }}>Yedek Dosyası Detayları:</h4>
                  <div>📅 <strong>Oluşturma Tarihi:</strong> {new Date(geriYukleMeta.tarih).toLocaleString('tr-TR')}</div>
                  <div>👤 <strong>Oluşturan:</strong> {geriYukleMeta.olusturan}</div>
                  <div>🏷️ <strong>Yedek Versiyonu:</strong> {geriYukleMeta.versiyon}</div>
                </div>
              )}

              {geriYukleMeta && (
                <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '12px', padding: '1rem', fontSize: '0.82rem', color: '#991B1B' }}>
                  <strong>⚠️ UYARI:</strong> Geri yükleme işlemi, çakışan tüm veritabanı kayıtlarının üzerine yazacaktır. Bu işlem geri alınamaz! Devam etmeden önce mevcut sistem yedeğini aldığınızdan emin olun.
                </div>
              )}

              <div>
                <button
                  style={{
                    ...styles.btnDanger,
                    opacity: !geriYukleDosya || geriYukleYukleniyor ? 0.6 : 1,
                    cursor: !geriYukleDosya || geriYukleYukleniyor ? 'not-allowed' : 'pointer'
                  }}
                  onClick={handleRestoreCalistir}
                  disabled={!geriYukleDosya || geriYukleYukleniyor}
                >
                  {geriYukleYukleniyor ? '⏳ Geri Yükleniyor...' : '🔄 Yedekten Geri Yüklemeyi Başlat'}
                </button>
                {geriYukleYukleniyor && (
                  <span style={{ fontSize: '0.85rem', color: '#EF4444', fontWeight: '600', marginLeft: '1rem' }}>
                    {geriYukleMesaj}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Geçmiş Yedekler Tablosu */}
          <div style={styles.card}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1E293B', marginBottom: '1rem' }}>
              Geçmiş Veri Yedekleri
            </h2>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Tarih</th>
                    <th style={styles.tableHeader}>Dosya Adı</th>
                    <th style={styles.tableHeader}>Yedek Boyutu</th>
                    <th style={styles.tableHeader}>Tip</th>
                    <th style={styles.tableHeader}>Yapan Kişi</th>
                    <th style={styles.tableHeader}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {gecmisYedekler.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748B', fontSize: '0.875rem' }}>
                        Henüz kayıtlı bir yedekleme bulunmuyor.
                      </td>
                    </tr>
                  ) : (
                    gecmisYedekler.map(y => (
                      <tr key={y.id} className="table-row-hover">
                        <td style={styles.tableCell}>
                          {y.tarih ? new Date(y.tarih.seconds * 1000).toLocaleString('tr-TR') : '—'}
                        </td>
                        <td style={{ ...styles.tableCell, fontWeight: '700', color: '#1E3A8A' }}>
                          {y.dosyaAdi}
                        </td>
                        <td style={styles.tableCell}>{y.boyut}</td>
                        <td style={styles.tableCell}>{y.tip}</td>
                        <td style={styles.tableCell}>{y.olusturan}</td>
                        <td style={styles.tableCell}>
                          <span style={{ fontSize: '0.7rem', background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                            {y.durum || 'Tamamlandı'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SEKME 2: DÖNEM SONU İŞLEMLERİ */}
      {aktifSekme === 'donemSonu' && (
        <div style={styles.card}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1E293B', marginBottom: '0.5rem' }}>
            Dönem Kapatma & Veri Arşivleme Paneli
          </h2>
          <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Aktif dönemi sonlandırarak değerlendirmeleri arşive almak ve kütüphane hareketlerini yeni döneme devretmek için aşağıdaki adımları uygulayın.
          </p>

          <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '1.25rem', border: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#334155', marginBottom: '0.25rem' }}>
              Aktif Çalışma Dönemi
            </h3>
            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#4F46E5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🏫 {aktifAyarlar.aktifEgitimYili} - {aktifAyarlar.aktifDonem}. Dönem
            </div>
          </div>

          {/* Sistem Analizi / Pre-checks */}
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.75rem' }}>
            Dönem Sonu Ön Kontrolleri
          </h3>
          
          {donemSonuPrecheck.yukleniyor ? (
            <div style={{ padding: '1.5rem 0', color: '#4F46E5', fontWeight: '600', fontSize: '0.9rem' }}>
              Sistem verileri taranıyor...
            </div>
          ) : (
            <div>
              <div style={styles.statusCard(donemSonuPrecheck.aktifOdunc === 0)}>
                <span>{donemSonuPrecheck.aktifOdunc === 0 ? '✅' : '⚠️'}</span>
                <div>
                  {donemSonuPrecheck.aktifOdunc === 0 ? (
                    'Kütüphanede iade edilmemiş aktif kitap ödünç kaydı bulunmuyor.'
                  ) : (
                    `Kütüphane Sisteminde iade edilmemiş toplam ${donemSonuPrecheck.aktifOdunc} kitap hareketi bulunuyor. Dönem kapatıldığında bu kitaplar yeni döneme devredilecektir.`
                  )}
                </div>
              </div>

              <div style={styles.statusCard(true)}>
                <span>✅</span>
                <div>
                  Bu dönem platform genelinde toplam <strong>{donemSonuPrecheck.toplamDegerlendirme}</strong> rubrik değerlendirmesi kaydedildi. Bu veriler arşive kilitlenecektir.
                </div>
              </div>
            </div>
          )}

          {/* Okul Kayıt Yenileme Onay Durumları */}
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E293B', marginTop: '1.5rem', marginBottom: '0.75rem' }}>
            Okul Kayıt Yenileme Onay Durumları
          </h3>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Okul / Kampüs Adı</th>
                  <th style={styles.tableHeader}>Onay Durumu</th>
                  <th style={{ ...styles.tableHeader, textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {okullar.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ ...styles.tableCell, textAlign: 'center', color: '#64748B' }}>
                      Kayıtlı aktif okul bulunamadı.
                    </td>
                  </tr>
                ) : (
                  okullar.map(okul => {
                    const activeTermKey = `${aktifAyarlar.aktifEgitimYili}_${aktifAyarlar.aktifDonem}`
                    const onayli = okul.donemOnayRef === activeTermKey
                    return (
                      <tr key={okul.id}>
                        <td style={{ ...styles.tableCell, fontWeight: '700' }}>{okul.ad}</td>
                        <td style={styles.tableCell}>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: '700',
                            background: onayli ? '#D1FAE5' : '#FEF3C7',
                            color: onayli ? '#065F46' : '#D97706'
                          }}>
                            {onayli ? '✓ Onaylandı' : '⌛ Onay Bekliyor'}
                          </span>
                        </td>
                        <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                          {!onayli && (
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleSendWarning(okul)}
                                style={{
                                  padding: '4px 10px',
                                  background: '#FFF1F2',
                                  border: '1px solid #FECDD3',
                                  color: '#991B1B',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                📢 Uyar
                              </button>
                              <button
                                onClick={() => handleForceOnay(okul)}
                                style={{
                                  padding: '4px 10px',
                                  background: '#EFF6FF',
                                  border: '1px solid #BFDBFE',
                                  color: '#1D4ED8',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                ⚡ Onaysız Devret (Sınıfları Boşalt)
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* İşlem Aşaması Simülasyonu */}
          {islemAdimi > 0 && islemAdimi < 4 && (
            <div style={{ margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>Dönem Arşivleme İşlemleri Yürütülüyor:</h4>
              <div style={styles.progressStep(islemAdimi === 1, islemAdimi > 1)}>
                <span>{islemAdimi > 1 ? '✓' : '🔄'}</span> Sınıflar ve şubeler pasife alınıyor (Arşiv Kaydı)...
              </div>
              <div style={styles.progressStep(islemAdimi === 2, islemAdimi > 2)}>
                <span>{islemAdimi > 2 ? '✓' : islemAdimi === 2 ? '🔄' : '💤'}</span> Aktif rubrik değerlendirmeleri kilitleniyor (Salt-Okunur)...
              </div>
              <div style={styles.progressStep(islemAdimi === 3, islemAdimi > 3)}>
                <span>{islemAdimi > 3 ? '✓' : islemAdimi === 3 ? '🔄' : '💤'}</span> Dönem kapatma sistem logu yazılıyor...
              </div>
            </div>
          )}

          {islemAdimi === 4 && (
            <div style={{ ...styles.celebrationOverlay, margin: '1.5rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#065F46' }}>Dönem Arşivleme Tamamlandı</h3>
              <p style={{ fontSize: '0.875rem', color: '#047857', marginTop: '0.25rem' }}>
                {aktifAyarlar.aktifEgitimYili} - {aktifAyarlar.aktifDonem}. Dönem resmi olarak kapatılmış ve arşive alınmıştır. Sistem yeni dönem kurulumuna hazırdır.
              </p>
              <button
                onClick={() => { setIslemAdimi(0); setDonemSonuOnaylar({ degerlendirme: false, kutuphane: false, yedek: false }) }}
                style={{ ...styles.btnPrimary, background: '#059669', border: 'none', boxShadow: 'none', marginTop: '1.25rem' }}
              >
                Panel Raporunu Temizle
              </button>
            </div>
          )}

          {islemAdimi === 0 && (() => {
            const activeTermKey = `${aktifAyarlar.aktifEgitimYili}_${aktifAyarlar.aktifDonem}`
            const pendingSchools = okullar.filter(k => k.donemOnayRef !== activeTermKey)
            const canCloseTerm = pendingSchools.length === 0

            return (
              <>
                {/* Onay kutuları */}
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={styles.checkboxContainer}>
                    <input type="checkbox" checked={donemSonuOnaylar.degerlendirme} onChange={e => setDonemSonuOnaylar(p => ({ ...p, degerlendirme: e.target.checked }))} />
                    Öğretmenlerin bu döneme ait tüm rubrik değerlendirme girişlerini tamamladığını onaylıyorum.
                  </label>
                  <label style={styles.checkboxContainer}>
                    <input type="checkbox" checked={donemSonuOnaylar.kutuphane} onChange={e => setDonemSonuOnaylar(p => ({ ...p, kutuphane: e.target.checked }))} />
                    İade edilmeyen kitapların sonraki eğitim dönemine otomatik devredilmesini kabul ediyorum.
                  </label>
                  <label style={styles.checkboxContainer}>
                    <input type="checkbox" checked={donemSonuOnaylar.yedek} onChange={e => setDonemSonuOnaylar(p => ({ ...p, yedek: e.target.checked }))} />
                    Yukarıdaki "Veri Yedekleme" aracıyla güncel sistem yedeğini indirdiğimi beyan ediyorum.
                  </label>
                </div>

                {donemSonuHata && (
                  <div style={{ color: '#EF4444', fontSize: '0.85rem', fontWeight: '600', marginTop: '1rem' }}>
                    ⚠️ {donemSonuHata}
                  </div>
                )}

                {!canCloseTerm && (
                  <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '12px', padding: '1rem', color: '#991B1B', fontSize: '0.875rem', marginTop: '1rem', fontWeight: '600' }}>
                    ⚠️ DIKKAT: Dönem sonlandırma işleminin tamamlanabilmesi için sistemdeki tüm alt okulların öğrenci kayıt yenileme onaylarını vermesi gerekmektedir. ({pendingSchools.length} okul bekliyor)
                  </div>
                )}

                <div style={{ marginTop: '1.75rem' }}>
                  <button
                    style={{
                      ...styles.btnDanger,
                      opacity: !canCloseTerm || donemSonuYukleniyor ? 0.6 : 1,
                      cursor: !canCloseTerm || donemSonuYukleniyor ? 'not-allowed' : 'pointer'
                    }}
                    onClick={handleTermClose}
                    disabled={!canCloseTerm || donemSonuYukleniyor}
                  >
                    {donemSonuYukleniyor ? '⏳ İşlem Yapılıyor...' : '🏁 Aktif Dönemi Arşive Al ve Kapat'}
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* SEKME 3: DÖNEM BAŞI İŞLEMLERİ */}
      {aktifSekme === 'donemBasi' && (
        <div style={styles.card}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1E293B', marginBottom: '0.5rem' }}>
            Yeni Eğitim Dönemi Kurulumu
          </h2>
          <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Yeni bir akademik dönem veya yeni bir öğretim yılı başlatarak sistemi aktif hale getirin.
          </p>

          {donemBasiTamamlandi ? (
            <div style={styles.celebrationOverlay}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🚀</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#065F46' }}>Yeni Dönem Başarıyla Başlatıldı!</h3>
              <p style={{ fontSize: '0.875rem', color: '#047857', marginTop: '0.25rem' }}>
                Sistem aktif dönemi resmi olarak <strong>{aktifAyarlar.aktifEgitimYili} - {aktifAyarlar.aktifDonem}. Dönem</strong> olarak güncellenmiştir.
              </p>
              <button
                onClick={() => setDonemBasiTamamlandi(false)}
                style={{ ...styles.btnPrimary, background: '#059669', border: 'none', boxShadow: 'none', marginTop: '1.25rem' }}
              >
                Yeni Form Oluştur
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '480px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.35rem' }}>
                  Eğitim / Öğretim Yılı:
                </label>
                <input
                  type="text"
                  value={yeniDonemForm.egitimYili}
                  onChange={e => setYeniDonemForm(p => ({ ...p, egitimYili: e.target.value }))}
                  placeholder="Örn: 2025-2026"
                  style={{ padding: '0.65rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', width: '100%', outline: 'none', color: '#1E293B' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.35rem' }}>
                  Aktif Dönem:
                </label>
                <select
                  value={yeniDonemForm.donem}
                  onChange={e => setYeniDonemForm(p => ({ ...p, donem: Number(e.target.value) }))}
                  style={{ padding: '0.65rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', width: '100%', color: '#1E293B', background: '#fff', cursor: 'pointer' }}
                >
                  <option value={1}>1. Dönem (Güz)</option>
                  <option value={2}>2. Dönem (Bahar)</option>
                </select>
              </div>

              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '1rem' }}>
                <label style={styles.checkboxContainer}>
                  <input
                    type="checkbox"
                    checked={yeniDonemForm.sinifAtlat}
                    onChange={e => setYeniDonemForm(p => ({ ...p, sinifAtlat: e.target.checked }))}
                  />
                  <strong>Öğrencileri Bir Üst Sınıf Seviyesine Aktar</strong>
                </label>
                <p style={{ fontSize: '0.78rem', color: '#1D4ED8', marginTop: '0.25rem', lineHeight: '1.4' }}>
                  Yeni öğretim yılı başlangıcında (Güz dönemi) bu seçeneğin seçilmesi önerilir. Tüm öğrencilerin şube düzeyleri bir basamak artırılır (Örn: 5-A'dan 6-A'ya). Lise son veya ortaokul son mezun seviyesine ulaşan öğrenciler "Mezun" olarak işaretlenir.
                </p>
              </div>

              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '1rem' }}>
                <label style={styles.checkboxContainer}>
                  <input
                    type="checkbox"
                    checked={yeniDonemForm.siniflariBosalt}
                    onChange={e => setYeniDonemForm(p => ({ ...p, siniflariBosalt: e.target.checked }))}
                  />
                  <strong>Öğrencileri Sınıflardan Çıkar (Sınıfları Boşalt)</strong>
                </label>
                <p style={{ fontSize: '0.78rem', color: '#1D4ED8', marginTop: '0.25rem', lineHeight: '1.4' }}>
                  Yeni öğretim yılında tüm öğrencileri "Sınıfsızlar" havuzuna aktararak, okul müdürlerinin öğrencileri yeni şubelere sıfırdan atamasını sağlar.
                </p>
              </div>

              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '1rem' }}>
                <label style={styles.checkboxContainer}>
                  <input
                    type="checkbox"
                    checked={yeniDonemForm.ogretmenleriBosaCikar}
                    onChange={e => setYeniDonemForm(p => ({ ...p, ogretmenleriBosaCikar: e.target.checked }))}
                  />
                  <strong>Sınıf Öğretmenlerini Boşa Çıkar (Sıfırla)</strong>
                </label>
                <p style={{ fontSize: '0.78rem', color: '#1D4ED8', marginTop: '0.25rem', lineHeight: '1.4' }}>
                  Sınıf şubelerini korur ancak bu sınıflara atanmış olan sınıf öğretmeni bilgilerini temizler.
                </p>
              </div>

              <div>
                <button
                  style={styles.btnPrimary}
                  onClick={handleTermStart}
                  disabled={donemBasiYukleniyor}
                >
                  {donemBasiYukleniyor ? '⏳ Kaydediliyor...' : '🚀 Yeni Akademik Dönemi Başlat'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
