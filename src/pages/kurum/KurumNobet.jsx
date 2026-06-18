import React, { useState, useEffect, useMemo } from 'react'
import {
  collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { logKaydet } from '../../services/logService'

// Haversine Formülü ile mesafe (metre cinsinden)
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity
  const R = 6371e3 // Dünya yarıçapı (metre)
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(R * c)
}

export default function KurumNobet() {
  const { secilenKurumId, secilenKurum } = useKurumYonetim()
  const { profil } = useAuth()

  const [aktifTab, setAktifTab] = useState('takip') // 'takip' | 'noktalar'
  const [nobetNoktalari, setNobetNoktalari] = useState([])
  const [takipVerileri, setTakipVerileri] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')

  // Form State'leri
  const [noktaAd, setNoktaAd] = useState('')
  const [noktaEnlem, setNoktaEnlem] = useState('')
  const [noktaBoylam, setNoktaBoylam] = useState('')
  const [noktaKat, setNoktaKat] = useState('0')
  const [noktaYaricap, setNoktaYaricap] = useState('20')
  const [noktaBasinc, setNoktaBasinc] = useState('1013.25')
  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [modalAcik, setModalAcik] = useState(false)

  // Kalibrasyon Hesaplayıcı State'leri
  const [calibReferans, setCalibReferans] = useState('1013.25')
  const [calibKat, setCalibKat] = useState('1')

  // Simülatör State'leri
  const [simOgretmenId, setSimOgretmenId] = useState('sim-ogretmen-1')
  const [simOgretmenAd, setSimOgretmenAd] = useState('Ahmet Yılmaz (Nöbetçi Fizik Öğr.)')
  const [simOkulda, setSimOkulda] = useState(true)
  const [simKat, setSimKat] = useState(0)
  const [simEnlem, setSimEnlem] = useState('')
  const [simBoylam, setSimBoylam] = useState('')
  const [simBasinc, setSimBasinc] = useState(1013.25)

  // Nöbet Noktalarını dinle
  useEffect(() => {
    if (!secilenKurumId) return
    setYukleniyor(true)
    const q = collection(db, 'kurumlar', secilenKurumId, 'nobetNoktalari')
    const unsub = onSnapshot(q, (snap) => {
      const liste = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setNobetNoktalari(liste)
      setYukleniyor(false)
    }, (err) => {
      console.error('Nöbet noktaları hatası:', err)
      setHata('Nöbet noktaları yüklenirken bir hata oluştu.')
      setYukleniyor(false)
    })
    return () => unsub()
  }, [secilenKurumId])

  // Nöbetçi Öğretmen Takip kayıtlarını dinle
  useEffect(() => {
    if (!secilenKurumId) return
    const q = collection(db, 'kurumlar', secilenKurumId, 'nobetTakip')
    const unsub = onSnapshot(q, (snap) => {
      const liste = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTakipVerileri(liste)
    })
    return () => unsub()
  }, [secilenKurumId])

  // Okulun varsayılan koordinatlarını formda veya simülatörde kullan
  useEffect(() => {
    if (secilenKurum && !duzenlenenId) {
      // Okulun koordinatları kayıtlıysa oradan çek, yoksa varsayılan okulmatik merkezini koy
      const defLat = secilenKurum.enlem || 36.8121
      const defLng = secilenKurum.boylam || 34.6415
      setNoktaEnlem(defLat.toString())
      setNoktaBoylam(defLng.toString())
      setSimEnlem(defLat.toString())
      setSimBoylam(defLng.toString())
    }
  }, [secilenKurum, duzenlenenId])

  // Form Temizle
  function formTemizle() {
    setNoktaAd('')
    setNoktaEnlem(secilenKurum?.enlem?.toString() || '36.8121')
    setNoktaBoylam(secilenKurum?.boylam?.toString() || '34.6415')
    setNoktaKat('0')
    setNoktaYaricap('20')
    setNoktaBasinc('1013.25')
    setDuzenlenenId(null)
  }

  // Nöbet Noktası Kaydet / Güncelle
  async function handleNoktaKaydet(e) {
    e.preventDefault()
    if (!secilenKurumId) return
    if (!noktaAd) {
      alert('Lütfen nöbet noktası adını giriniz.')
      return
    }

    const veri = {
      ad: noktaAd,
      enlem: parseFloat(noktaEnlem) || 0,
      boylam: parseFloat(noktaBoylam) || 0,
      kat: parseInt(noktaKat) || 0,
      yaricap: parseInt(noktaYaricap) || 20,
      referansBasinc: parseFloat(noktaBasinc) || 1013.25,
      olusturmaTarihi: serverTimestamp()
    }

    try {
      if (duzenlenenId) {
        await updateDoc(doc(db, 'kurumlar', secilenKurumId, 'nobetNoktalari', duzenlenenId), veri)
        await logKaydet('NÖBET', `Nöbet noktası güncellendi: ${noktaAd}`, profil)
      } else {
        await addDoc(collection(db, 'kurumlar', secilenKurumId, 'nobetNoktalari'), veri)
        await logKaydet('NÖBET', `Yeni nöbet noktası eklendi: ${noktaAd}`, profil)
      }
      setModalAcik(false)
      formTemizle()
    } catch (err) {
      console.error(err)
      alert('Nöbet noktası kaydedilirken hata oluştu.')
    }
  }

  // Nöbet Noktası Düzenle Modunu Aç
  function handleDuzenleModu(nokta) {
    setDuzenlenenId(nokta.id)
    setNoktaAd(nokta.ad)
    setNoktaEnlem(nokta.enlem.toString())
    setNoktaBoylam(nokta.boylam.toString())
    setNoktaKat(nokta.kat.toString())
    setNoktaYaricap(nokta.yaricap.toString())
    setNoktaBasinc(nokta.referansBasinc.toString())
    setModalAcik(true)
  }

  // Nöbet Noktası Sil
  async function handleNoktaSil(id, ad) {
    if (!window.confirm(`"${ad}" nöbet noktasını silmek istediğinize emin misiniz?`)) return
    try {
      await deleteDoc(doc(db, 'kurumlar', secilenKurumId, 'nobetNoktalari', id))
      await logKaydet('NÖBET', `Nöbet noktası silindi: ${ad}`, profil)
    } catch (err) {
      console.error(err)
      alert('Silme işlemi başarısız.')
    }
  }

  // Tarayıcıdan Anlık Konum Alma Yardımı
  function handleTarayiciKonumAl() {
    if (!navigator.geolocation) {
      alert('Tarayıcınız konum servisini desteklemiyor.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNoktaEnlem(pos.coords.latitude.toFixed(6))
        setNoktaBoylam(pos.coords.longitude.toFixed(6))
      },
      (err) => {
        console.error(err)
        alert('Konum alınamadı. Lütfen konum izinlerini kontrol edin.')
      },
      { enableHighAccuracy: true }
    )
  }

  // Kalibrasyon Yardımı Hesaplama
  const calibHesaplananBasinc = useMemo(() => {
    const pRef = parseFloat(calibReferans) || 1013.25
    const kat = parseInt(calibKat) || 0
    // Her kat için ~0.3 hPa düşüş varsayıyoruz
    return (pRef - kat * 0.3).toFixed(2)
  }, [calibReferans, calibKat])

  // Simülatörden Veri Gönderimi (Öğretmen Telemetri Simülasyonu)
  async function handleTelemetriGonder() {
    if (!secilenKurumId) return
    const veri = {
      ogretmenAd: simOgretmenAd,
      okuldaMi: simOkulda,
      aktifKat: parseInt(simKat),
      anlikBasinc: parseFloat(simBasinc),
      enlem: parseFloat(simEnlem) || 0,
      boylam: parseFloat(simBoylam) || 0,
      sonGuncelleme: serverTimestamp()
    }

    try {
      await setDoc(doc(db, 'kurumlar', secilenKurumId, 'nobetTakip', simOgretmenId), veri)
      alert(`${simOgretmenAd} için anlık telemetri Firebase'e yazıldı!`)
    } catch (err) {
      console.error(err)
      alert('Telemetri verisi gönderilemedi.')
    }
  }

  // Öğretmenin nöbet noktasındaki durumunu değerlendir
  function ogretmenDurumHesapla(ogretmen, nokta) {
    if (!ogretmen.okuldaMi) {
      return { kod: 'DISARIDA', metin: 'Okul Dışında', renk: '#EF4444', ikon: '🔴' }
    }

    // Kat kontrolü
    if (ogretmen.aktifKat !== nokta.kat) {
      const farkKat = ogretmen.aktifKat - nokta.kat
      const farkYildiz = Math.abs(farkKat)
      return {
        kod: 'YANLIS_KAT',
        metin: `Farklı Katta (${farkKat > 0 ? '+' : ''}${farkKat}. Kat)`,
        renk: '#F59E0B',
        ikon: '⚠️'
      }
    }

    // Coğrafi mesafe kontrolü
    const mesafe = haversineDistance(ogretmen.enlem, ogretmen.boylam, nokta.enlem, nokta.boylam)
    if (mesafe > nokta.yaricap) {
      return {
        kod: 'UZAKTA',
        metin: `Nöbet Alanı Dışında (${mesafe}m uzakta)`,
        renk: '#3B82F6',
        ikon: '🚸'
      }
    }

    return { kod: 'NOKTADA', metin: 'Nöbet Noktasında', renk: '#10B981', ikon: '🟢' }
  }

  if (yukleniyor) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: '#64748B' }}>
        <span>Nöbet verileri yükleniyor...</span>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Üst Bilgi Başlığı */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1B3A6B', margin: 0 }}>
            🛡️ Nöbetçi Öğretmen Yönetim & Takip Sistemi
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 0' }}>
            Okul içi barometrik kat tespiti ve GPS tabanlı nöbet alanı doğrulama paneli.
          </p>
        </div>

        {/* Tab Seçiciler */}
        <div style={{ display: 'flex', background: '#E2E8F0', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setAktifTab('takip')}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600',
              cursor: 'pointer', background: aktifTab === 'takip' ? '#fff' : 'transparent',
              color: aktifTab === 'takip' ? '#1B3A6B' : '#64748B', transition: 'all 0.15s'
            }}
          >
            📋 Canlı Nöbet Takibi
          </button>
          <button
            onClick={() => setAktifTab('noktalar')}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600',
              cursor: 'pointer', background: aktifTab === 'noktalar' ? '#fff' : 'transparent',
              color: aktifTab === 'noktalar' ? '#1B3A6B' : '#64748B', transition: 'all 0.15s'
            }}
          >
            ⚙️ Nöbet Noktaları ve Kalibrasyon
          </button>
        </div>
      </div>

      {hata && (
        <div style={{ padding: '1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {hata}
        </div>
      )}

      {/* ── TAB 1: CANLI NÖBET TAKİBİ ── */}
      {aktifTab === 'takip' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Sol Kolon: Nöbet Noktaları ve Öğretmenlerin Durumları */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {nobetNoktalari.length === 0 ? (
              <div style={{ background: '#fff', border: '1px dashed #CBD5E1', borderRadius: '12px', padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📍</div>
                <h3 style={{ margin: 0, color: '#1E293B' }}>Kayıtlı Nöbet Noktası Yok</h3>
                <p style={{ color: '#64748B', fontSize: '0.85rem', maxWidth: '360px', margin: '0.5rem auto 1.25rem' }}>
                  Öğretmenlerin takibine başlayabilmek için öncelikle okul sınırlarında nöbet alanlarını (kat ve GPS koordinatlarıyla) tanımlamalısınız.
                </p>
                <button
                  onClick={() => { setAktifTab('noktalar'); setModalAcik(true); }}
                  style={{ padding: '0.5rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  İlk Noktayı Ekle
                </button>
              </div>
            ) : (
              nobetNoktalari.map(nokta => {
                // Bu noktaya atanmış/o an takip edilen öğretmenleri eşleştir
                return (
                  <div key={nokta.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Nokta Başlığı */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
                      <div>
                        <span style={{ fontWeight: '700', fontSize: '1rem', color: '#1E293B' }}>{nokta.ad}</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#F1F5F9', padding: '2px 8px', borderRadius: '999px', color: '#475569', fontWeight: '600' }}>
                          {nokta.kat === 0 ? 'Zemin Kat' : `${nokta.kat}. Kat`}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                        Hedef: {nokta.referansBasinc} hPa ± {nokta.yaricap}m
                      </div>
                    </div>

                    {/* Öğretmen Durum Kartları */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {takipVerileri.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontStyle: 'italic', padding: '0.25rem' }}>
                          Henüz hiçbir öğretmenden telemetri verisi gelmedi.
                        </div>
                      ) : (
                        takipVerileri.map(ogr => {
                          const durum = ogretmenDurumHesapla(ogr, nokta)
                          return (
                            <div key={ogr.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ fontSize: '1.2rem' }}>🧑‍🏫</div>
                                <div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1E293B' }}>{ogr.ogretmenAd}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                    Rakım Basıncı: {ogr.anlikBasinc} hPa • Konum: {ogr.enlem.toFixed(5)}, {ogr.boylam.toFixed(5)}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{
                                  fontSize: '0.75rem', fontWeight: '700',
                                  color: '#fff', background: durum.renk,
                                  padding: '4px 10px', borderRadius: '6px',
                                }} title={durum.metin}>
                                  {durum.ikon} {durum.metin}
                                </span>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })
            )}

            {/* Bilgilendirme Notu */}
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '1rem', display: 'flex', gap: '0.75rem' }}>
              <div style={{ fontSize: '1.5rem' }}>💡</div>
              <div style={{ fontSize: '0.8rem', color: '#1E40AF', lineHeight: '1.4' }}>
                <strong>Nasıl Çalışır?</strong> Öğretmenin telefonundaki mobil uygulama, GPS ve barometre donanımlarından aldığı verileri Firebase'e anlık raporlar. Sistem, yukarıdaki kriterlere göre öğretmenin tanımlanan 3 boyutlu nöbet koordinatlarında bulunup bulunmadığını otomatik hesaplar.
              </div>
            </div>
          </div>

          {/* Sağ Kolon: Öğretmen Telemetri Simülatörü */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🧪 Nöbetçi Simülatörü
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>
              Mobil uygulama yüklenene kadar sistem algoritmalarını test etmek için buradan sanal cihaz sinyalleri gönderebilirsiniz.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
              
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Sanal Öğretmen Kimliği:
                <select
                  value={simOgretmenId}
                  onChange={e => {
                    setSimOgretmenId(e.target.value)
                    setSimOgretmenAd(e.target.options[e.target.selectedIndex].text)
                  }}
                  style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }}
                >
                  <option value="sim-ogretmen-1">Ahmet Yılmaz (Nöbetçi Fizik Öğr.)</option>
                  <option value="sim-ogretmen-2">Zeynep Kaya (Nöbetçi Edebiyat Öğr.)</option>
                  <option value="sim-ogretmen-3">Mehmet Demir (Nöbetçi Kimya Öğr.)</option>
                </select>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={simOkulda}
                  onChange={e => setSimOkulda(e.target.checked)}
                />
                Okul Sınırları İçinde mi? (GPS)
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Bulunduğu Kat:
                <select
                  value={simKat}
                  onChange={e => {
                    const k = parseInt(e.target.value)
                    setSimKat(k)
                    // Kat yüksekliğine göre barometrik basıncı otomatik ayarla (Kat başına ~0.3 hPa düşer)
                    setSimBasinc(1013.25 - k * 0.3)
                  }}
                  style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }}
                >
                  <option value="-1">Bodrum Kat (-1)</option>
                  <option value="0">Zemin Kat (0)</option>
                  <option value="1">1. Kat</option>
                  <option value="2">2. Kat</option>
                  <option value="3">3. Kat</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Sanal Basınç Değeri (hPa):
                <input
                  type="number"
                  step="0.05"
                  value={simBasinc}
                  onChange={e => setSimBasinc(parseFloat(e.target.value) || 1013.25)}
                  style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', fontWeight: '600', color: '#475569' }}>
                  Enlem (Lat):
                  <input
                    type="number"
                    step="0.000001"
                    value={simEnlem}
                    onChange={e => setSimEnlem(e.target.value)}
                    style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', fontWeight: '600', color: '#475569' }}>
                  Boylam (Lng):
                  <input
                    type="number"
                    step="0.000001"
                    value={simBoylam}
                    onChange={e => setSimBoylam(e.target.value)}
                    style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                </label>
              </div>

              {/* Hızlı Konum Atamaları */}
              {nobetNoktalari.length > 0 && (
                <div style={{ marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                    Hızlı Konumlandır (Noktaya Işınla):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {nobetNoktalari.map(n => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setSimEnlem(n.enlem.toString())
                          setSimBoylam(n.boylam.toString())
                          setSimKat(n.kat)
                          setSimBasinc(n.referansBasinc)
                        }}
                        style={{
                          fontSize: '0.7rem', padding: '3px 8px', background: '#F1F5F9', border: '1px solid #CBD5E1',
                          borderRadius: '4px', cursor: 'pointer', transition: 'background 0.1s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                        onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}
                      >
                        📍 {n.ad}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleTelemetriGonder}
                style={{
                  marginTop: '0.5rem', padding: '0.6rem', background: '#10B981', color: '#fff', border: 'none',
                  borderRadius: '6px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                onMouseLeave={e => e.currentTarget.style.background = '#10B981'}
              >
                📡 Sinyal Gönder (Firebase)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: NÖBET NOKTALARI VE KALİBRASYON YÖNETİMİ ── */}
      {aktifTab === 'noktalar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Kalibrasyon Asistanı Rehberi */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: '#1B3A6B', fontSize: '1rem', fontWeight: '700' }}>
              📟 Barometrik Basınç Kalibrasyon Asistanı
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: '1.5' }}>
              Atmosfer basıncı deniz seviyesinden yükseldikçe düşer (ortalama her 8.3 metrede ya da her katta ~0.3 hPa). 
              Hava durumuna bağlı günlük oynamalardan kaçınmak için referans basınç değeri girilmelidir. 
              Aşağıdaki asistanı kullanarak okulunuzun zemin kat basıncına göre üst katların hedef kalibrasyon basınçlarını otomatik üretebilirsiniz.
            </p>

            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.25rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569', flex: '1 1 180px' }}>
                Zemin Kat Referans Basıncı (hPa):
                <input
                  type="number"
                  step="0.05"
                  value={calibReferans}
                  onChange={e => setCalibReferans(e.target.value)}
                  style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569', flex: '1 1 180px' }}>
                Hesaplanacak Hedef Kat:
                <select
                  value={calibKat}
                  onChange={e => setCalibKat(e.target.value)}
                  style={{ padding: '0.4rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem' }}
                >
                  <option value="-1">Bodrum Kat (-1)</option>
                  <option value="0">Zemin Kat (0)</option>
                  <option value="1">1. Kat</option>
                  <option value="2">2. Kat</option>
                  <option value="3">3. Kat</option>
                </select>
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: '1 1 180px' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '600' }}>Hesaplanan Hedef Kat Basıncı:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1B3A6B', marginTop: '2px' }}>
                  {calibHesaplananBasinc} hPa
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', flex: '1 1 180px' }}>
                <button
                  onClick={() => {
                    setNoktaKat(calibKat)
                    setNoktaBasinc(calibHesaplananBasinc)
                    setModalAcik(true)
                  }}
                  style={{
                    width: '100%', padding: '0.5rem 1rem', background: '#1B3A6B', color: '#fff', border: 'none',
                    borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  Forma Aktar & Yeni Nokta Ekle
                </button>
              </div>
            </div>
          </div>

          {/* Nöbet Noktaları Listesi ve Ekleme Butonu */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#1E293B', fontSize: '1rem', fontWeight: '700' }}>
                📍 Tanımlı Nöbet Noktaları Havuzu
              </h3>
              <button
                onClick={() => { formTemizle(); setModalAcik(true) }}
                style={{
                  padding: '0.5rem 1.25rem', background: '#10B981', color: '#fff', border: 'none',
                  borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem'
                }}
              >
                + Yeni Nöbet Noktası Tanımla
              </button>
            </div>

            {nobetNoktalari.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                Kayıtlı nöbet noktası bulunmuyor.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '0.75rem 0.5rem', fontWeight: '700' }}>Nokta Adı</th>
                      <th style={{ padding: '0.75rem 0.5rem', fontWeight: '700' }}>Kat Seviyesi</th>
                      <th style={{ padding: '0.75rem 0.5rem', fontWeight: '700' }}>Koordinatlar (Enlem, Boylam)</th>
                      <th style={{ padding: '0.75rem 0.5rem', fontWeight: '700' }}>Güvenli Yarıçap (Metre)</th>
                      <th style={{ padding: '0.75rem 0.5rem', fontWeight: '700' }}>Kalibre Basınç (hPa)</th>
                      <th style={{ padding: '0.75rem 0.5rem', fontWeight: '700', textAlign: 'right' }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nobetNoktalari.map(nokta => (
                      <tr key={nokta.id} style={{ borderBottom: '1px solid #F1F5F9', color: '#1E293B' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>{nokta.ad}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ background: '#EFF6FF', color: '#1E40AF', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>
                            {nokta.kat === 0 ? 'Zemin Kat (0)' : `${nokta.kat}. Kat`}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', color: '#64748B' }}>
                          {nokta.enlem.toFixed(6)}, {nokta.boylam.toFixed(6)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{nokta.yaricap} metre</td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: '700', color: '#1B3A6B' }}>
                          {nokta.referansBasinc} hPa
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDuzenleModu(nokta)}
                            style={{
                              background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer',
                              fontWeight: '600', marginRight: '0.75rem', fontSize: '0.8rem'
                            }}
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => handleNoktaSil(nokta.id, nokta.ad)}
                            style={{
                              background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer',
                              fontWeight: '600', fontSize: '0.8rem'
                            }}
                          >
                            Sil
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: NOKTA EKLEME & DÜZENLEME FORMU ── */}
      {modalAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '480px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden'
          }}>
            {/* Modal Başlığı */}
            <div style={{
              background: '#1B3A6B', padding: '1rem 1.25rem', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                {duzenlenenId ? '📍 Nöbet Noktası Güncelle' : '📍 Yeni Nöbet Noktası Tanımla'}
              </span>
              <button
                onClick={() => { setModalAcik(false); formTemizle() }}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Modal Formu */}
            <form onSubmit={handleNoktaKaydet} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Nöbet Noktası Adı / Tanımı:
                <input
                  type="text"
                  placeholder="Örn: Kuzey Bahçe Girişi, A Blok 2. Kat"
                  value={noktaAd}
                  onChange={e => setNoktaAd(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
                  required
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                  Bulunduğu Kat:
                  <select
                    value={noktaKat}
                    onChange={e => setNoktaKat(e.target.value)}
                    style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    <option value="-1">Bodrum Kat (-1)</option>
                    <option value="0">Zemin Kat (0)</option>
                    <option value="1">1. Kat</option>
                    <option value="2">2. Kat</option>
                    <option value="3">3. Kat</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                  Güvenli Yarıçap (Metre):
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={noktaYaricap}
                    onChange={e => setNoktaYaricap(e.target.value)}
                    style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                  Enlem (Latitude):
                  <input
                    type="number"
                    step="0.000001"
                    value={noktaEnlem}
                    onChange={e => setNoktaEnlem(e.target.value)}
                    style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
                    required
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                  Boylam (Longitude):
                  <input
                    type="number"
                    step="0.000001"
                    value={noktaBoylam}
                    onChange={e => setNoktaBoylam(e.target.value)}
                    style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
                    required
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleTarayiciKonumAl}
                style={{
                  padding: '4px 8px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF',
                  borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', alignSelf: 'flex-start'
                }}
              >
                🛰️ Tarayıcımdan Mevcut Konumumu Al
              </button>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
                Referans Basınç Değeri (hPa):
                <input
                  type="number"
                  step="0.01"
                  value={noktaBasinc}
                  onChange={e => setNoktaBasinc(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.85rem' }}
                  required
                />
              </label>

              {/* Modal Aksiyonları */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.75rem', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setModalAcik(false); formTemizle() }}
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
                  {duzenlenenId ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
