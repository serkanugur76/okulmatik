import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../../services/firebase'

const ROL_ETİKET = {
  platform_admin: { etiket: 'Platform Admin', renk: '#7C3AED', bg: '#EDE9FE' },
  kurum_admin:    { etiket: 'Kurum Admin',    renk: '#0369A1', bg: '#E0F2FE' },
  ogretmen:       { etiket: 'Öğretmen',       renk: '#065F46', bg: '#D1FAE5' },
}

export default function PlatformKullanicilar() {
  const [kullanicilar, setKullanicilar] = useState([])
  const [filtre, setFiltre]             = useState('')

  useEffect(() => {
    const q = query(collection(db, 'kullanicilar'), orderBy('email'))
    return onSnapshot(q, snap => {
      setKullanicilar(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  const liste = kullanicilar.filter(k =>
    k.email?.toLowerCase().includes(filtre.toLowerCase()) ||
    k.ad?.toLowerCase().includes(filtre.toLowerCase())
  )

  const s = {
    th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    td: { padding: '1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Kullanıcılar</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Platform genelindeki tüm kullanıcılar</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <input
          value={filtre}
          onChange={e => setFiltre(e.target.value)}
          placeholder="Ad veya e-posta ile ara..."
          style={{ padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', width: '280px', color: '#1E293B' }}
        />
        <span style={{ fontSize: '0.875rem', color: '#64748B' }}>{liste.length} kullanıcı</span>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Ad', 'E-posta', 'Rol', 'Kurum ID'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Kullanıcı bulunamadı</td></tr>
            ) : liste.map(k => {
              const rol = ROL_ETİKET[k.rol] || { etiket: k.rol || '—', renk: '#374151', bg: '#F1F5F9' }
              return (
                <tr key={k.id}>
                  <td style={s.td}>{k.ad || '—'}</td>
                  <td style={s.td}>{k.email}</td>
                  <td style={s.td}>
                    <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', background: rol.bg, color: rol.renk }}>
                      {rol.etiket}
                    </span>
                  </td>
                  <td style={s.td}>{k.kurumId || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
