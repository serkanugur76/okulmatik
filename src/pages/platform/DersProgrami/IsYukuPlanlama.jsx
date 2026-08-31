import React, { useState, useEffect } from 'react'
import { db } from '../../../services/firebase'
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { useKurumYonetim } from '../../../contexts/KurumYonetimContext'

export default function IsYukuPlanlama() {
  const { erisimKurumlar } = useKurumYonetim()
  
  const [seciliKurumId, setSeciliKurumId] = useState('')
  const [seciliSinifId, setSeciliSinifId] = useState('')
  
  // Data States
  const [ogretmenler, setOgretmenler] = useState([])
  const [sartlar, setSartlar] = useState({})
  const [dersler, setDersler] = useState([])
  const [siniflar, setSiniflar] = useState([])
  const [atamalar, setAtamalar] = useState([])

  // Form State
  const [seciliDersId, setSeciliDersId] = useState('')
  const [seciliOgretmenId, setSeciliOgretmenId] = useState('')
  const [planlananSaat, setPlanlananSaat] = useState(0)
  const [islemYapiliyor, setIslemYapiliyor] = useState(false)

  const okullar = erisimKurumlar.filter(k => k.tip === 'altKurum')

  useEffect(() => {
    const unsubOgr = onSnapshot(query(collection(db, 'kullanicilar'), where('rol', '==', 'ogretmen')), snap => {
      setOgretmenler(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    
    const unsubSart = onSnapshot(collection(db, 'ogretmenSartlari'), snap => {
      const data = {}
      snap.docs.forEach(d => { data[d.id] = d.data() })
      setSartlar(data)
    })
    
    const unsubDers = onSnapshot(collection(db, 'sistemDersleri'), snap => {
      setDersler(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    const unsubAtama = onSnapshot(collection(db, 'dersAtamalari'), snap => {
      setAtamalar(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    return () => { unsubOgr(); unsubSart(); unsubDers(); unsubAtama() }
  }, [])

  useEffect(() => {
    if (!seciliKurumId) {
      setSiniflar([])
      setSeciliSinifId('')
      return
    }
    const qSinif = query(collection(db, 'siniflar'), where('kurumId', '==', seciliKurumId))
    const unsubSinif = onSnapshot(qSinif, snap => {
      setSiniflar(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => Number(a.seviye || 0) - Number(b.seviye || 0) || (a.sube || '').localeCompare(b.sube || '')))
      setSeciliSinifId('')
    })
    return () => unsubSinif()
  }, [seciliKurumId])

  useEffect(() => {
    if (seciliDersId) {
      const ders = dersler.find(d => d.id === seciliDersId)
      if (ders) setPlanlananSaat(ders.haftalikSaat)
    }
  }, [seciliDersId, dersler])

  const handleAtamaEkle = async (e) => {
    e.preventDefault()
    if (!seciliKurumId || !seciliSinifId || !seciliDersId || !seciliOgretmenId || planlananSaat <= 0) return
    setIslemYapiliyor(true)
    try {
      await addDoc(collection(db, 'dersAtamalari'), {
        kurumId: seciliKurumId,
        sinifId: seciliSinifId,
        dersId: seciliDersId,
        ogretmenId: seciliOgretmenId,
        planlananSaat: Number(planlananSaat),
        eklenmeTarihi: serverTimestamp()
      })
      setSeciliDersId('')
      setSeciliOgretmenId('')
      setPlanlananSaat(0)
    } catch (err) {
      console.error(err)
      alert('Atama eklenirken hata oluştu.')
    } finally {
      setIslemYapiliyor(false)
    }
  }

  const handleSil = async (id) => {
    if(!window.confirm('Bu atamayı silmek istediğinize emin misiniz?')) return
    await deleteDoc(doc(db, 'dersAtamalari', id))
  }

  const getOgretmenYuk = (ogrId) => {
    return atamalar.filter(a => a.ogretmenId === ogrId).reduce((sum, a) => sum + (a.planlananSaat || 0), 0)
  }

  const uygunOgretmenler = ogretmenler.filter(ogr => {
    const srt = sartlar[ogr.id]
    if (!srt) return true 
    if (srt.kurumKisitlari && srt.kurumKisitlari.length > 0) {
      return srt.kurumKisitlari.includes(seciliKurumId)
    }
    return true
  }).sort((a,b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))

  const sinifAtamalari = atamalar.filter(a => a.sinifId === seciliSinifId)
  
  const yukDurumlari = ogretmenler.map(ogr => {
    const srt = sartlar[ogr.id] || { toplamSaat: 0, brans: 'Tanımsız' }
    const yuk = getOgretmenYuk(ogr.id)
    return { ...ogr, maxSaat: srt.toplamSaat || 0, mevcutYuk: yuk, brans: srt.brans }
  }).filter(o => o.mevcutYuk > 0 || sartlar[o.id])

  yukDurumlari.sort((a,b) => b.mevcutYuk - a.mevcutYuk)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', alignItems: 'start' }}>
      
      {/* Sol Panel: Okul, Sınıf Seçimi ve Atama Formu */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Seçimler */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #E2E8F0' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#1E293B' }}>Kurum & Sınıf Seçimi</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Okul / Alt Kurum</label>
            <select 
              value={seciliKurumId} onChange={e => setSeciliKurumId(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
            >
              <option value="">— Okul Seçin —</option>
              {okullar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Sınıf</label>
            <select 
              value={seciliSinifId} onChange={e => setSeciliSinifId(e.target.value)} disabled={!seciliKurumId}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', opacity: !seciliKurumId ? 0.5 : 1 }}
            >
              <option value="">— Sınıf Seçin —</option>
              {siniflar.map(s => <option key={s.id} value={s.id}>{s.seviye}. Sınıf - {s.sube}</option>)}
            </select>
          </div>
        </div>

        {/* Yeni Atama Ekleme */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #E2E8F0', opacity: !seciliSinifId ? 0.5 : 1, pointerEvents: !seciliSinifId ? 'none' : 'auto' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#1E293B' }}>Sınıfa Ders Ata</h3>
          
          <form onSubmit={handleAtamaEkle} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Ders Seçin</label>
              <select 
                value={seciliDersId} onChange={e => setSeciliDersId(e.target.value)} required
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
              >
                <option value="">— Ders Seçin —</option>
                {dersler.map(d => <option key={d.id} value={d.id}>{d.ad} ({d.haftalikSaat} Saat)</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Planlanan Saat</label>
              <input 
                type="number" value={planlananSaat} onChange={e => setPlanlananSaat(e.target.value)} required min="1" max="40"
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Öğretmen (Kurum Yetkili)</label>
              <select 
                value={seciliOgretmenId} onChange={e => setSeciliOgretmenId(e.target.value)} required
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
              >
                <option value="">— Öğretmen Seçin —</option>
                {uygunOgretmenler.map(ogr => {
                  const s = sartlar[ogr.id]
                  const load = getOgretmenYuk(ogr.id)
                  const max = s?.toplamSaat || 0
                  return (
                    <option key={ogr.id} value={ogr.id}>
                      {ogr.ad} - {s?.brans || 'Tanımsız'} (Yük: {load}/{max})
                    </option>
                  )
                })}
              </select>
            </div>

            <button 
              type="submit" disabled={islemYapiliyor}
              style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#10B981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: islemYapiliyor ? 'not-allowed' : 'pointer' }}
            >
              {islemYapiliyor ? 'Ekleniyor...' : 'Atamayı Kaydet'}
            </button>
          </form>
        </div>

      </div>

      {/* Sağ Panel: Atamalar ve İş Yükü Özeti */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Seçili Sınıf Atamaları */}
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1E293B' }}>Sınıf Ders Programı (Taslak)</h3>
            <div style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '0.25rem' }}>
              {seciliSinifId ? `${siniflar.find(s => s.id === seciliSinifId)?.seviye}. Sınıf - ${siniflar.find(s => s.id === seciliSinifId)?.sube} atamaları` : 'Lütfen bir sınıf seçin.'}
            </div>
          </div>
          
          {seciliSinifId ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>Ders</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>Öğretmen</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', borderBottom: '1px solid #E2E8F0', textAlign: 'center' }}>Saat</th>
                  <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {sinifAtamalari.length === 0 ? (
                  <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Henüz ders ataması yapılmamış.</td></tr>
                ) : (
                  sinifAtamalari.map(a => {
                    const d = dersler.find(dx => dx.id === a.dersId)
                    const o = ogretmenler.find(ox => ox.id === a.ogretmenId)
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: '600', color: '#0F172A' }}>{d ? d.ad : 'Bilinmeyen Ders'}</td>
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: '#334155' }}>{o ? o.ad : 'Bilinmeyen Öğretmen'}</td>
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: '#1E293B', textAlign: 'center', fontWeight: '700' }}>{a.planlananSaat}</td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                          <button onClick={() => handleSil(a.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}>🗑️</button>
                        </td>
                      </tr>
                    )
                  })
                )}
                <tr style={{ background: '#F8FAFC' }}>
                  <td colSpan="2" style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: '700', color: '#1E293B', textAlign: 'right' }}>Toplam Ders Saati:</td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '1rem', fontWeight: '800', color: '#4338CA', textAlign: 'center' }}>
                    {sinifAtamalari.reduce((sum, a) => sum + (a.planlananSaat || 0), 0)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏫</div>
              Atamaları görmek için soldan okul ve sınıf seçimi yapın.
            </div>
          )}
        </div>

        {/* Öğretmen İş Yükü Özeti */}
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1E293B' }}>Tüm Kurumlar Öğretmen İş Yükü Özeti</h3>
          </div>
          <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {yukDurumlari.map(ogr => {
              const oran = ogr.maxSaat > 0 ? (ogr.mevcutYuk / ogr.maxSaat) * 100 : (ogr.mevcutYuk > 0 ? 100 : 0)
              const asim = ogr.mevcutYuk > ogr.maxSaat
              
              return (
                <div key={ogr.id} style={{ 
                  border: `1px solid ${asim ? '#FECACA' : '#E2E8F0'}`, 
                  borderRadius: '12px', padding: '1rem', 
                  background: asim ? '#FEF2F2' : '#fff' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ogr.ad}</div>
                    <div style={{ fontSize: '0.8rem', color: asim ? '#DC2626' : '#64748B', fontWeight: '600' }}>
                      {ogr.mevcutYuk} / {ogr.maxSaat}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '0.75rem' }}>{ogr.brans}</div>
                  
                  {/* Progress Bar */}
                  <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${Math.min(oran, 100)}%`, 
                      background: asim ? '#DC2626' : (oran > 80 ? '#F59E0B' : '#10B981'),
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  {asim && <div style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '0.5rem', fontWeight: '600' }}>⚠️ Limit Aşıldı!</div>}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
