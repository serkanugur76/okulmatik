import { useEffect, useState } from 'react'
import { collection, getCountFromServer, query, where } from 'firebase/firestore'
import { db } from '../../services/firebase'

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
        {altyazi && (
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>{altyazi}</div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [sayilar, setSayilar] = useState({
    anaKurum: null, kampus: null, altKurum: null, kullanicilar: null,
  })

  useEffect(() => {
    async function yukle() {
      try {
        const [ana, kamp, alt, kul] = await Promise.all([
          getCountFromServer(query(collection(db, 'kurumlar'), where('tip', '==', 'kurum'))),
          getCountFromServer(query(collection(db, 'kurumlar'), where('tip', '==', 'kampus'))),
          getCountFromServer(query(collection(db, 'kurumlar'), where('tip', '==', 'altKurum'))),
          getCountFromServer(collection(db, 'kullanicilar')),
        ])
        setSayilar({
          anaKurum:    ana.data().count,
          kampus:      kamp.data().count,
          altKurum:    alt.data().count,
          kullanicilar: kul.data().count,
        })
      } catch (err) {
        console.error('Dashboard sayım hatası:', err)
      }
    }
    yukle()
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>
        Dashboard
      </h1>
      <p style={{ color: '#64748B', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Platform geneli özet
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        <IstatKart
          baslik="Ana Kurum"
          deger={sayilar.anaKurum}
          ikon="🏢"
          renk="#7C3AED"
          altyazi="Anlaşma yapılan kurum"
        />
        <IstatKart
          baslik="Kampüs"
          deger={sayilar.kampus}
          ikon="🏛️"
          renk="#1B3A6B"
          altyazi="Kurumlara bağlı kampüs"
        />
        <IstatKart
          baslik="Alt Kurum"
          deger={sayilar.altKurum}
          ikon="🏫"
          renk="#0369A1"
          altyazi="İlkokul / Ortaokul / Lise"
        />
        <IstatKart
          baslik="Kullanıcı"
          deger={sayilar.kullanicilar}
          ikon="👥"
          renk="#065F46"
          altyazi="Platform kullanıcıları"
        />
      </div>
    </div>
  )
}
