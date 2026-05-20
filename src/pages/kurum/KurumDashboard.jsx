import { useEffect, useState } from 'react'
import { collection, getCountFromServer } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

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
  const { erisimKurumlar, yukleniyor } = useKurumYonetim()
  const [sayilar, setSayilar] = useState({ siniflar: null, ogrenciler: null, kullanicilar: null })

  // Root kurum (parentId yok)
  const rootKurum = erisimKurumlar.find(k => !k.parentId)

  // Alt kurumlar (2. seviye: kampüs değil, ilkokul/ortaokul/lise gibi)
  const altKurumlar = erisimKurumlar.filter(k => {
    if (!k.parentId) return false
    const ust = erisimKurumlar.find(x => x.id === k.parentId)
    return !!ust?.parentId // üstünün de üstü varsa altKurum
  })

  // Kampüs sayısı
  const kampusSayisi = erisimKurumlar.filter(k => {
    if (!k.parentId) return false
    const ust = erisimKurumlar.find(x => x.id === k.parentId)
    return !ust?.parentId // üstü root ise kampüs
  }).length

  useEffect(() => {
    if (yukleniyor || altKurumlar.length === 0) return

    async function yukle() {
      try {
        // Tüm alt kurumların sınıf + öğrenci sayılarını paralel çek
        const sonuclar = await Promise.all(
          altKurumlar.map(k => Promise.all([
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

        setSayilar({ siniflar: toplamSinif, ogrenciler: toplamOgrenci, kullanicilar: toplamKullanici })
      } catch (err) {
        console.error('Dashboard yükleme hatası:', err)
      }
    }

    yukle()
  }, [erisimKurumlar, yukleniyor]) // eslint-disable-line

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>
        {rootKurum?.ad || 'Dashboard'}
      </h1>
      <p style={{ color: '#64748B', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Tüm kampüs ve alt kurumlara ait özet bilgiler
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        <IstatKart
          baslik="Kampüs"
          deger={kampusSayisi}
          ikon="🏛️"
          renk="#7C3AED"
          altyazi={`${altKurumlar.length} alt kurum`}
        />
        <IstatKart
          baslik="Sınıf"
          deger={sayilar.siniflar}
          ikon="🏫"
          renk="#1B3A6B"
          altyazi="tüm alt kurumlar"
        />
        <IstatKart
          baslik="Öğrenci"
          deger={sayilar.ogrenciler}
          ikon="🎒"
          renk="#0369A1"
          altyazi="tüm alt kurumlar"
        />
        <IstatKart
          baslik="Kullanıcı"
          deger={sayilar.kullanicilar}
          ikon="👥"
          renk="#065F46"
          altyazi="tüm alt kurumlar"
        />
      </div>
    </div>
  )
}
