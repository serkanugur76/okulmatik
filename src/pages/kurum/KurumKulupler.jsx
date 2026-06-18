import React, { useState, useEffect, useMemo } from 'react'
import {
  collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, query, orderBy, writeBatch
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { logKaydet } from '../../services/logService'

// Rubrikten tüm alt kriterler (düz liste)
function altKriterListesi(rubrik) {
  return (rubrik?.kriterler || []).flatMap(k =>
    (k.altKriterler || []).map(ak => ({ ...ak, anaAd: k.ad, anaId: k.id }))
  )
}

// Ortalama hesapla (tüm alt kriterler üzerinden)
function hesaplaOrt(puanlar, rubrik) {
  const liste = altKriterListesi(rubrik)
  if (!liste.length) return null
  const degerler = liste.map(ak => puanlar?.[ak.id]).filter(v => v > 0)
  if (!degerler.length) return null
  return degerler.reduce((a, b) => a + b, 0) / degerler.length
}

export default function KurumKulupler() {
  const { secilenKurumId, secilenKurum, erisimKurumlar } = useKurumYonetim()
  const { profil, kullanici } = useAuth()

  // Rol kontrolü: admin mi öğretmen mi?
  const adminModu = useMemo(() => {
    return profil?.rol === 'platform_admin' || profil?.rol === 'kurum_admin'
  }, [profil])

  const [aktifTab, setAktifTab] = useState('kulupler') // 'kulupler' | 'yoklama' | 'dersPlani' | 'etkinlikler'
  const [kulupler, setKulupler] = useState([])
  const [ogretmenler, setOgretmenler] = useState([])
  const [ogrenciler, setOgrenciler] = useState([])
  const [rubrikler, setRubrikler] = useState([])
  const [yoklamalar, setYoklamalar] = useState([])
  const [etkinlikler, setEtkinlikler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)

  // Seçili Kulüp (Yoklama, Ders Planı ve Etkinlikler sekmesi için)
  const [seciliKulupId, setSeciliKulupId] = useState('')

  // Modaller
  const [kulupModalAcik, setKulupModalAcik] = useState(false)
  const [ogrenciModalAcik, setOgrenciModalAcik] = useState(false)
  const [etkinlikModalAcik, setEtkinlikModalAcik] = useState(false)

  // Form State'leri
  const [formAd, setFormAd] = useState('')
  const [formTanitim, setFormTanitim] = useState('')
  const [formOkulDuzeyi, setFormOkulDuzeyi] = useState('genel') // ilkokul, ortaokul, lise, genel
  const [formOgretmenler, setFormOgretmenler] = useState([]) // seçilen öğretmen ID'leri
  const [formRubrikler, setFormRubrikler] = useState([]) // seçilen rubrik ID'leri
  const [formKontenjan, setFormKontenjan] = useState('') // kulüp kontenjan sınırı
  const [duzenlenenKulupId, setDuzenlenenKulupId] = useState(null)

  // Materyal Listesi State'leri
  const [materyalModalAcik, setMateryalModalAcik] = useState(false)
  const [materyalTekAd, setMateryalTekAd] = useState('')
  const [materyalTopluMetin, setMateryalTopluMetin] = useState('')
  const [materyalEklemeTipi, setMateryalEklemeTipi] = useState('tek') // 'tek' | 'toplu'

  // Etkinlik Temsilcisi State'leri
  const [temsilciModalAcik, setTemsilciModalAcik] = useState(false)
  const [seciliEtkinlikId, setSeciliEtkinlikId] = useState('')
  const [geciciTemsilciler, setGeciciTemsilciler] = useState([])

  // Rubrik Değerlendirme State'leri
  const [seciliHafta, setSeciliHafta] = useState('')
  const [seciliDegerlendirmeRubrikId, setSeciliDegerlendirmeRubrikId] = useState('')
  const [mevcutDegerlendirmeler, setMevcutDegerlendirmeler] = useState({})
  const [degerlendirmePuanlari, setDegerlendirmePuanlari] = useState({})
  const [degerlendirmeKaydediyor, setDegerlendirmeKaydediyor] = useState(false)

  // Öğrenci Arama & Atama State'leri
  const [ogrenciArama, setOgrenciArama] = useState('')
  const [geciciOgrenciler, setGeciciOgrenciler] = useState([]) // atanan öğrenci ID'leri

  // Talep Akış State'leri
  const [talepModalAcik, setTalepModalAcik] = useState(false)
  const [talepOgrenciId, setTalepOgrenciId] = useState('')
  const [talepTipi, setTalepTipi] = useState('gecis') // 'gecis' | 'cikis'
  const [talepHedefKulupId, setTalepHedefKulupId] = useState('')
  const [talepAciklama, setTalepAciklama] = useState('')

  const [talepler, setTalepler] = useState([])
  const [hedefRedModalAcik, setHedefRedModalAcik] = useState(false)
  const [hedefRedTalepId, setHedefRedTalepId] = useState('')
  const [hedefRedNedeni, setHedefRedNedeni] = useState('kontenjan') // kontenjan, mufredat, malzeme, diger
  const [hedefRedAciklamasi, setHedefRedAciklamasi] = useState('')

  const [idareciRedModalAcik, setIdareciRedModalAcik] = useState(false)
  const [idareciRedTalepId, setIdareciRedTalepId] = useState('')
  const [idareciRedAciklamasi, setIdareciRedAciklamasi] = useState('')

  // Yoklama State'leri
  const [yoklamaTarih, setYoklamaTarih] = useState(new Date().toISOString().split('T')[0])
  const [gelenlerMap, setGelenlerMap] = useState({}) // ogrenciId -> boolean
  const [yoklamaKayitlar, setYoklamaKayitlar] = useState([])

  // Ders Planı Ekleme Formu
  const [yeniDersHafta, setYeniDersHafta] = useState('')
  const [yeniDersKonu, setYeniDersKonu] = useState('')

  // Etkinlik Form State'leri
  const [etkAd, setEtkAd] = useState('')
  const [etkTarih, setEtkTarih] = useState('')
  const [etkTip, setEtkTip] = useState('turnuva') // turnuva, yarisma, sergi, diger
  const [etkAciklama, setEtkAciklama] = useState('')

  const activeTip = useMemo(() => {
    return erisimKurumlar.find(k => k.id === secilenKurumId)?.tip
  }, [erisimKurumlar, secilenKurumId])

  const sorguIds = useMemo(() => {
    if (!secilenKurumId) return []
    
    // 1. Alt kurumları (descendants) bul
    let descendants = []
    if (activeTip === 'kampus') {
      descendants = erisimKurumlar.filter(k => k.parentId === secilenKurumId).map(k => k.id)
    } else if (activeTip === 'kurum') {
      descendants = erisimKurumlar.filter(k => k.rootKurumId === secilenKurumId).map(k => k.id)
    }

    // 2. Üst kurumları (ancestors) bul
    const ancestors = []
    let currId = secilenKurumId
    while (currId) {
      const currObj = erisimKurumlar.find(k => k.id === currId)
      if (!currObj) break
      
      const pId = currObj.parentId
      if (pId && pId !== currId && !ancestors.includes(pId)) {
        ancestors.push(pId)
        currId = pId
      } else {
        const rId = currObj.rootKurumId
        if (rId && rId !== currId && !ancestors.includes(rId)) {
          ancestors.push(rId)
        }
        break
      }
    }

    const uniqueIds = new Set([secilenKurumId, ...descendants, ...ancestors])
    return [...uniqueIds]
  }, [secilenKurumId, erisimKurumlar, activeTip])

  const sorguIdsKey = sorguIds.join(',')

  // Firestore Dinleyicileri (onSnapshot)
  useEffect(() => {
    if (!secilenKurumId || sorguIds.length === 0) return
    setYukleniyor(true)

    // 1. Kulüpleri Dinle
    const unsubKulupler = onSnapshot(collection(db, 'kurumlar', secilenKurumId, 'kulupler'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setKulupler(list)
      // Eğer seçili kulüp yoksa ve liste doluysa ilk kulübü otomatik seç
      if (list.length > 0 && !seciliKulupId) {
        setSeciliKulupId(list[0].id)
      }
      setYukleniyor(false)
    })

    const unsubs = []

    // 2. Öğretmenleri (Kullanıcıları) Dinle (Tüm hiyerarşik kurumlardan)
    const ogrParcalar = {}
    sorguIds.forEach(kid => {
      const unsub = onSnapshot(collection(db, 'kurumlar', kid, 'kullanicilar'), (snap) => {
        ogrParcalar[kid] = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.rol === 'ogretmen')
        const birlesik = [...new Map(Object.values(ogrParcalar).flat().map(o => [o.id, o])).values()]
          .sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
        setOgretmenler(birlesik)
      })
      unsubs.push(unsub)
    })

    // 3. Öğrencileri Dinle (Tüm hiyerarşik kurumlardan)
    const ogrnParcalar = {}
    sorguIds.forEach(kid => {
      const unsub = onSnapshot(collection(db, 'kurumlar', kid, 'ogrenciler'), (snap) => {
        ogrnParcalar[kid] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        const birlesik = [...new Map(Object.values(ogrnParcalar).flat().map(o => [o.id, o])).values()]
          .sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
        setOgrenciler(birlesik)
      })
      unsubs.push(unsub)
    })

    // 4. Rubrikleri Dinle (Tüm hiyerarşik kurumlardan)
    const rubrikParcalar = {}
    sorguIds.forEach(kid => {
      const unsub = onSnapshot(collection(db, 'kurumlar', kid, 'rubrikler'), (snap) => {
        rubrikParcalar[kid] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        const birlesik = [...new Map(Object.values(rubrikParcalar).flat().map(r => [r.id, r])).values()]
          .sort((a, b) => (a.ad || a.baslik || '').localeCompare(b.ad || b.baslik || '', 'tr'))
        setRubrikler(birlesik)
      })
      unsubs.push(unsub)
    })

    // 5. Yoklamaları Dinle
    const unsubYoklamalar = onSnapshot(collection(db, 'kurumlar', secilenKurumId, 'kulupYoklama'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setYoklamalar(list)
    })
    unsubs.push(unsubYoklamalar)

    // 6. Etkinlikleri Dinle
    const unsubEtkinlikler = onSnapshot(collection(db, 'kurumlar', secilenKurumId, 'kulupEtkinlikleri'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setEtkinlikler(list)
    })
    unsubs.push(unsubEtkinlikler)

    // 7. Talepleri Dinle
    const unsubTalepler = onSnapshot(collection(db, 'kurumlar', secilenKurumId, 'kulupTalepleri'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const tA = a.tarih?.seconds || 0
          const tB = b.tarih?.seconds || 0
          return tB - tA
        })
      setTalepler(list)
    })
    unsubs.push(unsubTalepler)

    return () => {
      unsubKulupler()
      unsubs.forEach(u => u())
    }
  }, [secilenKurumId, sorguIdsKey])

  // Öğretmenin sorumlu olduğu kulüpler
  const goruntulenenKulupler = useMemo(() => {
    if (adminModu) return kulupler
    // Öğretmen ise sadece ogretmenIds listesinde kendi uid'si bulunan kulüpleri görsün
    return kulupler.filter(k => k.ogretmenIds && k.ogretmenIds.includes(kullanici?.uid))
  }, [kulupler, adminModu, kullanici])

  // Görüntülenen talepler (rol bazlı)
  const goruntulenenTalepler = useMemo(() => {
    if (adminModu) return talepler
    return talepler.filter(t => 
      t.ogretmenId === kullanici?.uid || 
      (t.hedefKulupId && kulupler.find(k => k.id === t.hedefKulupId)?.ogretmenIds?.includes(kullanici?.uid))
    )
  }, [talepler, adminModu, kullanici, kulupler])

  // Seçili Kulüp Nesnesi
  const seciliKulup = useMemo(() => {
    return kulupler.find(k => k.id === seciliKulupId) || null
  }, [kulupler, seciliKulupId])

  // Seçili kulübün öğrencileri
  const kulupOgrencileri = useMemo(() => {
    if (!seciliKulup || !seciliKulup.ogrenciIds) return []
    return ogrenciler.filter(o => seciliKulup.ogrenciIds.includes(o.id))
  }, [seciliKulup, ogrenciler])

  // Rubrik Değerlendirme useEffect ve Yardımcı Fonksiyonlar
  useEffect(() => {
    if (!secilenKurumId || !seciliKulupId || !seciliHafta || !seciliDegerlendirmeRubrikId) {
      setMevcutDegerlendirmeler({})
      setDegerlendirmePuanlari({})
      return
    }

    const q = query(
      collection(db, 'kurumlar', secilenKurumId, 'kulupDegerlendirmeleri'),
      where('kulupId', '==', seciliKulupId),
      where('hafta', '==', Number(seciliHafta)),
      where('rubrikId', '==', seciliDegerlendirmeRubrikId)
    )

    const unsub = onSnapshot(q, (snap) => {
      const map = {}
      snap.docs.forEach(d => {
        const data = d.data()
        map[data.ogrenciId] = data.puanlar || {}
      })
      setMevcutDegerlendirmeler(map)
      setDegerlendirmePuanlari({})
    }, (err) => {
      console.error('Değerlendirmeler dinlenirken hata:', err)
    })

    return () => unsub()
  }, [secilenKurumId, seciliKulupId, seciliHafta, seciliDegerlendirmeRubrikId])

  function getKulupPuan(ogrenciId, akId) {
    if (degerlendirmePuanlari[ogrenciId]?.hasOwnProperty(akId)) {
      return degerlendirmePuanlari[ogrenciId][akId]
    }
    return mevcutDegerlendirmeler[ogrenciId]?.[akId] || null
  }

  function handleKulupPuanDegis(ogrenciId, akId, puan) {
    setDegerlendirmePuanlari(prev => ({
      ...prev,
      [ogrenciId]: {
        ...(prev[ogrenciId] || {}),
        [akId]: puan ? Number(puan) : null
      }
    }))
  }

  // Yoklama Sayfası Açıldığında Yoklama Durumunu Hazırla
  useEffect(() => {
    if (seciliKulup && kulupOgrencileri.length > 0) {
      // Seçili tarihteki yoklama var mı kontrol et
      const varolan = yoklamalar.find(y => y.kulupId === seciliKulupId && y.tarih === yoklamaTarih)
      const map = {}
      kulupOgrencileri.forEach(o => {
        if (varolan) {
          // Eğer yoklama alınmışsa gelmeyenlerde mi kontrol et
          const gelmedi = varolan.gelmeyenOgrenciler.some(g => g.id === o.id)
          map[o.id] = !gelmedi // gelmediyse false, geldiyse true
        } else {
          // Varsayılan olarak herkes geldi işaretlensin
          map[o.id] = true
        }
      })
      setGelenlerMap(map)
    }
  }, [seciliKulupId, yoklamaTarih, yoklamalar, kulupOgrencileri])

  // Kulüp Ekle / Düzenle Kaydet
  async function handleKulupKaydet(e) {
    e.preventDefault()
    if (!secilenKurumId) return
    if (!formAd) return alert('Lütfen kulüp adını giriniz.')

    const veri = {
      ad: formAd,
      tanitim: formTanitim,
      okulDuzeyi: formOkulDuzeyi,
      kontenjan: formKontenjan ? parseInt(formKontenjan) : null,
      ogretmenIds: formOgretmenler,
      rubrikIds: formRubrikler,
      ogrenciIds: duzenlenenKulupId ? (seciliKulup?.ogrenciIds || []) : [],
      dersPlani: duzenlenenKulupId ? (seciliKulup?.dersPlani || []) : [],
      olusturmaTarihi: serverTimestamp()
    }

    try {
      if (duzenlenenKulupId) {
        await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupler', duzenlenenKulupId), veri)
        await logKaydet('KULÜP', `Kulüp güncellendi: ${formAd}`, profil)
      } else {
        await addDoc(collection(db, 'kurumlar', secilenKurumId, 'kulupler'), veri)
        await logKaydet('KULÜP', `Yeni kulüp oluşturuldu: ${formAd}`, profil)
      }
      setKulupModalAcik(false)
      formTemizle()
    } catch (err) {
      console.error(err)
      alert('Kulüp kaydedilirken bir hata oluştu.')
    }
  }

  // Kulüp Düzenleme Aç
  function handleKulupDuzenle(kulup) {
    setDuzenlenenKulupId(kulup.id)
    setFormAd(kulup.ad)
    setFormTanitim(kulup.tanitim || '')
    setFormOkulDuzeyi(kulup.okulDuzeyi || 'genel')
    setFormKontenjan(kulup.kontenjan || '')
    setFormOgretmenler(kulup.ogretmenIds || [])
    setFormRubrikler(kulup.rubrikIds || [])
    setKulupModalAcik(true)
  }

  // Kulüp Sil
  async function handleKulupSil(id, ad) {
    if (!window.confirm(`"${ad}" kulübünü ve bağlı tüm verilerini silmek istediğinize emin misiniz?`)) return
    try {
      await deleteDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupler', id))
      await logKaydet('KULÜP', `Kulüp silindi: ${ad}`, profil)
    } catch (err) {
      console.error(err)
      alert('Silme işlemi başarısız.')
    }
  }

  function formTemizle() {
    setFormAd('')
    setFormTanitim('')
    setFormOkulDuzeyi('genel')
    setFormKontenjan('')
    setFormOgretmenler([])
    setFormRubrikler([])
    setDuzenlenenKulupId(null)
  }

  // Öğrenci Atamalarını Kaydet
  async function handleOgrenciAtamaKaydet() {
    if (!secilenKurumId || !seciliKulupId) return
    try {
      await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupler', seciliKulupId), {
        ogrenciIds: geciciOgrenciler
      })
      await logKaydet('KULÜP', `"${seciliKulup?.ad}" kulübünün öğrenci listesi güncellendi.`, profil)
      setOgrenciModalAcik(false)
    } catch (err) {
      console.error(err)
      alert('Öğrenci ataması başarısız.')
    }
  }

  // Öğrenci Ekle/Çıkar Checkbox
  function handleOgrenciSecimToggle(id) {
    setGeciciOgrenciler(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Talep Oluştur
  async function handleTalepOlustur(e) {
    e.preventDefault()
    if (!secilenKurumId || !seciliKulupId || !talepOgrenciId) return alert('Lütfen öğrenci seçiniz.')
    if (talepTipi === 'gecis' && !talepHedefKulupId) return alert('Lütfen hedef kulüp seçiniz.')

    const ogr = ogrenciler.find(o => o.id === talepOgrenciId)
    const ogrenciAdSoyad = ogr ? `${ogr.ad} ${ogr.soyad || ''}`.trim() : 'Bilinmeyen Öğrenci'
    const kaynakKulup = kulupler.find(k => k.id === seciliKulupId)
    const hedefKulup = talepTipi === 'gecis' ? kulupler.find(k => k.id === talepHedefKulupId) : null

    if (talepTipi === 'gecis' && hedefKulup) {
      const mevcutOgrenciSayisi = hedefKulup.ogrenciIds?.length || 0
      if (hedefKulup.kontenjan && mevcutOgrenciSayisi >= hedefKulup.kontenjan) {
        return alert(`Seçilen hedef kulübün kontenjanı doludur (${mevcutOgrenciSayisi} / ${hedefKulup.kontenjan}). Geçiş talebi oluşturamazsınız.`)
      }
    }

    const yeniTalep = {
      ogrenciId: talepOgrenciId,
      ogrenciAdSoyad,
      tip: talepTipi,
      kaynakKulupId: seciliKulupId,
      kaynakKulupAd: kaynakKulup?.ad || '',
      hedefKulupId: talepTipi === 'gecis' ? talepHedefKulupId : null,
      hedefKulupAd: talepTipi === 'gecis' ? (hedefKulup?.ad || '') : null,
      aciklama: talepAciklama,
      ogretmenId: kullanici?.uid || '',
      ogretmenAd: profil?.ad || profil?.email || 'Öğretmen',
      durum: talepTipi === 'cikis' ? 'hedef_onayladi' : 'bekliyor',
      tarih: serverTimestamp()
    }

    try {
      await addDoc(collection(db, 'kurumlar', secilenKurumId, 'kulupTalepleri'), yeniTalep)
      await logKaydet('KULÜP_TALEP', `"${ogrenciAdSoyad}" için ${talepTipi === 'gecis' ? `"${hedefKulup?.ad}" kulübüne geçiş` : 'kulüpten çıkış'} talebi oluşturuldu.`, profil)
      setTalepModalAcik(false)
      // Reset form states
      setTalepOgrenciId('')
      setTalepTipi('gecis')
      setTalepHedefKulupId('')
      setTalepAciklama('')
      alert('Talebiniz başarıyla kaydedildi.')
    } catch (err) {
      console.error(err)
      alert('Talep kaydedilirken bir hata oluştu.')
    }
  }

  // Kulüp Rubrik Değerlendirmesini Kaydet
  async function handleKulupDegerlendirmeKaydet() {
    const degisiklikSayisi = Object.keys(degerlendirmePuanlari).length
    if (!secilenKurumId || !seciliKulupId || !seciliHafta || !seciliDegerlendirmeRubrikId || !degisiklikSayisi) return

    setDegerlendirmeKaydediyor(true)
    try {
      const seciliRubrik = rubrikler.find(r => r.id === seciliDegerlendirmeRubrikId)
      const seciliHaftaBilgisi = seciliKulup.dersPlani?.find(h => h.hafta === Number(seciliHafta))

      await Promise.all(
        Object.entries(degerlendirmePuanlari).map(([ogrenciId, yeniPuanlar]) => {
          const birlesik = { ...(mevcutDegerlendirmeler[ogrenciId] || {}) }
          Object.entries(yeniPuanlar).forEach(([akId, p]) => {
            if (p != null) birlesik[akId] = p; else delete birlesik[akId]
          })

          const ogr = kulupOgrencileri.find(o => o.id === ogrenciId)
          const ort = hesaplaOrt(birlesik, seciliRubrik)
          const docId = `${seciliKulupId}_${ogrenciId}_${seciliDegerlendirmeRubrikId}_h${seciliHafta}`

          return setDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupDegerlendirmeleri', docId), {
            kulupId: seciliKulupId,
            kulupAd: seciliKulup.ad || '',
            ogrenciId,
            ogrenciAd: ogr?.ad || '',
            ogrenciSoyad: ogr?.soyad || '',
            rubrikId: seciliDegerlendirmeRubrikId,
            rubrikAd: seciliRubrik?.ad || '',
            hafta: Number(seciliHafta),
            konu: seciliHaftaBilgisi?.konu || '',
            puanlar: birlesik,
            ort: ort != null ? parseFloat(ort.toFixed(2)) : null,
            degerlendiriciId: profil?.uid || '',
            degerlendiriciAd: profil?.ad || profil?.email || '',
            guncellenmeTarihi: serverTimestamp()
          })
        })
      )

      alert('Değerlendirmeler başarıyla kaydedildi.')
      setDegerlendirmePuanlari({})
    } catch (err) {
      console.error(err)
      alert('Değerlendirme kaydedilirken hata oluştu: ' + err.message)
    } finally {
      setDegerlendirmeKaydediyor(false)
    }
  }

  // Hedef Öğretmen Kararı (Kabul/Red)
  async function handleTargetOgretmenKarar(talepId, kabulEdildi) {
    if (!secilenKurumId || !talepId) return
    const talep = talepler.find(t => t.id === talepId)
    if (!talep) return

    try {
      if (kabulEdildi) {
        await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupTalepleri', talepId), {
          durum: 'hedef_onayladi',
          hedefKararTarihi: serverTimestamp()
        })
        await logKaydet('KULÜP_TALEP', `Öğretmen, "${talep.ogrenciAdSoyad}" geçiş talebini kabul etti.`, profil)
        alert('Talep kabul edildi, idarecinin son onayı bekleniyor.')
      } else {
        // Reddetme işlemi için modalı açacağız
        setHedefRedTalepId(talepId)
        setHedefRedNedeni('kontenjan')
        setHedefRedAciklamasi('')
        setHedefRedModalAcik(true)
      }
    } catch (err) {
      console.error(err)
      alert('İşlem sırasında bir hata oluştu.')
    }
  }

  // Hedef Öğretmen Reddetme İşlemini Kaydet
  async function handleHedefRedKaydet(e) {
    e.preventDefault()
    if (!secilenKurumId || !hedefRedTalepId) return
    const talep = talepler.find(t => t.id === hedefRedTalepId)
    if (!talep) return

    try {
      await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupTalepleri', hedefRedTalepId), {
        durum: 'hedef_reddedildi',
        hedefRedNedeni,
        hedefRedAciklamasi,
        hedefKararTarihi: serverTimestamp()
      })
      await logKaydet('KULÜP_TALEP', `Öğretmen, "${talep.ogrenciAdSoyad}" geçiş talebini reddetti. Gerekçe: ${hedefRedNedeni}`, profil)
      setHedefRedModalAcik(false)
      alert('Talep reddedildi.')
    } catch (err) {
      console.error(err)
      alert('İşlem sırasında bir hata oluştu.')
    }
  }

  // İdareci Kararı (Onay/Red)
  async function handleIdareciKarar(talepId, onaylandi) {
    if (!secilenKurumId || !talepId) return
    const talep = talepler.find(t => t.id === talepId)
    if (!talep) return

    if (onaylandi) {
      if (talep.tip === 'gecis' && talep.hedefKulupId) {
        const hedefKulup = kulupler.find(k => k.id === talep.hedefKulupId)
        if (hedefKulup && hedefKulup.kontenjan) {
          const mevcutOgrenciSayisi = hedefKulup.ogrenciIds?.length || 0
          if (mevcutOgrenciSayisi >= hedefKulup.kontenjan) {
            return alert(`Hedef kulübün kontenjanı doludur (${mevcutOgrenciSayisi} / ${hedefKulup.kontenjan}). Geçiş talebini onaylamak için lütfen önce hedef kulübün kontenjan sınırını güncelleyin.`)
          }
        }
      }

      if (!window.confirm(`"${talep.ogrenciAdSoyad}" öğrencisinin kulüp ${talep.tip === 'gecis' ? 'geçişini' : 'çıkışını'} onaylıyor musunuz? Bu işlem otomatik olarak kulüp üyeliklerini güncelleyecektir.`)) return

      try {
        const batch = writeBatch(db)

        // 1. Kaynak kulüpten öğrenciyi çıkar
        const kaynakKulup = kulupler.find(k => k.id === talep.kaynakKulupId)
        if (kaynakKulup) {
          const yeniOgrenciIds = (kaynakKulup.ogrenciIds || []).filter(id => id !== talep.ogrenciId)
          batch.update(doc(db, 'kurumlar', secilenKurumId, 'kulupler', talep.kaynakKulupId), {
            ogrenciIds: yeniOgrenciIds
          })
        }

        // 2. Eğer geçiş ise, hedef kulübe öğrenciyi ekle
        if (talep.tip === 'gecis' && talep.hedefKulupId) {
          const hedefKulup = kulupler.find(k => k.id === talep.hedefKulupId)
          if (hedefKulup) {
            const yeniOgrenciIds = [...new Set([...(hedefKulup.ogrenciIds || []), talep.ogrenciId])]
            batch.update(doc(db, 'kurumlar', secilenKurumId, 'kulupler', talep.hedefKulupId), {
              ogrenciIds: yeniOgrenciIds
            })
          }
        }

        // 3. Talebi onaylandı olarak güncelle
        batch.update(doc(db, 'kurumlar', secilenKurumId, 'kulupTalepleri', talepId), {
          durum: 'onaylandi',
          idareKararTarihi: serverTimestamp()
        })

        await batch.commit()
        await logKaydet('KULÜP_TALEP', `İdareci "${talep.ogrenciAdSoyad}" talebini onayladı ve kulüp geçiş/çıkış işlemini gerçekleştirdi.`, profil)
        alert('İşlem başarıyla tamamlandı, kulüp listeleri güncellendi.')
      } catch (err) {
        console.error(err)
        alert('İşlem sırasında bir veritabanı hatası oluştu.')
      }
    } else {
      // İdareci reddetme modalını aç
      setIdareciRedTalepId(talepId)
      setIdareciRedAciklamasi('')
      setIdareciRedModalAcik(true)
    }
  }

  // İdareci Reddetme İşlemini Kaydet
  async function handleIdareciRedKaydet(e) {
    e.preventDefault()
    if (!secilenKurumId || !idareciRedTalepId) return
    const talep = talepler.find(t => t.id === idareciRedTalepId)
    if (!talep) return

    try {
      await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupTalepleri', idareciRedTalepId), {
        durum: 'idare_reddedildi',
        idareRedAciklamasi,
        idareKararTarihi: serverTimestamp()
      })
      await logKaydet('KULÜP_TALEP', `İdareci, "${talep.ogrenciAdSoyad}" talebini reddetti.`, profil)
      setIdareciRedModalAcik(false)
      alert('Talep reddedildi.')
    } catch (err) {
      console.error(err)
      alert('İşlem sırasında bir hata oluştu.')
    }
  }

  // Materyal Ekle
  async function handleMateryalEkle(e) {
    e.preventDefault()
    if (!secilenKurumId || !seciliKulupId) return
    const kulup = kulupler.find(k => k.id === seciliKulupId)
    if (!kulup) return

    let yeniMateryaller = []
    const ekleyenAd = profil?.ad || profil?.email || 'Öğretmen'
    const tarihStr = new Date().toLocaleDateString('tr-TR')

    if (materyalEklemeTipi === 'tek') {
      if (!materyalTekAd.trim()) return alert('Lütfen materyal adı girin.')
      yeniMateryaller.push({
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
        ad: materyalTekAd.trim(),
        durum: 'taslak',
        ekleyenAd,
        tarih: tarihStr
      })
    } else {
      if (!materyalTopluMetin.trim()) return alert('Lütfen e-tablodan kopyaladığınız satırları yapıştırın.')
      const satirlar = materyalTopluMetin.split('\n')
      satirlar.forEach((satir, i) => {
        const ad = satir.trim()
        if (ad) {
          yeniMateryaller.push({
            id: (Date.now() + i).toString() + '_' + Math.random().toString(36).substr(2, 9),
            ad,
            durum: 'taslak',
            ekleyenAd,
            tarih: tarihStr
          })
        }
      })
    }

    const guncelMateryaller = [...(kulup.materyaller || []), ...yeniMateryaller]

    try {
      await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupler', seciliKulupId), {
        materyaller: guncelMateryaller
      })
      setFormAd('') // reset if needed
      setMateryalTekAd('')
      setMateryalTopluMetin('')
      alert('Materyaller taslak olarak başarıyla eklendi, resmiyet kazanması için idareci onayı bekleniyor.')
    } catch (err) {
      console.error(err)
      alert('Materyal eklenirken hata oluştu.')
    }
  }

  // Materyal Sil
  async function handleMateryalSil(materyalId) {
    if (!secilenKurumId || !seciliKulupId || !materyalId) return
    const kulup = kulupler.find(k => k.id === seciliKulupId)
    if (!kulup) return

    const mat = (kulup.materyaller || []).find(m => m.id === materyalId)
    if (!mat) return

    if (mat.durum === 'onayli' && !adminModu) {
      return alert('Onaylanmış (Resmi) materyaller yalnızca okul idarecileri tarafından silinebilir.')
    }

    if (!window.confirm(`"${mat.ad}" materyalini silmek istediğinize emin misiniz?`)) return

    const guncelMateryaller = (kulup.materyaller || []).filter(m => m.id !== materyalId)

    try {
      await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupler', seciliKulupId), {
        materyaller: guncelMateryaller
      })
    } catch (err) {
      console.error(err)
      alert('Materyal silinirken hata oluştu.')
    }
  }

  // Materyal Onayla
  async function handleMateryalOnayla(materyalId) {
    if (!secilenKurumId || !seciliKulupId || !materyalId) return
    const kulup = kulupler.find(k => k.id === seciliKulupId)
    if (!kulup) return

    const guncelMateryaller = (kulup.materyaller || []).map(m => {
      if (m.id === materyalId) {
        return { ...m, durum: 'onayli' }
      }
      return m
    })

    try {
      await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupler', seciliKulupId), {
        materyaller: guncelMateryaller
      })
      await logKaydet('KULÜP', `"${kulup.ad}" kulübünün bir materyali onaylandı.`, profil)
    } catch (err) {
      console.error(err)
      alert('Materyal onaylanırken hata oluştu.')
    }
  }

  // Tüm Materyalleri Onayla
  async function handleTumMateryalleriOnayla() {
    if (!secilenKurumId || !seciliKulupId) return
    const kulup = kulupler.find(k => k.id === seciliKulupId)
    if (!kulup) return

    const guncelMateryaller = (kulup.materyaller || []).map(m => ({ ...m, durum: 'onayli' }))

    try {
      await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupler', seciliKulupId), {
        materyaller: guncelMateryaller
      })
      await logKaydet('KULÜP', `"${kulup.ad}" kulübünün tüm materyalleri onaylandı.`, profil)
      alert('Tüm materyaller resmi olarak onaylandı.')
    } catch (err) {
      console.error(err)
      alert('Materyaller onaylanırken hata oluştu.')
    }
  }

  // Etkinlik Temsilcisi Kaydet
  async function handleTemsilciSecmeKaydet() {
    if (!secilenKurumId || !seciliEtkinlikId) return
    const etk = etkinlikler.find(e => e.id === seciliEtkinlikId)
    if (!etk) return

    try {
      await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupEtkinlikleri', seciliEtkinlikId), {
        temsilciIds: geciciTemsilciler
      })
      await logKaydet('KULÜP_ETKİNLİK', `"${etk.ad}" etkinliği için temsilci öğrenciler güncellendi.`, profil)
      setTemsilciModalAcik(false)
      alert('Temsilci öğrenciler başarıyla kaydedildi.')
    } catch (err) {
      console.error(err)
      alert('Temsilciler kaydedilirken hata oluştu.')
    }
  }

  // Yoklama Kaydet
  async function handleYoklamaKaydet() {
    if (!secilenKurumId || !seciliKulupId) return
    const gelmeyenler = []
    Object.keys(gelenlerMap).forEach(id => {
      if (!gelenlerMap[id]) {
        const ogr = ogrenciler.find(o => o.id === id)
        if (ogr) {
          gelmeyenler.push({ id: ogr.id, adSoyad: `${ogr.ad} ${ogr.soyad || ''}`.trim() })
        }
      }
    })

    const yoklamaId = `${seciliKulupId}_${yoklamaTarih}`
    const veri = {
      kulupId: seciliKulupId,
      tarih: yoklamaTarih,
      gelmeyenOgrenciler: gelmeyenler,
      yoklamaAlanUid: kullanici?.uid || '',
      yoklamaAlanAd: profil?.ad || profil?.email || 'Öğretmen',
      timestamp: serverTimestamp()
    }

    try {
      await setDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupYoklama', yoklamaId), veri)
      alert('Yoklama başarıyla sisteme kaydedildi ve okul idaresine raporlandı!')
      await logKaydet('KULÜP', `"${seciliKulup?.ad}" kulübü için yoklama alındı. (${yoklamaTarih})`, profil)
    } catch (err) {
      console.error(err)
      alert('Yoklama kaydedilirken hata oluştu.')
    }
  }

  // Ders Planına Konu Ekle
  async function handleDersPlaniEkle(e) {
    e.preventDefault()
    if (!secilenKurumId || !seciliKulupId || !yeniDersHafta || !yeniDersKonu) return

    const plan = seciliKulup.dersPlani || []
    const yeniPlan = [
      ...plan,
      { hafta: parseInt(yeniDersHafta), konu: yeniDersKonu, tamamlandi: false }
    ].sort((a, b) => a.hafta - b.hafta)

    try {
      await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupler', seciliKulupId), {
        dersPlani: yeniPlan
      })
      setYeniDersHafta('')
      setYeniDersKonu('')
    } catch (err) {
      console.error(err)
      alert('Ders planı güncellenemedi.')
    }
  }

  // Ders Planı Konusu Durum Değiştir (Tamamlandı / Tamamlanmadı)
  async function handleDersPlaniTamamlaToggle(index) {
    if (!secilenKurumId || !seciliKulupId) return
    const plan = [...(seciliKulup.dersPlani || [])]
    plan[index].tamamlandi = !plan[index].tamamlandi

    try {
      await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupler', seciliKulupId), {
        dersPlani: plan
      })
    } catch (err) {
      console.error(err)
    }
  }

  // Ders Planından Konu Sil
  async function handleDersPlaniSil(index) {
    if (!window.confirm('Bu haftayı plandan silmek istiyor musunuz?')) return
    if (!secilenKurumId || !seciliKulupId) return
    const plan = [...(seciliKulup.dersPlani || [])].filter((_, i) => i !== index)

    try {
      await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupler', seciliKulupId), {
        dersPlani: plan
      })
    } catch (err) {
      console.error(err)
    }
  }

  // Etkinlik Kaydet
  async function handleEtkinlikKaydet(e) {
    e.preventDefault()
    if (!secilenKurumId || !seciliKulupId || !etkAd || !etkTarih) return

    const veri = {
      kulupId: seciliKulupId,
      ad: etkAd,
      tarih: etkTarih,
      tip: etkTip,
      aciklama: etkAciklama,
      timestamp: serverTimestamp()
    }

    try {
      await addDoc(collection(db, 'kurumlar', secilenKurumId, 'kulupEtkinlikleri'), veri)
      setEtkinlikModalAcik(false)
      setEtkAd('')
      setEtkTarih('')
      setEtkAciklama('')
      await logKaydet('KULÜP', `Kulüp etkinliği eklendi: ${etkAd}`, profil)
    } catch (err) {
      console.error(err)
      alert('Etkinlik kaydedilemedi.')
    }
  }

  // Etkinlik Sil
  async function handleEtkinlikSil(id, ad) {
    if (!window.confirm(`"${ad}" etkinliğini silmek istiyor musunuz?`)) return
    try {
      await deleteDoc(doc(db, 'kurumlar', secilenKurumId, 'kulupEtkinlikleri', id))
    } catch (err) {
      console.error(err)
    }
  }

  // Filtrelenmiş öğrenci listesi (atama modalı için)
  const filtrelenmisOgrenciler = useMemo(() => {
    const metin = ogrenciArama.toLowerCase().trim()
    if (!metin) return ogrenciler
    return ogrenciler.filter(o =>
      `${o.ad} ${o.soyad || ''}`.toLowerCase().includes(metin) ||
      (o.ogrenciNo || '').toString().includes(metin) ||
      (o.sinifAd || '').toLowerCase().includes(metin)
    )
  }, [ogrenciler, ogrenciArama])

  if (yukleniyor) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: '#64748B' }}>
        <span>Kulüp verileri yükleniyor...</span>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Üst Bilgi Başlığı */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1B3A6B', margin: 0 }}>
            🏆 Sosyal Kulüpler Yönetim Modülü
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 0' }}>
            Kurum içi sosyal kulüp tanımlamaları, öğretmen-öğrenci atamaları, yoklama defteri ve etkinlik planlamaları.
          </p>
        </div>

        {/* Tab Seçiciler */}
        <div style={{ display: 'flex', background: '#E2E8F0', padding: '4px', borderRadius: '8px' }}>
          <button onClick={() => setAktifTab('kulupler')}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600',
              cursor: 'pointer', background: aktifTab === 'kulupler' ? '#fff' : 'transparent',
              color: aktifTab === 'kulupler' ? '#1B3A6B' : '#64748B', transition: 'all 0.15s'
            }}>
            🏆 Kulüpler
          </button>
          <button onClick={() => setAktifTab('yoklama')}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600',
              cursor: 'pointer', background: aktifTab === 'yoklama' ? '#fff' : 'transparent',
              color: aktifTab === 'yoklama' ? '#1B3A6B' : '#64748B', transition: 'all 0.15s'
            }}>
            📝 Yoklama Defteri
          </button>
          <button onClick={() => setAktifTab('dersPlani')}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600',
              cursor: 'pointer', background: aktifTab === 'dersPlani' ? '#fff' : 'transparent',
              color: aktifTab === 'dersPlani' ? '#1B3A6B' : '#64748B', transition: 'all 0.15s'
            }}>
            📖 Ders Planı
          </button>
          <button onClick={() => setAktifTab('etkinlikler')}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600',
              cursor: 'pointer', background: aktifTab === 'etkinlikler' ? '#fff' : 'transparent',
              color: aktifTab === 'etkinlikler' ? '#1B3A6B' : '#64748B', transition: 'all 0.15s'
            }}>
            🏁 Etkinlik & Turnuvalar
          </button>
          <button onClick={() => setAktifTab('talepler')}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600',
              cursor: 'pointer', background: aktifTab === 'talepler' ? '#fff' : 'transparent',
              color: aktifTab === 'talepler' ? '#1B3A6B' : '#64748B', transition: 'all 0.15s'
            }}>
            📩 Geçiş Talepleri
          </button>
          <button onClick={() => setAktifTab('degerlendirme')}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600',
              cursor: 'pointer', background: aktifTab === 'degerlendirme' ? '#fff' : 'transparent',
              color: aktifTab === 'degerlendirme' ? '#1B3A6B' : '#64748B', transition: 'all 0.15s'
            }}>
            📊 Rubrik Değerlendirme
          </button>
        </div>
      </div>

      {/* Seçilen kurum doğrulaması */}
      {!secilenKurumId && (
        <div style={{ padding: '2rem', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '12px', textAlign: 'center', color: '#92400E' }}>
          Lütfen sol menünün üst kısmından işlem yapacağınız aktif bir okul seçin.
        </div>
      )}

      {secilenKurumId && (
        <>
          {/* ── TAB 1: KULÜPLER TANIMI ── */}
          {aktifTab === 'kulupler' && (
            <div>
              {adminModu && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                  <button
                    onClick={() => { formTemizle(); setKulupModalAcik(true) }}
                    style={{
                      padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none',
                      borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#11223F'}
                    onMouseLeave={e => e.currentTarget.style.background = '#1B3A6B'}
                  >
                    + Yeni Kulüp Ekle
                  </button>
                </div>
              )}

              {goruntulenenKulupler.length === 0 ? (
                <div style={{ background: '#fff', border: '1px dashed #CBD5E1', borderRadius: '12px', padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏆</div>
                  <h4 style={{ margin: 0, color: '#1E293B' }}>Henüz Kulüp Tanımlanmamış</h4>
                  <p style={{ color: '#64748B', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {adminModu ? 'Yeni kulüp oluşturup öğretmen atamaya başlayın.' : 'Atanmış olduğunuz herhangi bir aktif sosyal kulüp bulunmamaktadır.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
                  {goruntulenenKulupler.map(kulup => {
                    const atananOgretmenIsimleri = ogretmenler
                      .filter(o => kulup.ogretmenIds && kulup.ogretmenIds.includes(o.id))
                      .map(o => o.ad)
                      .join(', ') || 'Atanmamış'

                    return (
                      <div key={kulup.id} style={{
                        background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px',
                        padding: '1.25rem', display: 'flex', flexDirection: 'column',
                        justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#1E293B' }}>{kulup.ad}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                              <span style={{
                                fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', fontWeight: '700',
                                background: kulup.kontenjan && (kulup.ogrenciIds?.length || 0) >= kulup.kontenjan ? '#FEE2E2' : '#F1F5F9',
                                color: kulup.kontenjan && (kulup.ogrenciIds?.length || 0) >= kulup.kontenjan ? '#991B1B' : '#475569',
                              }}>
                                👥 {kulup.ogrenciIds?.length || 0} / {kulup.kontenjan || '∞'} Üye
                              </span>
                              {kulup.okulDuzeyi && (
                                <span style={{
                                  fontSize: '0.65rem', padding: '1px 6px', borderRadius: '999px', fontWeight: '700',
                                  background: kulup.okulDuzeyi === 'ilkokul' ? '#FEF3C7' : kulup.okulDuzeyi === 'ortaokul' ? '#E0F2FE' : kulup.okulDuzeyi === 'lise' ? '#FEE2E2' : '#F1F5F9',
                                  color: kulup.okulDuzeyi === 'ilkokul' ? '#92400E' : kulup.okulDuzeyi === 'ortaokul' ? '#0369A1' : kulup.okulDuzeyi === 'lise' ? '#991B1B' : '#475569',
                                  border: '1px solid',
                                  borderColor: kulup.okulDuzeyi === 'ilkokul' ? '#FDE047' : kulup.okulDuzeyi === 'ortaokul' ? '#7DD3FC' : kulup.okulDuzeyi === 'lise' ? '#FCA5A5' : '#CBD5E1',
                                }}>
                                  {kulup.okulDuzeyi === 'ilkokul' ? '🏫 İlkokul' : kulup.okulDuzeyi === 'ortaokul' ? '🏫 Ortaokul' : kulup.okulDuzeyi === 'lise' ? '🏫 Lise' : '🌍 Genel'}
                                </span>
                              )}
                            </div>
                          </div>

                          <p style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4', minHeight: '40px', margin: '0 0 1rem' }}>
                            {kulup.tanitim || 'Tanıtım açıklaması girilmemiş.'}
                          </p>

                          <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                            <div><strong>🧑‍🏫 Danışman Öğretmen:</strong> {atananOgretmenIsimleri}</div>
                            <div><strong>📋 Ölçme Kriteri (Rubrik):</strong> {
                              rubrikler.filter(r => kulup.rubrikIds && kulup.rubrikIds.includes(r.id)).map(r => r.ad || r.baslik).join(', ') || 'Atanmamış'
                            }</div>
                          </div>
                        </div>

                        {/* Aksiyon Butonları */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                          {adminModu ? (
                            <button
                              onClick={() => {
                                setSeciliKulupId(kulup.id)
                                // Öğrenci atama modalını başlat
                                setGeciciOgrenciler(kulup.ogrenciIds || [])
                                setOgrenciModalAcik(true)
                              }}
                              style={{
                                flex: 1, padding: '0.4rem', fontSize: '0.75rem', background: '#EFF6FF',
                                color: '#1E40AF', border: '1px solid #BFDBFE', borderRadius: '6px',
                                fontWeight: '600', cursor: 'pointer', minWidth: '110px'
                              }}
                            >
                              Öğrencileri Yönet
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSeciliKulupId(kulup.id)
                                setTalepOgrenciId('')
                                setTalepTipi('gecis')
                                setTalepHedefKulupId('')
                                setTalepAciklama('')
                                setTalepModalAcik(true)
                              }}
                              style={{
                                flex: 1, padding: '0.4rem', fontSize: '0.75rem', background: '#F0FDF4',
                                color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '6px',
                                fontWeight: '600', cursor: 'pointer', minWidth: '110px'
                              }}
                            >
                              Geçiş/Çıkış Talebi
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSeciliKulupId(kulup.id)
                              setMateryalTekAd('')
                              setMateryalTopluMetin('')
                              setMateryalEklemeTipi('tek')
                              setMateryalModalAcik(true)
                            }}
                            style={{
                              padding: '0.4rem 0.6rem', fontSize: '0.75rem', background: '#FFF7ED',
                              color: '#C2410C', border: '1px solid #FFEDD5', borderRadius: '6px',
                              fontWeight: '600', cursor: 'pointer'
                            }}
                          >
                            📦 Materyaller
                          </button>

                          {adminModu && (
                            <>
                              <button onClick={() => handleKulupDuzenle(kulup)}
                                style={{
                                  padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#F8FAFC',
                                  color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px',
                                  fontWeight: '600', cursor: 'pointer'
                                }}>
                                Düzenle
                              </button>
                              <button onClick={() => handleKulupSil(kulup.id, kulup.ad)}
                                style={{
                                  padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#FEF2F2',
                                  color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: '6px',
                                  fontWeight: '600', cursor: 'pointer'
                                }}>
                                Sil
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: YOKLAMA DEFTERİ ── */}
          {aktifTab === 'yoklama' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* Sol Kolon: Yoklama Tablosu */}
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select
                      value={seciliKulupId}
                      onChange={e => setSeciliKulupId(e.target.value)}
                      style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#1B3A6B' }}
                    >
                      <option value="">— Kulüp Seçin —</option>
                      {goruntulenenKulupler.map(k => (
                        <option key={k.id} value={k.id}>{k.ad}</option>
                      ))}
                    </select>

                    <input
                      type="date"
                      value={yoklamaTarih}
                      onChange={e => setYoklamaTarih(e.target.value)}
                      style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
                    />
                  </div>
                  
                  {seciliKulup && (
                    <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '600' }}>
                      Toplam: {kulupOgrencileri.length} Öğrenci
                    </span>
                  )}
                </div>

                {!seciliKulupId ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8', fontSize: '0.85rem' }}>
                    Lütfen yoklama listesini görüntülemek için üst kısımdan bir kulüp seçin.
                  </div>
                ) : kulupOgrencileri.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8', fontSize: '0.85rem' }}>
                    Bu kulübe henüz hiç öğrenci ataması yapılmamış.
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {kulupOgrencileri.map(o => {
                        const geldiMi = gelenlerMap[o.id] !== false // undefined/true ise geldi kabul et
                        return (
                          <div key={o.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0.65rem 0.85rem', background: geldiMi ? '#F8FAFC' : '#FFF5F5',
                            border: geldiMi ? '1px solid #F1F5F9' : '1px solid #FEE2E2', borderRadius: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: geldiMi ? '#E0F2FE' : '#FEE2E2',
                                color: geldiMi ? '#0369A1' : '#B91C1C',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: '700'
                              }}>
                                {o.ad[0].toUpperCase()}
                              </div>
                              <div>
                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1E293B' }}>{o.ad} {o.soyad || ''}</span>
                                <span style={{ fontSize: '0.7rem', color: '#64748B', marginLeft: '8px' }}>
                                  No: {o.ogrenciNo || '—'} · Sınıf: {o.sinifAd || '—'}
                                </span>
                              </div>
                            </div>

                            {/* Geldi/Gelmedi Buton Grubu */}
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => setGelenlerMap(prev => ({ ...prev, [o.id]: true }))}
                                style={{
                                  padding: '3px 10px', fontSize: '0.75rem', border: 'none', borderRadius: '5px',
                                  cursor: 'pointer', fontWeight: '700',
                                  background: geldiMi ? '#10B981' : '#E2E8F0',
                                  color: geldiMi ? '#fff' : '#64748B'
                                }}
                              >
                                Geldi
                              </button>
                              <button
                                onClick={() => setGelenlerMap(prev => ({ ...prev, [o.id]: false }))}
                                style={{
                                  padding: '3px 10px', fontSize: '0.75rem', border: 'none', borderRadius: '5px',
                                  cursor: 'pointer', fontWeight: '700',
                                  background: !geldiMi ? '#EF4444' : '#E2E8F0',
                                  color: !geldiMi ? '#fff' : '#64748B'
                                }}
                              >
                                Gelmedi
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <button
                      onClick={handleYoklamaKaydet}
                      style={{
                        marginTop: '1.25rem', width: '100%', padding: '0.6rem',
                        background: '#10B981', color: '#fff', border: 'none',
                        borderRadius: '8px', fontWeight: '700', cursor: 'pointer',
                        fontSize: '0.85rem', transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                      onMouseLeave={e => e.currentTarget.style.background = '#10B981'}
                    >
                      Yoklama Defterini Kaydet & İdareye Raporla
                    </button>
                  </div>
                )}
              </div>

              {/* Sağ Kolon: Geçmiş Yoklama Kayıtları */}
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#1E293B' }}>
                  🗒️ Geçmiş Yoklama Raporları
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>
                  Okul idaresi ve öğretmenler tarafından alınmış geçmiş yoklamalar.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                  {yoklamalar.filter(y => y.kulupId === seciliKulupId).length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontStyle: 'italic' }}>
                      Kayıtlı yoklama arşivi bulunamadı.
                    </div>
                  ) : (
                    yoklamalar
                      .filter(y => y.kulupId === seciliKulupId)
                      .sort((a, b) => b.tarih.localeCompare(a.tarih))
                      .map(y => (
                        <div key={y.id} style={{
                          padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: '6px',
                          border: '1px solid #E2E8F0', fontSize: '0.75rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#1B3A6B' }}>
                            <span>📅 {y.tarih}</span>
                            <span>Gelmedi: {y.gelmeyenOgrenciler?.length || 0}</span>
                          </div>
                          <div style={{ color: '#64748B', marginTop: '2px' }}>Alan: {y.yoklamaAlanAd}</div>
                          {y.gelmeyenOgrenciler?.length > 0 && (
                            <div style={{ marginTop: '4px', paddingLeft: '6px', borderLeft: '2px solid #EF4444', color: '#991B1B' }}>
                              {y.gelmeyenOgrenciler.map(g => g.adSoyad).join(', ')}
                            </div>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: DERS PLANI ── */}
          {aktifTab === 'dersPlani' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* Sol Kolon: Kazanım Plan Listesi */}
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#1E293B', fontWeight: '700' }}>
                  📖 Yıllık Ders & Kazanım Planı
                </h3>

                {!seciliKulupId ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8', fontSize: '0.85rem' }}>
                    Ders planını görüntülemek için bir kulüp seçin.
                  </div>
                ) : !seciliKulup?.dersPlani || seciliKulup.dersPlani.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8', fontSize: '0.85rem', border: '1px dashed #E2E8F0', borderRadius: '8px' }}>
                    Kayıtlı ders planı bulunmuyor. Sağdaki formu kullanarak haftalık planlar ekleyin.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {seciliKulup.dersPlani.map((ders, index) => (
                      <div key={index} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.75rem', background: ders.tamamlandi ? '#F0FDF4' : '#F8FAFC',
                        border: ders.tamamlandi ? '1px solid #BBF7D0' : '1px solid #E2E8F0', borderRadius: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            fontSize: '0.75rem', fontWeight: '800', background: '#1B3A6B',
                            color: '#fff', padding: '2px 8px', borderRadius: '4px'
                          }}>
                            Hafta {ders.hafta}
                          </span>
                          <span style={{
                            fontSize: '0.85rem', color: '#1E293B',
                            textDecoration: ders.tamamlandi ? 'line-through' : 'none',
                            fontWeight: ders.tamamlandi ? '400' : '600'
                          }}>
                            {ders.konu}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', color: '#475569' }}>
                            <input
                              type="checkbox"
                              checked={ders.tamamlandi}
                              onChange={() => handleDersPlaniTamamlaToggle(index)}
                            />
                            Tamamlandı
                          </label>
                          <button
                            onClick={() => handleDersPlaniSil(index)}
                            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sağ Kolon: Yeni Konu Ekle */}
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.85rem', fontSize: '0.95rem', color: '#1E293B', fontWeight: '700' }}>
                  ➕ Plana Konu Ekle
                </h3>
                
                {!seciliKulupId ? (
                  <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: 0, fontStyle: 'italic' }}>
                    İşlem yapmak için kulüp seçiniz.
                  </p>
                ) : (
                  <form onSubmit={handleDersPlaniEkle} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                      Hafta Sayısı:
                      <input
                        type="number"
                        min="1"
                        max="40"
                        placeholder="Örn: 1, 2, 3..."
                        value={yeniDersHafta}
                        onChange={e => setYeniDersHafta(e.target.value)}
                        style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }}
                        required
                      />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                      Ders / Etkinlik Konusu:
                      <textarea
                        placeholder="Bu hafta ne işlenecek?"
                        value={yeniDersKonu}
                        onChange={e => setYeniDersKonu(e.target.value)}
                        style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem', minHeight: '60px', resize: 'vertical' }}
                        required
                      />
                    </label>

                    <button
                      type="submit"
                      style={{
                        padding: '0.5rem', background: '#1B3A6B', color: '#fff', border: 'none',
                        borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      Ders Planına Ekle
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 4: ETKİNLİKLER VE TURNUVALAR ── */}
          {aktifTab === 'etkinlikler' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* Sol Kolon: Etkinlikler Listesi */}
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#1E293B', fontWeight: '700' }}>
                    🏆 Kulüp Etkinlikleri, Turnuva ve Yarışmalar
                  </h3>
                  {seciliKulupId && (
                    <button onClick={() => setEtkinlikModalAcik(true)}
                      style={{
                        padding: '0.4rem 0.85rem', background: '#10B981', color: '#fff', border: 'none',
                        borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
                      }}>
                      + Etkinlik Ekle
                    </button>
                  )}
                </div>

                {!seciliKulupId ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8', fontSize: '0.85rem' }}>
                    Etkinlikleri listelemek için bir kulüp seçin.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {etkinlikler.filter(e => e.kulupId === seciliKulupId).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        Bu kulüp için planlanmış bir etkinlik veya turnuva bulunmuyor.
                      </div>
                    ) : (
                      etkinlikler
                        .filter(e => e.kulupId === seciliKulupId)
                        .map(etk => (
                          <div key={etk.id} style={{
                            padding: '1rem', background: '#F8FAFC', border: '1px solid #E2E8F0',
                            borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{
                                  fontSize: '0.7rem', padding: '2px 8px', background: '#EEF2F6',
                                  color: '#334155', borderRadius: '999px', fontWeight: '700', textTransform: 'uppercase'
                                }}>
                                  {etk.tip === 'turnuva' ? '🏆 Turnuva' : etk.tip === 'yarisma' ? '🏁 Yarışma' : etk.tip === 'sergi' ? '🎨 Sergi' : '📅 Etkinlik'}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>📅 {etk.tarih}</span>
                              </div>
                              <h4 style={{ margin: '0 0 4px', fontSize: '0.9rem', color: '#1B3A6B', fontWeight: '700' }}>{etk.ad}</h4>
                              <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: '1.4' }}>{etk.aciklama}</p>

                              {/* Temsilci Listesi */}
                              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#1B3A6B' }}>
                                  🏆 Katılacak Temsilciler:
                                </span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                  {(!etk.temsilciIds || etk.temsilciIds.length === 0) ? (
                                    <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontStyle: 'italic' }}>Temsilci seçilmemiş.</span>
                                  ) : (
                                    ogrenciler
                                      .filter(o => etk.temsilciIds.includes(o.id))
                                      .map(o => (
                                        <span key={o.id} style={{ fontSize: '0.7rem', background: '#EFF6FF', color: '#1E40AF', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                          👤 {o.ad} {o.soyad || ''}
                                        </span>
                                      ))
                                  )}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', marginLeft: '12px' }}>
                              <button
                                onClick={() => {
                                  setSeciliEtkinlikId(etk.id)
                                  setGeciciTemsilciler(etk.temsilciIds || [])
                                  setTemsilciModalAcik(true)
                                }}
                                style={{
                                  padding: '4px 10px', fontSize: '0.72rem', background: '#EFF6FF',
                                  color: '#1E40AF', border: '1px solid #BFDBFE', borderRadius: '6px',
                                  fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap'
                                }}
                              >
                                🏆 Temsilci Seç
                              </button>
                              <button
                                onClick={() => handleEtkinlikSil(etk.id, etk.ad)}
                                style={{
                                  background: 'none', border: 'none', color: '#EF4444',
                                  fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer'
                                }}
                              >
                                Sil
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>

              {/* Sağ Kolon: Rehber Bilgisi */}
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '1rem', display: 'flex', gap: '0.75rem' }}>
                <div style={{ fontSize: '1.5rem' }}>💡</div>
                <div style={{ fontSize: '0.8rem', color: '#1E40AF', lineHeight: '1.4' }}>
                  <strong>Etkinlik ve Turnuva Planlama:</strong> Kulüp içindeki satranç turnuvaları, robotik yarışmaları, resim sergileri gibi olayları buradan tanımlayarak kulübün aktif faaliyet takvimini oluşturabilir ve okul idaresine raporlayabilirsiniz.
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 5: GEÇİŞ & ÇIKIŞ TALEPLERİ ── */}
          {aktifTab === 'talepler' && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1B3A6B', fontWeight: '700' }}>
                  📩 Kulüp Geçiş ve Çıkış Talepleri
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '600', padding: '2px 8px', background: '#F1F5F9', borderRadius: '999px' }}>
                  Toplam: {goruntulenenTalepler.length} Talep
                </span>
              </div>

              {goruntulenenTalepler.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#94A3B8', fontSize: '0.85rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✉️</div>
                  Kayıtlı herhangi bir geçiş veya çıkış talebi bulunmuyor.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Tarih</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Öğrenci</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Talep Tipi</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Kaynak Kulüp</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Hedef Kulüp</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Talep Eden</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Açıklama</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Durum</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Aksiyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goruntulenenTalepler.map(t => {
                        const tarihStr = t.tarih?.toDate ? t.tarih.toDate().toLocaleString('tr-TR') : '—'
                        const isTargetTeacher = t.hedefKulupId && kulupler.find(k => k.id === t.hedefKulupId)?.ogretmenIds?.includes(kullanici?.uid)

                        // Durum Rozeti Renk ve Yazısı
                        let durumBadge = null
                        if (t.durum === 'bekliyor') {
                          durumBadge = (
                            <span style={{ padding: '4px 8px', background: '#FEF3C7', color: '#D97706', borderRadius: '6px', fontWeight: '700', fontSize: '0.72rem' }}>
                              ⏳ Öğretmen Kararı Bekleniyor
                            </span>
                          )
                        } else if (t.durum === 'hedef_onayladi') {
                          durumBadge = (
                            <span style={{ padding: '4px 8px', background: '#DBEAFE', color: '#2563EB', borderRadius: '6px', fontWeight: '700', fontSize: '0.72rem' }}>
                              ⏳ İdare Onayı Bekleniyor
                            </span>
                          )
                        } else if (t.durum === 'hedef_reddedildi') {
                          const gerekceMap = {
                            kontenjan: 'Kontenjan Sınırı',
                            mufredat: 'Müfredat İlerleme Seviyesi',
                            malzeme: 'Malzeme Yetersizliği',
                            diger: 'Diğer Nedenler'
                          }
                          durumBadge = (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ alignSelf: 'flex-start', padding: '4px 8px', background: '#FEE2E2', color: '#DC2626', borderRadius: '6px', fontWeight: '700', fontSize: '0.72rem' }}>
                                ❌ Öğretmen Reddetti
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#991B1B', fontStyle: 'italic' }}>
                                Gerekçe: {gerekceMap[t.hedefRedNedeni] || 'Bilinmiyor'}
                                {t.hedefRedAciklamasi && ` (${t.hedefRedAciklamasi})`}
                              </span>
                            </div>
                          )
                        } else if (t.durum === 'onaylandi') {
                          durumBadge = (
                            <span style={{ padding: '4px 8px', background: '#D1FAE5', color: '#059669', borderRadius: '6px', fontWeight: '700', fontSize: '0.72rem' }}>
                              ✅ Onaylandı / Tamamlandı
                            </span>
                          )
                        } else if (t.durum === 'idare_reddedildi') {
                          durumBadge = (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ alignSelf: 'flex-start', padding: '4px 8px', background: '#FEE2E2', color: '#B91C1C', borderRadius: '6px', fontWeight: '700', fontSize: '0.72rem' }}>
                                ❌ İdare Reddetti
                              </span>
                              {t.idareRedAciklamasi && (
                                <span style={{ fontSize: '0.7rem', color: '#991B1B', fontStyle: 'italic' }}>
                                  Neden: {t.idareRedAciklamasi}
                                </span>
                              )}
                            </div>
                          )
                        }

                        return (
                          <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '12px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{tarihStr}</td>
                            <td style={{ padding: '12px 10px', fontWeight: '600', color: '#1E293B' }}>{t.ogrenciAdSoyad}</td>
                            <td style={{ padding: '12px 10px' }}>
                              <span style={{
                                padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700',
                                background: t.tip === 'gecis' ? '#EFF6FF' : '#FFF7ED',
                                color: t.tip === 'gecis' ? '#1E40AF' : '#C2410C',
                                border: t.tip === 'gecis' ? '1px solid #BFDBFE' : '1px solid #FFEDD5'
                              }}>
                                {t.tip === 'gecis' ? '🔄 Geçiş' : '🚪 Çıkış'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 10px', color: '#475569' }}>{t.kaynakKulupAd}</td>
                            <td style={{ padding: '12px 10px', color: '#475569' }}>{t.hedefKulupAd || '—'}</td>
                            <td style={{ padding: '12px 10px', color: '#475569' }}>{t.ogretmenAd}</td>
                            <td style={{ padding: '12px 10px', color: '#64748B', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.aciklama}>
                              {t.aciklama || '—'}
                            </td>
                            <td style={{ padding: '12px 10px' }}>{durumBadge}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {/* Öğretmen Onay Aksiyonu */}
                              {!adminModu && isTargetTeacher && t.durum === 'bekliyor' && (
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => handleTargetOgretmenKarar(t.id, true)}
                                    style={{ padding: '4px 8px', background: '#10B981', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                                  >
                                    Kabul Et
                                  </button>
                                  <button
                                    onClick={() => handleTargetOgretmenKarar(t.id, false)}
                                    style={{ padding: '4px 8px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                                  >
                                    Reddet
                                  </button>
                                </div>
                              )}

                              {/* İdareci Onay Aksiyonu */}
                              {adminModu && t.durum === 'hedef_onayladi' && (
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => handleIdareciKarar(t.id, true)}
                                    style={{ padding: '4px 8px', background: '#10B981', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                                  >
                                    Onayla
                                  </button>
                                  <button
                                    onClick={() => handleIdareciKarar(t.id, false)}
                                    style={{ padding: '4px 8px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                                  >
                                    Reddet
                                  </button>
                                </div>
                              )}

                              {!isTargetTeacher && !adminModu && t.durum === 'bekliyor' && (
                                <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontStyle: 'italic' }}>Onay Bekleniyor</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 6: RUBRİK DEĞERLENDİRME ── */}
          {aktifTab === 'degerlendirme' && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Kulüp Seçimi */}
                  <select
                    value={seciliKulupId}
                    onChange={e => setSeciliKulupId(e.target.value)}
                    style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#1B3A6B' }}
                  >
                    <option value="">— Kulüp Seçin —</option>
                    {goruntulenenKulupler.map(k => (
                      <option key={k.id} value={k.id}>{k.ad}</option>
                    ))}
                  </select>

                  {/* Hafta Seçimi */}
                  {seciliKulup && (
                    <select
                      value={seciliHafta}
                      onChange={e => setSeciliHafta(e.target.value)}
                      style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#1B3A6B' }}
                    >
                      <option value="">— Hafta / Konu Seçin —</option>
                      {(seciliKulup.dersPlani || []).map(h => (
                        <option key={h.hafta} value={h.hafta}>
                          Hafta {h.hafta}: {h.konu} {h.tamamlandi ? '(Tamamlandı)' : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Rubrik Seçimi */}
                  {seciliKulup && (
                    <select
                      value={seciliDegerlendirmeRubrikId}
                      onChange={e => setSeciliDegerlendirmeRubrikId(e.target.value)}
                      style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#1B3A6B' }}
                    >
                      <option value="">— Rubrik Seçin —</option>
                      {rubrikler.filter(r => seciliKulup.rubrikIds && seciliKulup.rubrikIds.includes(r.id)).map(r => (
                        <option key={r.id} value={r.id}>
                          {r.ad} {r.isKulup ? '(🏆 Kulüp)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {seciliKulup && (
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '600' }}>
                    Toplam: {kulupOgrencileri.length} Öğrenci
                  </span>
                )}
              </div>

              {!seciliKulupId ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8', fontSize: '0.85rem' }}>
                  Lütfen değerlendirme yapmak için üst kısımdan bir kulüp seçin.
                </div>
              ) : !seciliHafta ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8', fontSize: '0.85rem' }}>
                  Lütfen üst kısımdan değerlendirilecek haftayı seçin. Ders planınız yoksa önce "Ders Planı" sekmesinden plan ekleyin.
                </div>
              ) : !seciliDegerlendirmeRubrikId ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8', fontSize: '0.85rem' }}>
                  Lütfen değerlendirmede kullanılacak rubriği üst kısımdan seçin. Kulübünüze rubrik atanmamışsa önce kulüp düzenleme ekranından rubrik atayın.
                </div>
              ) : kulupOgrencileri.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8', fontSize: '0.85rem' }}>
                  Bu kulüpte kayıtlı öğrenci bulunmuyor.
                </div>
              ) : (() => {
                const seciliRubrik = rubrikler.find(r => r.id === seciliDegerlendirmeRubrikId)
                if (!seciliRubrik) return null
                const altKriterler = altKriterListesi(seciliRubrik)

                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', color: '#1B3A6B' }}>Öğrenci Adı Soyadı</th>
                          {altKriterler.map(ak => (
                            <th key={ak.id} style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '700', color: '#1B3A6B', minWidth: '130px' }}>
                              <div>{ak.ad}</div>
                              <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: '400' }}>({ak.anaAd})</span>
                            </th>
                          ))}
                          <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '700', color: '#1B3A6B', width: '80px' }}>Ort.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kulupOgrencileri.map(o => {
                          const satirPuanlar = {}
                          altKriterler.forEach(ak => {
                            const p = getKulupPuan(o.id, ak.id)
                            if (p != null) satirPuanlar[ak.id] = p
                          })
                          const ort = hesaplaOrt(satirPuanlar, seciliRubrik)

                          return (
                            <tr key={o.id} style={{ borderBottom: '1px solid #E2E8F0' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <td style={{ padding: '0.75rem', fontWeight: '600', color: '#1E293B' }}>
                                <div>{o.ad} {o.soyad || ''}</div>
                                <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: '400' }}>No: {o.ogrenciNo || '—'} · Sınıf: {o.sinifAd || '—'}</div>
                              </td>

                              {altKriterler.map(ak => {
                                const aktifPuan = getKulupPuan(o.id, ak.id)
                                const seviyeler = ak.seviyeler || [
                                  { ad: '1', puan: 1 },
                                  { ad: '2', puan: 2 },
                                  { ad: '3', puan: 3 },
                                  { ad: '4', puan: 4 }
                                ]

                                return (
                                  <td key={ak.id} style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                                      {seviyeler.map(sev => {
                                        const secili = aktifPuan === sev.puan
                                        return (
                                          <button
                                            key={sev.puan}
                                            type="button"
                                            onClick={() => handleKulupPuanDegis(o.id, ak.id, secili ? null : sev.puan)}
                                            title={sev.ad || `Puan: ${sev.puan}`}
                                            style={{
                                              width: '24px', height: '24px', borderRadius: '50%',
                                              border: '1px solid',
                                              borderColor: secili ? '#1B3A6B' : '#CBD5E1',
                                              background: secili ? '#1B3A6B' : '#fff',
                                              color: secili ? '#fff' : '#475569',
                                              fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer',
                                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                                              transition: 'all 0.1s'
                                            }}
                                          >
                                            {sev.puan}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </td>
                                )
                              })}

                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                {ort != null ? (
                                  <span style={{
                                    padding: '2px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '0.8rem',
                                    background: ort >= 3.5 ? '#D1FAE5' : ort >= 2.5 ? '#DBEAFE' : ort >= 1.5 ? '#FEF3C7' : '#FEE2E2',
                                    color: ort >= 3.5 ? '#065F46' : ort >= 2.5 ? '#1E40AF' : ort >= 1.5 ? '#92400E' : '#991B1B'
                                  }}>
                                    {ort.toFixed(2)}
                                  </span>
                                ) : (
                                  <span style={{ color: '#CBD5E1' }}>—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    <div style={{
                      display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                      marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #F1F5F9', gap: '1rem'
                    }}>
                      {Object.keys(degerlendirmePuanlari).length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#C2410C', fontWeight: '700' }}>
                          ⚠️ {Object.keys(degerlendirmePuanlari).length} öğrenci için kaydedilmemiş değişiklik var!
                        </span>
                      )}
                      <button
                        onClick={handleKulupDegerlendirmeKaydet}
                        disabled={degerlendirmeKaydediyor || Object.keys(degerlendirmePuanlari).length === 0}
                        style={{
                          padding: '0.5rem 1.5rem', background: '#1B3A6B', color: '#fff', border: 'none',
                          borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
                          opacity: (degerlendirmeKaydediyor || Object.keys(degerlendirmePuanlari).length === 0) ? 0.6 : 1
                        }}
                      >
                        {degerlendirmeKaydediyor ? 'Kaydediliyor...' : 'Değerlendirmeleri Kaydet'}
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </>
      )}

      {/* ── MODAL 1: KULÜP EKLE / DÜZENLE FORMU ── */}
      {kulupModalAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '460px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            {/* Modal Başlığı */}
            <div style={{
              background: '#1B3A6B', padding: '1rem 1.25rem', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                {duzenlenenKulupId ? '🏆 Kulüp Bilgilerini Güncelle' : '🏆 Yeni Sosyal Kulüp Oluştur'}
              </span>
              <button
                onClick={() => { setKulupModalAcik(false); formTemizle() }}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Modal Formu */}
            <form onSubmit={handleKulupKaydet} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Kulüp Adı:
                <input
                  type="text"
                  placeholder="Örn: Satranç Kulübü, Kodlama ve Robotik Kulübü"
                  value={formAd}
                  onChange={e => setFormAd(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
                  required
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Tanıtım Açıklaması:
                <textarea
                  placeholder="Kulübün amacı ve faaliyet alanı..."
                  value={formTanitim}
                  onChange={e => setFormTanitim(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', minHeight: '60px', resize: 'vertical' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Okul Düzeyi:
                <select
                  value={formOkulDuzeyi}
                  onChange={e => setFormOkulDuzeyi(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', background: '#fff', cursor: 'pointer' }}
                >
                  <option value="ilkokul">🏫 İlkokul</option>
                  <option value="ortaokul">🏫 Ortaokul</option>
                  <option value="lise">🏫 Lise</option>
                  <option value="genel">🌍 Genel / Tüm Düzeyler</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Kontenjan Sınırı (Sınırsız için boş bırakın):
                <input
                  type="number"
                  min="1"
                  placeholder="Örn: 20, 30"
                  value={formKontenjan}
                  onChange={e => setFormKontenjan(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </label>

              {/* Öğretmen Atama (Çoklu Seçim Checkbox) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                <span>🧑‍🏫 Danışman Öğretmen(ler):</span>
                <div style={{
                  maxHeight: '110px', overflowY: 'auto', border: '1px solid #CBD5E1',
                  borderRadius: '8px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                  {ogretmenler.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic' }}>Okulda kayıtlı öğretmen bulunmuyor.</span>
                  ) : (
                    ogretmenler.map(ogr => (
                      <label key={ogr.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '400', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formOgretmenler.includes(ogr.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormOgretmenler(prev => [...prev, ogr.id])
                            } else {
                              setFormOgretmenler(prev => prev.filter(id => id !== ogr.id))
                            }
                          }}
                        />
                        {ogr.ad}
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Rubrik Atama (Çoklu Seçim Checkbox) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                <span>📋 İlişkili Ölçme Rubrik(ler)i:</span>
                <div style={{
                  maxHeight: '110px', overflowY: 'auto', border: '1px solid #CBD5E1',
                  borderRadius: '8px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                  {rubrikler.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic' }}>Okulda tanımlı aktif rubrik bulunmuyor.</span>
                  ) : (
                    rubrikler.map(rub => (
                      <label key={rub.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '400', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formRubrikler.includes(rub.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormRubrikler(prev => [...prev, rub.id])
                            } else {
                              setFormRubrikler(prev => prev.filter(id => id !== rub.id))
                            }
                          }}
                        />
                        <span>
                          {rub.ad || rub.baslik}
                          {rub.isKulup && <span style={{ color: '#D97706', fontWeight: '700', marginLeft: '4px' }}> (🏆 Kulüp Rubriği)</span>}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Modal Aksiyonları */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.75rem', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setKulupModalAcik(false); formTemizle() }}
                  style={{
                    padding: '0.5rem 1rem', background: '#F1F5F9', border: '1px solid #CBD5E1',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', color: '#475569'
                  }}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  {duzenlenenKulupId ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: ÖĞRENCİ ATAMA MODALI ── */}
      {ogrenciModalAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '520px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            {/* Modal Başlığı */}
            <div style={{
              background: '#1B3A6B', padding: '1rem 1.25rem', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>👥 Kulüp Öğrenci Listesini Düzenle</span>
                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>{seciliKulup?.ad}</div>
              </div>
              <button
                onClick={() => { setOgrenciModalAcik(false); setOgrenciArama('') }}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Arama Kutusu */}
            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #F1F5F9' }}>
              <input
                type="text"
                placeholder="Öğrenci adı, sınıfı veya numarası ara..."
                value={ogrenciArama}
                onChange={e => setOgrenciArama(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
              />
            </div>

            {/* Öğrenci Listesi */}
            <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filtrelenmisOgrenciler.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#94A3B8', fontSize: '0.8rem' }}>Sonuç bulunamadı.</div>
              ) : (
                filtrelenmisOgrenciler.map(o => {
                  const secili = geciciOgrenciler.includes(o.id)
                  return (
                    <label key={o.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem', background: secili ? '#EFF6FF' : '#F8FAFC',
                      border: secili ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                      borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={secili}
                          onChange={() => handleOgrenciSecimToggle(o.id)}
                        />
                        <div>
                          <div style={{ fontWeight: '700', color: '#1E293B' }}>{o.ad} {o.soyad || ''}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748B' }}>No: {o.ogrenciNo || '—'} · Sınıf: {o.sinifAd || '—'}</div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.65rem', padding: '2px 8px', borderRadius: '999px',
                        background: secili ? '#3B82F6' : '#E2E8F0', color: secili ? '#fff' : '#475569',
                        fontWeight: '700'
                      }}>
                        {secili ? 'Atandı' : 'Boşta'}
                      </span>
                    </label>
                  )
                })
              )}
            </div>

            {/* Modal Aksiyonları */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderTop: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#1B3A6B' }}>
                Seçilen: {geciciOgrenciler.length} Öğrenci
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { setOgrenciModalAcik(false); setOgrenciArama('') }}
                  style={{
                    padding: '0.5rem 1rem', background: '#F1F5F9', border: '1px solid #CBD5E1',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', color: '#475569'
                  }}
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleOgrenciAtamaKaydet}
                  style={{
                    padding: '0.5rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Listeyi Güncelle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: ETKİNLİK EKLEME MODALI ── */}
      {etkinlikModalAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '440px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            {/* Modal Başlığı */}
            <div style={{
              background: '#1B3A6B', padding: '1rem 1.25rem', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>🏁 Yeni Etkinlik / Turnuva Tanımla</span>
                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>{seciliKulup?.ad}</div>
              </div>
              <button
                onClick={() => setEtkinlikModalAcik(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Modal Formu */}
            <form onSubmit={handleEtkinlikKaydet} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Etkinlik / Yarışma Başlığı:
                <input
                  type="text"
                  placeholder="Örn: 2026 Bahar Satranç Turnuvası"
                  value={etkAd}
                  onChange={e => setEtkAd(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
                  required
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                  Etkinlik Tarihi:
                  <input
                    type="date"
                    value={etkTarih}
                    onChange={e => setEtkTarih(e.target.value)}
                    style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
                    required
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                  Etkinlik Tipi:
                  <select
                    value={etkTip}
                    onChange={e => setEtkTip(e.target.value)}
                    style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    <option value="turnuva">🏆 Turnuva</option>
                    <option value="yarisma">🏁 Yarışma</option>
                    <option value="sergi">🎨 Sergi</option>
                    <option value="diger">📅 Diğer Etkinlik</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Açıklama / Detaylar:
                <textarea
                  placeholder="Etkinlik kuralları, yeri veya detayları..."
                  value={etkAciklama}
                  onChange={e => setEtkAciklama(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', minHeight: '60px', resize: 'vertical' }}
                />
              </label>

              {/* Modal Aksiyonları */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.75rem', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setEtkinlikModalAcik(false)}
                  style={{
                    padding: '0.5rem 1rem', background: '#F1F5F9', border: '1px solid #CBD5E1',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', color: '#475569'
                  }}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: KULÜP GEÇİŞ / ÇIKIŞ TALEP MODALI ── */}
      {talepModalAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '460px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            {/* Modal Başlığı */}
            <div style={{
              background: '#1B3A6B', padding: '1rem 1.25rem', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>📩 Kulüp Geçiş / Çıkış Talebi</span>
                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>{seciliKulup?.ad}</div>
              </div>
              <button
                onClick={() => setTalepModalAcik(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Modal Formu */}
            <form onSubmit={handleTalepOlustur} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Öğrenci Seçin:
                <select
                  value={talepOgrenciId}
                  onChange={e => setTalepOgrenciId(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', background: '#fff', cursor: 'pointer' }}
                  required
                >
                  <option value="">— Öğrenci Seçin —</option>
                  {ogrenciler
                    .filter(o => seciliKulup?.ogrenciIds?.includes(o.id))
                    .map(o => (
                      <option key={o.id} value={o.id}>{o.ad} {o.soyad || ''} ({o.sinifAd || 'Sınıfsız'})</option>
                    ))
                  }
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                İşlem Tipi:
                <select
                  value={talepTipi}
                  onChange={e => setTalepTipi(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', background: '#fff', cursor: 'pointer' }}
                >
                  <option value="gecis">🔄 Kulüp Geçiş Talebi</option>
                  <option value="cikis">🚪 Kulüpten Çıkarma Talebi</option>
                </select>
              </label>

              {talepTipi === 'gecis' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                  Gitmek İstediği Kulüp:
                  <select
                    value={talepHedefKulupId}
                    onChange={e => setTalepHedefKulupId(e.target.value)}
                    style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', background: '#fff', cursor: 'pointer' }}
                    required
                  >
                    <option value="">— Hedef Kulüp Seçin —</option>
                    {kulupler
                      .filter(k => k.id !== seciliKulupId)
                      .map(k => {
                        const isFull = k.kontenjan && (k.ogrenciIds?.length || 0) >= k.kontenjan
                        return (
                          <option 
                            key={k.id} 
                            value={k.id} 
                            disabled={isFull}
                          >
                            {k.ad} ({k.okulDuzeyi ? k.okulDuzeyi.toUpperCase() : 'GENEL'})
                            {isFull ? ` (Kontenjan Dolu - ${k.ogrenciIds?.length || 0}/${k.kontenjan})` : ''}
                          </option>
                        )
                      })
                    }
                  </select>
                </label>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Talep Açıklaması / Gerekçesi:
                <textarea
                  placeholder="Öğrencinin neden kulüp değiştirmek/çıkmak istediğini belirtin..."
                  value={talepAciklama}
                  onChange={e => setTalepAciklama(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', minHeight: '80px', resize: 'vertical' }}
                  required
                />
              </label>

              {/* Modal Aksiyonları */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.75rem', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setTalepModalAcik(false)}
                  style={{
                    padding: '0.5rem 1rem', background: '#F1F5F9', border: '1px solid #CBD5E1',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', color: '#475569'
                  }}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Talebi Gönder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 5: HEDEF ÖĞRETMEN RED DETAY MODALI ── */}
      {hedefRedModalAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '440px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            {/* Modal Başlığı */}
            <div style={{
              background: '#EF4444', padding: '1rem 1.25rem', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>❌ Geçiş Talebini Reddet</span>
              <button
                onClick={() => setHedefRedModalAcik(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Modal Formu */}
            <form onSubmit={handleHedefRedKaydet} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Red Nedeni Seçin:
                <select
                  value={hedefRedNedeni}
                  onChange={e => setHedefRedNedeni(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', background: '#fff', cursor: 'pointer' }}
                >
                  <option value="kontenjan">👥 Kontenjan Sınırı</option>
                  <option value="mufredat">📚 Müfredat İlerleme Seviyesi</option>
                  <option value="malzeme">🛠️ Kulüp Malzeme/Araç Yetersizliği</option>
                  <option value="diger">❓ Diğer</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Açıklama:
                <textarea
                  placeholder="Red gerekçesini detaylandırın..."
                  value={hedefRedAciklamasi}
                  onChange={e => setHedefRedAciklamasi(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', minHeight: '80px', resize: 'vertical' }}
                  required
                />
              </label>

              {/* Modal Aksiyonları */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.75rem', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setHedefRedModalAcik(false)}
                  style={{
                    padding: '0.5rem 1rem', background: '#F1F5F9', border: '1px solid #CBD5E1',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', color: '#475569'
                  }}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.25rem', background: '#EF4444', color: '#fff', border: 'none',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Reddet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 6: İDARECİ RED DETAY MODALI ── */}
      {idareciRedModalAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '440px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            {/* Modal Başlığı */}
            <div style={{
              background: '#B91C1C', padding: '1rem 1.25rem', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>❌ Talebi Reddet (İdare)</span>
              <button
                onClick={() => setIdareciRedModalAcik(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Modal Formu */}
            <form onSubmit={handleIdareciRedKaydet} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Red Nedeni / Açıklaması:
                <textarea
                  placeholder="Reddetme nedenini yazın..."
                  value={idareciRedAciklamasi}
                  onChange={e => setIdareciRedAciklamasi(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem', minHeight: '80px', resize: 'vertical' }}
                  required
                />
              </label>

              {/* Modal Aksiyonları */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.75rem', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIdareciRedModalAcik(false)}
                  style={{
                    padding: '0.5rem 1rem', background: '#F1F5F9', border: '1px solid #CBD5E1',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', color: '#475569'
                  }}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.25rem', background: '#B91C1C', color: '#fff', border: 'none',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Reddet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── MODAL 7: MATERYAL LİSTESİ YÖNETİM MODALI ── */}
      {materyalModalAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '560px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh'
          }}>
            {/* Modal Başlığı */}
            <div style={{
              background: '#1B3A6B', padding: '1rem 1.25rem', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>📦 Kulüp Materyal Listesi Yönetimi</span>
                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>{seciliKulup?.ad}</div>
              </div>
              <button
                onClick={() => setMateryalModalAcik(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Modal Gövdesi */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
              
              {/* Mevcut Materyaller Listesi */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#1E293B', fontWeight: '700' }}>📋 Kayıtlı Materyaller</h4>
                  {adminModu && (seciliKulup?.materyaller || []).some(m => m.durum === 'taslak') && (
                    <button
                      onClick={handleTumMateryalleriOnayla}
                      style={{ padding: '2px 8px', fontSize: '0.7rem', background: '#10B981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      ✓ Tümünü Onayla (Resmileştir)
                    </button>
                  )}
                </div>

                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', background: '#F8FAFC' }}>
                  {(!seciliKulup?.materyaller || seciliKulup.materyaller.length === 0) ? (
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>
                      Henüz kulübe ait materyal tanımlanmamıştır.
                    </span>
                  ) : (
                    seciliKulup.materyaller.map(m => {
                      const canDelete = adminModu || m.durum === 'taslak'
                      return (
                        <div key={m.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '0.75rem'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: '600', color: '#1E293B' }}>{m.ad}</span>
                            <span style={{ fontSize: '0.65rem', color: '#64748B' }}>Ekleyen: {m.ekleyenAd} ({m.tarih})</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {m.durum === 'taslak' ? (
                              <span style={{ padding: '2px 6px', background: '#FEF3C7', color: '#D97706', borderRadius: '4px', fontWeight: '700', fontSize: '0.65rem' }}>
                                ⏳ Taslak
                              </span>
                            ) : (
                              <span style={{ padding: '2px 6px', background: '#D1FAE5', color: '#059669', borderRadius: '4px', fontWeight: '700', fontSize: '0.65rem' }}>
                                Resmi
                              </span>
                            )}

                            {adminModu && m.durum === 'taslak' && (
                              <button
                                onClick={() => handleMateryalOnayla(m.id)}
                                style={{ padding: '2px 6px', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', fontSize: '0.65rem' }}
                              >
                                Onayla
                              </button>
                            )}

                            {canDelete && (
                              <button
                                onClick={() => handleMateryalSil(m.id)}
                                style={{ background: 'none', border: 'none', color: '#EF4444', fontWeight: '700', cursor: 'pointer', fontSize: '0.65rem' }}
                              >
                                Sil
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Materyal Ekleme Bölümü */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#1E293B', fontWeight: '700' }}>➕ Yeni Materyal Ekle</h4>
                
                {/* Seçim Sekmeleri (Tek Tek / Toplu) */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setMateryalEklemeTipi('tek')}
                    style={{
                      flex: 1, padding: '4px', fontSize: '0.75rem', fontWeight: '600', borderRadius: '6px', border: '1px solid #CBD5E1', cursor: 'pointer',
                      background: materyalEklemeTipi === 'tek' ? '#EFF6FF' : '#fff',
                      color: materyalEklemeTipi === 'tek' ? '#1E40AF' : '#64748B',
                      borderColor: materyalEklemeTipi === 'tek' ? '#BFDBFE' : '#CBD5E1'
                    }}
                  >
                    Tek Tek Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => setMateryalEklemeTipi('toplu')}
                    style={{
                      flex: 1, padding: '4px', fontSize: '0.75rem', fontWeight: '600', borderRadius: '6px', border: '1px solid #CBD5E1', cursor: 'pointer',
                      background: materyalEklemeTipi === 'toplu' ? '#EFF6FF' : '#fff',
                      color: materyalEklemeTipi === 'toplu' ? '#1E40AF' : '#64748B',
                      borderColor: materyalEklemeTipi === 'toplu' ? '#BFDBFE' : '#CBD5E1'
                    }}
                  >
                    E-Tablo ile Toplu Yapıştır
                  </button>
                </div>

                <form onSubmit={handleMateryalEkle} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {materyalEklemeTipi === 'tek' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#475569' }}>Materyal Adı:</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder="Örn: Satranç Takımı, A4 Kağıdı, Arduino Seti"
                          value={materyalTekAd}
                          onChange={e => setMateryalTekAd(e.target.value)}
                          style={{ flex: 1, padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }}
                        />
                        <button
                          type="submit"
                          style={{ padding: '0.4rem 1rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Ekle
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#475569' }}>E-Tablodan Satırları Yapıştır:</span>
                      <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: '400', marginBottom: '2px' }}>Excel veya Google E-Tablo'dan kopyaladığınız materyal isimlerini aşağıya yapıştırın (Her satır bir materyal oluşturur).</span>
                      <textarea
                        rows="4"
                        placeholder="Satranç Takımı&#10;Yazma Defteri&#10;Tükenmez Kalem"
                        value={materyalTopluMetin}
                        onChange={e => setMateryalTopluMetin(e.target.value)}
                        style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem', minHeight: '80px', fontFamily: 'monospace' }}
                      />
                      <button
                        type="submit"
                        style={{ alignSelf: 'flex-end', padding: '0.4rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', marginTop: '4px' }}
                      >
                        Toplu Ekle (Taslak)
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Modal Aksiyonları */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.75rem 1.25rem', borderTop: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              <button
                onClick={() => setMateryalModalAcik(false)}
                style={{
                  padding: '0.5rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none',
                  borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 8: ETKİNLİK/TURNUVA TEMSİLCİ SEÇME MODALI ── */}
      {temsilciModalAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '440px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            {/* Modal Başlığı */}
            <div style={{
              background: '#1B3A6B', padding: '1rem 1.25rem', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>🏆 Turnuva / Etkinlik Temsilcilerini Seç</span>
                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>{etkinlikler.find(e => e.id === seciliEtkinlikId)?.ad}</div>
              </div>
              <button
                onClick={() => setTemsilciModalAcik(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Öğrenci Listesi */}
            <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {kulupOgrencileri.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#94A3B8', fontSize: '0.8rem' }}>Kulübe kayıtlı öğrenci bulunmuyor.</div>
              ) : (
                kulupOgrencileri.map(o => {
                  const secili = geciciTemsilciler.includes(o.id)
                  return (
                    <label key={o.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem', background: secili ? '#EFF6FF' : '#F8FAFC',
                      border: secili ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                      borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={secili}
                          onChange={() => {
                            setGeciciTemsilciler(prev =>
                              prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id]
                            )
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: '700', color: '#1E293B' }}>{o.ad} {o.soyad || ''}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748B' }}>No: {o.ogrenciNo || '—'} · Sınıf: {o.sinifAd || '—'}</div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.65rem', padding: '2px 8px', borderRadius: '999px',
                        background: secili ? '#1B3A6B' : '#E2E8F0', color: secili ? '#fff' : '#475569',
                        fontWeight: '700'
                      }}>
                        {secili ? 'Temsilci' : 'Katılmıyor'}
                      </span>
                    </label>
                  )
                })
              )}
            </div>

            {/* Modal Aksiyonları */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderTop: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#1B3A6B' }}>
                Seçilen: {geciciTemsilciler.length} Öğrenci
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setTemsilciModalAcik(false)}
                  style={{
                    padding: '0.5rem 1rem', background: '#F1F5F9', border: '1px solid #CBD5E1',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', color: '#475569'
                  }}
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleTemsilciSecmeKaydet}
                  style={{
                    padding: '0.5rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Temsilcileri Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
