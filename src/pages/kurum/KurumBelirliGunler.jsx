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

  // Asistan Form State'leri (Ara tatil, sömestr ve bayram tarihleri)
  const [araTatil1Bas, setAraTatil1Bas] = useState('16.11')
  const [araTatil1Bit, setAraTatil1Bit] = useState('20.11')
  const [somestrBas, setSomestrBas] = useState('25.01')
  const [somestrBit, setSomestrBit] = useState('05.02')
  const [araTatil2Bas, setAraTatil2Bas] = useState('12.04')
  const [araTatil2Bit, setAraTatil2Bit] = useState('16.04')
  const [ramazanBas, setRamazanBas] = useState('')
  const [ramazanBit, setRamazanBit] = useState('')
  const [kurbanBas, setKurbanBas] = useState('')
  const [kurbanBit, setKurbanBit] = useState('')

  // Firestore Dinleyicisi
  useEffect(() => {
    if (!secilenKurumId) {
      setBelirliGunler([])
      setYukleniyor(false)
      return
    }
    setYukleniyor(true)
    const q = query(collection(db, 'kurumlar', secilenKurumId, 'belirliGunler'), orderBy('olusturmaTarihi', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Akademik takvim yılı sıralaması: Eylül'den (9) başlayıp Haziran'a (6) kadar kronolojik sıralama
      list.sort((a, b) => {
        const parseTarih = (str) => {
          if (!str) return 9999
          const ilkKisim = str.split('-')[0].trim()
          const [gun, ay] = ilkKisim.split('.').map(Number)
          if (!ay || !gun) return 9999
          // Eylül (9) ay sırası 0, Ekim (10) -> 1, ..., Ocak (1) -> 4, ..., Haziran (6) -> 9
          const okulYiliAySira = ay >= 9 ? ay - 9 : ay + 3
          return okulYiliAySira * 100 + gun
        }
        return parseTarih(a.tarihAraligi) - parseTarih(b.tarihAraligi)
      })
      setBelirliGunler(list)
      setYukleniyor(false)
    }, (err) => {
      console.error(err)
      setYukleniyor(false)
    })
    return () => unsub()
  }, [secilenKurumId])

  // Tekil Sil
  async function handleSil(id, baslik) {
    if (!secilenKurumId) return
    if (!window.confirm(`"${baslik}" kaydını silmek istediğinize emin misiniz?`)) return
    try {
      await deleteDoc(doc(db, 'kurumlar', secilenKurumId, 'belirliGunler', id))
      logKaydet({ profil, kullanici, islem: 'sil', modul: 'belirliGunler', hedefAd: baslik, kurumId: secilenKurumId })
    } catch (err) {
      alert('Kayıt silinirken hata oluştu: ' + err.message)
    }
  }

  // Tümünü Temizle
  async function handleTumunuTemizle() {
    if (!secilenKurumId || belirliGunler.length === 0) return
    if (!window.confirm('Kayıtlı tüm belirli gün ve tatilleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return
    
    setKaydediyor(true)
    try {
      const batch = writeBatch(db)
      belirliGunler.forEach(g => {
        batch.delete(doc(db, 'kurumlar', secilenKurumId, 'belirliGunler', g.id))
      })
      await batch.commit()
      logKaydet({ profil, kullanici, islem: 'sil', modul: 'belirliGunler', hedefAd: 'Tüm Liste Temizlendi', kurumId: secilenKurumId })
      alert('Tüm kayıtlar başarıyla temizlendi.')
    } catch (err) {
      alert('Kayıtlar silinirken hata oluştu: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  // Hazır Şablon Asistanını Kaydet
  async function handleAsistanKaydet(e) {
    e.preventDefault()
    if (!secilenKurumId) return
    setKaydediyor(true)
    try {
      const batch = writeBatch(db)
      
      // Önce mevcutları silelim (tercihe bağlı ama temiz kurulum en iyisidir)
      belirliGunler.forEach(g => {
        batch.delete(doc(db, 'kurumlar', secilenKurumId, 'belirliGunler', g.id))
      })

      // Hazır MEB Takvimi Verileri (Sosyal Etkinlikler Yönetmeliği Ek-8 Çizelgesi)
      const hazirVeriler = [
        // Eylül
        { tarihAraligi: '15.09-21.09', baslik: 'İlköğretim Haftası', tatilMi: false },
        { tarihAraligi: '19.09', baslik: 'Gaziler Günü', tatilMi: false },

        // Ekim
        { tarihAraligi: '04.10', baslik: 'Hayvanları Koruma Günü', tatilMi: false },
        { tarihAraligi: '13.10', baslik: 'Dünya Afet Azaltma Günü', tatilMi: false },
        { tarihAraligi: '29.10', baslik: 'Cumhuriyet Bayramı', tatilMi: true },
        { tarihAraligi: '29.10-04.11', baslik: 'Kızılay Haftası', tatilMi: false },

        // Kasım
        { tarihAraligi: '03.11-09.11', baslik: 'Organ Bağışı ve Nakli Haftası', tatilMi: false },
        { tarihAraligi: '10.11', baslik: 'Atatürk\'ü Anma Günü', tatilMi: false },
        { tarihAraligi: '10.11-16.11', baslik: 'Atatürk Haftası', tatilMi: false },
        { tarihAraligi: '12.11', baslik: 'Afet Eğitimi Hazırlık Günü', tatilMi: false },
        { tarihAraligi: '24.11', baslik: 'Öğretmenler Günü', tatilMi: false },

        // Aralık
        { tarihAraligi: '03.12', baslik: 'Dünya Engelliler Günü', tatilMi: false },
        { tarihAraligi: '10.12-16.12', baslik: 'İnsan Hakları ve Demokrasi Haftası', tatilMi: false },
        { tarihAraligi: '12.12-18.12', baslik: 'Tutum, Yatırım ve Türk Malları Haftası', tatilMi: false },
        { tarihAraligi: '20.12-27.12', baslik: 'Mehmet Akif Ersoy\'u Anma Haftası', tatilMi: false },

        // Ocak
        { tarihAraligi: '01.01', baslik: 'Yılbaşı Tatili', tatilMi: true },
        { tarihAraligi: '11.01-17.01', baslik: 'Enerji Tasarrufu Haftası', tatilMi: false },

        // Şubat
        { tarihAraligi: '22.02-28.02', baslik: 'Vergi Haftası', tatilMi: false },
        { tarihAraligi: '28.02', baslik: 'Sivil Savunma Günü', tatilMi: false },

        // Mart
        { tarihAraligi: '01.03-07.03', baslik: 'Yeşilay Haftası', tatilMi: false },
        { tarihAraligi: '01.03-07.03', baslik: 'Girişimcilik Haftası', tatilMi: false },
        { tarihAraligi: '08.03-14.03', baslik: 'Bilim ve Teknoloji Haftası', tatilMi: false },
        { tarihAraligi: '12.03', baslik: 'İstiklal Marşı\'nın Kabulü ve Mehmet Akif Ersoy\'u Anma Günü', tatilMi: false },
        { tarihAraligi: '15.03-21.03', baslik: 'Tüketiciyi Koruma Haftası', tatilMi: false },
        { tarihAraligi: '18.03', baslik: 'Çanakkale Zaferi ve Şehitleri Anma Günü', tatilMi: false },
        { tarihAraligi: '21.03-26.03', baslik: 'Orman Haftası', tatilMi: false },
        { tarihAraligi: '27.03', baslik: 'Dünya Tiyatrolar Günü', tatilMi: false },
        { tarihAraligi: '29.03-04.04', baslik: 'Kütüphane Haftası', tatilMi: false },

        // Nisan
        { tarihAraligi: '02.04', baslik: 'Otizm Farkındalık Günü', tatilMi: false },
        { tarihAraligi: '07.04-13.04', baslik: 'Sağlık Haftası', tatilMi: false },
        { tarihAraligi: '15.04-22.04', baslik: 'Turizm Haftası', tatilMi: false },
        { tarihAraligi: '23.04', baslik: 'Ulusal Egemenlik ve Çocuk Bayramı', tatilMi: true },
        { tarihAraligi: '23.04-29.04', baslik: 'Dünya Kitap Günü ve Kütüphaneler Haftası', tatilMi: false },

        // Mayıs
        { tarihAraligi: '01.05', baslik: 'Emek ve Dayanışma Günü', tatilMi: true },
        { tarihAraligi: '01.05-07.05', baslik: 'Bilişim Haftası', tatilMi: false },
        { tarihAraligi: '01.05-07.05', baslik: 'Trafik ve İlk Yardım Haftası', tatilMi: false },
        { tarihAraligi: '10.05-16.05', baslik: 'Engelliler Haftası', tatilMi: false },
        { tarihAraligi: '18.05-24.05', baslik: 'Müzeler Haftası', tatilMi: false },
        { tarihAraligi: '19.05', baslik: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı', tatilMi: true },
        { tarihAraligi: '25.05', baslik: 'Etik Günü', tatilMi: false },
        { tarihAraligi: '29.05', baslik: 'İstanbul\'un Fethi', tatilMi: false },

        // Haziran & Temmuz
        { tarihAraligi: '05.06-11.06', baslik: 'Çevre Koruma Haftası', tatilMi: false },
        { tarihAraligi: '15.07', baslik: 'Demokrasi ve Milli Birlik Günü', tatilMi: true }
      ]

      // Kullanıcının girdiği değişken tatilleri ekleyelim
      if (araTatil1Bas && araTatil1Bit) {
        hazirVeriler.push({ tarihAraligi: `${araTatil1Bas}-${araTatil1Bit}`, baslik: '1. Ara Tatil', tatilMi: true })
      }
      if (somestrBas && somestrBit) {
        hazirVeriler.push({ tarihAraligi: `${somestrBas}-${somestrBit}`, baslik: 'Sömestr Tatili', tatilMi: true })
      }
      if (araTatil2Bas && araTatil2Bit) {
        hazirVeriler.push({ tarihAraligi: `${araTatil2Bas}-${araTatil2Bit}`, baslik: '2. Ara Tatil', tatilMi: true })
      }
      if (ramazanBas && ramazanBit) {
        hazirVeriler.push({ tarihAraligi: `${ramazanBas}-${ramazanBit}`, baslik: 'Ramazan Bayramı Tatili', tatilMi: true })
      }
      if (kurbanBas && kurbanBit) {
        hazirVeriler.push({ tarihAraligi: `${kurbanBas}-${kurbanBit}`, baslik: 'Kurban Bayramı Tatili', tatilMi: true })
      }

      // Batch'e yazalım
      hazirVeriler.forEach(veri => {
        const newDocRef = doc(collection(db, 'kurumlar', secilenKurumId, 'belirliGunler'))
        batch.set(newDocRef, {
          ...veri,
          olusturmaTarihi: serverTimestamp()
        })
      })

      await batch.commit()
      logKaydet({ profil, kullanici, islem: 'olustur', modul: 'belirliGunler', hedefAd: 'Hazır MEB Şablonu Yüklendi', kurumId: secilenKurumId })
      alert('MEB Takvimi ve Resmi Tatiller başarıyla sisteme yüklendi!')
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
      { 'Tarih / Aralık (Örn: 29.10 veya 16.11-20.11)': '29.10', 'Açıklama / Başlık': 'Cumhuriyet Bayramı', 'Tatil Mi (Evet/Hayır)': 'Evet' },
      { 'Tarih / Aralık (Örn: 29.10 veya 16.11-20.11)': '10.11-16.11', 'Açıklama / Başlık': 'Atatürk Haftası', 'Tatil Mi (Evet/Hayır)': 'Hayır' },
      { 'Tarih / Aralık (Örn: 29.10 veya 16.11-20.11)': '25.01-05.02', 'Açıklama / Başlık': 'Sömestr Tatili', 'Tatil Mi (Evet/Hayır)': 'Evet' },
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Belirli Günler Şablonu')
    XLSX.writeFile(wb, 'belirli_gunler_sablonu.xlsx')
  }

  // Excel Yükleme İşlemi
  function handleExcelOku(e) {
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
        
        rows.forEach(r => {
          const tarihStr = String(r['Tarih / Aralık (Örn: 29.10 veya 16.11-20.11)'] || '').trim()
          const baslik = String(r['Açıklama / Başlık'] || '').trim()
          const tatilStr = String(r['Tatil Mi (Evet/Hayır)'] || '').trim().toLowerCase()
          const tatilMi = tatilStr === 'evet' || tatilStr === 'true' || tatilStr === 'yes'

          if (tarihStr && baslik) {
            const newDocRef = doc(collection(db, 'kurumlar', secilenKurumId, 'belirliGunler'))
            batch.set(newDocRef, {
              tarihAraligi: tarihStr,
              baslik,
              tatilMi,
              olusturmaTarihi: serverTimestamp()
            })
          }
        })

        await batch.commit()
        logKaydet({ profil, kullanici, islem: 'olustur', modul: 'belirliGunler', hedefAd: 'Excel Toplu Yükleme', kurumId: secilenKurumId })
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
            {secilenKurum?.ad || 'Kurum Seçilmedi'} — Akademik Takvim Bloke Günleri
          </span>
        </div>

        {secilenKurumId && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
              onClick={handleSablonIndir}
              style={{
                padding: '0.5rem 1rem', background: '#4F46E5', color: '#fff', border: 'none',
                borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
              }}
            >
              📥 Excel Şablon İndir
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
          </div>
        )}
      </div>

      {!secilenKurumId ? (
        <div style={{ padding: '2rem', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '12px', textAlign: 'center', color: '#92400E' }}>
          Lütfen sol menünün üst kısmından işlem yapacağınız aktif bir okul seçin.
        </div>
      ) : yukleniyor ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: '#64748B' }}>
          Takvim verileri yükleniyor...
        </div>
      ) : belirliGunler.length === 0 ? (
        <div style={{ padding: '3rem 1.5rem', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', textAlign: 'center', color: '#94A3B8' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📅</div>
          Kayıtlı belirli gün, hafta veya resmi tatil bulunmuyor.
          <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#64748B' }}>
            "MEB Şablon Yükle" butonuna basarak standart MEB takvimini tek tıkla yükleyebilirsiniz.
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                <th style={{ padding: '10px 12px', color: '#1B3A6B', fontWeight: '700' }}>Tarih / Aralık</th>
                <th style={{ padding: '10px 12px', color: '#1B3A6B', fontWeight: '700' }}>Belirli Gün / Resmi Tatil Açıklaması</th>
                <th style={{ padding: '10px 12px', color: '#1B3A6B', fontWeight: '700', textAlign: 'center' }}>Ders Yapılabilir Mi?</th>
                <th style={{ padding: '10px 12px', color: '#1B3A6B', fontWeight: '700', textAlign: 'right' }}>İşlem</th>
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
                  const ilkKisim = (g.tarihAraligi || '').split('-')[0].trim()
                  const ay = parseInt(ilkKisim.split('.')[1]) || 0
                  const ayAdi = TURKCE_AYLAR[ay] || 'Diğer / Tanımsız'

                  const ayDegisti = ay !== sonAy
                  sonAy = ay

                  return (
                    <React.Fragment key={g.id}>
                      {ayDegisti && (
                        <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #E2E8F0' }}>
                          <td colSpan={4} style={{ padding: '8px 12px', fontWeight: '800', color: '#1B3A6B', fontSize: '0.85rem' }}>
                            📅 {ayAdi} Ayı Tatil ve Belirli Günleri
                          </td>
                        </tr>
                      )}
                      <tr style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#334155' }}>{g.tarihAraligi}</td>
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
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleSil(g.id, g.baslik)}
                            style={{ padding: '2px 8px', background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
                          >
                            Sil
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ✨ ŞABLON ASİSTANI MODALI */}
      {asistanModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '480px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            <div style={{ background: '#1B3A6B', padding: '1rem 1.25rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>✨ MEB Takvimi Şablon Asistanı</span>
              <button onClick={() => setAsistanModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
            </div>
            
            <form onSubmit={handleAsistanKaydet} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>
                Sabit resmi tatiller (29 Ekim, 23 Nisan vb.) otomatik yüklenecektir. Lütfen o eğitim yılına ait değişken tatil tarihlerini (GG.AA formatında) belirtiniz:
              </p>

              {/* Ara Tatil 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>1. Ara Tatil:</span>
                <input type="text" placeholder="Baş (16.11)" value={araTatil1Bas} onChange={e => setAraTatil1Bas(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} required />
                <input type="text" placeholder="Bit (20.11)" value={araTatil1Bit} onChange={e => setAraTatil1Bit(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} required />
              </div>

              {/* Sömestr */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>Sömestr Tatili:</span>
                <input type="text" placeholder="Baş (25.01)" value={somestrBas} onChange={e => setSomestrBas(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} required />
                <input type="text" placeholder="Bit (05.02)" value={somestrBit} onChange={e => setSomestrBit(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} required />
              </div>

              {/* Ara Tatil 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>2. Ara Tatil:</span>
                <input type="text" placeholder="Baş (12.04)" value={araTatil2Bas} onChange={e => setAraTatil2Bas(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} required />
                <input type="text" placeholder="Bit (16.04)" value={araTatil2Bit} onChange={e => setAraTatil2Bit(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} required />
              </div>

              {/* Ramazan Bayramı */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>Ramazan Bayr:</span>
                <input type="text" placeholder="Baş (20.03)" value={ramazanBas} onChange={e => setRamazanBas(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} />
                <input type="text" placeholder="Bit (23.03)" value={ramazanBit} onChange={e => setRamazanBit(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} />
              </div>

              {/* Kurban Bayramı */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>Kurban Bayr:</span>
                <input type="text" placeholder="Baş (27.05)" value={kurbanBas} onChange={e => setKurbanBas(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} />
                <input type="text" placeholder="Bit (30.05)" value={kurbanBit} onChange={e => setKurbanBit(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }} />
              </div>

              <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontStyle: 'italic', marginTop: '4px' }}>
                * Not: Şablon yüklendiğinde mevcut listedeki tüm tatil ve belirli gün kayıtları temizlenecektir.
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
