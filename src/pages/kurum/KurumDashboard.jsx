import { useEffect, useState } from 'react'
import { collection, getCountFromServer, doc, getDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'

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

export default function KurumDashboard() {
  const { kurumId } = useAuth()
  const [kurum, setKurum]     = useState(null)
  const [sayilar, setSayilar] = useState({ siniflar: null, ogrenciler: null, kullanicilar: null })

  useEffect(() => {
    if (!kurumId) return
    async function yukle() {
      try {
        const [kurumSnap, s, o, k] = await Promise.all([
          getDoc(doc(db, 'kurumlar', kurumId)),
          getCountFromServer(collection(db, 'kurumlar', kurumId, 'siniflar')),
          getCountFromServer(collection(db, 'kurumlar', kurumId, 'ogrenciler')),
          getCountFromServer(collection(db, 'kurumlar', kurumId, 'kullanicilar')),
        ])
        setKurum(kurumSnap.exists() ? kurumSnap.data() : null)
        setSayilar({ siniflar: s.data().count, ogrenciler: o.data().count, kullanicilar: k.data().count })
      } catch (err) {
        console.error('Dashboard yükleme hatası:', err)
      }
    }
    yukle()
  }, [kurumId])

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>
        {kurum?.ad || 'Dashboard'}
      </h1>
      <p style={{ color: '#64748B', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Kurumunuza ait özet bilgiler
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        <IstatKart baslik="Sınıf"       deger={sayilar.siniflar}     ikon="🏫" renk="#1B3A6B" />
        <IstatKart baslik="Öğrenci"     deger={sayilar.ogrenciler}   ikon="🎒" renk="#0369A1" />
        <IstatKart baslik="Kullanıcı"   deger={sayilar.kullanicilar} ikon="👥" renk="#065F46" />
      </div>
    </div>
  )
}
