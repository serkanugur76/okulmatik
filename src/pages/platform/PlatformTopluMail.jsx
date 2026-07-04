import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { logKaydet } from '../../services/logService'
import * as XLSX from 'xlsx'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

export default function PlatformTopluMail() {
  const { profil, kullanici } = useAuth()
  const { erisimKurumlar } = useKurumYonetim()
  
  // SMTP Connection States (Loaded from localStorage for convenience)
  const [smtpHost, setSmtpHost] = useState(() => localStorage.getItem('smtp_host') || 'smtp.gmail.com')
  const [smtpPort, setSmtpPort] = useState(() => localStorage.getItem('smtp_port') || '587')
  const [smtpUsername, setSmtpUsername] = useState(() => localStorage.getItem('smtp_username') || '')
  const [smtpPassword, setSmtpPassword] = useState(() => localStorage.getItem('smtp_password') || '')
  const [fromName, setFromName] = useState(() => localStorage.getItem('smtp_from_name') || 'Okulmatik')

  // UI state for connection test
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState(null) // { success: boolean, msg: string }
  const [saveStatus, setSaveStatus] = useState(null) // 'kaydedildi' | null
  const [isDragOver, setIsDragOver] = useState(false)
  const [smtpModalAcik, setSmtpModalAcik] = useState(false)
  const [sablonModalAcik, setSablonModalAcik] = useState(false)
  const [showGoogleGuide, setShowGoogleGuide] = useState(false)

  // Excel data state
  const [students, setStudents] = useState([])
  const [selectedStudentIndex, setSelectedStudentIndex] = useState(null)

  const [seciliKurumId, setSeciliKurumId] = useState('')
  const [loadingKurumStudents, setLoadingKurumStudents] = useState(false)

  const altOkullar = useMemo(() => {
    if (!erisimKurumlar) return []
    return erisimKurumlar.filter(k => k.tip === 'altKurum')
  }, [erisimKurumlar])

  const handleFetchFromKurum = async () => {
    if (!seciliKurumId) {
      alert('Lütfen öncelikle bir kurum seçin.')
      return
    }

    const kurum = erisimKurumlar.find(k => k.id === seciliKurumId)
    const kurumAd = kurum ? kurum.ad : 'Seçili Kurum'

    setLoadingKurumStudents(true)
    addLog(`🔄 ${kurumAd} kurumuna ait öğrenciler veritabanından çekiliyor...`)

    try {
      const snap = await getDocs(collection(db, 'kurumlar', seciliKurumId, 'ogrenciler'))
      const list = []
      snap.forEach(doc => {
        const d = doc.data()
        list.push({
          id: doc.id,
          ad: d.ad || '',
          soyad: d.soyad || '',
          eposta: d.email || d.eposta || '',
          kullaniciAdi: d.kullaniciAdi || d.ogrenciNo || '',
          sifre: d.sifre || '',
          anahtarKod: d.anahtarKod || '',
          durum: 'bekliyor',
          hataMesaji: ''
        })
      })

      list.sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))

      setStudents(list)
      setTotalCount(list.length)
      setSentCount(0)
      setSelectedStudentIndex(list.length > 0 ? 0 : null)
      addLog(`✅ ${kurumAd} kurumundan ${list.length} öğrenci başarıyla yüklendi.`)
      alert(`${kurumAd} kurumundan ${list.length} öğrenci başarıyla yüklendi.`)
    } catch (err) {
      console.error(err)
      addLog(`❌ Öğrenci çekme hatası: ${err.message}`)
      alert('Öğrenciler çekilirken hata oluştu: ' + err.message)
    } finally {
      setLoadingKurumStudents(false)
    }
  }
  
  // Template state
  const [subjectTemplate, setSubjectTemplate] = useState('Erişim Bilgileriniz - {ad} {soyad}')
  const [webAddress, setWebAddress] = useState('https://dijital.okulmatic.com')
  const [messageTemplate, setMessageTemplate] = useState(
    `<p>Merhaba <strong>{ad} {soyad}</strong>,</p>\n` +
    `<p>Eğitim platformumuza erişim bilgileriniz aşağıda yer almaktadır:</p>\n` +
    `<table style="border-collapse: collapse; width: 100%; max-width: 400px; margin: 15px 0;">\n` +
    `  <tr>\n` +
    `    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Giriş Adresi:</td>\n` +
    `    <td style="padding: 8px; border: 1px solid #ddd;"><a href="{web_adresi}" target="_blank">{web_adresi}</a></td>\n` +
    `  </tr>\n` +
    `  <tr>\n` +
    `    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Kullanıcı Adı:</td>\n` +
    `    <td style="padding: 8px; border: 1px solid #ddd;">{kullanici_adi}</td>\n` +
    `  </tr>\n` +
    `  <tr>\n` +
    `    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Şifre:</td>\n` +
    `    <td style="padding: 8px; border: 1px solid #ddd;"><code>{sifre}</code></td>\n` +
    `  </tr>\n` +
    `  {if_anahtar_kod}\n` +
    `  <tr>\n` +
    `    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">İlk Aktivasyon Kodu:</td>\n` +
    `    <td style="padding: 8px; border: 1px solid #ddd;"><code>{anahtar_kod}</code></td>\n` +
    `  </tr>\n` +
    `  {endif_anahtar_kod}\n` +
    `</table>\n` +
    `<p>Lütfen bilgilerinizi güvenli bir yerde saklayınız. İyi dersler dileriz!</p>`
  )

  // Sending status state
  const [sending, setSending] = useState(false)
  const [sentCount, setSentCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [logs, setLogs] = useState([])
  
  // Refs
  const xlsxInputRef = useRef()
  const sendingRef = useRef(false)
  const logsEndRef = useRef()

  // Save connection details in localStorage
  const handleSaveSettings = () => {
    localStorage.setItem('smtp_host', smtpHost)
    localStorage.setItem('smtp_port', smtpPort)
    localStorage.setItem('smtp_username', smtpUsername)
    localStorage.setItem('smtp_password', smtpPassword)
    localStorage.setItem('smtp_from_name', fromName)
    
    setSaveStatus('kaydedildi')
    setTimeout(() => setSaveStatus(null), 3000)
    addLog('💾 SMTP Ayarları tarayıcı hafızasına kaydedildi.')
  }

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  // HTTP post bridge to secure /api/send-email endpoint
  const sendEmailApi = async (to, subject, htmlBody) => {
    const response = await fetch('/api/send-email', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        host: smtpHost,
        port: smtpPort,
        username: smtpUsername,
        password: smtpPassword,
        to,
        from: fromName ? `${fromName} <${smtpUsername}>` : smtpUsername,
        subject,
        htmlBody
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `HTTP error: ${response.status}`);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return "OK";
  }

  // SMTP self connection test trigger
  const handleTestConnection = async () => {
    if (!smtpHost || !smtpUsername || !smtpPassword) {
      alert('Lütfen SMTP Sunucusu, Kullanıcı Adı ve Şifre alanlarını doldurun.')
      return
    }

    setTestingConnection(true)
    setTestResult(null)
    addLog(`🧪 SMTP Bağlantısı test ediliyor... (Alıcı: ${smtpUsername})`)

    try {
      const result = await sendEmailApi(
        smtpUsername,
        "Okulmatik SMTP Bağlantı Testi",
        `<p>Bu e-posta Okulmatik toplu mail dağıtım aracı tarafından SMTP ayarlarınızı doğrulamak amacıyla gönderilmiştir.</p>` +
        `<p><strong>Durum:</strong> Başarılı! E-posta sunucu ayarlarınız eksiksiz çalışıyor.</p>`
      )

      if (result === 'OK') {
        setTestResult({ success: true, msg: 'Bağlantı Başarılı! Test e-postası gelen kutunuza gönderildi.' })
        addLog('✅ SMTP Bağlantı Testi Başarılı.')
      } else {
        setTestResult({ success: false, msg: result })
        addLog(`❌ SMTP Bağlantı Hatası: ${result}`)
      }
    } catch (error) {
      setTestResult({ success: false, msg: error.message })
      addLog(`❌ SMTP Bağlantı Hatası: ${error.message}`)
    } finally {
      setTestingConnection(false)
    }
  }

  // Excel file parsing logic
  const processFile = (file) => {
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        if (rows.length < 2) {
          alert('Excel dosyasında en az bir başlık satırı ve bir veri satırı bulunmalıdır.')
          return
        }

        const headers = rows[0].map(h => h !== null && h !== undefined ? h.toString().trim() : '')
        const dataRows = rows.slice(1)

        // Intelligent column mapper with robust normalization (ignores hyphens, underscores, dots, and Turkish accents)
        const mapping = {}
        headers.forEach((h, index) => {
          if (!h) return
          let clean = h.toLowerCase()
            .replace(/[^a-z0-9ıişğüöç]/g, '')
            .replace(/[ı]/g, 'i')
            .replace(/[ş]/g, 's')
            .replace(/[ğ]/g, 'g')
            .replace(/[ü]/g, 'u')
            .replace(/[ö]/g, 'o')
            .replace(/[ç]/g, 'c')

          if (['ad', 'adi', 'isim', 'name', 'firstname'].some(v => clean === v || clean.startsWith('ogrenciad'))) {
            mapping.ad = index
          } else if (['soyad', 'soyadi', 'lastname', 'surname'].some(v => clean === v || clean.startsWith('ogrencisoyad'))) {
            mapping.soyad = index
          } else if (['eposta', 'email', 'mail', 'emailadresi', 'posta'].some(v => clean === v)) {
            mapping.eposta = index
          } else if (['kullaniciadi', 'username', 'user'].some(v => clean.includes(v))) {
            mapping.kullaniciAdi = index
          } else if (['sifre', 'password', 'pass'].some(v => clean === v)) {
            mapping.sifre = index
          } else if (['anahtarkod', 'kod', 'key', 'aktivasyonkodu', 'aktivasyon', 'token'].some(v => clean.includes(v))) {
            mapping.anahtarKod = index
          }
        })

        if (mapping.eposta === undefined) {
          alert('Excel dosyasında e-posta / mail kolonu bulunamadı. Lütfen kontrol edin.')
          return
        }

        const parsedStudents = dataRows
          .filter(r => r.some(cell => cell !== '')) // skip empty rows
          .map((r, i) => {
            const ad = mapping.ad !== undefined ? r[mapping.ad]?.toString().trim() : ''
            const soyad = mapping.soyad !== undefined ? r[mapping.soyad]?.toString().trim() : ''
            const eposta = r[mapping.eposta]?.toString().trim() || ''
            const kullaniciAdi = mapping.kullaniciAdi !== undefined ? r[mapping.kullaniciAdi]?.toString().trim() : ''
            const sifre = mapping.sifre !== undefined ? r[mapping.sifre]?.toString().trim() : ''
            const anahtarKod = mapping.anahtarKod !== undefined ? r[mapping.anahtarKod]?.toString().trim() : ''

            return {
              id: i,
              ad,
              soyad,
              eposta,
              kullaniciAdi,
              sifre,
              anahtarKod,
              durum: 'bekliyor', // 'bekliyor' | 'gonderildi' | 'hata'
              hataMesaji: ''
            }
          })

        setStudents(parsedStudents)
        setTotalCount(parsedStudents.length)
        setSentCount(0)
        setSelectedStudentIndex(parsedStudents.length > 0 ? 0 : null)
        addLog(`📂 Excel başarıyla içe aktarıldı: ${parsedStudents.length} öğrenci yüklendi.`)
      } catch (err) {
        console.error(err)
        alert('Excel dosyası okunurken hata oluştu: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleExcelImport = (e) => {
    const file = e.target.files[0]
    processFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      processFile(file)
    }
  }

  const handleDownloadTemplate = () => {
    const header = ['Ad', 'Soyad', 'E-posta', 'KullaniciAdi', 'Sifre', 'AnahtarKod']
    const data = [
      ['Ahmet', 'Yılmaz', 'ahmet.yilmaz@okul.k12.tr', 'ahmetyilmaz', 'Tr45@m!a', 'OKM-2026-X72'],
      ['Elif', 'Demir', 'elif.demir@okul.k12.tr', 'elifdemir', 'P@ssw0rd99', '']
    ]
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Öğrenci Şablonu')
    XLSX.writeFile(wb, 'okulmatik_toplu_mail_sablonu.xlsx')
  }

  // Template render utility
  const renderTemplate = (template, student) => {
    if (!student) return ''
    let rendered = template
      .replace(/{ad}/g, student.ad || '')
      .replace(/{soyad}/g, student.soyad || '')
      .replace(/{kullanici_adi}/g, student.kullaniciAdi || '')
      .replace(/{sifre}/g, student.sifre || '')
      .replace(/{web_adresi}/g, webAddress)
      
    // Handle conditional activation key layout representation
    if (student.anahtarKod) {
      rendered = rendered
        .replace(/{if_anahtar_kod}/g, '')
        .replace(/{endif_anahtar_kod}/g, '')
        .replace(/{anahtar_kod}/g, student.anahtarKod)
    } else {
      // Remove the key table row if key is not defined for this row entry
      const pattern = /{if_anahtar_kod}[\s\S]*?{endif_anahtar_kod}/g
      rendered = rendered.replace(pattern, '')
    }

    return rendered
  }

  const renderSubject = (template, student) => {
    if (!student) return ''
    return template
      .replace(/{ad}/g, student.ad || '')
      .replace(/{soyad}/g, student.soyad || '')
  }

  const selectedStudent = useMemo(() => {
    if (selectedStudentIndex === null || !students[selectedStudentIndex]) return null
    return students[selectedStudentIndex]
  }, [students, selectedStudentIndex])

  const previewSubject = useMemo(() => {
    return renderSubject(subjectTemplate, selectedStudent || { ad: 'Ahmet', soyad: 'Yılmaz' })
  }, [subjectTemplate, selectedStudent])

  const previewBody = useMemo(() => {
    return renderTemplate(messageTemplate, selectedStudent || { ad: 'Ahmet', soyad: 'Yılmaz', kullaniciAdi: 'ahmetyilmaz', sifre: 'Tr45@m!a', anahtarKod: 'OKM-2026-X72' })
  }, [messageTemplate, selectedStudent, webAddress])

  // Log logger
  const addLog = (text) => {
    const timestamp = new Date().toLocaleTimeString('tr-TR')
    setLogs(prev => [...prev, `[${timestamp}] ${text}`])
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  // Bulk mail trigger workflow
  const handleStartSending = async () => {
    if (!smtpHost || !smtpUsername || !smtpPassword) {
      alert('Lütfen öncelikle SMTP sunucu ayarlarını doldurun ve kaydedin.')
      return
    }
    if (students.length === 0) {
      alert('Gönderilecek öğrenci verisi bulunmamaktadır. Lütfen Excel dosyası yükleyin.')
      return
    }
    if (!subjectTemplate.trim()) {
      alert('Lütfen e-posta konu başlığı şablonunu tanımlayın.')
      return
    }

    setSending(true)
    sendingRef.current = true
    addLog(`🛫 Toplu gönderim süreci başlatıldı. Toplam: ${students.length} öğrenci.`)

    let sent = 0
    const updatedStudents = [...students]

    for (let i = 0; i < updatedStudents.length; i++) {
      if (!sendingRef.current) {
        addLog('⏹️ Gönderim işlemi kullanıcı tarafından durduruldu.')
        break
      }

      const st = updatedStudents[i]
      if (st.durum === 'gonderildi') {
        sent++
        continue
      }

      // Throttling: every 10 emails, delay for 5 seconds to bypass mail server spam controls
      if (i > 0 && i % 10 === 0) {
        addLog('⏳ Spam engelleme koruması: 5 saniye bekleniyor...')
        for (let c = 5; c > 0; c--) {
          if (!sendingRef.current) break
          setCountdown(c)
          await sleep(1000)
        }
        setCountdown(0)
        if (!sendingRef.current) break
      }

      const subject = renderSubject(subjectTemplate, st)
      const body = renderTemplate(messageTemplate, st)

      try {
        const result = await sendEmailApi(st.eposta, subject, body)

        if (result === 'OK') {
          st.durum = 'gonderildi'
          st.hataMesaji = ''
          sent++
          setSentCount(sent)
          addLog(`✅ E-posta gönderildi: ${st.ad} ${st.soyad} (${st.eposta})`)
        } else {
          st.durum = 'hata'
          st.hataMesaji = result
          addLog(`❌ Gönderim başarısız: ${st.ad} ${st.soyad} (${st.eposta}) - Hata: ${result}`)
        }
      } catch (err) {
        st.durum = 'hata'
        st.hataMesaji = err.message
        addLog(`❌ Gönderim hatası: ${st.ad} ${st.soyad} (${st.eposta}) - Hata: ${err.message}`)
      }

      // Realtime state table updates
      setStudents([...updatedStudents])
      // Small pause between emails to breathe
      await sleep(350)
    }

    setSending(false)
    sendingRef.current = false
    addLog(`🏁 Toplu gönderim süreci sonlandı. Toplam başarılı gönderim: ${sent}/${students.length}`)

    // Record system log
    try {
      await logKaydet({
        profil,
        kullanici,
        islem: 'guncelle',
        modul: 'kullanicilar',
        hedefAd: 'Toplu Mail Dağıtımı',
        kurumId: profil?.kurumId || '',
        detay: `Toplu giriş bilgileri dağıtımı tamamlandı (SMTP: ${smtpUsername}). Başarılı: ${sent}/${students.length} mail.`
      })
    } catch (e) {
      console.warn('Sistem logu yazılamadı:', e)
    }
  }

  const handleStopSending = () => {
    sendingRef.current = false
    setSending(false)
  }

  return (
    <div style={{ paddingBottom: '60px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .mail-header-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: #1E293B;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin: 0;
        }
        .mail-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .mail-header-buttons {
          display: flex;
          gap: 10px;
        }
        @media (max-width: 768px) {
          .mail-header-title {
            font-size: 1.35rem !important;
            justify-content: center;
            text-align: center;
          }
          .mail-header-desc {
            text-align: center;
            font-size: 0.85rem !important;
          }
          .mail-header-row {
            flex-direction: column;
            align-items: stretch !important;
            text-align: center;
            gap: 0.75rem !important;
          }
          .mail-header-buttons {
            flex-direction: column !important;
            width: 100% !important;
          }
          .mail-header-buttons button {
            width: 100% !important;
            justify-content: center;
          }
        }
      `}} />
      {/* Page Header */}
      <div className="mail-header-row">
        <div>
          <h1 className="mail-header-title">
            ✉️ Toplu Mail Gönderici
          </h1>
          <p className="mail-header-desc" style={{ color: '#64748B', fontSize: '0.925rem', marginTop: '0.25rem', margin: '0.25rem 0 0' }}>
            Excel dosyasından okunan kullanıcı adlarını, şifreleri ve aktivasyon kodlarını tanımladığınız SMTP e-posta sunucunuz üzerinden spama takılmadan öğrencilerin e-posta adreslerine gönderin.
          </p>
        </div>
        <div className="mail-header-buttons">
          <button
            onClick={() => setSmtpModalAcik(true)}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#F1F5F9',
              color: '#475569',
              border: '1.5px solid #E2E8F0',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#1E293B' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569' }}
          >
            ⚙️ SMTP Gönderici Ayarları
          </button>
          <button
            onClick={() => setSablonModalAcik(true)}
            style={{
              padding: '0.65rem 1.25rem',
              background: 'linear-gradient(135deg, #1B3A6B 0%, #102A50 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(27, 58, 107, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'transform 0.1s, opacity 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = 0.9 }}
            onMouseLeave={e => { e.currentTarget.style.opacity = 1 }}
          >
            📝 Şablon & Ön İzleme
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        {/* SOL KOLON - Excel Yükleme */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* CARD 2: Excel veya Veritabanı Alıcı Yükleme */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📂 Alıcı Listesi
              </h2>
              <button
                onClick={handleDownloadTemplate}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4F46E5',
                  fontWeight: '700',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                📥 Şablonu İndir
              </button>
            </div>
            <p style={{ color: '#64748B', fontSize: '0.825rem', marginBottom: '1.25rem' }}>
              Gönderim yapacağınız öğrencileri bir kurum seçerek doğrudan veritabanından çekebilir ya da şablon Excel dosyasını yükleyebilirsiniz.
            </p>

            {/* Veritabanı Seçim ve Yükleme Paneli */}
            <div style={{
              background: '#F0F9FF',
              border: '1px solid #BAE6FD',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0369A1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                🏢 Veritabanından Kurum Seçin:
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  value={seciliKurumId}
                  onChange={e => setSeciliKurumId(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    padding: '0.5rem',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: '#334155',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">— Alt Kurum/Okul Seçin —</option>
                  {altOkullar.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.ad}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleFetchFromKurum}
                  disabled={loadingKurumStudents || !seciliKurumId}
                  style={{
                    padding: '0.5rem 1rem',
                    background: (!seciliKurumId || loadingKurumStudents) ? '#CBD5E1' : 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: (!seciliKurumId || loadingKurumStudents) ? 'not-allowed' : 'pointer',
                    boxShadow: (!seciliKurumId || loadingKurumStudents) ? 'none' : '0 2px 4px rgba(2, 132, 199, 0.2)',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {loadingKurumStudents ? '⏳ Yükleniyor...' : '🔍 Öğrencileri Yükle'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '1rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
              <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>veya</span>
              <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
            </div>

            <div
              onClick={() => xlsxInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: '2px dashed #CBD5E1',
                borderColor: isDragOver ? '#4F46E5' : '#CBD5E1',
                borderRadius: '12px',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: isDragOver ? 'rgba(79, 70, 229, 0.05)' : 'rgba(248, 250, 252, 0.5)',
                transition: 'all 0.2s',
                marginBottom: '1rem'
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569', display: 'block' }}>
                Excel veya CSV Dosyası Yükleyin
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                Sürükleyip bırakın veya göz atmak için tıklayın (.xlsx, .xls)
              </span>
              <input
                ref={xlsxInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelImport}
                style={{ display: 'none' }}
              />
            </div>

            {students.length > 0 && (
              <div style={{
                maxHeight: '260px',
                overflowY: 'auto',
                border: '1px solid #E2E8F0',
                borderRadius: '10px'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0, borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Ad Soyad</th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>E-posta</th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((st, i) => (
                      <tr
                        key={st.id}
                        onClick={() => setSelectedStudentIndex(i)}
                        style={{
                          cursor: 'pointer',
                          background: selectedStudentIndex === i ? '#EEF2FF' : 'transparent',
                          borderBottom: '1px solid #F1F5F9'
                        }}
                      >
                        <td style={{ padding: '8px', fontWeight: '600', color: '#1E293B' }}>{st.ad} {st.soyad}</td>
                        <td style={{ padding: '8px', color: '#64748B' }}>{st.eposta}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {st.durum === 'gonderildi' && <span style={{ color: '#166534', background: '#D1FAE5', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>Gönderildi</span>}
                          {st.durum === 'hata' && <span style={{ color: '#991B1B', background: '#FEE2E2', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }} title={st.hataMesaji}>Hata</span>}
                          {st.durum === 'bekliyor' && <span style={{ color: '#475569', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>Bekliyor</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* SAĞ KOLON - Şablon, Ön İzleme, Loglar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          




          {/* CARD 5: Gönderim Paneli ve Loglar */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1E293B', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚡ Toplu Gönderim Yönetimi
            </h2>

            {/* İlerleme çubuğu */}
            {totalCount > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '0.35rem' }}>
                  <span>Gönderim Durumu</span>
                  <span>{sentCount} / {totalCount} ({Math.round((sentCount / totalCount) * 100)}%)</span>
                </div>
                <div style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #4F46E5 0%, #818CF8 100%)',
                    width: `${(sentCount / totalCount) * 100}%`,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}

            {/* Geri sayım / bekleme uyarısı */}
            {countdown > 0 && (
              <div style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#1E40AF',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '1rem',
                animation: 'pulse 1.5s infinite'
              }}>
                <span>⏳</span>
                <span>Spam Engelleme: Sonraki pakete geçmeden önce <strong>{countdown} saniye</strong> bekleniyor...</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
              {sending ? (
                <button
                  onClick={handleStopSending}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  ⏹️ Gönderimi Durdur
                </button>
              ) : (
                <button
                  onClick={handleStartSending}
                  disabled={!smtpHost || !smtpUsername || !smtpPassword || students.length === 0}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: (!smtpHost || !smtpUsername || !smtpPassword || students.length === 0) ? '#CBD5E1' : 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    cursor: (!smtpHost || !smtpUsername || !smtpPassword || students.length === 0) ? 'not-allowed' : 'pointer',
                    boxShadow: (!smtpHost || !smtpUsername || !smtpPassword || students.length === 0) ? 'none' : '0 4px 6px -1px rgba(79, 70, 229, 0.4)'
                  }}
                >
                  🛫 Toplu Gönderimi Başlat
                </button>
              )}
            </div>

            {/* Gönderim Logları */}
            <div style={{
              background: '#0F172A',
              color: '#38BDF8',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              padding: '0.75rem',
              borderRadius: '8px',
              height: '140px',
              overflowY: 'auto',
              border: '1px solid #1E293B'
            }}>
              {logs.length === 0 ? (
                <div style={{ color: '#64748B' }}>İşlem kaydı bulunmuyor. Gönderim yapıldığında detaylar burada listelenir.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} style={{ marginBottom: '2px', whiteSpace: 'pre-wrap' }}>{log}</div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>

          </div>

        </div>
      </div>

      {/* ── SMTP GÖNDERİCİ AYARLARI MODALI ── */}
      {smtpModalAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '1.5rem', boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
          }}>
            {/* Modal Başlığı */}
            <div style={{
              padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#1B3A6B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚙️ SMTP Gönderici Ayarları
              </h2>
              <button
                onClick={() => setSmtpModalAcik(false)}
                style={{
                  padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: '700',
                  background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1',
                  borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: '4px', transition: 'all 0.15s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#EF4444';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = '#DC2626';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#F1F5F9';
                  e.currentTarget.style.color = '#475569';
                  e.currentTarget.style.borderColor = '#CBD5E1';
                }}
              >
                ✕ Kapat
              </button>
            </div>

            {/* Modal İçeriği */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
                <p style={{ color: '#64748B', fontSize: '0.78rem', marginBottom: '1rem', marginTop: 0 }}>
                  E-postaların gönderileceği e-posta adresini ve sunucu (SMTP) ayarlarını girin.
                </p>

                <div style={{ marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowGoogleGuide(!showGoogleGuide)}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      background: showGoogleGuide ? '#EFF6FF' : '#F1F5F9',
                      color: showGoogleGuide ? '#1E40AF' : '#475569',
                      border: `1.5px solid ${showGoogleGuide ? '#BFDBFE' : '#E2E8F0'}`,
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s'
                    }}
                  >
                    💡 Gmail / Google SMTP Kurulum Kılavuzu {showGoogleGuide ? '▲' : '▼'}
                  </button>

                  {showGoogleGuide && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '1rem',
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      borderRadius: '8px',
                      color: '#92400E',
                      fontSize: '0.75rem',
                      lineHeight: '1.45'
                    }}>
                      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: '800', color: '#B45309' }}>
                        Google Hesabı ile Toplu Mail Gönderme Adımları:
                      </h4>
                      <ol style={{ margin: 0, paddingLeft: '1.15rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <li>
                          <strong>İki Adımlı Doğrulamayı Etkinleştirin:</strong> E-posta göndereceğiniz Google hesabınızın güvenlik ayarlarından "İki Adımlı Doğrulama" (2-Step Verification) özelliğini aktif hale getirin.
                        </li>
                        <li>
                          <strong>Uygulama Şifresi Oluşturun:</strong> Google Hesabınızı Yönetin &gt; Güvenlik sekmesine gidin. Arama çubuğuna <strong>"Uygulama şifreleri"</strong> (App Passwords) yazın veya bu sayfaya yönlenin. Yeni bir şifre adı (örn: <em>Okulmatik Toplu Mail</em>) belirleyip <strong>"Oluştur"</strong> butonuna basın.
                        </li>
                        <li>
                          <strong>Şifreyi Buraya Yapıştırın:</strong> Google'ın oluşturduğu 16 karakterlik özel şifreyi kopyalayın ve aşağıdaki <strong>"Uygulama Şifresi"</strong> alanına yapıştırın. (Normal giriş şifreniz güvenlik nedeniyle SMTP üzerinden toplu gönderime izin vermez.)
                        </li>
                      </ol>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#475569', marginBottom: '0.2rem' }}>SMTP Sunucu (Host):</label>
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={e => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com"
                        style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.825rem', outline: 'none', color: '#1E293B', background: '#fff' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#475569', marginBottom: '0.2rem' }}>Port:</label>
                      <input
                        type="text"
                        value={smtpPort}
                        onChange={e => setSmtpPort(e.target.value)}
                        placeholder="587"
                        style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.825rem', outline: 'none', color: '#1E293B', background: '#fff' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#475569', marginBottom: '0.2rem' }}>Gönderen Adı (From Name):</label>
                    <input
                      type="text"
                      value={fromName}
                      onChange={e => setFromName(e.target.value)}
                      placeholder="Okul Yönetimi"
                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.825rem', outline: 'none', color: '#1E293B', background: '#fff' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#475569', marginBottom: '0.2rem' }}>Gönderici E-posta (Username):</label>
                    <input
                      type="email"
                      value={smtpUsername}
                      onChange={e => setSmtpUsername(e.target.value)}
                      placeholder="iletisim@okulmatik.com"
                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.825rem', outline: 'none', color: '#1E293B', background: '#fff' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#475569', marginBottom: '0.2rem' }}>Uygulama Şifresi / E-posta Şifresi:</label>
                    <input
                      type="password"
                      value={smtpPassword}
                      onChange={e => setSmtpPassword(e.target.value)}
                      placeholder="••••••••••••••••"
                      style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.825rem', outline: 'none', color: '#1E293B', background: '#fff' }}
                    />
                  </div>
                </div>

                {testResult && (
                  <div style={{
                    background: testResult.success ? '#F0FDF4' : '#FFF1F2',
                    border: `1px solid ${testResult.success ? '#BBF7D0' : '#FECDD3'}`,
                    color: testResult.success ? '#166534' : '#991B1B',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    marginTop: '1rem',
                    wordBreak: 'break-word'
                  }}>
                    {testResult.success ? '✅' : '❌'} {testResult.msg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                  <button
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      background: '#fff',
                      color: '#475569',
                      border: '1.5px solid #E2E8F0',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {testingConnection ? '⏳ Test Ediliyor...' : '🧪 Bağlantıyı Test Et'}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '1rem 1.5rem', borderTop: '1px solid #E2E8F0', background: '#F8FAFC',
              display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center'
            }}>
              <button
                onClick={() => setSmtpModalAcik(false)}
                style={{
                  padding: '0.55rem 1.25rem', background: '#F1F5F9', border: '1.5px solid #E2E8F0',
                  borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', color: '#475569'
                }}
              >
                Vazgeç
              </button>
              <button
                onClick={() => { handleSaveSettings(); setSmtpModalAcik(false); }}
                style={{
                  padding: '0.55rem 1.5rem', background: 'linear-gradient(135deg, #1B3A6B 0%, #102A50 100%)',
                  color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(27, 58, 107, 0.25)'
                }}
              >
                💾 Ayarları Kaydet ve Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAİL ŞABLONU VE CANLI ÖN İZLEME MODALI ── */}
      {sablonModalAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '1.5rem', boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '1100px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
          }}>
            {/* Modal Başlığı */}
            <div style={{
              padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#1B3A6B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📝 E-posta Şablonu & Canlı Ön İzleme
              </h2>
              <button
                onClick={() => setSablonModalAcik(false)}
                style={{
                  padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: '700',
                  background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1',
                  borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: '4px', transition: 'all 0.15s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#EF4444';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = '#DC2626';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#F1F5F9';
                  e.currentTarget.style.color = '#475569';
                  e.currentTarget.style.borderColor = '#CBD5E1';
                }}
              >
                ✕ Kapat
              </button>
            </div>

            {/* Modal İçeriği */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'stretch' }}>
              {/* Sol Sütun: Şablon Ayarları */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#1E293B', marginBottom: '0.25rem', marginTop: 0 }}>
                  📝 E-posta Şablon Ayarları
                </h3>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#475569', marginBottom: '0.2rem' }}>
                    E-posta Konu Başlığı (Subject):
                  </label>
                  <input
                    type="text"
                    value={subjectTemplate}
                    onChange={e => setSubjectTemplate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.825rem', outline: 'none', color: '#1E293B', background: '#fff' }}
                  />
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '0.15rem', display: 'block' }}>
                    Değişkenler: <code>{`{ad}`}</code>, <code>{`{soyad}`}</code>
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#475569', marginBottom: '0.2rem' }}>
                    Giriş Platformu Web Adresi:
                  </label>
                  <input
                    type="text"
                    value={webAddress}
                    onChange={e => setWebAddress(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.825rem', outline: 'none', color: '#1E293B', background: '#fff' }}
                  />
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#475569', marginBottom: '0.2rem' }}>
                    E-posta Mesaj Gövdesi (HTML):
                  </label>
                  <textarea
                    value={messageTemplate}
                    onChange={e => setMessageTemplate(e.target.value)}
                    style={{ width: '100%', flex: 1, minHeight: '220px', padding: '0.5rem 0.75rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.78rem', fontFamily: 'monospace', outline: 'none', color: '#1E293B', resize: 'vertical', background: '#fff' }}
                  />
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '0.25rem', display: 'block', lineHeight: '1.4' }}>
                    Etiketler: <code>{`{ad}`}</code>, <code>{`{soyad}`}</code>, <code>{`{kullanici_adi}`}</code>, <code>{`{sifre}`}</code>, <code>{`{anahtar_kod}`}</code>, <code>{`{web_adresi}`}</code>
                  </span>
                </div>
              </div>

              {/* Sağ Sütun: Canlı Ön İzleme */}
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{
                  background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px',
                  padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box'
                }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#1E293B', marginBottom: '0.5rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    👁️ Canlı E-Posta Ön İzlemesi
                  </h3>
                  <p style={{ color: '#64748B', fontSize: '0.78rem', marginBottom: '1.25rem' }}>
                    Şablonda yaptığınız değişiklikler burada anlık olarak simüle edilir.
                  </p>

                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', background: '#fff', padding: '1.25rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Konu: </span>
                      <span style={{ fontSize: '0.8rem', color: '#1E293B', fontWeight: '600' }}>{previewSubject}</span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: '#334155',
                        lineHeight: '1.6',
                        flex: 1,
                        outline: 'none'
                      }}
                      dangerouslySetInnerHTML={{ __html: previewBody }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '1rem 1.5rem', borderTop: '1px solid #E2E8F0', background: '#F8FAFC',
              display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center'
            }}>
              <button
                onClick={() => setSablonModalAcik(false)}
                style={{
                  padding: '0.55rem 1.25rem', background: '#F1F5F9', border: '1.5px solid #E2E8F0',
                  borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', color: '#475569'
                }}
              >
                Vazgeç
              </button>
              <button
                onClick={() => { handleSaveSettings(); setSablonModalAcik(false); }}
                style={{
                  padding: '0.55rem 1.5rem', background: 'linear-gradient(135deg, #1B3A6B 0%, #102A50 100%)',
                  color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(27, 58, 107, 0.25)'
                }}
              >
                💾 Şablonu Kaydet ve Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
