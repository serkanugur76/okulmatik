import React, { useEffect, useState, useMemo } from 'react'
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

export default function PlatformVersiyonlar() {
  const { profil, kullanici } = useKurumYonetim()
  const [versiyonlar, setVersiyonlar] = useState([])
  const [loading, setLoading] = useState(true)
  const [acikVersiyon, setAcikVersiyon] = useState('')

  // Edit / Add Modal States
  const [editingVersion, setEditingVersion] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formVersiyon, setFormVersiyon] = useState('')
  const [formBaslik, setFormBaslik] = useState('')
  const [formTarih, setFormTarih] = useState('')
  const [formRozet, setFormRozet] = useState('')
  const [formMaddeler, setFormMaddeler] = useState([])

  const isPlatformAdmin = profil?.rol === 'platform_admin' || 
                          profil?.email === 'ugurserkan@gmail.com' || 
                          kullanici?.email === 'ugurserkan@gmail.com'

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'versiyonlar', id))
    } catch (err) {
      alert('Kayıt silinirken hata oluştu: ' + err.message)
    }
  }

  const openEdit = (ver) => {
    setEditingVersion(ver)
    setFormVersiyon(ver.versiyon)
    setFormBaslik(ver.baslik)
    setFormTarih(ver.tarih)
    setFormRozet(ver.rozet || '')
    setFormMaddeler(ver.maddeler ? [...ver.maddeler] : [])
  }

  const openAdd = () => {
    setShowAddModal(true)
    setFormVersiyon('')
    setFormBaslik('')
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    setFormTarih(new Date().toLocaleDateString('tr-TR', options))
    setFormRozet('')
    setFormMaddeler([{ tip: 'yenilik', baslik: '', detay: '' }])
  }

  const handleSave = async () => {
    if (!formVersiyon || !formBaslik || !formTarih) {
      alert('Lütfen sürüm, başlık ve tarih alanlarını doldurun.')
      return
    }

    const docData = {
      versiyon: formVersiyon,
      baslik: formBaslik,
      tarih: formTarih,
      rozet: formRozet,
      renk: formVersiyon.toLowerCase().endsWith('.0') ? '#3B82F6' : '#10B981',
      bg: formVersiyon.toLowerCase().endsWith('.0') ? '#EFF6FF' : '#ECFDF5',
      maddeler: formMaddeler.filter(m => m.baslik.trim() !== '')
    }

    try {
      if (editingVersion && editingVersion.id) {
        await updateDoc(doc(db, 'versiyonlar', editingVersion.id), docData)
        setEditingVersion(null)
      } else {
        await addDoc(collection(db, 'versiyonlar'), {
          ...docData,
          olusturmaTarihi: new Date().toISOString()
        })
        setShowAddModal(false)
      }
    } catch (err) {
      alert('Kaydedilirken hata oluştu: ' + err.message)
    }
  }

  const addMaddelerRow = () => {
    setFormMaddeler([...formMaddeler, { tip: 'yenilik', baslik: '', detay: '' }])
  }

  const updateMaddelerRow = (idx, field, val) => {
    setFormMaddeler(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }

  const removeMaddelerRow = (idx) => {
    setFormMaddeler(formMaddeler.filter((_, i) => i !== idx))
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
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="version-header-title">
            ✨ Versiyon Geçmişi
          </h1>
          <p className="version-header-desc" style={{ color: '#64748B', fontSize: '0.925rem', marginTop: '0.25rem', margin: '0.25rem 0 0' }}>
            Okulmatik platformunda yapılan tüm sistem güncellemelerini, hata düzeltmelerini ve yeni eklenen modülleri sürüm bazlı takip edin.
          </p>
        </div>
        {isPlatformAdmin && (
          <button
            onClick={openAdd}
            style={{
              padding: '8px 16px',
              background: '#4338CA',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s',
              boxShadow: '0 4px 6px -1px rgba(67, 56, 202, 0.2)'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#3730A3'}
            onMouseLeave={e => e.currentTarget.style.background = '#4338CA'}
          >
            ➕ Yeni Sürüm Ekle
          </button>
        )}
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
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(s);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#4F46E5',
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
                        onMouseEnter={e => e.currentTarget.style.background = '#EEF2FF'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        title="Sürüm kaydını düzenle"
                      >
                        ✏️
                      </button>
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
                    </>
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

      {/* Düzenleme / Ekleme Modalı */}
      {(editingVersion || showAddModal) && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.3)',
          backdropFilter: 'blur(8px)',
          zIndex: 1002,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1B3A6B', margin: 0 }}>
                {editingVersion ? `Sürümü Düzenle: ${formVersiyon}` : 'Yeni Sürüm Ekle'}
              </h3>
              <button 
                onClick={() => { setEditingVersion(null); setShowAddModal(false); }}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94A3B8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#334155', marginBottom: '0.5rem' }}>Sürüm No (Örn: v1.5.15)</label>
                  <input 
                    type="text" 
                    value={formVersiyon} 
                    onChange={e => setFormVersiyon(e.target.value)}
                    placeholder="v1.5.15"
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '10px', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#334155', marginBottom: '0.5rem' }}>Tarih (Örn: 5 Temmuz 2026)</label>
                  <input 
                    type="text" 
                    value={formTarih} 
                    onChange={e => setFormTarih(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '10px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#334155', marginBottom: '0.5rem' }}>Sürüm Ana Başlığı</label>
                <input 
                  type="text" 
                  value={formBaslik} 
                  onChange={e => setFormBaslik(e.target.value)}
                  placeholder="Mobil Yoklama ve Görsel İyileştirmeler"
                  style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '10px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#334155', marginBottom: '0.5rem' }}>Rozet (İsteğe Bağlı, Örn: En Yeni)</label>
                  <input 
                    type="text" 
                    value={formRozet} 
                    onChange={e => setFormRozet(e.target.value)}
                    placeholder="En Yeni"
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '10px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#1B3A6B' }}>📝 Güncelleme Maddeleri ({formMaddeler.length})</label>
                  <button 
                    onClick={addMaddelerRow}
                    style={{
                      padding: '4px 10px', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0',
                      borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    ➕ Madde Eklendi
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {formMaddeler.map((m, idx) => (
                    <div key={idx} style={{ padding: '0.75rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', position: 'relative' }}>
                      <button 
                        onClick={() => removeMaddelerRow(idx)}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        🗑️
                      </button>

                      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#64748B', marginBottom: '0.25rem' }}>Tip</label>
                          <select 
                            value={m.tip}
                            onChange={e => updateMaddelerRow(idx, 'tip', e.target.value)}
                            style={{ width: '100%', padding: '6px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.75rem' }}
                          >
                            <option value="yenilik">Yenilik</option>
                            <option value="opt">İyileştirme</option>
                            <option value="duzeltme">Düzeltme</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#64748B', marginBottom: '0.25rem' }}>Madde Başlığı</label>
                          <input 
                            type="text" 
                            value={m.baslik}
                            onChange={e => updateMaddelerRow(idx, 'baslik', e.target.value)}
                            placeholder="Yeni yoklama modülü aktif edildi"
                            style={{ width: '100%', padding: '6px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.75rem' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#64748B', marginBottom: '0.25rem' }}>Madde Detayı (Kısa Açıklama)</label>
                        <textarea 
                          value={m.detay || ''}
                          onChange={e => updateMaddelerRow(idx, 'detay', e.target.value)}
                          placeholder="Bu güncelleme ile kurumlar..."
                          rows={2}
                          style={{ width: '100%', padding: '6px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.75rem', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #F1F5F9',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              background: '#F8FAFC'
            }}>
              <button 
                onClick={() => { setEditingVersion(null); setShowAddModal(false); }}
                style={{
                  padding: '8px 16px', background: '#fff', color: '#64748B', border: '1px solid #E2E8F0',
                  borderRadius: '10px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
                }}
              >
                İptal
              </button>
              <button 
                onClick={handleSave}
                style={{
                  padding: '8px 20px', background: '#10B981', color: '#fff', border: 'none',
                  borderRadius: '10px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                }}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
