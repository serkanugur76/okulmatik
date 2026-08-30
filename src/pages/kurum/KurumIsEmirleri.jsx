import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { logKaydet } from '../../services/logService'

const KATEGORİLER = [
  { value: 'teknik', label: '🛠️ Teknik', renk: '#3B82F6', bg: '#EFF6FF' },
  { value: 'temizlik', label: '🧹 Temizlik', renk: '#10B981', bg: '#ECFDF5' },
  { value: 'bakim_onarim', label: '🔧 Bakım - Onarım', renk: '#F59E0B', bg: '#FFFBEB' },
  { value: 'diger', label: '📦 Diğer', renk: '#6B7280', bg: '#F9FAFB' }
]

const DURUMLAR = {
  acik: { label: 'Açık / Beklemede', renk: '#EF4444', bg: '#FEF2F2' },
  surec: { label: 'İşlemde', renk: '#3B82F6', bg: '#EFF6FF' },
  tamamlandi: { label: 'Tamamlandı', renk: '#10B981', bg: '#ECFDF5' }
}

const BOŞ_FORM = {
  baslik: '',
  detay: '',
  kategori: 'teknik',
  atananId: ''
}

export default function KurumIsEmirleri() {
  const { kullanici, profil, platformAdmin } = useAuth()
  const { secilenKurumId: kurumId } = useKurumYonetim()

  const [isEmirleri, setIsEmirleri] = useState([])
  const [personeller, setPersoneller] = useState([])
  const [sekme, setSekme] = useState('acik') // 'acik' | 'surec' | 'tamamlandi'
  const [kategoriFiltre, setKategoriFiltre] = useState('hepsi')
  const [modal, setModal] = useState(false)
  const [kapatModal, setKapatModal] = useState(null) // Kapatılacak iş emri objesi
  const [kapanisNotu, setKapanisNotu] = useState('')
  const [form, setForm] = useState(BOŞ_FORM)
  const [kaydediyor, setKaydediyor] = useState(false)
  const [hata, setHata] = useState('')

  const isYonetici = profil?.rol === 'kurum_admin' || platformAdmin

  // 1. İş emirlerini ve Yetkili Personeli Dinle
  useEffect(() => {
    if (!kurumId) return

    // İş emirlerini dinle
    const qEmirler = collection(db, 'kurumlar', kurumId, 'isEmirleri')
    const unsubEmirler = onSnapshot(qEmirler, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => {
        const tA = a.olusturmaTarihi?.toDate ? a.olusturmaTarihi.toDate() : (a.olusturmaTarihi ? new Date(a.olusturmaTarihi) : new Date())
        const tB = b.olusturmaTarihi?.toDate ? b.olusturmaTarihi.toDate() : (b.olusturmaTarihi ? new Date(b.olusturmaTarihi) : new Date())
        return tB - tA
      })
      setIsEmirleri(docs)
    })

    // Yetkili personelleri dinle (is_emri yetkisi olanlar veya adminler)
    const qKullanicilar = query(collection(db, 'kurumlar', kurumId, 'kullanicilar'))
    const unsubKullanicilar = onSnapshot(qKullanicilar, snap => {
      const liste = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.rol === 'kurum_admin' || u.modulIzinler?.is_emri === true)
      setPersoneller(liste)
    })

    return () => {
      unsubEmirler()
      unsubKullanicilar()
    }
  }, [kurumId])

  // 2. Yeni İş Emri Kaydet (Kurucu/Admin)
  async function handleKaydet(e) {
    e.preventDefault()
    if (!form.baslik.trim()) { setHata('Başlık zorunludur.'); return }
    if (!form.atananId) { setHata('Lütfen işin atanacağı personeli seçin.'); return }

    setKaydediyor(true)
    setHata('')

    const atananUser = personeller.find(p => p.id === form.atananId)

    try {
      const yeniIsEmri = {
        baslik: form.baslik.trim(),
        detay: form.detay.trim(),
        kategori: form.kategori,
        atananId: form.atananId,
        atananAd: atananUser?.ad || atananUser?.email || 'Bilinmeyen Personel',
        durum: 'acik',
        olusturanId: kullanici.uid,
        olusturanAd: profil?.ad || kullanici.email,
        olusturmaTarihi: serverTimestamp(),
        guncellemeTarihi: serverTimestamp(),
        kapanisNotu: ''
      }

      await addDoc(collection(db, 'kurumlar', kurumId, 'isEmirleri'), yeniIsEmri)
      
      logKaydet({
        profil,
        kullanici,
        islem: 'is_emri_olustur',
        modul: 'isEmirleri',
        hedefAd: form.baslik.trim(),
        kurumId,
        detay: `Atanan: ${yeniIsEmri.atananAd}`
      })

      setForm(BOŞ_FORM)
      setModal(false)
    } catch (err) {
      setHata('İş emri oluşturulamadı: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  // 3. İş Emrini Başlat (İşlemde durumuna getir - Personel)
  async function handleBaslat(isEmri) {
    try {
      const docRef = doc(db, 'kurumlar', kurumId, 'isEmirleri', isEmri.id)
      await updateDoc(docRef, {
        durum: 'surec',
        guncellemeTarihi: serverTimestamp()
      })

      logKaydet({
        profil,
        kullanici,
        islem: 'is_emri_baslat',
        modul: 'isEmirleri',
        hedefAd: isEmri.baslik,
        kurumId,
        detay: 'Durum: İşlemde'
      })
    } catch (err) {
      alert('Hata oluştu: ' + err.message)
    }
  }

  // 4. İş Emrini Kapat/Tamamla
  async function handleKapat(e) {
    e.preventDefault()
    if (!kapatModal) return

    try {
      const docRef = doc(db, 'kurumlar', kurumId, 'isEmirleri', kapatModal.id)
      await updateDoc(docRef, {
        durum: 'tamamlandi',
        kapanisNotu: kapanisNotu.trim(),
        guncellemeTarihi: serverTimestamp(),
        tamamlanmaTarihi: serverTimestamp()
      })

      logKaydet({
        profil,
        kullanici,
        islem: 'is_emri_tamamla',
        modul: 'isEmirleri',
        hedefAd: kapatModal.baslik,
        kurumId,
        detay: `Kapanış Notu: ${kapanisNotu.trim()}`
      })

      setKapatModal(null)
      setKapanisNotu('')
    } catch (err) {
      alert('Hata oluştu: ' + err.message)
    }
  }

  // 5. İş Emrini Sil (Sadece Kurucu/Admin)
  async function handleSil(isEmri) {
    if (!window.confirm(`"${isEmri.baslik}" isimli iş emrini silmek istediğinize emin misiniz?`)) return
    try {
      const docRef = doc(db, 'kurumlar', kurumId, 'isEmirleri', isEmri.id)
      await deleteDoc(docRef)

      logKaydet({
        profil,
        kullanici,
        islem: 'is_emri_sil',
        modul: 'isEmirleri',
        hedefAd: isEmri.baslik,
        kurumId
      })
    } catch (err) {
      alert('Silme hatası: ' + err.message)
    }
  }

  // 6. Listeyi Filtrele
  const filtrelenmisListe = isEmirleri.filter(item => {
    // Sekme (durum) filtresi
    if (item.durum !== sekme) return false
    // Kategori filtresi
    if (kategoriFiltre !== 'hepsi' && item.kategori !== kategoriFiltre) return false
    // Eğer yönetici değilse, sadece kendisine atanan veya kendisinin oluşturduğu işleri görsün
    if (!isYonetici) {
      return item.atananId === kullanici.uid || item.olusturanId === kullanici.uid
    }
    return true
  })

  const formatTarih = (timestamp) => {
    if (!timestamp) return '—'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const s = {
    sekmeBtn: (active) => ({
      padding: '0.6rem 1.2rem',
      fontSize: '0.875rem',
      fontWeight: '600',
      cursor: 'pointer',
      border: 'none',
      background: active ? '#1B3A6B' : 'transparent',
      color: active ? '#ffffff' : '#64748B',
      borderRadius: '8px',
      transition: 'all 0.2s ease',
      boxShadow: active ? '0 4px 12px rgba(27, 58, 107, 0.15)' : 'none'
    }),
    katBtn: (active, color) => ({
      padding: '0.4rem 0.875rem',
      fontSize: '0.8rem',
      fontWeight: '600',
      cursor: 'pointer',
      borderRadius: '20px',
      border: '1.5px solid',
      borderColor: active ? color : '#E2E8F0',
      background: active ? color : '#FFFFFF',
      color: active ? '#FFFFFF' : '#64748B',
      transition: 'all 0.15s ease'
    }),
    card: {
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '16px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    },
    girdi: {
      padding: '0.625rem 0.875rem',
      border: '1.5px solid #E2E8F0',
      borderRadius: '8px',
      fontSize: '0.9rem',
      color: '#1E293B',
      width: '100%',
      outline: 'none',
    },
    etiket: {
      fontSize: '0.875rem',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '0.375rem',
      display: 'block'
    }
  }

  return (
    <div style={{ paddingBottom: '3rem' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .is-emri-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px -2px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02) !important;
        }
        .filter-container {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.25rem;
        }
        @media (max-width: 768px) {
          .action-bar {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .sekme-group {
            width: 100%;
            display: flex;
            justify-content: space-between;
          }
          .sekme-group button {
            flex: 1;
            text-align: center;
          }
          .add-btn {
            width: 100% !important;
          }
          .modal-box {
            max-height: 85vh !important;
            width: 100% !important;
          }
        }
      `}} />

      {/* Başlık ve Buton */}
      <div className="action-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>İş Emri Takip</h1>
          <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Kurum içi teknik, temizlik ve bakım süreçleri</p>
        </div>
        {isYonetici && (
          <button className="add-btn" onClick={() => { setForm(BOŞ_FORM); setModal(true); }}
            style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
            <span>➕</span> Yeni İş Emri
          </button>
        )}
      </div>

      {/* Durum Sekmeleri */}
      <div style={{ background: '#E2E8F0', padding: '4px', borderRadius: '10px', display: 'inline-flex', gap: '2px', marginBottom: '1.25rem', width: 'auto' }} className="sekme-group">
        <button style={s.sekmeBtn(sekme === 'acik')} onClick={() => setSekme('acik')}>
          Açık ({isEmirleri.filter(item => item.durum === 'acik' && (isYonetici || item.atananId === kullanici.uid || item.olusturanId === kullanici.uid)).length})
        </button>
        <button style={s.sekmeBtn(sekme === 'surec')} onClick={() => setSekme('surec')}>
          İşlemde ({isEmirleri.filter(item => item.durum === 'surec' && (isYonetici || item.atananId === kullanici.uid || item.olusturanId === kullanici.uid)).length})
        </button>
        <button style={s.sekmeBtn(sekme === 'tamamlandi')} onClick={() => setSekme('tamamlandi')}>
          Tamamlandı ({isEmirleri.filter(item => item.durum === 'tamamlandi' && (isYonetici || item.atananId === kullanici.uid || item.olusturanId === kullanici.uid)).length})
        </button>
      </div>

      {/* Kategori Filtreleri */}
      <div className="filter-container">
        <button style={s.katBtn(kategoriFiltre === 'hepsi', '#475569')} onClick={() => setKategoriFiltre('hepsi')}>
          📁 Tümü
        </button>
        {KATEGORİLER.map(cat => (
          <button key={cat.value} style={s.katBtn(kategoriFiltre === cat.value, cat.renk)} onClick={() => setKategoriFiltre(cat.value)}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* İş Emri Listesi */}
      <div className="cards-grid">
        {filtrelenmisListe.length === 0 ? (
          <div style={{ gridColumn: '1/-1', background: '#FFFFFF', border: '1px dashed #CBD5E1', padding: '3rem 1rem', borderRadius: '16px', textAlign: 'center', color: '#94A3B8' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📋</span>
            Filtrelere uygun iş emri bulunamadı.
          </div>
        ) : (
          filtrelenmisListe.map(item => {
            const katInfo = KATEGORİLER.find(c => c.value === item.kategori) || KATEGORİLER[3]
            const durumInfo = DURUMLAR[item.durum] || DURUMLAR.acik
            const isAssignedToMe = item.atananId === kullanici.uid

            return (
              <div key={item.id} className="is-emri-card" style={s.card}>
                {/* Üst Bilgi (Kategori & Durum) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: katInfo.bg, color: katInfo.renk }}>
                    {katInfo.label}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: durumInfo.bg, color: durumInfo.renk }}>
                    {durumInfo.label}
                  </span>
                </div>

                {/* Başlık ve Detay */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#1B3A6B', marginBottom: '0.4rem', lineHeight: '1.4' }}>
                    {item.baslik}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {item.detay}
                  </p>
                </div>

                {/* Atama & Süreç Bilgileri */}
                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', color: '#64748B' }}>
                  <div>👤 <strong>Oluşturan:</strong> {item.olusturanAd}</div>
                  <div>🎯 <strong>Atanan:</strong> {item.atananAd} {isAssignedToMe && <span style={{ color: '#10B981', fontWeight: '700' }}>(Siz)</span>}</div>
                  <div>📅 <strong>Tarih:</strong> {formatTarih(item.olusturmaTarihi)}</div>
                  {item.durum === 'tamamlandi' && item.tamamlanmaTarihi && (
                    <div>✓ <strong>Tamamlanma:</strong> {formatTarih(item.tamamlanmaTarihi)}</div>
                  )}
                </div>

                {/* Kapanış Notu */}
                {item.durum === 'tamamlandi' && item.kapanisNotu && (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.6rem', fontSize: '0.78rem', color: '#475569' }}>
                    <strong>📝 Kapanış Açıklaması:</strong>
                    <div style={{ marginTop: '0.2rem', fontStyle: 'italic' }}>"{item.kapanisNotu}"</div>
                  </div>
                )}

                {/* İşlemler / Butonlar */}
                <div style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {/* İşi Başlat (Sadece kendisine atanan ve 'açık' durumda olan işler için personel görebilir) */}
                  {item.durum === 'acik' && isAssignedToMe && (
                    <button onClick={() => handleBaslat(item)}
                      style={{ padding: '5px 12px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>
                      ⚡ İşi Başlat
                    </button>
                  )}

                  {/* Görevi Tamamla (Süreçte olan ve kendisine atanan işler için personel görebilir) */}
                  {item.durum === 'surec' && isAssignedToMe && (
                    <button onClick={() => { setKapatModal(item); setKapanisNotu(''); }}
                      style={{ padding: '5px 12px', background: '#10B981', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>
                      ✓ Görevi Tamamla
                    </button>
                  )}

                  {/* Sil Butonu (Sadece Kurucu/Admin görebilir) */}
                  {isYonetici && (
                    <button onClick={() => handleSil(item)}
                      style={{ padding: '5px 10px', background: '#FEF2F2', color: '#EF4444', border: '1px solid #FEE2E2', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>
                      🗑️ Sil
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── İŞ EMRİ OLUŞTURMA MODALI ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '1rem' }}>Yeni İş Emri Oluştur</h2>
            
            <form onSubmit={handleKaydet} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={s.etiket}>İş Başlığı *</label>
                <input style={s.girdi} value={form.baslik} onChange={e => setForm(f => ({ ...f, baslik: e.target.value }))} placeholder="Örn: Konferans salonu ampul değişimi" required autoFocus />
              </div>

              <div>
                <label style={s.etiket}>Açıklama / Detay</label>
                <textarea style={{ ...s.girdi, minHeight: '80px', resize: 'vertical' }} value={form.detay} onChange={e => setForm(f => ({ ...f, detay: e.target.value }))} placeholder="Yapılacak işin detaylarını buraya yazın..." />
              </div>

              <div>
                <label style={s.etiket}>Kategori</label>
                <select style={s.girdi} value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))}>
                  {KATEGORİLER.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={s.etiket}>Görevin Atanacağı Personel *</label>
                <select style={s.girdi} value={form.atananId} onChange={e => setForm(f => ({ ...f, atananId: e.target.value }))} required>
                  <option value="">— Personel Seçin —</option>
                  {personeller.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.ad || p.email} ({p.rol === 'kurum_admin' ? 'Yönetici' : 'İşletme Yetkilisi'})
                    </option>
                  ))}
                </select>
                {personeller.length === 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: '4px', display: 'block' }}>
                    ⚠️ Sistemde yetkilendirilmiş teknik/işletme personeli bulunmuyor. Lütfen önce kullanıcılara yetki verin.
                  </span>
                )}
              </div>

              {hata && <p style={{ fontSize: '0.85rem', color: '#991B1B', background: '#FEE2E2', borderRadius: '6px', padding: '0.5rem 0.75rem', margin: 0 }}>{hata}</p>}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setModal(false)}
                  style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>
                  İptal
                </button>
                <button type="submit" disabled={kaydediyor}
                  style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                  {kaydediyor ? 'Gönderiliyor...' : 'İş Emri Ver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── İŞİ TAMAMLAMA / NOT EKLEME MODALI ── */}
      {kapatModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setKapatModal(null)}>
          <div className="modal-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.5rem' }}>Görevi Tamamla</h2>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1rem' }}>
              <strong>"{kapatModal.baslik}"</strong> iş emri tamamlandı olarak kapatılacaktır. Kapanış açıklamasını girin:
            </p>
            
            <form onSubmit={handleKapat} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={s.etiket}>Kapanış Açıklaması *</label>
                <textarea style={{ ...s.girdi, minHeight: '100px', resize: 'vertical' }} value={kapanisNotu} onChange={e => setKapanisNotu(e.target.value)} placeholder="Örn: Klima filtreleri temizlendi ve gaz dolumu yapıldı." required autoFocus />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setKapatModal(null)}
                  style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>
                  Vazgeç
                </button>
                <button type="submit"
                  style={{ padding: '0.6rem 1.25rem', background: '#10B981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                  Tamamlandı Olarak Kapat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
