import React, { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  collection, onSnapshot, addDoc, doc, deleteDoc, writeBatch, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { logKaydet } from '../../services/logService'

export default function KurumBelirliGunler() {
  const { secilenKurumId, secilenKurum } = useKurumYonetim()
  const { profil, kullanici } = useAuth()
  const fileInputRef = useRef()

  const [belirliGunler, setBelirliGunler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [asistanModal, setAsistanModal] = useState(false)
  const [kaydediyor, setKaydediyor] = useState(false)

  // Rol kontrolü: Sadece platform yöneticisi düzenleme yapabilir
  const platformAdmin = profil?.rol === 'platform_admin'

  // Manuel Ekleme Form State'leri
  const [manuelBaslik, setManuelBaslik] = useState('')
  const [manuelBaslangic, setManuelBaslangic] = useState('')
  const [manuelBitis, setManuelBitis] = useState('')
  const [manuelTatilMi, setManuelTatilMi] = useState(false)

  // Asistan Form State'leri (Artık date-picker takvim girdileri olacak)
  const [akademikYil, setAkademikYil] = useState(new Date().getFullYear())
  const [araTatil1Bas, setAraTatil1Bas] = useState('')
  const [araTatil1Bit, setAraTatil1Bit] = useState('')
  const [somestrBas, setSomestrBas] = useState('')
  const [somestrBit, setSomestrBit] = useState('')
  const [araTatil2Bas, setAraTatil2Bas] = useState('')
  const [araTatil2Bit, setAraTatil2Bit] = useState('')
  const [ramazanBas, setRamazanBas] = useState('')
  const [ramazanBit, setRamazanBit] = useState('')
  const [kurbanBas, setKurbanBas] = useState('')
  const [kurbanBit, setKurbanBit] = useState('')

  // Global Firestore Dinleyicisi
  useEffect(() => {
    setYukleniyor(true)
    const q = query(collection(db, 'belirliGunler'), orderBy('baslangicTarihi', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setBelirliGunler(list)
      setYukleniyor(false)
    }, (err) => {
      console.error(err)
      setYukleniyor(false)
    })
    return () => unsub()
  }, [])

  // Tarih Formatlayıcı Yardımcı (YYYY-MM-DD -> GG.AA.YYYY)
  function formatTarihTr(tarihStr) {
    if (!tarihStr) return ''
    const parts = tarihStr.split('-')
    if (parts.length !== 3) return tarihStr
    const [y, a, d] = parts
    return `${d}.${a}.${y}`
  }

  // Manuel Belirli Gün Ekle
  async function handleManuelEkle(e) {
    e.preventDefault()
    if (!platformAdmin) return
    if (!manuelBaslik || !manuelBaslangic) {
      alert('Lütfen başlık ve başlangıç tarihini seçin.')
      return
    }

    setKaydediyor(true)
    try {
      await addDoc(collection(db, 'belirliGunler'), {
        baslik: manuelBaslik,
        baslangicTarihi: manuelBaslangic,
        bitisTarihi: manuelBitis || manuelBaslangic,
        tatilMi: manuelTatilMi,
        olusturmaTarihi: serverTimestamp()
      })

      logKaydet({ profil, kullanici, islem: 'olustur', modul: 'belirliGunler', hedefAd: manuelBaslik, kurumId: secilenKurumId || 'sistem' })
      setManuelBaslik('')
      setManuelBaslangic('')
      setManuelBitis('')
      setManuelTatilMi(false)
      alert('Kayıt başarıyla eklendi.')
    } catch (err) {
      alert('Ekleme sırasında hata oluştu: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  // Tekil Sil
  async function handleSil(id, baslik) {
    if (!platformAdmin) return
    if (!window.confirm(`"${baslik}" kaydını sistem genelinden silmek istediğinize emin misiniz?`)) return
    try {
      await deleteDoc(doc(db, 'belirliGunler', id))
      logKaydet({ profil, kullanici, islem: 'sil', modul: 'belirliGunler', hedefAd: baslik, kurumId: secilenKurumId || 'sistem' })
    } catch (err) {
      alert('Kayıt silinirken hata oluştu: ' + err.message)
    }
  }

  // Tümünü Temizle
  async function handleTumunuTemizle() {
    if (!platformAdmin || belirliGunler.length === 0) return
    if (!window.confirm('Sistem genelindeki tüm belirli gün ve tatilleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return
    
    setKaydediyor(true)
    try {
      const batch = writeBatch(db)
      belirliGunler.forEach(g => {
        batch.delete(doc(db, 'belirliGunler', g.id))
      })
      await batch.commit()
      logKaydet({ profil, kullanici, islem: 'sil', modul: 'belirliGunler', hedefAd: 'Tüm Liste Temizlendi', kurumId: secilenKurumId || 'sistem' })
      alert('Tüm kayıtlar başarıyla temizlendi.')
    } catch (err) {
      alert('Kayıtlar silinirken hata oluştu: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  // Hazır MEB Şablon Asistanını Kaydet
  async function handleAsistanKaydet(e) {
    e.preventDefault()
    if (!platformAdmin) return
    setKaydediyor(true)
    try {
      const batch = writeBatch(db)
      
      // Önce mevcutları silelim (temiz kurulum)
      belirliGunler.forEach(g => {
        batch.delete(doc(db, 'belirliGunler', g.id))
      })

      const yil = Number(akademikYil)
      
      // Hazır MEB Takvimi Verileri (Sosyal Etkinlikler Yönetmeliği Ek-8 Çizelgesi)
      const hazirVeriler = [
        // Eylül
        { baslangicTarihi: `${yil}-09-15`, bitisTarihi: `${yil}-09-21`, baslik: 'İlköğretim Haftası', tatilMi: false },
        { baslangicTarihi: `${yil}-09-19`, bitisTarihi: `${yil}-09-19`, baslik: 'Gaziler Günü', tatilMi: false },

        // Ekim
        { baslangicTarihi: `${yil}-10-04`, bitisTarihi: `${yil}-10-04`, baslik: 'Hayvanları Koruma Günü', tatilMi: false },
        { baslangicTarihi: `${yil}-10-13`, bitisTarihi: `${yil}-10-13`, baslik: 'Dünya Afet Azaltma Günü', tatilMi: false },
        { baslangicTarihi: `${yil}-10-29`, bitisTarihi: `${yil}-10-29`, baslik: 'Cumhuriyet Bayramı', tatilMi: true },
        { baslangicTarihi: `${yil}-10-29`, bitisTarihi: `${yil}-11-04`, baslik: 'Kızılay Haftası', tatilMi: false },

        // Kasım
        { baslangicTarihi: `${yil}-11-03`, bitisTarihi: `${yil}-11-09`, baslik: 'Organ Bağışı ve Nakli Haftası', tatilMi: false },
        { baslangicTarihi: `${yil}-11-10`, bitisTarihi: `${yil}-11-10`, baslik: 'Atatürk\'ü Anma Günü', tatilMi: false },
        { baslangicTarihi: `${yil}-11-10`, bitisTarihi: `${yil}-11-16`, baslik: 'Atatürk Haftası', tatilMi: false },
        { baslangicTarihi: `${yil}-11-12`, bitisTarihi: `${yil}-11-12`, baslik: 'Afet Eğitimi Hazırlık Günü', tatilMi: false },
        { baslangicTarihi: `${yil}-11-24`, bitisTarihi: `${yil}-11-24`, baslik: 'Öğretmenler Günü', tatilMi: false },

        // Aralık
        { baslangicTarihi: `${yil}-12-03`, bitisTarihi: `${yil}-12-03`, baslik: 'Dünya Engelliler Günü', tatilMi: false },
        { baslangicTarihi: `${yil}-12-10`, bitisTarihi: `${yil}-12-16`, baslik: 'İnsan Hakları ve Demokrasi Haftası', tatilMi: false },
        { baslangicTarihi: `${yil}-12-12`, bitisTarihi: `${yil}-12-18`, baslik: 'Tutum, Yatırım ve Türk Malları Haftası', tatilMi: false },
        { baslangicTarihi: `${yil}-12-20`, bitisTarihi: `${yil}-12-27`, baslik: 'Mehmet Akif Ersoy\'u Anma Haftası', tatilMi: false },

        // Ocak
        { baslangicTarihi: `${yil + 1}-01-01`, bitisTarihi: `${yil + 1}-01-01`, baslik: 'Yılbaşı Tatili', tatilMi: true },
        { baslangicTarihi: `${yil + 1}-01-11`, bitisTarihi: `${yil + 1}-01-17`, baslik: 'Enerji Tasarrufu Haftası', tatilMi: false },

        // Şubat
        { baslangicTarihi: `${yil + 1}-02-22`, bitisTarihi: `${yil + 1}-02-28`, baslik: 'Vergi Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-02-28`, bitisTarihi: `${yil + 1}-02-28`, baslik: 'Sivil Savunma Günü', tatilMi: false },

        // Mart
        { baslangicTarihi: `${yil + 1}-03-01`, bitisTarihi: `${yil + 1}-03-07`, baslik: 'Yeşilay Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-03-01`, bitisTarihi: `${yil + 1}-03-07`, baslik: 'Girişimcilik Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-03-08`, bitisTarihi: `${yil + 1}-03-14`, baslik: 'Bilim ve Teknoloji Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-03-12`, bitisTarihi: `${yil + 1}-03-12`, baslik: 'İstiklal Marşı\'nın Kabulü ve Mehmet Akif Ersoy\'u Anma Günü', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-03-15`, bitisTarihi: `${yil + 1}-03-21`, baslik: 'Tüketiciyi Koruma Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-03-18`, bitisTarihi: `${yil + 1}-03-18`, baslik: 'Çanakkale Zaferi ve Şehitleri Anma Günü', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-03-21`, bitisTarihi: `${yil + 1}-03-26`, baslik: 'Orman Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-03-27`, bitisTarihi: `${yil + 1}-03-27`, baslik: 'Dünya Tiyatrolar Günü', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-03-29`, bitisTarihi: `${yil + 1}-04-04`, baslik: 'Kütüphane Haftası', tatilMi: false },

        // Nisan
        { baslangicTarihi: `${yil + 1}-04-02`, bitisTarihi: `${yil + 1}-04-02`, baslik: 'Otizm Farkındalık Günü', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-04-07`, bitisTarihi: `${yil + 1}-04-13`, baslik: 'Sağlık Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-04-15`, bitisTarihi: `${yil + 1}-04-22`, baslik: 'Turizm Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-04-23`, bitisTarihi: `${yil + 1}-04-23`, baslik: 'Ulusal Egemenlik ve Çocuk Bayramı', tatilMi: true },
        { baslangicTarihi: `${yil + 1}-04-23`, bitisTarihi: `${yil + 1}-04-29`, baslik: 'Dünya Kitap Günü ve Kütüphaneler Haftası', tatilMi: false },

        // Mayıs
        { baslangicTarihi: `${yil + 1}-05-01`, bitisTarihi: `${yil + 1}-05-01`, baslik: 'Emek ve Dayanışma Günü', tatilMi: true },
        { baslangicTarihi: `${yil + 1}-05-01`, bitisTarihi: `${yil + 1}-05-07`, baslik: 'Bilişim Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-05-01`, bitisTarihi: `${yil + 1}-05-07`, baslik: 'Trafik ve İlk Yardım Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-05-10`, bitisTarihi: `${yil + 1}-05-16`, baslik: 'Engelliler Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-05-18`, bitisTarihi: `${yil + 1}-05-24`, baslik: 'Müzeler Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-05-19`, bitisTarihi: `${yil + 1}-05-19`, baslik: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı', tatilMi: true },
        { baslangicTarihi: `${yil + 1}-05-25`, bitisTarihi: `${yil + 1}-05-25`, baslik: 'Etik Günü', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-05-29`, bitisTarihi: `${yil + 1}-05-29`, baslik: 'İstanbul\'un Fethi', tatilMi: false },

        // Haziran & Temmuz
        { baslangicTarihi: `${yil + 1}-06-05`, bitisTarihi: `${yil + 1}-06-11`, baslik: 'Çevre Koruma Haftası', tatilMi: false },
        { baslangicTarihi: `${yil + 1}-07-15`, bitisTarihi: `${yil + 1}-07-15`, baslik: 'Demokrasi ve Milli Birlik Günü', tatilMi: true }
      ]

      // Kullanıcının girdiği değişken tatilleri ekleyelim (Date picker'dan gelen YYYY-MM-DD değerleri)
      if (araTatil1Bas && araTatil1Bit) {
        hazirVeriler.push({ baslangicTarihi: araTatil1Bas, bitisTarihi: araTatil1Bit, baslik: '1. Ara Tatil', tatilMi: true })
      }
      if (somestrBas && somestrBit) {
        hazirVeriler.push({ baslangicTarihi: somestrBas, bitisTarihi: somestrBit, baslik: 'Sömestr Tatili', tatilMi: true })
      }
      if (araTatil2Bas && araTatil2Bit) {
        hazirVeriler.push({ baslangicTarihi: araTatil2Bas, bitisTarihi: araTatil2Bit, baslik: '2. Ara Tatil', tatilMi: true })
      }
      if (ramazanBas && ramazanBit) {
        hazirVeriler.push({ baslangicTarihi: ramazanBas, bitisTarihi: ramazanBit, baslik: 'Ramazan Bayramı Tatili', tatilMi: true })
      }
      if (kurbanBas && kurbanBit) {
        hazirVeriler.push({ baslangicTarihi: kurbanBas, bitisTarihi: kurbanBit, baslik: 'Kurban Bayramı Tatili', tatilMi: true })
      }

      // Batch olarak yazalım
      hazirVeriler.forEach(veri => {
        const newDocRef = doc(collection(db, 'belirliGunler'))
        batch.set(newDocRef, {
          ...veri,
          olusturmaTarihi: serverTimestamp()
        })
      })

      await batch.commit()
      logKaydet({ profil, kullanici, islem: 'olustur', modul: 'belirliGunler', hedefAd: 'Hazır MEB Şablonu Yüklendi', kurumId: secilenKurumId || 'sistem' })
      alert('MEB Takvimi ve Resmi Tatiller başarıyla yüklendi!')
      setAsistanModal(false)
    } catch (err) {
      alert('Yükleme sırasında hata oluştu: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  // Excel Şablon İndir
  function handleSablonIndir() {
    const data = [
      { 'Başlangıç Tarihi (GG.AA.YYYY)': '29.10.2026', 'Bitiş Tarihi (GG.AA.YYYY)': '29.10.2026', 'Açıklama / Başlık': 'Cumhuriyet Bayramı', 'Tatil Mi (Evet/Hayır)': 'Evet' },
      { 'Başlangıç Tarihi (GG.AA.YYYY)': '10.11.2026', 'Bitiş Tarihi (GG.AA.YYYY)': '16.11.2026', 'Açıklama / Başlık': 'Atatürk Haftası', 'Tatil Mi (Evet/Hayır)': 'Hayır' },
      { 'Başlangıç Tarihi (GG.AA.YYYY)': '25.01.2027', 'Bitiş Tarihi (GG.AA.YYYY)': '05.02.2027', 'Açıklama / Başlık': 'Sömestr Tatili', 'Tatil Mi (Evet/Hayır)': 'Evet' },
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Belirli Günler Şablonu')
    XLSX.writeFile(wb, 'belirli_gunler_sablonu.xlsx')
  }

  // Excel Yükleme İşlemi (Sadece Platform Admin)
  function handleExcelOku(e) {
    if (!platformAdmin) return
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet)
        
        if (rows.length === 0) {
          alert('Excel dosyasında veri bulunamadı.')
          return
        }

        if (!window.confirm(`Excel'deki ${rows.length} kaydı sisteme aktarmak istiyor musunuz? Mevcut takvim kayıtları korunacaktır.`)) return

        setKaydediyor(true)
        const batch = writeBatch(db)
        
        const parseTrDateToYmd = (str) => {
          if (!str) return ''
          const parts = String(str).trim().split('.')
          if (parts.length !== 3) return ''
          const [d, m, y] = parts
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
        }

        rows.forEach(r => {
          const baslangicTr = r['Başlangıç Tarihi (GG.AA.YYYY)']
          const bitisTr = r['Bitiş Tarihi (GG.AA.YYYY)']
          const baslangicYmd = parseTrDateToYmd(baslangicTr)
          const bitisYmd = parseTrDateToYmd(bitisTr)
          
          const baslik = String(r['Açıklama / Başlık'] || '').trim()
          const tatilStr = String(r['Tatil Mi (Evet/Hayır)'] || '').trim().toLowerCase()
          const tatilMi = tatilStr === 'evet' || tatilStr === 'true' || tatilStr === 'yes'

          if (baslangicYmd && baslik) {
            const newDocRef = doc(collection(db, 'belirliGunler'))
            batch.set(newDocRef, {
              baslangicTarihi: baslangicYmd,
              bitisTarihi: bitisYmd || baslangicYmd,
              baslik,
              tatilMi,
              olusturmaTarihi: serverTimestamp()
            })
          }
        })

        await batch.commit()
        logKaydet({ profil, kullanici, islem: 'olustur', modul: 'belirliGunler', hedefAd: 'Excel Toplu Yükleme', kurumId: secilenKurumId || 'sistem' })
        alert('Excel verileri başarıyla yüklendi!')
      } catch (err) {
        alert('Excel okuma hatası: ' + err.message)
      } finally {
        setKaydediyor(false)
        fileInputRef.current.value = ''
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Üst Bilgi */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1B3A6B', margin: 0 }}>
            📅 Belirli Gün, Hafta & Tatiller
          </h1>
          <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: '600' }}>
            {platformAdmin ? 'Sistem Genel Takvim Yönetimi (Platform Admin)' : 'Sistem Resmi Tatil ve Belirli Gün Çizelgesi (Salt Okunur)'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Sadece Platform Yöneticisine Özel İşlemler */}
          {platformAdmin && (
            <>
              <button
                onClick={() => setAsistanModal(true)}
                style={{
                  padding: '0.5rem 1rem', background: '#10B981', color: '#fff', border: 'none',
                  borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                ✨ MEB Şablon Yükle
              </button>
              <button
                onClick={() => fileInputRef.current.click()}
                style={{
                  padding: '0.5rem 1rem', background: '#1B3A6B', color: '#fff', border: 'none',
                  borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                }}
              >
                📤 Excel'den Yükle
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleExcelOku}
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
              />
              {belirliGunler.length > 0 && (
                <button
                  onClick={handleTumunuTemizle}
                  disabled={kaydediyor}
                  style={{
                    padding: '0.5rem 1rem', background: '#EF4444', color: '#fff', border: 'none',
                    borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
                    opacity: kaydediyor ? 0.6 : 1
                  }}
                >
                  🗑️ Tümünü Temizle
                </button>
              )}
            </>
          )}

          {/* Excel Şablon İndirme Butonu Herkes İçin Açık */}
          <button
            onClick={handleSablonIndir}
            style={{
              padding: '0.5rem 1rem', background: '#4F46E5', color: '#fff', border: 'none',
              borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
            }}
          >
            📥 Excel Şablon İndir
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: platformAdmin ? '1fr 320px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Sol Sütun: Liste */}
        <div>
          {yukleniyor ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: '#64748B' }}>
              Takvim verileri yükleniyor...
            </div>
          ) : belirliGunler.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📅</div>
              Kayıtlı belirli gün, hafta veya resmi tatil bulunmuyor.
              {platformAdmin && (
                <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#64748B' }}>
                  "MEB Şablon Yükle" veya "Yeni Belirli Gün Ekle" butonlarını kullanarak ilk takvimi oluşturabilirsiniz.
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                    <th style={{ padding: '10px 12px', color: '#1B3A6B', fontWeight: '700' }}>Tarih / Aralık</th>
                    <th style={{ padding: '10px 12px', color: '#1B3A6B', fontWeight: '700' }}>Belirli Gün / Resmi Tatil Açıklaması</th>
                    <th style={{ padding: '10px 12px', color: '#1B3A6B', fontWeight: '700', textAlign: 'center' }}>Ders Yapılabilir Mi?</th>
                    {platformAdmin && <th style={{ padding: '10px 12px', color: '#1B3A6B', fontWeight: '700', textAlign: 'right' }}>İşlem</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const TURKCE_AYLAR = {
                      1: 'Ocak', 2: 'Şubat', 3: 'Mart', 4: 'Nisan', 5: 'Mayıs', 6: 'Haziran',
                      7: 'Temmuz', 8: 'Ağustos', 9: 'Eylül', 10: 'Ekim', 11: 'Kasım', 12: 'Aralık'
                    }
                    let sonAy = null
                    return belirliGunler.map(g => {
                      const ay = g.baslangicTarihi ? parseInt(g.baslangicTarihi.split('-')[1]) : 0
                      const ayAdi = TURKCE_AYLAR[ay] || 'Diğer / Tanımsız'

                      const ayDegisti = ay !== sonAy
                      sonAy = ay

                      const tarihMetni = g.baslangicTarihi === g.bitisTarihi
                        ? formatTarihTr(g.baslangicTarihi)
                        : `${formatTarihTr(g.baslangicTarihi)} - ${formatTarihTr(g.bitisTarihi)}`

                      return (
                        <React.Fragment key={g.id}>
                          {ayDegisti && (
                            <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #E2E8F0' }}>
                              <td colSpan={platformAdmin ? 4 : 3} style={{ padding: '8px 12px', fontWeight: '800', color: '#1B3A6B', fontSize: '0.85rem' }}>
                                📅 {ayAdi} Ayı Tatil ve Belirli Günleri
                              </td>
                            </tr>
                          )}
                          <tr style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '10px 12px', fontWeight: '700', color: '#334155' }}>{tarihMetni}</td>
                            <td style={{ padding: '10px 12px', color: '#334155' }}>{g.baslik}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700',
                                background: g.tatilMi ? '#FEE2E2' : '#D1FAE5',
                                color: g.tatilMi ? '#991B1B' : '#065F46'
                              }}>
                                {g.tatilMi ? '🚫 Hayır (Tatil)' : '✅ Evet (Okul Var)'}
                              </span>
                            </td>
                            {platformAdmin && (
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <button
                                  onClick={() => handleSil(g.id, g.baslik)}
                                  style={{ padding: '2px 8px', background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
                                >
                                  Sil
                                </button>
                              </td>
                            )}
                          </tr>
                        </React.Fragment>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sağ Sütun: Manuel Belirli Gün Ekleme Formu (Sadece Platform Admin) */}
        {platformAdmin && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#1B3A6B', fontWeight: '700' }}>
              ➕ Yeni Gün / Hafta Ekle
            </h3>
            
            <form onSubmit={handleManuelEkle} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Başlık / Açıklama:
                <input
                  type="text"
                  placeholder="Örn: 29 Ekim Cumhuriyet Bayramı"
                  value={manuelBaslik}
                  onChange={e => setManuelBaslik(e.target.value)}
                  style={{ padding: '0.45rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem' }}
                  required
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Başlangıç Tarihi:
                <input
                  type="date"
                  value={manuelBaslangic}
                  onChange={e => setManuelBaslangic(e.target.value)}
                  style={{ padding: '0.45rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem' }}
                  required
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Bitiş Tarihi (Opsiyonel):
                <input
                  type="date"
                  value={manuelBitis}
                  onChange={e => setManuelBitis(e.target.value)}
                  style={{ padding: '0.45rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.8rem' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '600', color: '#475569', cursor: 'pointer', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={manuelTatilMi}
                  onChange={e => setManuelTatilMi(e.target.checked)}
                />
                Bu tarih aralığı tatil mi? (Ders Bloke)
              </label>

              <button
                type="submit"
                disabled={kaydediyor}
                style={{
                  padding: '0.5rem 1rem', background: '#1B3A6B', color: '#fff', border: 'none',
                  borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
                  marginTop: '6px', opacity: kaydediyor ? 0.6 : 1
                }}
              >
                {kaydediyor ? 'Kaydediliyor...' : 'Listeye Ekle'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ✨ ŞABLON ASİSTANI MODALI */}
      {asistanModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '500px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            <div style={{ background: '#1B3A6B', padding: '1rem 1.25rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>✨ MEB Takvimi Şablon Asistanı</span>
              <button onClick={() => setAsistanModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
            </div>
            
            <form onSubmit={handleAsistanKaydet} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '80vh', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>
                Lütfen akademik eğitim yılının başlangıç yılını ve değişken resmi tatil tarihlerini takvimden seçin. Sabit resmi tatiller seçilen yıla göre otomatik hesaplanacaktır.
              </p>

              {/* Akademik Yıl Seçimi */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr', gap: '8px', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1B3A6B' }}>Eğitim Başlangıç Yılı:</span>
                <select
                  value={akademikYil}
                  onChange={e => setAkademikYil(Number(e.target.value))}
                  style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}
                >
                  <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                  <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                </select>
              </div>

              {/* Ara Tatil 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>1. Ara Tatil:</span>
                <input type="date" value={araTatil1Bas} onChange={e => setAraTatil1Bas(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} required />
                <input type="date" value={araTatil1Bit} onChange={e => setAraTatil1Bit(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} required />
              </div>

              {/* Sömestr */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>Sömestr Tatili:</span>
                <input type="date" value={somestrBas} onChange={e => setSomestrBas(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} required />
                <input type="date" value={somestrBit} onChange={e => setSomestrBit(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} required />
              </div>

              {/* Ara Tatil 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>2. Ara Tatil:</span>
                <input type="date" value={araTatil2Bas} onChange={e => setAraTatil2Bas(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} required />
                <input type="date" value={araTatil2Bit} onChange={e => setAraTatil2Bit(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} required />
              </div>

              {/* Ramazan Bayramı */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>Ramazan Bayramı:</span>
                <input type="date" value={ramazanBas} onChange={e => setRamazanBas(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} />
                <input type="date" value={ramazanBit} onChange={e => setRamazanBit(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} />
              </div>

              {/* Kurban Bayramı */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>Kurban Bayramı:</span>
                <input type="date" value={kurbanBas} onChange={e => setKurbanBas(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} />
                <input type="date" value={kurbanBit} onChange={e => setKurbanBit(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} />
              </div>

              <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontStyle: 'italic', marginTop: '4px' }}>
                * Not: Şablon yüklendiğinde mevcut listedeki tüm belirli gün ve tatiller silinerek yerine yenileri yazılacaktır.
              </div>

              {/* Modal Aksiyonları */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAsistanModal(false)}
                  style={{
                    padding: '0.4rem 1rem', background: '#F1F5F9', border: '1px solid #CBD5E1',
                    borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', color: '#475569'
                  }}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={kaydediyor}
                  style={{
                    padding: '0.4rem 1.25rem', background: '#10B981', color: '#fff', border: 'none',
                    borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
                    opacity: kaydediyor ? 0.6 : 1
                  }}
                >
                  {kaydediyor ? 'Yükleniyor...' : 'Şablonu Sisteme Yükle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
