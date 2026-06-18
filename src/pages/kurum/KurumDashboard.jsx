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
  const { erisimKurumlar, secilenKurumId, secilenKurum, yukleniyor } = useKurumYonetim()
  const [sayilar, setSayilar] = useState({ siniflar: null, ogrenciler: null, kullanicilar: null })

  // Seçili kurumun seviyesi
  const ust = erisimKurumlar.find(k => k.id === secilenKurum?.parentId)
  const seviye = !secilenKurum?.parentId ? 'root'
    : !ust?.parentId ? 'kampus'
    : 'altKurum'

  // Sayım yapılacak kurum listesi
  const sayimKurumlar = (() => {
    if (seviye === 'root') {
      return erisimKurumlar.filter(k => k.rootKurumId === secilenKurumId && k.tip === 'altKurum')
    }
    if (seviye === 'kampus') {
      return erisimKurumlar.filter(k => k.parentId === secilenKurumId && k.tip === 'altKurum')
    }
    // Alt kurum: sadece kendisi
    return secilenKurum ? [secilenKurum] : []
  })()

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
      setSayilar({ siniflar: null, ogrenciler: null, kullanicilar: null })
      return
    }

    async function yukle() {
      try {
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
        setSayilar({ siniflar: toplamSinif, ogrenciler: toplamOgrenci, kullanicilar: toplamKullanici })
      } catch (err) {
        console.error('Dashboard yükleme hatası:', err)
        setSayilar({ siniflar: 0, ogrenciler: 0, kullanicilar: 0 })
      }
    }
    yukle()
  }, [secilenKurumId, erisimKurumlar, yukleniyor]) // eslint-disable-line

  return (
    <div>
      <div style={{ marginBottom: '2rem' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {seviye === 'root' && (
          <IstatKart
            baslik="Kampüs"
            deger={kampusSayisi}
            ikon="🏛️"
            renk="#7C3AED"
            altyazi={`${sayimKurumlar.length} alt kurum`}
          />
        )}
        {seviye === 'kampus' && (
          <IstatKart
            baslik="Alt Kurum"
            deger={sayimKurumlar.length}
            ikon="🏛️"
            renk="#7C3AED"
          />
        )}
        <IstatKart baslik="Sınıf"     deger={sayilar.siniflar}     ikon="🏫" renk="#1B3A6B" />
        <IstatKart baslik="Öğrenci"   deger={sayilar.ogrenciler}   ikon="🎒" renk="#0369A1" />
        <IstatKart baslik="Kullanıcı" deger={sayilar.kullanicilar} ikon="👥" renk="#065F46" />
      </div>
    </div>
  )
}
