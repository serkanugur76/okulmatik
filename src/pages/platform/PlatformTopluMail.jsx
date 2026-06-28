import React, { useState, useEffect, useRef, useMemo } from 'react'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { logKaydet } from '../../services/logService'
import * as XLSX from 'xlsx'

export default function PlatformTopluMail() {
  const { profil, kullanici } = useAuth()
  
  // Connection state
  const [gmailToken, setGmailToken] = useState(() => sessionStorage.getItem('gmail_api_token') || '')
  const [senderEmail, setSenderEmail] = useState(() => sessionStorage.getItem('gmail_sender_email') || '')
  const [isConnected, setIsConnected] = useState(() => !!sessionStorage.getItem('gmail_api_token'))
  const [connecting, setConnecting] = useState(false)

  // Excel data state
  const [students, setStudents] = useState([])
  const [selectedStudentIndex, setSelectedStudentIndex] = useState(null)
  
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

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  // Google OAuth2 and scope activation
  const handleConnectGmail = async () => {
    setConnecting(true)
    const provider = new GoogleAuthProvider()
    provider.addScope('https://www.googleapis.com/auth/gmail.send')
    try {
      const result = await signInWithPopup(auth, provider)
      const credential = GoogleAuthProvider.credentialFromResult(result)
      const token = credential?.accessToken
      if (token) {
        setGmailToken(token)
        setSenderEmail(result.user.email || result.user.displayName || 'Google Kullanıcısı')
        setIsConnected(true)
        sessionStorage.setItem('gmail_api_token', token)
        sessionStorage.setItem('gmail_sender_email', result.user.email || '')
        addLog(`✅ Google ve Gmail API bağlantısı sağlandı (${result.user.email})`)
      } else {
        alert('Giriş sağlandı fakat erişim belirteci (Access Token) alınamadı.')
      }
    } catch (error) {
      console.error('Google bağlantı hatası:', error)
      addLog(`❌ Bağlantı hatası: ${error.message}`)
      alert('Gmail bağlantısı başarısız oldu: ' + error.message)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnectGmail = () => {
    setGmailToken('')
    setSenderEmail('')
    setIsConnected(false)
    sessionStorage.removeItem('gmail_api_token')
    sessionStorage.removeItem('gmail_sender_email')
    addLog('ℹ️ Google API bağlantısı kesildi.')
  }

  // File parsing and header mapping
  const handleExcelImport = (e) => {
    const file = e.target.files[0]
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

        const headers = rows[0].map(h => h.toString().trim())
        const dataRows = rows.slice(1)

        // Intelligent column mapper
        const mapping = {}
        headers.forEach((h, index) => {
          const clean = h.toLowerCase().replace(/\s+/g, '').replace(/[ııİi]/g, 'i').replace(/[şs]/g, 's').replace(/[ğg]/g, 'g').replace(/[üu]/g, 'u').replace(/[öo]/g, 'o').replace(/[çc]/g, 'c')
          if (['ad', 'adi', 'isim', 'name', 'firstname'].some(v => clean === v || clean.startsWith('ogrenciad'))) {
            mapping.ad = index
          } else if (['soyad', 'soyadi', 'lastname', 'surname'].some(v => clean === v || clean.startsWith('ogrencisoyad'))) {
            mapping.soyad = index
          } else if (['eposta', 'email', 'mail', 'emailadresi', 'posta'].some(v => clean === v)) {
            mapping.eposta = index
          } else if (['kullaniciadi', 'kullaniciadi', 'username', 'user'].some(v => clean.includes(v))) {
            mapping.kullaniciAdi = index
          } else if (['sifre', 'sefre', 'password', 'pass'].some(v => clean === v)) {
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

  // RFC 822 Email compiler (supporting UTF-8 and clean headers)
  const compileRawMessage = (to, subject, htmlBody) => {
    const base64Subject = btoa(unescape(encodeURIComponent(subject)))
    const mailLines = [
      `To: ${to}`,
      `Subject: =?utf-8?B?${base64Subject}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      btoa(unescape(encodeURIComponent(htmlBody)))
    ]
    const rawMsg = mailLines.join("\r\n")
    return btoa(unescape(encodeURIComponent(rawMsg)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

  // Bulk mail trigger workflow
  const handleStartSending = async () => {
    if (!isConnected || !gmailToken) {
      alert('Lütfen öncelikle Google/Gmail API bağlantısını kurun.')
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

      // Throttling: every 10 emails, delay for 5 seconds to bypass google send spam controls
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
      const raw = compileRawMessage(st.eposta, subject, body)

      try {
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${gmailToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ raw })
        })

        if (res.ok) {
          st.durum = 'gonderildi'
          st.hataMesaji = ''
          sent++
          setSentCount(sent)
          addLog(`✅ E-posta gönderildi: ${st.ad} ${st.soyad} (${st.eposta})`)
        } else {
          const errData = await res.json().catch(() => ({}))
          const errMsg = errData.error?.message || `Durum Kodu: ${res.status}`
          st.durum = 'hata'
          st.hataMesaji = errMsg
          addLog(`❌ Gönderim başarısız: ${st.ad} ${st.soyad} (${st.eposta}) - Hata: ${errMsg}`)
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
        detay: `Toplu giriş bilgileri dağıtımı tamamlandı. Başarılı: ${sent}/${students.length} mail.`
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
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          ✉️ Toplu Mail Gönderici (Giriş Bilgileri)
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.925rem', marginTop: '0.25rem' }}>
          Excel dosyasından okunan kullanıcı adlarını, şifreleri ve aktivasyon kodlarını Google Gmail altyapınız üzerinden spama takılmadan öğrencilerin e-posta adreslerine gönderin.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', lg: 'repeat(12, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        {/* SOL KOLON - Ayarlar ve Excel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* CARD 1: Google API Connection */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1E293B', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔑 Gmail API Bağlantısı
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.825rem', marginBottom: '1.25rem' }}>
              E-postaların kendi mail adresiniz üzerinden gönderilmesi için Google hesabınızla yetkilendirme sağlamalısınız. Güvenliğiniz için şifreniz hiçbir sunucuya kaydedilmez.
            </p>

            {isConnected ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.25rem' }}>🟢</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#166534' }}>Bağlantı Aktif</span>
                    <span style={{ fontSize: '0.75rem', color: '#15803D' }}>{senderEmail}</span>
                  </div>
                </div>
                <button
                  onClick={handleDisconnectGmail}
                  style={{
                    padding: '6px 12px',
                    background: '#FEE2E2',
                    border: '1px solid #FCA5A5',
                    color: '#991B1B',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Bağlantıyı Kes
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectGmail}
                disabled={connecting}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {connecting ? '⏳ Google Bağlantısı Açılıyor...' : '🔗 Gmail API İzni Ver & Bağlan'}
              </button>
            )}
          </div>

          {/* CARD 2: Excel Dosya Yükleme */}
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
                📂 Alıcı Listesi (Excel)
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
              Öğrencilerin Ad, Soyad, E-posta, KullaniciAdi, Sifre ve isteğe bağlı AnahtarKod bilgilerini içeren Excel dosyanızı yükleyin.
            </p>

            <div
              onClick={() => xlsxInputRef.current?.click()}
              style={{
                border: '2px dashed #CBD5E1',
                borderRadius: '12px',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(248, 250, 252, 0.5)',
                transition: 'all 0.2s',
                marginBottom: '1rem'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#4F46E5'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#CBD5E1'}
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
          
          {/* CARD 3: Mail Şablon Düzenleyici */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1E293B', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📝 E-posta Şablon Ayarları
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '0.25rem' }}>
                  E-posta Konu Başlığı (Subject):
                </label>
                <input
                  type="text"
                  value={subjectTemplate}
                  onChange={e => setSubjectTemplate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    outline: 'none',
                    color: '#1E293B'
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '0.15rem', display: 'block' }}>
                  Değişkenler: <code>{`{ad}`}</code>, <code>{`{soyad}`}</code> (Spam önleme için tavsiye edilir)
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '0.25rem' }}>
                  Giriş Platformu Web Adresi:
                </label>
                <input
                  type="text"
                  value={webAddress}
                  onChange={e => setWebAddress(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    outline: 'none',
                    color: '#1E293B'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '0.25rem' }}>
                  E-posta Mesaj Gövdesi (HTML):
                </label>
                <textarea
                  value={messageTemplate}
                  onChange={e => setMessageTemplate(e.target.value)}
                  rows={8}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                    color: '#1E293B',
                    resize: 'vertical'
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '0.15rem', display: 'block' }}>
                  Kullanılabilir Etiketler: <code>{`{ad}`}</code>, <code>{`{soyad}`}</code>, <code>{`{kullanici_adi}`}</code>, <code>{`{sifre}`}</code>, <code>{`{anahtar_kod}`}</code>, <code>{`{web_adresi}`}</code>
                  <br />
                  Koşullu Kod Alanı: <code>{`{if_anahtar_kod} ... {endif_anahtar_kod}`}</code> (Anahtar kod boş ise bu satırı gizler)
                </span>
              </div>
            </div>
          </div>

          {/* CARD 4: Canlı Ön İzleme */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1E293B', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              👁️ Canlı E-Posta Ön İzlemesi
            </h2>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', background: '#fff', padding: '1rem', overflow: 'hidden' }}>
              <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Konu: </span>
                <span style={{ fontSize: '0.8rem', color: '#1E293B', fontWeight: '600' }}>{previewSubject}</span>
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: '#334155',
                  lineHeight: '1.6',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  padding: '4px'
                }}
                dangerouslySetInnerHTML={{ __html: previewBody }}
              />
            </div>
          </div>

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
                  disabled={!isConnected || students.length === 0}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: (!isConnected || students.length === 0) ? '#CBD5E1' : 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    cursor: (!isConnected || students.length === 0) ? 'not-allowed' : 'pointer',
                    boxShadow: (!isConnected || students.length === 0) ? 'none' : '0 4px 6px -1px rgba(79, 70, 229, 0.4)'
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
    </div>
  )
}
