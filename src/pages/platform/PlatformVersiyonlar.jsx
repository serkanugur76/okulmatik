import React, { useEffect, useState, useMemo } from 'react'
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

export default function PlatformVersiyonlar() {
  const { profil } = useKurumYonetim()
  const [versiyonlar, setVersiyonlar] = useState([])
  const [loading, setLoading] = useState(true)
  const [acikVersiyon, setAcikVersiyon] = useState('')

  const isPlatformAdmin = profil?.rol === 'platform_admin' || profil?.email === 'ugurserkan@gmail.com'

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'versiyonlar', id))
    } catch (err) {
      alert('Kayıt silinirken hata oluştu: ' + err.message)
    }
  }

  useEffect(() => {
    const q = query(collection(db, 'versiyonlar'), orderBy('olusturmaTarihi', 'desc'))
    const unsubscribe = onSnapshot(q, snap => {
      const list = snap.docs.map(doc => {
        const d = doc.data()
        return {
          id: doc.id,
          versiyon: d.versiyon || '',
          baslik: d.baslik || '',
          tarih: d.tarih || '',
          rozet: d.rozet || '',
          renk: d.renk || '#10B981',
          bg: d.bg || '#ECFDF5',
          maddeler: d.maddeler || []
        }
      })
      setVersiyonlar(list)
      setLoading(false)
    }, err => {
      console.error('Error fetching version history:', err)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const SURUMLER = [
    {
      versiyon: 'v1.5.0',
      baslik: 'Mobil Öğrenci Kartları & Türkçe Akıllı Arama',
      tarih: '04 Temmuz 2026',
      rozet: 'En Yeni',
      renk: '#10B981',
      bg: '#ECFDF5',
      maddeler: [
        {
          tip: 'yenilik',
          baslik: 'Mobil Öğrenci Kartı Tasarımı',
          detay: 'Geniş öğrenci tabloları yerine mobil cihazlarda yerel uygulama benzeri kartlar oluşturuldu. Öğrenci bilgileri dikey olarak sadeleştirildi.'
        },
        {
          tip: 'yenilik',
          baslik: 'Tek Dokunuşla Veli Arama (Click-to-Call)',
          detay: 'Veli telefon numaraları yanına arama butonu eklendi. Mobil cihazlarda tıklanarak doğrudan arama yapılabiliyor.'
        },
        {
          tip: 'opt',
          baslik: 'Akıllı Arama ve Otomatik Genişleme',
          detay: 'Bir öğrenci arandığında, o öğrencinin bulunduğu Kampüs, Okul ve Sınıf akordeonları otomatik olarak açılır. Eşleşmeyenler kapanır.'
        },
        {
          tip: 'duzeltme',
          baslik: 'Türkçe Karakter Duyarlılığı',
          detay: 'Arama motorunda ı/i, ş/s gibi Türkçe karakter eşleştirme hataları giderildi. "asrın" araması "ASRIN" sonucunu hatasız getirmektedir.'
        }
      ]
    },
    {
      versiyon: 'v1.4.0',
      baslik: 'Kurumsal Hiyerarşi & Breadcrumb Linkleri',
      tarih: '04 Temmuz 2026',
      renk: '#3B82F6',
      bg: '#EFF6FF',
      maddeler: [
        {
          tip: 'yenilik',
          baslik: 'Aktif Breadcrumb Bağlantıları',
          detay: 'Sayfa üstlerindeki breadcrumb hiyerarşisi (Kampüs > Okul > Sınıf) tıklanabilir linklere dönüştürüldü. Geri gitme kolaylaştırıldı.'
        },
        {
          tip: 'yenilik',
          baslik: 'Mobil Geri Git Barı',
          detay: 'Telefon görünümünde sayfa üstlerine tarayıcı geçmişinde bir adım geri giden "Geri Git" barı yerleştirildi.'
        },
        {
          tip: 'duzeltme',
          baslik: 'Kampüs Bazlı Alt Kurum Dropdown Kilidi',
          detay: 'Kampüs yetkisiyle girildiğinde alt kurumların (İlkokul, Ortaokul vb.) dropdown listelerinde yüklenmeme veya seçilememe hatası düzeltildi.'
        }
      ]
    },
    {
      versiyon: 'v1.3.0',
      baslik: 'Mobil Tablo-Kart Dönüşümleri & Kütüphane Kartları',
      tarih: '04 Temmuz 2026',
      renk: '#8B5CF6',
      bg: '#F5F3FF',
      maddeler: [
        {
          tip: 'yenilik',
          baslik: 'Kütüphane Kart Tasarımları',
          detay: 'Kütüphane kitap listesi ve ödünç alma tabloları mobil cihazlarda modern kitap kartlarına dönüştürüldü.'
        },
        {
          tip: 'opt',
          baslik: 'Yoklama Defteri & Kulüp Tasarımları',
          detay: 'Kulüp Yönetimi altındaki Yoklama Defteri, Ders Planı ve Etkinlikler modülü mobilde dikey tek kolona uyarlandı, taşmalar önlendi.'
        },
        {
          tip: 'duzeltme',
          baslik: 'Z-Index ve Klavye Kayma Çözümleri',
          detay: 'Tüm ekleme/düzenleme modallarının z-index değeri 2000 yapılarak bottom-nav barın üstüne çekildi. max-height ve scroll eklenerek klavye açılınca formların görünmesi sağlandı.'
        }
      ]
    },
    {
      versiyon: 'v1.2.0',
      baslik: 'Otomatik Sürüm Yönetimi & Alt Navigasyon Barı',
      tarih: '01 Temmuz 2026',
      renk: '#F59E0B',
      bg: '#FEF3C7',
      maddeler: [
        {
          tip: 'yenilik',
          baslik: 'Mobil Alt Navigasyon Barı (BottomNavBar)',
          detay: 'Cihaz genişliği 768px altındayken sol menü gizlenerek altta Instagram benzeri sabit bar ve ☰ Modüller menü çekmecesi aktif edildi.'
        },
        {
          tip: 'yenilik',
          baslik: 'Dinamik Git Sürüm Bilgisi',
          detay: 'Proje build edilirken güncel Git Commit Hash ve tarihini alıp sürüm numarasıyla birleştiren __APP_VERSION_INFO__ altyapısı kuruldu.'
        }
      ]
    },
    {
      versiyon: 'v1.1.0',
      baslik: 'Zümre & Branş MEB Standardizasyonu',
      tarih: '30 Haziran 2026',
      renk: '#EC4899',
      bg: '#FDF2F8',
      maddeler: [
        {
          tip: 'yenilik',
          baslik: 'Yabancı Dil Branş Ayrımı',
          detay: 'Genel Yabancı Dil branşı MEB standartlarına göre "İngilizce" ve "Seçmeli Yabancı Dil" olarak iki bağımsız branşa bölündü.'
        },
        {
          tip: 'opt',
          baslik: 'Zümre Onay Süreçleri',
          detay: 'Zümre tutanağı düzenlerken branş seçim dropdown kutusu kaldırılarak ilgili branş evrakları kilitlendi, yanlış kayıtlar önlendi.'
        }
      ]
    },
    {
      versiyon: 'v1.0.0',
      baslik: 'Okulmatik Platform Lansmanı',
      tarih: '20 Haziran 2026',
      renk: '#6B7280',
      bg: '#F3F4F6',
      maddeler: [
        {
          tip: 'yenilik',
          baslik: 'İlk Kararlı Sürüm',
          detay: 'Okulmatik; Kurum, Kullanıcı, Sınıf, Öğrenci, Rubrik Şablonları, Değerlendirmeler ve Kütüphane modülleriyle ilk yayına alındı.'
        }
      ]
    }
  ]

  const birlesmisVersiyonlar = useMemo(() => {
    const dbVersions = [...versiyonlar]
    const staticVersions = SURUMLER.filter(
      s => !dbVersions.some(dbV => dbV.versiyon.toLowerCase() === s.versiyon.toLowerCase())
    )
    return [...dbVersions, ...staticVersions]
  }, [versiyonlar])

  useEffect(() => {
    if (birlesmisVersiyonlar.length > 0 && !acikVersiyon) {
      setAcikVersiyon(birlesmisVersiyonlar[0].versiyon)
    }
  }, [birlesmisVersiyonlar, acikVersiyon])

  const TIP_STIL = {
    yenilik: { etiket: 'Yenilik', bg: '#DBEAFE', color: '#1E40AF' },
    opt: { etiket: 'İyileştirme', bg: '#EDE9FE', color: '#5B21B6' },
    duzeltme: { etiket: 'Düzeltme', bg: '#FEE2E2', color: '#991B1B' }
  }

  return (
    <div style={{ maxWidth: '840px', paddingBottom: '3rem' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .version-header-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: #1E293B;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin: 0;
        }
        @media (max-width: 768px) {
          .version-header-title {
            font-size: 1.35rem !important;
            justify-content: center;
            text-align: center;
          }
          .version-header-desc {
            text-align: center;
            font-size: 0.85rem !important;
          }
        }
      `}} />
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="version-header-title">
          ✨ Versiyon Geçmişi
        </h1>
        <p className="version-header-desc" style={{ color: '#64748B', fontSize: '0.925rem', marginTop: '0.25rem', margin: '0.25rem 0 0' }}>
          Okulmatik platformunda yapılan tüm sistem güncellemelerini, hata düzeltmelerini ve yeni eklenen modülleri sürüm bazlı takip edin.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#64748B', padding: '2rem', fontSize: '0.9rem' }}>
            ⏳ Sürüm bilgileri yükleniyor...
          </div>
        ) : birlesmisVersiyonlar.map(s => {
          const acik = acikVersiyon === s.versiyon
          return (
            <div key={s.versiyon} style={{
              background: '#fff',
              border: '1.5px solid #E2E8F0',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.2s ease-in-out'
            }}>
              {/* Sürüm Header */}
              <div 
                onClick={() => setAcikVersiyon(acik ? null : s.versiyon)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1.25rem 1.5rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: acik ? s.bg : '#fff',
                  borderBottom: acik ? '1px solid #E2E8F0' : 'none',
                  transition: 'background 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '1rem',
                    fontWeight: '800',
                    color: s.renk,
                    background: '#fff',
                    border: `1.5px solid ${s.renk}`,
                    borderRadius: '8px',
                    padding: '3px 8px'
                  }}>
                    {s.versiyon}
                  </span>
                  <div>
                    <h3 style={{ fontSize: '0.975rem', fontWeight: '800', color: '#1E293B', margin: 0 }}>
                      {s.baslik}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      {s.tarih}
                    </span>
                  </div>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {s.rozet && (
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: '800',
                      background: s.renk,
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {s.rozet}
                    </span>
                  )}
                  {isPlatformAdmin && s.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`${s.versiyon} sürüm kaydını silmek istediğinize emin misiniz?`)) {
                          handleDelete(s.id);
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#EF4444',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        transition: 'background 0.2s',
                        marginRight: '0.25rem'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      title="Sürüm kaydını sil"
                    >
                      🗑️
                    </button>
                  )}
                  <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                    {acik ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {/* Sürüm İçerik/Detay */}
              {acik && (
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {s.maddeler.map((m, idx) => {
                    const t = TIP_STIL[m.tip] || { etiket: 'Güncelleme', bg: '#F3F4F6', color: '#374151' }
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.875rem',
                        paddingBottom: idx < s.maddeler.length - 1 ? '1rem' : 0,
                        borderBottom: idx < s.maddeler.length - 1 ? '1px solid #F1F5F9' : 'none'
                      }}>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: '800',
                          background: t.bg,
                          color: t.color,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                          marginTop: '2px'
                        }}>
                          {t.etiket}
                        </span>
                        <div>
                          <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1E293B', margin: '0 0 0.2rem' }}>
                            {m.baslik}
                          </h4>
                          <p style={{ fontSize: '0.825rem', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                            {m.detay}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
