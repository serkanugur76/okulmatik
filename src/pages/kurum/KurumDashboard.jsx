import { useEffect, useState, useMemo } from 'react'
import { collection, getCountFromServer, query, where, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { getDescendants, getAncestors } from '../../utils/hierarchy'

function IstatKart({ baslik, deger, ikon, renk, altyazi }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1.5rem',
      border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem',
    }}>
      <div style={{
        width: '52px', height: '52px', borderRadius: '12px',
        background: renk + '18', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '1.5rem',
      }}>
        {ikon}
      </div>
      <div>
        <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1E293B' }}>
          {deger === null ? '…' : deger}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#64748B' }}>{baslik}</div>
        {altyazi && <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>{altyazi}</div>}
      </div>
    </div>
  )
}

export default function KurumDashboard() {
  const { kullanici, profil } = useAuth()
  const { erisimKurumlar, secilenKurumId, secilenKurum, yukleniyor, ogretmenModu, ogretmenSinifIdleri } = useKurumYonetim()
  const [sayilar, setSayilar] = useState({ siniflar: null, ogrenciler: null, kullanicilar: null, mentorOgrenciler: null, rubrikler: null })
  const [quotaError, setQuotaError] = useState(false)

  // Seçili kurumun seviyesi
  const ust = erisimKurumlar.find(k => k.id === secilenKurum?.parentId)
  const seviye = !secilenKurum?.parentId ? 'root'
    : !ust?.parentId ? 'kampus'
    : 'altKurum'

  // Sayım yapılacak kurum listesi
  const sayimKurumlar = useMemo(() => {
    if (!secilenKurumId) return []
    const descendants = getDescendants(secilenKurumId, erisimKurumlar)
    const subSchools = descendants.filter(k => k.tip === 'altKurum')
    const seciliObj = erisimKurumlar.find(k => k.id === secilenKurumId)
    if (seciliObj && seciliObj.tip === 'altKurum') {
      subSchools.push(seciliObj)
    }
    return [...new Map(subSchools.map(s => [s.id, s])).values()]
  }, [secilenKurumId, erisimKurumlar])

  // Özet metinler
  const rootKurum = erisimKurumlar.find(k => !k.parentId)
  const kampusSayisi = erisimKurumlar.filter(k => k.parentId === secilenKurumId && k.tip === 'kampus').length

  const baslik = seviye === 'root'
    ? rootKurum?.ad || 'Dashboard'
    : secilenKurum?.ad || 'Dashboard'

  const altyazi = seviye === 'root'
    ? 'Tüm kampüs ve alt kurumlara ait özet'
    : seviye === 'kampus'
    ? `${secilenKurum?.ad} kampüsündeki alt kurumlara ait özet`
    : `${secilenKurum?.ad} alt kurumuna ait özet`

  useEffect(() => {
    if (yukleniyor || sayimKurumlar.length === 0) {
      setSayilar({ siniflar: null, ogrenciler: null, kullanicilar: null, mentorOgrenciler: null, rubrikler: null })
      return
    }
    setQuotaError(false)

    async function yukle() {
      try {
        if (ogretmenModu) {
          // Öğretmenin erişebileceği okullar
          const ogretmenOkullari = sayimKurumlar.filter(k =>
            k.id === secilenKurumId || (profil?.erisimKurumIdler || []).includes(k.id)
          )

          // Mentor olunan öğrenci sayılarını çek
          const mentorSonuclar = await Promise.all(
            ogretmenOkullari.map(async (k) => {
              try {
                const docSnap = await getDoc(doc(db, 'kurumlar', k.id, 'mentorAtamalari', kullanici?.uid))
                if (docSnap.exists()) {
                  const data = docSnap.data()
                  return (data.ogrenciler || []).length
                }
              } catch (e) {
                console.warn(`Mentor belgesi alınamadı (${k.id}):`, e.message)
                if (e.message?.includes('Quota exceeded') || e.message?.includes('quota')) {
                  setQuotaError(true)
                }
              }
              return 0
            })
          )
          const toplamMentorOgrenci = mentorSonuclar.reduce((a, b) => a + b, 0)

          // Öğretmenin atandığı sınıfları, öğrencileri ve rubrikleri say
          const okullarSonuclari = await Promise.all(
            ogretmenOkullari.map(async (k) => {
              try {
                const ogretmenOkulSinifIds = (profil?.sinifAtamalari || []).find(a => a.kurumId === k.id)?.siniflar || []
                if (ogretmenOkulSinifIds.length === 0) {
                  return { siniflar: 0, ogrenciler: 0, rubrikler: 0 }
                }

                // Sınıfların seviyelerini çek
                const sinifSnaplar = await Promise.all(
                  ogretmenOkulSinifIds.map(sid => getDoc(doc(db, 'kurumlar', k.id, 'siniflar', sid)))
                )
                const teacherGradeLevels = sinifSnaplar
                  .filter(s => s.exists())
                  .map(s => Number(s.data().seviye))
                  .filter(Boolean)

                // Öğrenci sayısını çek
                const qOgr = query(
                  collection(db, 'kurumlar', k.id, 'ogrenciler'),
                  where('sinifId', 'in', ogretmenOkulSinifIds)
                )
                const snapshotOgr = await getCountFromServer(qOgr)
                const ogrenciSayisi = snapshotOgr.data().count

                 // Rubrik sayısını çek (Seçili okul ve onun tüm üst hiyerarşisinden/kampüs/root rubrikleri yükler)
                 let rubrikSayisi = 0
                 const ancestors = getAncestors(k.id, erisimKurumlar)
                 const rubrikKurumIds = [...new Set([k.id, ...ancestors])]
                 const rubrikSnaps = await Promise.all(
                   rubrikKurumIds.map(kid => getDocs(collection(db, 'kurumlar', kid, 'rubrikler')))
                 )
                 const tumRubrikler = rubrikSnaps.flatMap((snap, idx) => {
                   const kid = rubrikKurumIds[idx]
                   return snap.docs.map(d => ({ id: d.id, ...d.data(), _kurumId: kid }))
                 })

                // 1. Ders/Branş ve Sınıf Seviyesine Göre Eşleşen Rubrikler
                let dersRubrikIds = []
                if (teacherGradeLevels.length > 0) {
                  const branslar = profil?.branslar || []
                  const eslesen = tumRubrikler.filter(r => {
                    const bransMatch = branslar.length === 0 || branslar.includes(r.ders)
                    const levelMatch = (r.hedefSeviyeler || []).some(lvl => teacherGradeLevels.includes(Number(lvl)))
                    return bransMatch && levelMatch
                  })
                  dersRubrikIds = eslesen.map(r => r.id)
                }

                // 2. Kulüplere Göre Eşleşen Rubrikler
                let kulupRubrikIds = []
                let kulupSorguSonucu = []
                if (kullanici?.uid) {
                  const qClubs = query(
                    collection(db, 'kurumlar', k.id, 'kulupler'),
                    where('ogretmenIds', 'array-contains', kullanici.uid)
                  )
                  const clubsSnap = await getDocs(qClubs)
                  kulupSorguSonucu = clubsSnap.docs.map(d => ({ ad: d.data().ad, rubrikIds: d.data().rubrikIds || [] }))
                  kulupRubrikIds = clubsSnap.docs.flatMap(d => d.data().rubrikIds || [])
                }

                // Toplam benzersiz aktif rubrik sayısı
                const benzersizRubrikIds = [...new Set([...dersRubrikIds, ...kulupRubrikIds])]
                rubrikSayisi = benzersizRubrikIds.length



                return {
                  siniflar: ogretmenOkulSinifIds.length,
                  ogrenciler: ogrenciSayisi,
                  rubrikler: rubrikSayisi
                }
              } catch (e) {
                console.warn(`Okul ${k.id} için sayılar alınamadı:`, e.message)
                if (e.message?.includes('Quota exceeded') || e.message?.includes('quota')) {
                  setQuotaError(true)
                }
                return { siniflar: 0, ogrenciler: 0, rubrikler: 0, error: e.message }
              }
            })
          )

          let toplamSinif = 0, toplamOgrenci = 0, toplamRubrik = 0
          okullarSonuclari.forEach(r => {
            toplamSinif += r.siniflar
            toplamOgrenci += r.ogrenciler
            toplamRubrik += r.rubrikler
          })



          setSayilar({
            siniflar: toplamSinif,
            ogrenciler: toplamOgrenci,
            kullanicilar: null,
            mentorOgrenciler: toplamMentorOgrenci,
            rubrikler: toplamRubrik
          })
          return
        }

        const sonuclar = await Promise.all(
          sayimKurumlar.map(k => Promise.all([
            getCountFromServer(collection(db, 'kurumlar', k.id, 'siniflar')),
            getCountFromServer(collection(db, 'kurumlar', k.id, 'ogrenciler')),
            getCountFromServer(collection(db, 'kurumlar', k.id, 'kullanicilar')),
          ]))
        )
        let toplamSinif = 0, toplamOgrenci = 0, toplamKullanici = 0
        sonuclar.forEach(([s, o, k]) => {
          toplamSinif     += s.data().count
          toplamOgrenci   += o.data().count
          toplamKullanici += k.data().count
        })
        setSayilar({ siniflar: toplamSinif, ogrenciler: toplamOgrenci, kullanicilar: toplamKullanici, mentorOgrenciler: null, rubrikler: null })
      } catch (err) {
        console.error('Dashboard yükleme hatası:', err)
        if (err.message?.includes('Quota exceeded') || err.message?.includes('quota')) {
          setQuotaError(true)
        }
        setSayilar({ siniflar: 0, ogrenciler: 0, kullanicilar: 0, mentorOgrenciler: 0, rubrikler: 0 })
      }
    }
    yukle()
  }, [secilenKurumId, erisimKurumlar, yukleniyor, ogretmenModu, ogretmenSinifIdleri, kullanici?.uid, profil?.branslar, profil?.sinifAtamalari, profil?.erisimKurumIdler])

  return (
    <div>
      <div style={{ marginBottom: '2rem' }} />

      {quotaError && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '12px',
          padding: '1.25rem', marginBottom: '1.5rem', color: '#991B1B', fontSize: '0.875rem',
          lineHeight: '1.5'
        }}>
          <div style={{ fontWeight: '800', marginBottom: '0.25rem' }}>⚠️ Firebase Günlük Okuma Limiti Aşılmış (Quota Exceeded)</div>
          <div style={{ color: '#7F1D1D', fontSize: '0.825rem' }}>
            Okulmatik'in bağlı olduğu Firebase veritabanının günlük ücretsiz okuma limiti (50,000 okuma) dolmuştur. 
            Bu nedenle sayfadaki istatistikler ve veriler geçici olarak yüklenememektedir. 
            Limitler her gün Türkiye saati ile sabah 10:00 civarında otomatik olarak sıfırlanmaktadır. 
            Kesintisiz kullanım için projenizi Firebase Console üzerinden <strong>Blaze planına</strong> yükseltebilirsiniz (Blaze planında günlük ilk 200,000 okuma ücretsizdir).
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {seviye === 'root' && !ogretmenModu && (
          <IstatKart
            baslik="Kampüs"
            deger={kampusSayisi}
            ikon="🏛️"
            renk="#7C3AED"
            altyazi={`${sayimKurumlar.length} alt kurum`}
          />
        )}
        {seviye === 'kampus' && !ogretmenModu && (
          <IstatKart
            baslik="Alt Kurum"
            deger={sayimKurumlar.length}
            ikon="🏛️"
            renk="#7C3AED"
          />
        )}
        <IstatKart baslik="Sınıf"     deger={sayilar.siniflar}     ikon="🏫" renk="#1B3A6B" />
        <IstatKart baslik="Öğrenci"   deger={sayilar.ogrenciler}   ikon="🎒" renk="#0369A1" />
        {ogretmenModu && (
          <>
            <IstatKart
              baslik="Aktif Rubrik"
              deger={sayilar.rubrikler}
              ikon="📋"
              renk="#059669"
              altyazi="Doldurulması Gereken Rubrik"
            />
            <IstatKart
              baslik="Mentorluk"
              deger={sayilar.mentorOgrenciler}
              ikon="🎓"
              renk="#7C3AED"
              altyazi="Rehberlik Edilen Öğrenci"
            />
          </>
        )}
        {!ogretmenModu && <IstatKart baslik="Kullanıcı" deger={sayilar.kullanicilar} ikon="👥" renk="#065F46" />}
      </div>

      {/* 🛠️ MODÜL YÖNETİMİ PANELİ (Sadece Kurum Yöneticileri ve Super Admin Görür) */}
      {!ogretmenModu && (profil?.rol === 'kurum_admin' || profil?.rol === 'platform_admin') && (
        <div style={{
          marginTop: '2rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#1B3A6B', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🛠️</span> <span>Kurum Modül ve Menü Yönetimi</span>
          </h3>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: '#64748B' }}>
            Okulunuzun yan menüsünde görünmesini istediğiniz modülleri açıp kapatabilirsiniz. Yan menü anlık olarak güncellenir.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
            {[
              { id: 'siniflar', etiket: '🏫 Sınıf Yönetimi', aciklama: 'Sınıflar, şubeler ve ders atamaları.' },
              { id: 'ogrenciler', etiket: '🎒 Öğrenci Yönetimi', aciklama: 'Öğrenci dosyaları ve iletişim bilgileri.' },
              { id: 'kullanicilar', etiket: '👥 Kullanıcı Yönetimi', aciklama: 'Öğretmen ve okul personeli yetkileri.' },
              { id: 'rubrikler', etiket: '📝 Rubrik Değerlendirmeleri', aciklama: 'Kriterli öğrenci değerlendirme sistemi.' },
              { id: 'resmiIslemler', etiket: '🏛️ Resmi İş ve Evrak Takibi', aciklama: 'İş planları ve resmi evrak üretim aracı.' },
              { id: 'mentor', etiket: '🎓 Mentorluk Programı', aciklama: 'Öğrenci koçluğu ve gelişim takibi.' },
              { id: 'nobet', etiket: '🛡️ Nöbet Planlama', aciklama: 'Öğretmen nöbet çizelgeleri ve takvim.' },
              { id: 'kulupler', etiket: '🏆 Sosyal Kulüp Yönetimi', aciklama: 'Öğrenci kulüp dağıtımları ve yoklama.' },
              { id: 'kutuphane', etiket: '📚 Okul Kütüphanesi', aciklama: 'Kitap envanteri ve ödünç takip sistemi.' },
              { id: 'arge', etiket: '🔬 Ar-Ge & Bilim Projeleri', aciklama: 'TÜBİTAK 2204-B Sihirbazı ve AI Denetçi.', premium: true }
            ].map(modul => {
              const aktifHarita = secilenKurum?.aktifModuller || {}
              
              // Değer tespiti
              let isChecked = aktifHarita[modul.id] !== undefined ? aktifHarita[modul.id] : true
              if (modul.id === 'arge' && aktifHarita.arge === undefined) {
                isChecked = false // Arge default false
              }

              // Premium lisans kontrolü
              const premiumLisans = secilenKurum?.lisansliModuller?.argeModulu || false
              const isLocked = modul.premium && !premiumLisans

              return (
                <div key={modul.id} style={{
                  border: '1.5px solid #F1F5F9', borderRadius: '12px', padding: '0.85rem', background: '#FAFAFA',
                  display: 'flex', alignItems: 'flex-start', gap: '10px', opacity: isLocked ? 0.7 : 1,
                  position: 'relative'
                }}>
                  <input
                    type="checkbox"
                    checked={isLocked ? false : isChecked}
                    disabled={isLocked}
                    onChange={async (e) => {
                      if (!secilenKurumId) return
                      const guncelDeger = e.target.checked
                      const newAktifMap = { ...aktifHarita, [modul.id]: guncelDeger }
                      try {
                        await updateDoc(doc(db, 'kurumlar', secilenKurumId), {
                          aktifModuller: newAktifMap
                        })
                      } catch (err) {
                        console.error("Modül durumu güncellenemedi:", err)
                        alert("Modül ayarı güncellenirken bir yetki/veritabanı hatası oluştu.")
                      }
                    }}
                    style={{ marginTop: '3px', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.8rem', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {modul.etiket}
                      {isLocked && (
                        <span style={{ fontSize: '0.65rem', background: '#FEF3C7', color: '#D97706', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>
                          🔒 KİLİTLİ (GOLD)
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748B', lineHeight: '1.3' }}>{modul.aciklama}</span>
                    {isLocked && (
                      <span 
                        onClick={() => alert("Ar-Ge ve TÜBİTAK 2204-B Proje modülünü aktif hale getirmek için lütfen Okulmatik müşteri hizmetleri ile (destek@okulmatik.com.tr) iletişime geçiniz.")}
                        style={{ fontSize: '0.68rem', color: '#4F46E5', fontWeight: '800', marginTop: '4px', cursor: 'pointer', textDecoration: 'underline' }}>
                        Bilgi Al / Satın Al
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
