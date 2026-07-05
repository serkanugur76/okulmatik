import { useEffect, useState, useMemo } from 'react'
import { collection, getCountFromServer, query, where, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'
import { getDescendants } from '../../utils/hierarchy'

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

                // Rubrik sayısını çek
                let rubrikSayisi = 0
                if (teacherGradeLevels.length > 0) {
                  const rubrikSnap = await getDocs(collection(db, 'kurumlar', k.id, 'rubrikler'))
                  const tumRubrikler = rubrikSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                  const branslar = profil?.branslar || []
                  const eslesen = tumRubrikler.filter(r => {
                    const bransMatch = branslar.length === 0 || branslar.includes(r.ders)
                    const levelMatch = (r.hedefSeviyeler || []).some(lvl => teacherGradeLevels.includes(Number(lvl)))
                    return bransMatch && levelMatch
                  })
                  rubrikSayisi = eslesen.length
                }

                return {
                  siniflar: ogretmenOkulSinifIds.length,
                  ogrenciler: ogrenciSayisi,
                  rubrikler: rubrikSayisi
                }
              } catch (e) {
                console.warn(`Okul ${k.id} için sayılar alınamadı:`, e.message)
                return { siniflar: 0, ogrenciler: 0, rubrikler: 0 }
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
        setSayilar({ siniflar: 0, ogrenciler: 0, kullanicilar: 0, mentorOgrenciler: 0, rubrikler: 0 })
      }
    }
    yukle()
  }, [secilenKurumId, erisimKurumlar, yukleniyor, ogretmenModu, ogretmenSinifIdleri, kullanici?.uid, profil?.branslar, profil?.sinifAtamalari, profil?.erisimKurumIdler])

  return (
    <div>
      <div style={{ marginBottom: '2rem' }} />

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
    </div>
  )
}
