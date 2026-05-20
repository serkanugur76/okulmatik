import { useEffect, useState } from 'react'
import { collection, getCountFromServer } from 'firebase/firestore'
import { db } from '../../services/firebase'

function IstatKart({ baslik, deger, ikon, renk }) {
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
        <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1E293B' }}>{deger ?? '—'}</div>
        <div style={{ fontSize: '0.875rem', color: '#64748B' }}>{baslik}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [sayilar, setSayilar] = useState({ kurumlar: null, kullanicilar: null })

  useEffect(() => {
    async function yukle() {
      try {
        const [k, u] = await Promise.all([
          getCountFromServer(collection(db, 'kurumlar')),
          getCountFromServer(collection(db, 'kullanicilar')),
        ])
        setSayilar({ kurumlar: k.data().count, kullanicilar: u.data().count })
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
        <IstatKart baslik="Toplam Kurum"     deger={sayilar.kurumlar}     ikon="🏫" renk="#1B3A6B" />
        <IstatKart baslik="Toplam Kullanıcı" deger={sayilar.kullanicilar} ikon="👥" renk="#0369A1" />
      </div>
    </div>
  )
}
