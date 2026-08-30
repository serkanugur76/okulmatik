import React, { useState, useEffect, useMemo } from 'react'
import {
  collection, getDocs, onSnapshot, query, orderBy, doc, getDoc, updateDoc, serverTimestamp, setDoc, deleteDoc, where
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { logKaydet } from '../../services/logService'

export default function KurumDonemIslemleri() {
  const { secilenKurumId: kurumId, secilenKurum } = useKurumYonetim()
  const { profil, kullanici } = useAuth()

  const [ogrenciler, setOgrenciler] = useState([])
  const [siniflar, setSiniflar] = useState([])
  const [seciliSinifId, setSeciliSinifId] = useState('hepsi')
  const [aktifDonemInfo, setAktifDonemInfo] = useState(null)
  
  // Öğrencinin yeni dönemde devam edip etmeyeceği state'i: { [ogrenciId]: boolean }
  const [kayitDurumu, setKayitDurumu] = useState({})
  // Öğrencinin hedef şube/sınıf değişikliği state'i: { [ogrenciId]: sinifId }
  const [ogrenciSiniflar, setOgrenciSiniflar] = useState({})
  
  const [yukleniyor, setYukleniyor] = useState(true)
  const [kaydediyor, setKaydediyor] = useState(false)
  const [tamamlandi, setTamamlandi] = useState(false)
  const [hata, setHata] = useState('')

  const activeTermKey = useMemo(() => {
    if (!aktifDonemInfo) return ''
    return `${aktifDonemInfo.aktifEgitimYili}_${aktifDonemInfo.aktifDonem}`
  }, [aktifDonemInfo])

  const onayliMi = useMemo(() => {
    if (!secilenKurum || !activeTermKey) return false
    return secilenKurum.donemOnayRef === activeTermKey
  }, [secilenKurum, activeTermKey])

  // 1. Aktif Dönem Bilgisini Yükle
  useEffect(() => {
    if (secilenKurum?.aktifEgitimYili && secilenKurum?.aktifDonem) {
      setAktifDonemInfo({
        aktifEgitimYili: secilenKurum.aktifEgitimYili,
        aktifDonem: secilenKurum.aktifDonem
      })
      return
    }

    const unsub = onSnapshot(doc(db, 'sistemAyarlari', 'genel'), snap => {
      if (snap.exists()) {
        setAktifDonemInfo(snap.data())
      }
    })
    return () => unsub()
  }, [secilenKurum])

  // 2. Okuldaki Öğrencileri ve Sınıfları Yükle
  useEffect(() => {
    if (!kurumId) return
    setYukleniyor(true)

    // Sınıfları yükle
    const qS = query(collection(db, 'kurumlar', kurumId, 'siniflar'), orderBy('ad', 'asc'))
    const unsubSinif = onSnapshot(qS, snap => {
      setSiniflar(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    // Öğrencileri yükle
    const qO = query(collection(db, 'kurumlar', kurumId, 'ogrenciler'), orderBy('ad', 'asc'))
    const unsubOgr = onSnapshot(qO, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Sadece mezun olmayan veya ayrılmamış aktif öğrencileri listeliyoruz
      const aktifler = list.filter(o => o.durum !== 'mezun' && o.durum !== 'ayrildi')
      setOgrenciler(aktifler)

      // Kayıt durumu varsayılan olarak hepsini seçili (true) yap
      setKayitDurumu(prev => {
        const next = { ...prev }
        aktifler.forEach(o => {
          if (next[o.id] === undefined) {
            next[o.id] = true
          }
        })
        return next
      })

      // Sınıf durumlarını varsayılan olarak mevcut sınıfId yap
      setOgrenciSiniflar(prev => {
        const next = { ...prev }
        aktifler.forEach(o => {
          if (next[o.id] === undefined) {
            next[o.id] = o.sinifId || ''
          }
        })
        return next
      })
      setYukleniyor(false)
    }, err => {
      setHata('Öğrenci verisi yüklenirken hata: ' + err.message)
      setYukleniyor(false)
    })

    return () => {
      unsubSinif()
      unsubOgr()
    }
  }, [kurumId])

  // 3. Öğrenci Kayıt Durumunu Değiştir
  function handleToggleKaydur(ogrId) {
    if (onayliMi || kaydediyor) return
    setKayitDurumu(prev => ({
      ...prev,
      [ogrId]: !prev[ogrId]
    }))
  }

  // 4. Dönem Onayını Tamamla
  async function handleOnayla() {
    if (!kurumId || !activeTermKey) return
    if (!window.confirm('Bu okuldaki öğrencilerin yeni dönem kayıt durumunu ve şube değişikliklerini onaylamak istediğinize emin misiniz? Bu işlemden sonra kayıt yenilemeyen öğrenciler sistemde "ayrıldı" olarak işaretlenecek ve sınıf değiştirenlerin şubeleri güncellenecektir.')) return

    setKaydediyor(true)
    setHata('')

    try {
      const ayrilacaklar = ogrenciler.filter(o => !kayitDurumu[o.id])
      const devamEdenler = ogrenciler.filter(o => kayitDurumu[o.id])

      // 1. Kayıt yenilemeyen öğrencileri veritabanında güncelle
      for (const ogr of ayrilacaklar) {
        const docRef = doc(db, 'kurumlar', kurumId, 'ogrenciler', ogr.id)
        await updateDoc(docRef, {
          sinifId: '',
          sinifAd: '',
          durum: 'ayrildi',
          guncellenmeTarihi: serverTimestamp()
        })
      }

      // 2. Devam edenlerin sınıf/şube değişikliklerini güncelle
      for (const ogr of devamEdenler) {
        const yeniSinifId = ogrenciSiniflar[ogr.id] || ''
        const eskiSinifId = ogr.sinifId || ''

        if (yeniSinifId !== eskiSinifId) {
          const yeniSinif = siniflar.find(s => s.id === yeniSinifId)
          const docRef = doc(db, 'kurumlar', kurumId, 'ogrenciler', ogr.id)
          await updateDoc(docRef, {
            sinifId: yeniSinifId,
            sinifAd: yeniSinif ? yeniSinif.ad : '',
            guncellenmeTarihi: serverTimestamp()
          })
        }
      }

      // 3. Kurum belgesine dönem onayı referansını yaz
      const kurumRef = doc(db, 'kurumlar', kurumId)
      await updateDoc(kurumRef, {
        donemOnayRef: activeTermKey
      })

      // 4. Varsa bu kuruma ait dönem sonu uyarısını sistem bildirimlerinden kaldır
      const uyarilarQ = query(
        collection(db, 'kurumlar', kurumId, 'sistemBildirimleri'),
        where('tip', '==', 'donem_sonu_uyarisi')
      )
      const uyarilarSnap = await getDocs(uyarilarQ)
      for (const d of uyarilarSnap.docs) {
        await deleteDoc(doc(db, 'kurumlar', kurumId, 'sistemBildirimleri', d.id))
      }

      // 5. İşlem günlüğü kaydet
      await logKaydet({
        profil,
        kullanici,
        islem: 'guncelle',
        modul: 'kurumlar',
        hedefAd: secilenKurum?.ad || 'Kurum',
        kurumId,
        detay: `Dönem sonu kayıt yenileme ve şube değişikliği onayı verildi. Ayrılan: ${ayrilacaklar.length}, Devam Eden: ${devamEdenler.length}`
      })

      setTamamlandi(true)
    } catch (err) {
      setHata('Dönem onayı kaydedilirken hata oluştu: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  // 5. Tablo Filtreleme
  const filtrelenmisOgrenciler = useMemo(() => {
    if (seciliSinifId === 'hepsi') return ogrenciler
    if (seciliSinifId === 'sinifsiz') return ogrenciler.filter(o => !o.sinifId)
    return ogrenciler.filter(o => o.sinifId === seciliSinifId)
  }, [ogrenciler, seciliSinifId])

  // Styles
  const s = {
    card: {
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '16px',
      padding: '1.75rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      marginBottom: '1.5rem'
    },
    title: { fontSize: '1.25rem', fontWeight: '800', color: '#1E293B', marginBottom: '0.5rem' },
    desc: { color: '#64748B', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.5' },
    badge: (ok) => ({
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '0.75rem',
      fontWeight: '700',
      background: ok ? '#D1FAE5' : '#FEF3C7',
      color: ok ? '#065F46' : '#D97706',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    }),
    tableHeader: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    tableCell: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    btnPrimary: {
      background: 'linear-gradient(135deg, #1B3A6B 0%, #2D5099 100%)',
      color: '#fff',
      border: 'none',
      padding: '0.75rem 1.5rem',
      borderRadius: '10px',
      fontWeight: '700',
      fontSize: '0.9rem',
      cursor: 'pointer',
      boxShadow: '0 4px 6px -1px rgba(27, 58, 107, 0.3)',
      transition: 'all 0.2s ease',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    checkbox: {
      width: '18px',
      height: '18px',
      cursor: 'pointer'
    }
  }

  if (yukleniyor) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Veriler yükleniyor...</div>
  }

  return (
    <div style={{ paddingBottom: '60px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1B3A6B', marginBottom: '0.25rem' }}>
        🏁 Dönem İşlemleri
      </h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        <strong>{secilenKurum?.ad}</strong> — Dönem sonu kayıt kontrolü ve onay ekranı
      </p>

      {/* Durum Kartı */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={s.title}>Kayıt Yenileme Kontrolü</h2>
            <p style={s.desc}>
              Yeni döneme geçiş için Süper Admin tarafından dönem sonlandırma işlemleri başlatılmıştır.
              Müdürlüğünüzün dönem kapatma onayını verebilmesi için kayıt yenilemeyecek (okuldan ayrılan) öğrencileri listeden belirleyip onaylaması gerekmektedir.
            </p>
          </div>
          <div>
            <span style={s.badge(onayliMi)}>
              {onayliMi ? '✓ Onaylandı' : '⌛ Onay Bekliyor'}
            </span>
          </div>
        </div>

        {aktifDonemInfo && (
          <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '1rem', border: '1px solid #E2E8F0', display: 'flex', gap: '2rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', fontWeight: '600' }}>AKTİF DÖNEM</span>
              <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1B3A6B' }}>
                {aktifDonemInfo.aktifEgitimYili} - {aktifDonemInfo.aktifDonem}. Dönem
              </span>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', fontWeight: '600' }}>TOPLAM AKTİF ÖĞRENCİ</span>
              <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1B3A6B' }}>
                {ogrenciler.length} Öğrenci
              </span>
            </div>
          </div>
        )}
      </div>

      {tamamlandi ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '16px', color: '#166534' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Dönem Onayı Tamamlandı!</h2>
          <p style={{ fontSize: '0.9rem', color: '#15803d', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
            Okulunuz için kayıt yenileme onay durumları veritabanına başarıyla kaydedilmiştir. Süper Admin genel dönem kapamasını gerçekleştirebilir.
          </p>
          <button style={s.btnPrimary} onClick={() => { setTamamlandi(false); window.location.reload() }}>
            Sayfayı Yenile
          </button>
        </div>
      ) : (
        <>
          {/* Filtre ve Öğrenci Listesi */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#475569' }}>Sınıf Filtresi:</span>
                <select
                  value={seciliSinifId}
                  onChange={e => setSeciliSinifId(e.target.value)}
                  style={{ padding: '6px 12px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', color: '#334155', outline: 'none' }}
                >
                  <option value="hepsi">Tüm Sınıflar</option>
                  <option value="sinifsiz">Sınıf Atanmamışlar</option>
                  {siniflar.map(sf => (
                    <option key={sf.id} value={sf.id}>{sf.ad}</option>
                  ))}
                </select>
              </div>

              {!onayliMi && (
                <button
                  style={{
                    ...s.btnPrimary,
                    opacity: kaydediyor ? 0.6 : 1,
                    cursor: kaydediyor ? 'not-allowed' : 'pointer'
                  }}
                  onClick={handleOnayla}
                  disabled={kaydediyor}
                >
                  {kaydediyor ? '⏳ Kaydediliyor...' : '✓ Kayıt Kontrolünü Tamamla ve Onayla'}
                </button>
              )}
            </div>

            {hata && (
              <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', color: '#991B1B', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                ⚠️ {hata}
              </div>
            )}

            <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={s.tableHeader}>TC / Öğrenci No</th>
                    <th style={s.tableHeader}>Adı Soyadı</th>
                    <th style={s.tableHeader}>Mevcut Sınıfı</th>
                    <th style={s.tableHeader}>Sınıf / Şube Değiştir</th>
                    <th style={s.tableHeader}>Mevcut Durumu</th>
                    <th style={{ ...s.tableHeader, textAlign: 'center', width: '200px' }}>Yeni Dönemde Devam Ediyor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrelenmisOgrenciler.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748B', fontSize: '0.875rem' }}>
                        Bu filtreye uygun öğrenci bulunmamaktadır.
                      </td>
                    </tr>
                  ) : (
                    filtrelenmisOgrenciler.map(o => (
                      <tr key={o.id} style={{ background: !kayitDurumu[o.id] ? '#FFF1F2' : '#ffffff' }}>
                        <td style={s.tableCell}>{o.ogrenciNo || '—'}</td>
                        <td style={{ ...s.tableCell, fontWeight: '700' }}>{o.ad} {o.soyad}</td>
                        <td style={s.tableCell}>{o.sinifAd || 'Sınıfsız'}</td>
                        <td style={s.tableCell}>
                          {(() => {
                            const ogrenciMevcutSinif = siniflar.find(sf => sf.id === o.sinifId)
                            const seviye = ogrenciMevcutSinif?.seviye || ''
                            const uygunSiniflar = seviye ? siniflar.filter(sf => sf.seviye === seviye) : siniflar

                            return (
                              <select
                                value={ogrenciSiniflar[o.id] || ''}
                                onChange={(e) => setOgrenciSiniflar(prev => ({ ...prev, [o.id]: e.target.value }))}
                                disabled={onayliMi || kaydediyor || !kayitDurumu[o.id]}
                                style={{
                                  padding: '5px 10px',
                                  border: '1.5px solid #CBD5E1',
                                  borderRadius: '6px',
                                  fontSize: '0.85rem',
                                  color: '#334155',
                                  background: '#ffffff',
                                  outline: 'none',
                                  cursor: !kayitDurumu[o.id] ? 'not-allowed' : 'pointer'
                                }}
                              >
                                <option value="">Sınıfsız (Boş)</option>
                                {uygunSiniflar.map(sf => (
                                  <option key={sf.id} value={sf.id}>{sf.ad}</option>
                                ))}
                              </select>
                            )
                          })()}
                        </td>
                        <td style={s.tableCell}>
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: '#D1FAE5', color: '#065F46', fontWeight: '700' }}>
                            Aktif
                          </span>
                        </td>
                        <td style={{ ...s.tableCell, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            style={s.checkbox}
                            checked={!!kayitDurumu[o.id]}
                            onChange={() => handleToggleKaydur(o.id)}
                            disabled={onayliMi || kaydediyor}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
