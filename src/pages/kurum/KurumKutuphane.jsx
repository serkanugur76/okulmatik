import { useEffect, useState, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, writeBatch, limit
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { logKaydet } from '../../services/logService'

export default function KurumKutuphane() {
  const { secilenKurumId, secilenKurum, erisimKurumlar, ogretmenModu } = useKurumYonetim()
  const { profil, kullanici } = useAuth()

  const ust = erisimKurumlar.find(k => k.id === secilenKurum?.parentId)
  const seviye = !secilenKurum?.parentId ? 'root' : !ust?.parentId ? 'kampus' : 'altKurum'

  // Alt kurumlar listesi (seçim için)
  const sayimKurumlar = useMemo(() => {
    if (seviye === 'root') return erisimKurumlar.filter(k => k.rootKurumId === secilenKurumId && k.tip === 'altKurum')
    if (seviye === 'kampus') return erisimKurumlar.filter(k => k.parentId === secilenKurumId && k.tip === 'altKurum')
    return secilenKurum ? [secilenKurum] : []
  }, [seviye, secilenKurumId, erisimKurumlar, secilenKurum])

  // URL parameters for state preservation
  const [searchParams, setSearchParams] = useSearchParams()
  function updateParam(updates) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([k, v]) => {
        if (v != null && v !== '') next.set(k, String(v))
        else next.delete(k)
      })
      return next
    }, { replace: true })
  }

  const secilenAltKurumId = searchParams.get('ak') || ''
  function setSecilenAltKurumId(id) { updateParam({ ak: id }) }

  // Reset sub-institution if parent institution changes
  const altKurumInitRef = useRef(false)
  useEffect(() => {
    if (!secilenKurumId) return
    if (!altKurumInitRef.current) { altKurumInitRef.current = true; return }
    updateParam({ ak: null })
  }, [secilenKurumId])

  // Actual active leaf institution ID for queries and modifications
  const hedefKurumId = ogretmenModu
    ? (secilenKurumId || null)
    : seviye === 'altKurum' ? secilenKurumId : (secilenAltKurumId || null)

  // ── State variables ───────────────────────────────────────
  const [kitaplar, setKitaplar] = useState([])
  const [oduncKayitlari, setOduncKayitlari] = useState([])
  const [ogrenciler, setOgrenciler] = useState([])
  const [kullanicilar, setKullanicilar] = useState([])

  const [sekme, setSekme] = useState('kitaplar') // 'kitaplar' | 'odunc' | 'uyeler'
  const [kitapArama, setKitapArama] = useState('')
  const [kitapTurFiltre, setKitapTurFiltre] = useState('')
  const [oduncArama, setOduncArama] = useState('')
  const [oduncFiltre, setOduncFiltre] = useState('hepsi') // 'hepsi' | 'odunc' | 'iade' | 'geciken'
  const [uyeArama, setUyeArama] = useState('')
  const [uyeTurFiltre, setUyeTurFiltre] = useState('hepsi') // 'hepsi' | 'ogrenci' | 'ogretmen' | 'aktif_odunc'

  // Modals
  const [kitapModal, setKitapModal] = useState(false)
  const [duzenlenenKitap, setDuzenlenenKitap] = useState(null)
  const [kitapForm, setKitapForm] = useState({ barkod: '', ad: '', yazar: '', yayinevi: '', tur: '', konum: '', toplamAdet: 1 })

  const [oduncModal, setOduncModal] = useState(false)
  const [oduncForm, setOduncForm] = useState({ kitapId: '', uyeTur: 'ogrenci', uyeId: '', iadeBeklenenGun: 15 })
  const [oduncUyeArama, setOduncUyeArama] = useState('')
  const [secilenUyeObj, setSecilenUyeObj] = useState(null)

  // Loading & Alerts
  const [kaydediyor, setKaydediyor] = useState(false)
  const [hata, setHata] = useState('')
  const [basari, setBasari] = useState('')

  // Excel Import
  const [excelDosya, setExcelDosya] = useState(null)
  const [excelYukleniyor, setExcelYukleniyor] = useState(false)
  const [excelSonuc, setExcelSonuc] = useState('')

  // ── Firestore Listeners ───────────────────────────────────
  // Books & Borrows
  useEffect(() => {
    if (!hedefKurumId) {
      setKitaplar([])
      setOduncKayitlari([])
      return
    }

    const qKitaplar = query(collection(db, 'kurumlar', hedefKurumId, 'kitaplar'), orderBy('ad', 'asc'))
    const unsubKitaplar = onSnapshot(qKitaplar, snap => {
      setKitaplar(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => {
      console.error("Kitaplar dinleme hatası:", err)
    })

    const qOdunc = query(collection(db, 'kurumlar', hedefKurumId, 'oduncKayitlari'), orderBy('verilisTarihi', 'desc'))
    const unsubOdunc = onSnapshot(qOdunc, snap => {
      setOduncKayitlari(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => {
      console.error("Ödünç kayıtları dinleme hatası:", err)
    })

    return () => {
      unsubKitaplar()
      unsubOdunc()
    }
  }, [hedefKurumId])

  // Students & Staff for lending select dropdowns
  useEffect(() => {
    if (!hedefKurumId) {
      setOgrenciler([])
      setKullanicilar([])
      return
    }

    // Students list
    const unsubOgr = onSnapshot(
      query(collection(db, 'kurumlar', hedefKurumId, 'ogrenciler'), orderBy('ad', 'asc')),
      snap => setOgrenciler(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )

    // Staff list
    const unsubKul = onSnapshot(
      query(collection(db, 'kurumlar', hedefKurumId, 'kullanicilar'), orderBy('ad', 'asc')),
      snap => setKullanicilar(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )

    return () => {
      unsubOgr()
      unsubKul()
    }
  }, [hedefKurumId])

  // Distinct genres list for filter dropdown
  const kitapTurleri = useMemo(() => {
    const list = kitaplar.map(k => (k.tur || '').trim()).filter(Boolean)
    return [...new Set(list)].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [kitaplar])

  // ── Statistics calculation ───────────────────────────────
  const istatistikler = useMemo(() => {
    const toplamFarkli = kitaplar.length
    const toplamKitapAdet = kitaplar.reduce((acc, k) => acc + (Number(k.toplamAdet) || 0), 0)
    const kutuphanedekiKitap = kitaplar.reduce((acc, k) => acc + (Number(k.mevcutAdet) || 0), 0)
    const aktifOdunc = oduncKayitlari.filter(o => o.durum === 'odunc').length

    // Overdue calculation
    const bugunMs = Date.now()
    const gecikenOdunc = oduncKayitlari.filter(o => {
      if (o.durum !== 'odunc') return false
      if (!o.iadeBeklenenTarih) return false
      // Convert timestamp to ms
      const beklenenTarihMs = o.iadeBeklenenTarih.seconds
        ? o.iadeBeklenenTarih.seconds * 1000
        : new Date(o.iadeBeklenenTarih).getTime()
      return beklenenTarihMs < bugunMs
    }).length

    return {
      toplamFarkli,
      toplamKitapAdet,
      kutuphanedekiKitap,
      aktifOdunc,
      gecikenOdunc
    }
  }, [kitaplar, oduncKayitlari])

  // ── Filtered Books & Borrows ──────────────────────────────
  const filtreliKitaplar = useMemo(() => {
    return kitaplar.filter(k => {
      const aramaUyum = !kitapArama ||
        (k.ad || '').toLowerCase().includes(kitapArama.toLowerCase()) ||
        (k.yazar || '').toLowerCase().includes(kitapArama.toLowerCase()) ||
        (k.barkod || '').toLowerCase().includes(kitapArama.toLowerCase()) ||
        (k.yayinevi || '').toLowerCase().includes(kitapArama.toLowerCase())

      const turUyum = !kitapTurFiltre || (k.tur || '').trim() === kitapTurFiltre

      return aramaUyum && turUyum
    })
  }, [kitaplar, kitapArama, kitapTurFiltre])

  const filtreliOduncKayitlari = useMemo(() => {
    const bugunMs = Date.now()
    return oduncKayitlari.filter(o => {
      const aramaUyum = !oduncArama ||
        (o.kitapAd || '').toLowerCase().includes(oduncArama.toLowerCase()) ||
        (o.kitapBarkod || '').toLowerCase().includes(oduncArama.toLowerCase()) ||
        (o.uyeAd || '').toLowerCase().includes(oduncArama.toLowerCase())

      let durumUyum = true
      if (oduncFiltre === 'odunc') durumUyum = o.durum === 'odunc'
      else if (oduncFiltre === 'iade') durumUyum = o.durum === 'iade'
      else if (oduncFiltre === 'geciken') {
        if (o.durum !== 'odunc') {
          durumUyum = false
        } else {
          const beklenenTarihMs = o.iadeBeklenenTarih?.seconds
            ? o.iadeBeklenenTarih.seconds * 1000
            : new Date(o.iadeBeklenenTarih).getTime()
          durumUyum = beklenenTarihMs < bugunMs
        }
      }

      return aramaUyum && durumUyum
    })
  }, [oduncKayitlari, oduncArama, oduncFiltre])

  const birlesikUyeler = useMemo(() => {
    const listOgr = ogrenciler.map(o => {
      const activeCount = oduncKayitlari.filter(x => x.uyeId === o.id && x.durum === 'odunc').length
      const totalCount = oduncKayitlari.filter(x => x.uyeId === o.id).length
      return {
        id: o.id,
        ad: `${o.ad} ${o.soyad || ''}`.trim(),
        detay: `Sınıf: ${o.sinifAd || '—'} (No: ${o.ogrenciNo || '—'})`,
        tur: 'ogrenci',
        activeCount,
        totalCount,
        raw: o
      }
    })

    const listKul = kullanicilar.map(k => {
      const activeCount = oduncKayitlari.filter(x => x.uyeId === k.id && x.durum === 'odunc').length
      const totalCount = oduncKayitlari.filter(x => x.uyeId === k.id).length
      return {
        id: k.id,
        ad: k.ad || k.email,
        detay: `E-posta: ${k.email || '—'}`,
        tur: 'ogretmen',
        activeCount,
        totalCount,
        raw: k
      }
    })

    return [...listOgr, ...listKul].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))
  }, [ogrenciler, kullanicilar, oduncKayitlari])

  const filtreliUyeler = useMemo(() => {
    return birlesikUyeler.filter(u => {
      const aramaUyum = !uyeArama ||
        u.ad.toLowerCase().includes(uyeArama.toLowerCase()) ||
        u.detay.toLowerCase().includes(uyeArama.toLowerCase())

      let turUyum = true
      if (uyeTurFiltre === 'ogrenci') turUyum = u.tur === 'ogrenci'
      else if (uyeTurFiltre === 'ogretmen') turUyum = u.tur === 'ogretmen'
      else if (uyeTurFiltre === 'aktif_odunc') turUyum = u.activeCount > 0

      return aramaUyum && turUyum
    })
  }, [birlesikUyeler, uyeArama, uyeTurFiltre])

  // ── Book CRUD Handlers ────────────────────────────────────
  function openKitapModal(kitap = null) {
    setHata('')
    setBasari('')
    if (kitap) {
      setDuzenlenenKitap(kitap)
      setKitapForm({
        barkod: kitap.barkod || '',
        ad: kitap.ad || '',
        yazar: kitap.yazar || '',
        yayinevi: kitap.yayinevi || '',
        tur: kitap.tur || '',
        konum: kitap.konum || '',
        toplamAdet: kitap.toplamAdet || 1
      })
    } else {
      setDuzenlenenKitap(null)
      setKitapForm({ barkod: '', ad: '', yazar: '', yayinevi: '', tur: '', konum: '', toplamAdet: 1 })
    }
    setKitapModal(true)
  }

  async function handleKitapKaydet(e) {
    e.preventDefault()
    if (!hedefKurumId) return
    const { barkod, ad, yazar, yayinevi, tur, konum, toplamAdet } = kitapForm

    if (!ad.trim()) { setHata('Kitap adı zorunludur.'); return }
    if (!barkod.trim()) { setHata('Barkod zorunludur.'); return }
    const adetSayi = Math.max(1, parseInt(toplamAdet) || 1)

    setKaydediyor(true)
    setHata('')
    setBasari('')

    try {
      // Check duplicate barcode (excluding current editing book)
      const barcodeExists = kitaplar.find(k => k.barkod === barkod.trim() && (!duzenlenenKitap || k.id !== duzenlenenKitap.id))
      if (barcodeExists) {
        throw new Error(`Bu barkod numarası (${barkod.trim()}) "${barcodeExists.ad}" isimli kitaba zaten atanmış!`)
      }

      if (duzenlenenKitap) {
        // Adjust mevcutAdet when toplamAdet changes
        const fark = adetSayi - (duzenlenenKitap.toplamAdet || 0)
        const yeniMevcut = Math.max(0, (duzenlenenKitap.mevcutAdet || 0) + fark)

        await updateDoc(doc(db, 'kurumlar', hedefKurumId, 'kitaplar', duzenlenenKitap.id), {
          barkod: barkod.trim(),
          ad: ad.trim(),
          yazar: yazar.trim(),
          yayinevi: yayinevi.trim(),
          tur: tur.trim(),
          konum: konum.trim(),
          toplamAdet: adetSayi,
          mevcutAdet: yeniMevcut
        })

        logKaydet({
          profil, kullanici, islem: 'guncelle', modul: 'kutuphane',
          hedefAd: `Kitap: ${ad.trim()}`, kurumId: hedefKurumId
        })
        setBasari('Kitap başarıyla güncellendi.')
      } else {
        await addDoc(collection(db, 'kurumlar', hedefKurumId, 'kitaplar'), {
          barkod: barkod.trim(),
          ad: ad.trim(),
          yazar: yazar.trim(),
          yayinevi: yayinevi.trim(),
          tur: tur.trim(),
          konum: konum.trim(),
          toplamAdet: adetSayi,
          mevcutAdet: adetSayi,
          kayitTarihi: serverTimestamp()
        })

        logKaydet({
          profil, kullanici, islem: 'olustur', modul: 'kutuphane',
          hedefAd: `Kitap: ${ad.trim()}`, kurumId: hedefKurumId
        })
        setBasari('Kitap başarıyla eklendi.')
      }
      setKitapModal(false)
    } catch (err) {
      setHata(err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  async function handleKitapSil(kitap) {
    if (!hedefKurumId) return
    // Check if the book has any active borrow records
    const hasActiveBorrow = oduncKayitlari.some(o => o.kitapId === kitap.id && o.durum === 'odunc')
    if (hasActiveBorrow) {
      alert('Bu kitap şu an bir üyede ödünç durumundadır. İade edilmeden kitap silinemez!')
      return
    }

    if (!window.confirm(`"${kitap.ad}" adlı kitabı silmek istediğinize emin misiniz?`)) return

    try {
      await deleteDoc(doc(db, 'kurumlar', hedefKurumId, 'kitaplar', kitap.id))
      logKaydet({
        profil, kullanici, islem: 'sil', modul: 'kutuphane',
        hedefAd: `Kitap: ${kitap.ad}`, kurumId: hedefKurumId
      })
      alert('Kitap silindi.')
    } catch (err) {
      alert('Kitap silinirken hata oluştu: ' + err.message)
    }
  }

  // ── Lending / Returning Handlers ──────────────────────────
  function openOduncModal(kitapId = '') {
    setHata('')
    setBasari('')
    setOduncUyeArama('')
    setSecilenUyeObj(null)
    setOduncForm({
      kitapId,
      uyeTur: 'ogrenci',
      uyeId: '',
      iadeBeklenenGun: 15
    })
    setOduncModal(true)
  }

  function openOduncModalUye(uye) {
    setHata('')
    setBasari('')
    setOduncUyeArama('')
    setSecilenUyeObj(uye.raw)
    setOduncForm({
      kitapId: '',
      uyeTur: uye.tur,
      uyeId: uye.id,
      iadeBeklenenGun: 15
    })
    setOduncModal(true)
  }

  // Uye Arama list
  const filtrelenmisUyeler = useMemo(() => {
    const metin = oduncUyeArama.trim().toLowerCase()
    if (!metin) return []
    if (oduncForm.uyeTur === 'ogrenci') {
      return ogrenciler.filter(o =>
        (o.ad || '').toLowerCase().includes(metin) ||
        (o.soyad || '').toLowerCase().includes(metin) ||
        (o.ogrenciNo || '').toLowerCase().includes(metin)
      ).slice(0, 10)
    } else {
      return kullanicilar.filter(k =>
        (k.ad || '').toLowerCase().includes(metin) ||
        (k.email || '').toLowerCase().includes(metin)
      ).slice(0, 10)
    }
  }, [ogrenciler, kullanicilar, oduncUyeArama, oduncForm.uyeTur])

  async function handleOduncVer(e) {
    e.preventDefault()
    if (!hedefKurumId) return
    const { kitapId, uyeTur, iadeBeklenenGun } = oduncForm

    if (!kitapId) { setHata('Lütfen ödünç verilecek kitabı seçin.'); return }
    if (!secilenUyeObj) { setHata('Lütfen ödünç verilecek üyeyi arayıp seçin.'); return }

    const secilenKitap = kitaplar.find(k => k.id === kitapId)
    if (!secilenKitap) { setHata('Kitap bulunamadı.'); return }
    if (secilenKitap.mevcutAdet <= 0) {
      setHata('Bu kitaptan kütüphanede kalmamıştır. Ödünç verilemez!');
      return
    }

    setKaydediyor(true)
    setHata('')
    setBasari('')

    try {
      const verilis = new Date()
      const beklenen = new Date()
      beklenen.setDate(verilis.getDate() + (parseInt(iadeBeklenenGun) || 15))

      const batch = writeBatch(db)

      // 1. Ödünç kaydı ekle
      const oduncRef = doc(collection(db, 'kurumlar', hedefKurumId, 'oduncKayitlari'))
      const uyeAdText = uyeTur === 'ogrenci'
        ? `${secilenUyeObj.ad} ${secilenUyeObj.soyad || ''}`.trim()
        : secilenUyeObj.ad || secilenUyeObj.email
      const uyeDetayText = uyeTur === 'ogrenci'
        ? `Sınıf: ${secilenUyeObj.sinifAd || '—'} (No: ${secilenUyeObj.ogrenciNo || '—'})`
        : `E-posta: ${secilenUyeObj.email || '—'}`

      batch.set(oduncRef, {
        kitapId: secilenKitap.id,
        kitapAd: secilenKitap.ad,
        kitapBarkod: secilenKitap.barkod,
        uyeId: secilenUyeObj.id,
        uyeTur,
        uyeAd: uyeAdText,
        uyeDetay: uyeDetayText,
        verilisTarihi: serverTimestamp(),
        iadeBeklenenTarih: beklenen.toISOString().split('T')[0], // yyyy-mm-dd format
        iadeTarihi: null,
        durum: 'odunc',
        islemYapanUid: kullanici?.uid || ''
      })

      // 2. Kitap mevcut adet düşür
      const kitapRef = doc(db, 'kurumlar', hedefKurumId, 'kitaplar', secilenKitap.id)
      batch.update(kitapRef, {
        mevcutAdet: Math.max(0, (secilenKitap.mevcutAdet || 0) - 1)
      })

      await batch.commit()

      logKaydet({
        profil, kullanici, islem: 'olustur', modul: 'kutuphane',
        hedefAd: `Ödünç: "${secilenKitap.ad}" → ${uyeAdText}`, kurumId: hedefKurumId
      })

      setBasari('Kitap başarıyla ödünç verildi.')
      setOduncModal(false)
    } catch (err) {
      setHata('Ödünç verme hatası: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  async function handleIadeAl(kayit) {
    if (!hedefKurumId) return
    if (kayit.durum === 'iade') return

    if (!window.confirm(`"${kayit.kitapAd}" kitabını ${kayit.uyeAd} isimli üyeden iade almak istiyor musunuz?`)) return

    try {
      const batch = writeBatch(db)

      // 1. Ödünç kaydını güncelle
      const kayitRef = doc(db, 'kurumlar', hedefKurumId, 'oduncKayitlari', kayit.id)
      batch.update(kayitRef, {
        durum: 'iade',
        iadeTarihi: serverTimestamp()
      })

      // 2. Kitap mevcut adeti arttır
      const kitapRef = doc(db, 'kurumlar', hedefKurumId, 'kitaplar', kayit.kitapId)
      // fetch actual book data to avoid going over toplamAdet
      const kObj = kitaplar.find(k => k.id === kayit.kitapId)
      const yeniMevcut = kObj ? Math.min(kObj.toplamAdet, (kObj.mevcutAdet || 0) + 1) : 1

      batch.update(kitapRef, {
        mevcutAdet: yeniMevcut
      })

      await batch.commit()

      logKaydet({
        profil, kullanici, islem: 'guncelle', modul: 'kutuphane',
        hedefAd: `İade: "${kayit.kitapAd}" ← ${kayit.uyeAd}`, kurumId: hedefKurumId
      })

      alert('Kitap başarıyla iade alındı.')
    } catch (err) {
      alert('İade işlemi başarısız: ' + err.message)
    }
  }

  // ── Excel Template Export ────────────────────────────────
  function handleSablonIndir() {
    const headers = [
      ['Barkod', 'Kitap Adı', 'Yazar', 'Yayınevi', 'Tür', 'Konum', 'Toplam Adet']
    ]
    const ornekVeri = [
      ['9786053755494', 'Cesur Yeni Dünya', 'Aldous Huxley', 'İthaki Yayınları', 'Bilim Kurgu', 'A-3', '3'],
      ['9789750719387', '1984', 'George Orwell', 'Can Yayınları', 'Roman', 'A-1', '5'],
      ['9789750718533', 'Şeker Portakalı', 'Jose Mauro de Vasconcelos', 'Can Yayınları', 'Dünya Klasiği', 'B-12', '2']
    ]

    const ws = XLSX.utils.aoa_to_sheet([...headers, ...ornekVeri])
    
    // Column widths
    ws['!cols'] = [
      { wch: 18 }, // Barkod
      { wch: 25 }, // Kitap Adı
      { wch: 20 }, // Yazar
      { wch: 20 }, // Yayınevi
      { wch: 15 }, // Tür
      { wch: 10 }, // Konum
      { wch: 12 }  // Toplam Adet
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kitap Taslak')
    XLSX.writeFile(wb, 'kutuphane_kitap_sablon.xlsx')
  }

  // ── Excel Import Processing ──────────────────────────────
  function handleExcelDosyaSecimi(e) {
    if (e.target.files && e.target.files[0]) {
      setExcelDosya(e.target.files[0])
      setExcelSonuc('')
    }
  }

  async function handleExcelYukle() {
    if (!hedefKurumId || !excelDosya) return
    setExcelYukleniyor(true)
    setExcelSonuc('')
    setHata('')

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = e.target.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const satirlar = XLSX.utils.sheet_to_json(sheet)

        if (satirlar.length === 0) {
          throw new Error('Excel dosyasında okunabilecek satır bulunamadı.')
        }

        // Helper to match column names flexibly
        const getVal = (row, alternatives) => {
          for (const key of Object.keys(row)) {
            const cleanKey = key.trim().toLowerCase().replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
            if (alternatives.includes(cleanKey)) {
              return String(row[key] || '').trim()
            }
          }
          return ''
        }

        const basariliKayitlar = []
        const hatalar = []

        // Fetch existing books for duplicate check and adjustment
        const mevcutKitapMap = new Map(kitaplar.map(k => [k.barkod, k]))

        // Group rows to process
        const islenecekKitaplar = []

        satirlar.forEach((satir, index) => {
          const barkod = getVal(satir, ['barkod', 'barcode', 'kod', 'isbn'])
          const ad = getVal(satir, ['kitap adi', 'kitapadi', 'ad', 'title', 'name', 'kitap'])
          const yazar = getVal(satir, ['yazar', 'author', 'writer'])
          const yayinevi = getVal(satir, ['yayinevi', 'yayin evi', 'publisher'])
          const tur = getVal(satir, ['tur', 'kategori', 'genre', 'category'])
          const konum = getVal(satir, ['konum', 'raf', 'location', 'shelf'])
          const toplamAdetRaw = getVal(satir, ['toplam adet', 'toplamadet', 'adet', 'quantity', 'qty', 'toplam'])

          const satirNo = index + 2 // header is row 1

          if (!barkod) {
            hatalar.push(`Satır ${satirNo}: Barkod hücresi boş.`)
            return
          }
          if (!ad) {
            hatalar.push(`Satır ${satirNo}: Kitap adı boş.`)
            return
          }

          const adet = Math.max(1, parseInt(toplamAdetRaw) || 1)

          islenecekKitaplar.push({
            barkod, ad, yazar, yayinevi, tur, konum, adet, satirNo
          })
        })

        if (islenecekKitaplar.length === 0) {
          throw new Error('Geçerli kitap verisi içeren satır bulunamadı. Lütfen şablonu inceleyin.')
        }

        // Process in chunks of 400 (Firestore batch limit is 500)
        let basariliAdet = 0
        let guncellenenAdet = 0

        for (let i = 0; i < islenecekKitaplar.length; i += 400) {
          const chunk = islenecekKitaplar.slice(i, i + 400)
          const batch = writeBatch(db)

          chunk.forEach(k => {
            const eskiKitap = mevcutKitapMap.get(k.barkod)
            if (eskiKitap) {
              // Update existing quantity
              const fark = k.adet - (eskiKitap.toplamAdet || 0)
              const yeniMevcut = Math.max(0, (eskiKitap.mevcutAdet || 0) + fark)

              const kRef = doc(db, 'kurumlar', hedefKurumId, 'kitaplar', eskiKitap.id)
              batch.update(kRef, {
                ad: k.ad,
                yazar: k.yazar,
                yayinevi: k.yayinevi,
                tur: k.tur,
                konum: k.konum,
                toplamAdet: k.adet,
                mevcutAdet: yeniMevcut
              })
              guncellenenAdet++
            } else {
              // Add new book
              const kRef = doc(collection(db, 'kurumlar', hedefKurumId, 'kitaplar'))
              batch.set(kRef, {
                barkod: k.barkod,
                ad: k.ad,
                yazar: k.yazar,
                yayinevi: k.yayinevi,
                tur: k.tur,
                konum: k.konum,
                toplamAdet: k.adet,
                mevcutAdet: k.adet,
                kayitTarihi: serverTimestamp()
              })
              basariliAdet++
            }
          })

          await batch.commit()
        }

        logKaydet({
          profil, kullanici, islem: 'olustur', modul: 'kutuphane',
          hedefAd: `Toplu Kitap Excel Yükleme: ${islenecekKitaplar.length} satır`, kurumId: hedefKurumId
        })

        let sonucMetni = `Yükleme tamamlandı. ${basariliAdet} yeni kitap eklendi, ${guncellenenAdet} mevcut kitap güncellendi.`
        if (hatalar.length > 0) {
          sonucMetni += `\n\nPas geçilen hatalar:\n${hatalar.slice(0, 10).join('\n')}`
          if (hatalar.length > 10) sonucMetni += `\n...ve ${hatalar.length - 10} adet daha hata var.`
        }

        setExcelSonuc(sonucMetni)
        setExcelDosya(null)
      } catch (err) {
        setHata('Excel okuma hatası: ' + err.message)
      } finally {
        setExcelYukleniyor(false)
      }
    }

    reader.readAsBinaryString(excelDosya)
  }

  // ── Render helper ────────────────────────────────────────
  const isGecikmis = (kayit) => {
    if (kayit.durum !== 'odunc') return false
    const bugunMs = Date.now()
    const beklenenMs = kayit.iadeBeklenenTarih?.seconds
      ? kayit.iadeBeklenenTarih.seconds * 1000
      : new Date(kayit.iadeBeklenenTarih).getTime()
    return beklenenMs < bugunMs
  }

  // Styles
  const styles = {
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' },
    statCard: {
      background: 'rgba(255, 255, 255, 0.75)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      borderRadius: '16px',
      padding: '1.25rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem'
    },
    statIcon: {
      width: '48px', height: '48px', borderRadius: '12px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.5rem', fontWeight: 'bold'
    },
    tableHeader: { padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    tableRow: { transition: 'background-color 0.15s ease' },
    tableCell: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    btn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.1rem', fontSize: '0.875rem', fontWeight: '600', borderRadius: '8px', cursor: 'pointer', border: 'none', transition: 'all 0.15s ease' },
    primaryBtn: { background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)', color: '#fff', boxShadow: '0 4px 10px rgba(79, 70, 229, 0.2)' },
    secondaryBtn: { background: '#fff', color: '#374151', border: '1.5px solid #D1D5DB' },
    dangerBtn: { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' },
    actionBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '1rem', transition: 'transform 0.1s' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.3)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
    modalContent: { background: '#fff', borderRadius: '18px', width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' },
    input: { width: '100%', padding: '0.65rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', color: '#1E293B', transition: 'border-color 0.15s' },
    label: { fontSize: '0.825rem', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '0.35rem' },
    select: { width: '100%', padding: '0.65rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', color: '#1E293B', background: '#fff', cursor: 'pointer' },
  }

  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            📚 Okul Kütüphanesi
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.925rem', marginTop: '0.25rem' }}>
            Kitap envanteri, Excel aktarımları ve ödünç/iade işlemleri
          </p>
        </div>

        {/* Institution selection dropdown if platform_admin or campus levels */}
        {seviye !== 'altKurum' && !ogretmenModu && (
          <div style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', border: '1px solid #C7D2FE', borderRadius: '12px', padding: '0.75rem 1.125rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#3730A3' }}>🏫 Okul Seçimi:</span>
            <select value={secilenAltKurumId} onChange={e => setSecilenAltKurumId(e.target.value)}
              style={{ padding: '6px 12px', border: '1.5px solid #4F46E5', borderRadius: '8px', fontSize: '0.875rem', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: '600' }}>
              <option value="">— İşlem yapılacak okulu seçin —</option>
              {(() => {
                const OKUL_SIRA = { ilkokul: 1, ortaokul: 2, lise: 3 }
                const kampusIdler = [...new Set(sayimKurumlar.map(k => k.parentId).filter(Boolean))]
                const kampusGruplari = kampusIdler
                  .map(kpId => ({
                    kampus: erisimKurumlar.find(x => x.id === kpId),
                    altlar: sayimKurumlar
                      .filter(k => k.parentId === kpId)
                      .sort((a, b) => (OKUL_SIRA[a.okulTuru] || 9) - (OKUL_SIRA[b.okulTuru] || 9) || (a.ad || '').localeCompare(b.ad || '', 'tr')),
                  }))
                  .filter(g => g.kampus)
                  .sort((a, b) => (a.kampus.ad || '').localeCompare(b.kampus.ad || '', 'tr'))

                return kampusGruplari.map(({ kampus, altlar }) => (
                  <optgroup key={kampus.id} label={`🏛 ${kampus.ad}`}>
                    {altlar.map(k => (
                      <option key={k.id} value={k.id}>{k.ad}</option>
                    ))}
                  </optgroup>
                ))
              })()}
            </select>
          </div>
        )}
      </div>

      {/* Warning if no school is selected under parent level */}
      {!hedefKurumId ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.6)', border: '1.5px dashed #CBD5E1', borderRadius: '16px' }}>
          <span style={{ fontSize: '3rem' }}>📚</span>
          <h3 style={{ color: '#1E293B', marginTop: '1rem', fontSize: '1.1rem', fontWeight: '700' }}>Aktif Okul Seçilmedi</h3>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: '0.5rem', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
            Kütüphane kayıtlarını görüntülemek, yeni kitap veya ödünç işlemi eklemek için yukarıdan bir alt okul seçmelisiniz.
          </p>
        </div>
      ) : (
        <>
          {/* Dashboard statistics section */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard} className="stat-card">
              <div style={{ ...styles.statIcon, background: '#E0E7FF', color: '#4F46E5' }}>📚</div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Farklı Başlık</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', marginTop: '0.15rem' }}>{istatistikler.toplamFarkli}</div>
              </div>
            </div>

            <div style={styles.statCard} className="stat-card">
              <div style={{ ...styles.statIcon, background: '#ECFDF5', color: '#10B981' }}>📖</div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Toplam Kitap</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', marginTop: '0.15rem' }}>{istatistikler.toplamKitapAdet}</div>
              </div>
            </div>

            <div style={styles.statCard} className="stat-card">
              <div style={{ ...styles.statIcon, background: '#FFF7ED', color: '#F97316' }}>🔄</div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Ödünç Verilen</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', marginTop: '0.15rem' }}>{istatistikler.aktifOdunc}</div>
              </div>
            </div>

            <div style={styles.statCard} className="stat-card">
              <div style={{ ...styles.statIcon, background: '#FEF2F2', color: '#EF4444' }}>⚠️</div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Süresi Geciken</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', marginTop: '0.15rem' }}>{istatistikler.gecikenOdunc}</div>
              </div>
            </div>
          </div>

          {/* Alert messages */}
          {basari && (
            <div style={{ padding: '0.875rem 1.25rem', background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: '10px', color: '#065F46', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✅ {basari}</span>
              <button onClick={() => setBasari('')} style={{ background: 'none', border: 'none', color: '#065F46', fontWeight: 'bold', cursor: 'pointer' }}>✕</button>
            </div>
          )}

          {hata && (
            <div style={{ padding: '0.875rem 1.25rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '10px', color: '#991B1B', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚠️ {hata}</span>
              <button onClick={() => setHata('')} style={{ background: 'none', border: 'none', color: '#991B1B', fontWeight: 'bold', cursor: 'pointer' }}>✕</button>
            </div>
          )}

          {/* Excel Result alert */}
          {excelSonuc && (
            <div style={{ padding: '1rem 1.5rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', color: '#1E40AF', fontSize: '0.85rem', whiteSpace: 'pre-line', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>📊 Excel İşlem Raporu:</div>
              <div>{excelSonuc}</div>
              <button onClick={() => setExcelSonuc('')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#1D4ED8', textDecoration: 'underline', fontWeight: '600', cursor: 'pointer', padding: 0 }}>Raporu Kapat</button>
            </div>
          )}

          {/* Action & Navigation Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E2E8F0', marginBottom: '1.5rem', paddingBottom: '0.1rem', flexWrap: 'wrap', gap: '1rem' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <button onClick={() => setSekme('kitaplar')} style={{
                background: 'none', border: 'none', padding: '0.75rem 0.5rem', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer',
                color: sekme === 'kitaplar' ? '#4F46E5' : '#64748B',
                borderBottom: sekme === 'kitaplar' ? '3px solid #4F46E5' : '3px solid transparent',
                transition: 'all 0.15s ease'
              }}>
                📚 Kitap Listesi ({kitaplar.length})
              </button>

              <button onClick={() => setSekme('odunc')} style={{
                background: 'none', border: 'none', padding: '0.75rem 0.5rem', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer',
                color: sekme === 'odunc' ? '#4F46E5' : '#64748B',
                borderBottom: sekme === 'odunc' ? '3px solid #4F46E5' : '3px solid transparent',
                transition: 'all 0.15s ease'
              }}>
                🔄 Ödünç & İade Takibi
              </button>

              <button onClick={() => setSekme('uyeler')} style={{
                background: 'none', border: 'none', padding: '0.75rem 0.5rem', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer',
                color: sekme === 'uyeler' ? '#4F46E5' : '#64748B',
                borderBottom: sekme === 'uyeler' ? '3px solid #4F46E5' : '3px solid transparent',
                transition: 'all 0.15s ease'
              }}>
                👥 Üye Listesi ({birlesikUyeler.length})
              </button>
            </div>

            {/* Actions for current tab */}
            {sekme === 'kitaplar' ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Excel Upload Input */}
                <label style={{ ...styles.btn, ...styles.secondaryBtn, display: 'inline-flex', position: 'relative', overflow: 'hidden' }}>
                  📥 Excel'den Yükle
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelDosyaSecimi} style={{ position: 'absolute', top: 0, right: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                </label>

                {excelDosya && (
                  <button onClick={handleExcelYukle} disabled={excelYukleniyor} style={{ ...styles.btn, background: '#10B981', color: '#fff', opacity: excelYukleniyor ? 0.7 : 1 }}>
                    {excelYukleniyor ? 'Yükleniyor...' : `✓ ${excelDosya.name} Yükle`}
                  </button>
                )}

                <button onClick={handleSablonIndir} style={{ ...styles.btn, ...styles.secondaryBtn }}>
                  📄 Şablon İndir
                </button>

                <button onClick={() => openKitapModal(null)} style={{ ...styles.btn, ...styles.primaryBtn }}>
                  ➕ Yeni Kitap Ekle
                </button>
              </div>
            ) : (
              <button onClick={() => openOduncModal('')} style={{ ...styles.btn, ...styles.primaryBtn }}>
                🔄 Kitap Ödünç Ver
              </button>
            )}
          </div>

          {/* TAB CONTENT 1: BOOKS */}
          {sekme === 'kitaplar' && (
            <div>
              {/* Filters */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <input value={kitapArama} onChange={e => setKitapArama(e.target.value)}
                  placeholder="Barkod, kitap adı, yazar veya yayınevi ara..."
                  style={{ ...styles.input, width: '300px' }} />

                <select value={kitapTurFiltre} onChange={e => setKitapTurFiltre(e.target.value)}
                  style={{ ...styles.select, width: '180px' }}>
                  <option value="">— Tüm Türler —</option>
                  {kitapTurleri.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                {(kitapArama || kitapTurFiltre) && (
                  <button onClick={() => { setKitapArama(''); setKitapTurFiltre('') }} style={{ ...styles.btn, ...styles.secondaryBtn, padding: '0.5rem 0.8rem' }}>
                    Temizle
                  </button>
                )}
              </div>

              {/* Table */}
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={styles.tableHeader}>Barkod</th>
                      <th style={styles.tableHeader}>Kitap Adı</th>
                      <th style={styles.tableHeader}>Yazar</th>
                      <th style={styles.tableHeader}>Yayınevi</th>
                      <th style={styles.tableHeader}>Tür</th>
                      <th style={styles.tableHeader}>Konum</th>
                      <th style={{ ...styles.tableHeader, textAlign: 'center' }}>Toplam/Mevcut</th>
                      <th style={{ ...styles.tableHeader, textAlign: 'right' }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtreliKitaplar.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                          Aradığınız kriterlere uygun kitap bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      filtreliKitaplar.map(k => (
                        <tr key={k.id} style={styles.tableRow} className="table-row-hover">
                          <td style={{ ...styles.tableCell, fontFamily: 'monospace', fontWeight: '600' }}>{k.barkod}</td>
                          <td style={{ ...styles.tableCell, fontWeight: '700', color: '#1B3A6B' }}>{k.ad}</td>
                          <td style={styles.tableCell}>{k.yazar || '—'}</td>
                          <td style={styles.tableCell}>{k.yayinevi || '—'}</td>
                          <td style={styles.tableCell}>
                            {k.tur ? (
                              <span style={{ fontSize: '0.75rem', background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>{k.tur}</span>
                            ) : '—'}
                          </td>
                          <td style={styles.tableCell}>
                            {k.konum ? (
                              <span style={{ fontSize: '0.75rem', background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontFamily: 'monospace' }}>{k.konum}</span>
                            ) : '—'}
                          </td>
                          <td style={{ ...styles.tableCell, textAlign: 'center' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: k.mevcutAdet > 0 ? '#10B981' : '#EF4444' }}>
                              {k.mevcutAdet}
                            </span>
                            <span style={{ color: '#94A3B8', margin: '0 4px' }}>/</span>
                            <span style={{ color: '#64748B' }}>{k.toplamAdet}</span>
                          </td>
                          <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                              {k.mevcutAdet > 0 ? (
                                <button title="Ödünç Ver" onClick={() => openOduncModal(k.id)} style={{ ...styles.actionBtn, color: '#4F46E5' }}>🔄</button>
                              ) : (
                                <span title="Stokta Yok" style={{ padding: '4px', fontSize: '1rem', opacity: 0.3, cursor: 'not-allowed' }}>🔄</span>
                              )}
                              <button title="Düzenle" onClick={() => openKitapModal(k)} style={{ ...styles.actionBtn, color: '#0EA5E9' }}>✏️</button>
                              <button title="Sil" onClick={() => handleKitapSil(k)} style={{ ...styles.actionBtn, color: '#EF4444' }}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB CONTENT 2: BORROWS */}
          {sekme === 'odunc' && (
            <div>
              {/* Filters */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <input value={oduncArama} onChange={e => setOduncArama(e.target.value)}
                  placeholder="Kitap adı, barkod veya üye adı ara..."
                  style={{ ...styles.input, width: '300px' }} />

                <select value={oduncFiltre} onChange={e => setOduncFiltre(e.target.value)}
                  style={{ ...styles.select, width: '180px' }}>
                  <option value="hepsi">Tüm Kayıtlar</option>
                  <option value="odunc">Aktif Ödünçtekiler</option>
                  <option value="geciken">Süresi Gecikenler ⚠️</option>
                  <option value="iade">İade Edilenler</option>
                </select>

                {(oduncArama || oduncFiltre !== 'hepsi') && (
                  <button onClick={() => { setOduncArama(''); setOduncFiltre('hepsi') }} style={{ ...styles.btn, ...styles.secondaryBtn, padding: '0.5rem 0.8rem' }}>
                    Temizle
                  </button>
                )}
              </div>

              {/* Table */}
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={styles.tableHeader}>Kitap Barkod / Adı</th>
                      <th style={styles.tableHeader}>Ödünç Alan Üye</th>
                      <th style={styles.tableHeader}>Veriliş Tarihi</th>
                      <th style={styles.tableHeader}>Beklenen İade Tarihi</th>
                      <th style={styles.tableHeader}>İade Tarihi</th>
                      <th style={styles.tableHeader}>Durum</th>
                      <th style={{ ...styles.tableHeader, textAlign: 'right' }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtreliOduncKayitlari.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                          Aradığınız kriterlere uygun ödünç/iade kaydı bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      filtreliOduncKayitlari.map(o => {
                        const gecikmis = isGecikmis(o)
                        return (
                          <tr key={o.id} style={styles.tableRow} className="table-row-hover">
                            <td style={styles.tableCell}>
                              <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748B' }}>{o.kitapBarkod}</div>
                              <div style={{ fontWeight: '700', color: '#1B3A6B', marginTop: '0.15rem' }}>{o.kitapAd}</div>
                            </td>
                            <td style={styles.tableCell}>
                              <div style={{ fontWeight: '600', color: '#1E293B' }}>
                                {o.uyeAd}
                                <span style={{ marginLeft: '6px', fontSize: '0.7rem', verticalAlign: 'middle', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', background: o.uyeTur === 'ogrenci' ? '#E0F2FE' : '#D1FAE5', color: o.uyeTur === 'ogrenci' ? '#0369A1' : '#065F46' }}>
                                  {o.uyeTur === 'ogrenci' ? 'Öğrenci' : 'Öğretmen'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.15rem' }}>{o.uyeDetay}</div>
                            </td>
                            <td style={styles.tableCell}>
                              {o.verilisTarihi ? new Date(o.verilisTarihi.seconds ? o.verilisTarihi.seconds * 1000 : o.verilisTarihi).toLocaleDateString('tr-TR') : '—'}
                            </td>
                            <td style={styles.tableCell}>
                              <span style={{ fontWeight: gecikmis ? 'bold' : 'normal', color: gecikmis ? '#EF4444' : '#1E293B' }}>
                                {o.iadeBeklenenTarih ? new Date(o.iadeBeklenenTarih).toLocaleDateString('tr-TR') : '—'}
                              </span>
                            </td>
                            <td style={styles.tableCell}>
                              {o.iadeTarihi ? new Date(o.iadeTarihi.seconds ? o.iadeTarihi.seconds * 1000 : o.iadeTarihi).toLocaleDateString('tr-TR') : '—'}
                            </td>
                            <td style={styles.tableCell}>
                              {o.durum === 'iade' ? (
                                <span style={{ fontSize: '0.75rem', background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>✓ İade Edildi</span>
                              ) : gecikmis ? (
                                <span style={{ fontSize: '0.75rem', background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>⚠️ Gecikmiş</span>
                              ) : (
                                <span style={{ fontSize: '0.75rem', background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>🔄 Ödünçte</span>
                              )}
                            </td>
                            <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                              {o.durum === 'odunc' ? (
                                <button onClick={() => handleIadeAl(o)} style={{ ...styles.btn, background: '#10B981', color: '#fff', padding: '4px 10px', fontSize: '0.75rem' }}>
                                  ✓ İade Al
                                </button>
                              ) : (
                                <span style={{ color: '#94A3B8', fontSize: '0.8rem', fontStyle: 'italic' }}>İşlem bitti</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB CONTENT 3: MEMBERS */}
          {sekme === 'uyeler' && (
            <div>
              {/* Filters */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <input value={uyeArama} onChange={e => setUyeArama(e.target.value)}
                  placeholder="Üye adı, sınıf, numara veya e-posta ara..."
                  style={{ ...styles.input, width: '300px' }} />

                <select value={uyeTurFiltre} onChange={e => setUyeTurFiltre(e.target.value)}
                  style={{ ...styles.select, width: '180px' }}>
                  <option value="hepsi">Tüm Üyeler</option>
                  <option value="ogrenci">Sadece Öğrenciler</option>
                  <option value="ogretmen">Sadece Öğretmenler</option>
                  <option value="aktif_odunc">Aktif Ödünç Alanlar</option>
                </select>

                {(uyeArama || uyeTurFiltre !== 'hepsi') && (
                  <button onClick={() => { setUyeArama(''); setUyeTurFiltre('hepsi') }} style={{ ...styles.btn, ...styles.secondaryBtn, padding: '0.5rem 0.8rem' }}>
                    Temizle
                  </button>
                )}
              </div>

              {/* Table */}
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={styles.tableHeader}>Üye Adı Soyadı</th>
                      <th style={styles.tableHeader}>Üye Türü</th>
                      <th style={styles.tableHeader}>Sınıf / E-posta / Detay</th>
                      <th style={{ ...styles.tableHeader, textAlign: 'center' }}>Aktif Ödünçte</th>
                      <th style={{ ...styles.tableHeader, textAlign: 'center' }}>Toplam İşlem</th>
                      <th style={{ ...styles.tableHeader, textAlign: 'right' }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtreliUyeler.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                          Aradığınız kriterlere uygun üye bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      filtreliUyeler.map(u => (
                        <tr key={u.id} style={styles.tableRow} className="table-row-hover">
                          <td style={{ ...styles.tableCell, fontWeight: '700', color: '#1B3A6B' }}>{u.ad}</td>
                          <td style={styles.tableCell}>
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', background: u.tur === 'ogrenci' ? '#E0F2FE' : '#D1FAE5', color: u.tur === 'ogrenci' ? '#0369A1' : '#065F46' }}>
                              {u.tur === 'ogrenci' ? 'Öğrenci' : 'Öğretmen / Personel'}
                            </span>
                          </td>
                          <td style={styles.tableCell}>{u.detay}</td>
                          <td style={{ ...styles.tableCell, textAlign: 'center', fontWeight: 'bold', color: u.activeCount > 0 ? '#EF4444' : '#64748B' }}>
                            {u.activeCount}
                          </td>
                          <td style={{ ...styles.tableCell, textAlign: 'center', color: '#64748B' }}>
                            {u.totalCount}
                          </td>
                          <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                            <button onClick={() => openOduncModalUye(u)} style={{ ...styles.btn, background: '#4F46E5', color: '#fff', padding: '4px 10px', fontSize: '0.75rem' }}>
                              🔄 Ödünç Ver
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* BOOK ADD/EDIT MODAL */}
      {kitapModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #1B3A6B 0%, #1E40AF 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem' }}>
                {duzenlenenKitap ? '📖 Kitap Düzenle' : '📚 Yeni Kitap Ekle'}
              </h3>
              <button onClick={() => setKitapModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleKitapKaydet} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={styles.label}>Barkod / ISBN *</label>
                <input value={kitapForm.barkod} onChange={e => setKitapForm(prev => ({ ...prev, barkod: e.target.value }))}
                  required placeholder="Örn: 9786053755494" style={styles.input} />
              </div>

              <div>
                <label style={styles.label}>Kitap Adı *</label>
                <input value={kitapForm.ad} onChange={e => setKitapForm(prev => ({ ...prev, ad: e.target.value }))}
                  required placeholder="Kitap adını girin..." style={styles.input} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={styles.label}>Yazar</label>
                  <input value={kitapForm.yazar} onChange={e => setKitapForm(prev => ({ ...prev, yazar: e.target.value }))}
                    placeholder="Yazar adı..." style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>Yayınevi</label>
                  <input value={kitapForm.yayinevi} onChange={e => setKitapForm(prev => ({ ...prev, yayinevi: e.target.value }))}
                    placeholder="Yayınevi..." style={styles.input} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={styles.label}>Tür / Kategori</label>
                  <input value={kitapForm.tur} onChange={e => setKitapForm(prev => ({ ...prev, tur: e.target.value }))}
                    placeholder="Örn: Roman, Bilim..." style={styles.input} list="kutuphane-turler" />
                  <datalist id="kutuphane-turler">
                    {kitapTurleri.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <div>
                  <label style={styles.label}>Konum / Raf</label>
                  <input value={kitapForm.konum} onChange={e => setKitapForm(prev => ({ ...prev, konum: e.target.value }))}
                    placeholder="Örn: A-2, B-1..." style={styles.input} />
                </div>
              </div>

              <div>
                <label style={styles.label}>Toplam Adet *</label>
                <input type="number" min="1" value={kitapForm.toplamAdet} onChange={e => setKitapForm(prev => ({ ...prev, toplamAdet: e.target.value }))}
                  required style={styles.input} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setKitapModal(false)} style={{ ...styles.btn, ...styles.secondaryBtn }}>Vazgeç</button>
                <button type="submit" disabled={kaydediyor} style={{ ...styles.btn, ...styles.primaryBtn }}>
                  {kaydediyor ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LEND / BORROW MODAL */}
      {oduncModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #1B3A6B 0%, #1E40AF 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem' }}>🔄 Kitap Ödünç Ver</h3>
              <button onClick={() => setOduncModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleOduncVer} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={styles.label}>Ödünç Verilecek Kitap *</label>
                <select value={oduncForm.kitapId} onChange={e => setOduncForm(prev => ({ ...prev, kitapId: e.target.value }))}
                  required style={styles.select}>
                  <option value="">— Kitap seçin —</option>
                  {kitaplar.filter(k => k.mevcutAdet > 0).map(k => (
                    <option key={k.id} value={k.id}>📚 {k.ad} ({k.yazar || 'Yazarsız'}) — Barkod: {k.barkod} [Mevcut: {k.mevcutAdet}]</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Üye Türü *</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input type="radio" name="uyeTur" checked={oduncForm.uyeTur === 'ogrenci'}
                      onChange={() => { setOduncForm(p => ({ ...p, uyeTur: 'ogrenci' })); setSecilenUyeObj(null); setOduncUyeArama('') }} />
                    Öğrenci
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input type="radio" name="uyeTur" checked={oduncForm.uyeTur === 'ogretmen'}
                      onChange={() => { setOduncForm(p => ({ ...p, uyeTur: 'ogretmen' })); setSecilenUyeObj(null); setOduncUyeArama('') }} />
                    Öğretmen / Personel
                  </label>
                </div>
              </div>

              <div>
                <label style={styles.label}>Üye Arama (Ad/Soyad/No/E-posta) *</label>
                {!secilenUyeObj ? (
                  <div style={{ position: 'relative' }}>
                    <input value={oduncUyeArama} onChange={e => setOduncUyeArama(e.target.value)}
                      placeholder={oduncForm.uyeTur === 'ogrenci' ? 'Öğrenci adı veya numarası yazın...' : 'Öğretmen adı veya e-postası yazın...'} style={styles.input} />

                    {filtrelenmisUyeler.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #CBD5E1', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
                        {filtrelenmisUyeler.map(u => {
                          const adGoster = oduncForm.uyeTur === 'ogrenci' ? `${u.ad} ${u.soyad || ''}`.trim() : u.ad || u.email
                          const detayGoster = oduncForm.uyeTur === 'ogrenci' ? `No: ${u.ogrenciNo || '—'} · Sınıf: ${u.sinifAd || '—'}` : u.email
                          return (
                            <div key={u.id} onClick={() => { setSecilenUyeObj(u); setOduncForm(prev => ({ ...prev, uyeId: u.id })) }}
                              style={{ padding: '0.6rem 0.875rem', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', fontSize: '0.85rem' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                              <div style={{ fontWeight: '600', color: '#1E293B' }}>{adGoster}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{detayGoster}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.875rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#15803D' }}>
                        ✓ {oduncForm.uyeTur === 'ogrenci' ? `${secilenUyeObj.ad} ${secilenUyeObj.soyad || ''}`.trim() : secilenUyeObj.ad || secilenUyeObj.email}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.15rem' }}>
                        {oduncForm.uyeTur === 'ogrenci' ? `No: ${secilenUyeObj.ogrenciNo || '—'} · Sınıf: ${secilenUyeObj.sinifAd || '—'}` : secilenUyeObj.email}
                      </div>
                    </div>
                    <button type="button" onClick={() => { setSecilenUyeObj(null); setOduncForm(p => ({ ...p, uyeId: '' })) }}
                      style={{ background: 'none', border: 'none', color: '#DC2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                      Değiştir
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label style={styles.label}>Ödünç Süresi (Gün) *</label>
                <select value={oduncForm.iadeBeklenenGun} onChange={e => setOduncForm(prev => ({ ...prev, iadeBeklenenGun: e.target.value }))}
                  required style={styles.select}>
                  <option value="7">7 Gün (1 Hafta)</option>
                  <option value="15">15 Gün (~2 Hafta)</option>
                  <option value="30">30 Gün (1 Ay)</option>
                  <option value="45">45 Gün</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setOduncModal(false)} style={{ ...styles.btn, ...styles.secondaryBtn }}>Vazgeç</button>
                <button type="submit" disabled={kaydediyor} style={{ ...styles.btn, ...styles.primaryBtn }}>
                  {kaydediyor ? 'Kaydediliyor...' : 'Ödünç Ver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
