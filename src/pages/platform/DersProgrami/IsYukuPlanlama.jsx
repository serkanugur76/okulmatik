import React, { useState, useEffect } from 'react'
import { db } from '../../../services/firebase'
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { useKurumYonetim } from '../../../contexts/KurumYonetimContext'

export default function IsYukuPlanlama() {
  const { erisimKurumlar } = useKurumYonetim()
  
  const [seciliKurumId, setSeciliKurumId] = useState('')
  
  // Data States
  const [ogretmenler, setOgretmenler] = useState([])
  const [sartlar, setSartlar] = useState({})
  const [dersler, setDersler] = useState([])
  const [siniflar, setSiniflar] = useState([])
  const [atamalar, setAtamalar] = useState([])

  // Modal State
  const [modalAcik, setModalAcik] = useState(false)
  const [aktifHucre, setAktifHucre] = useState({ sinif: null, ders: null, atama: null })
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
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Sıralama
      data.sort((a, b) => {
        const typeOrder = { 'Zorunlu': 1, 'Seçmeli': 2, 'Kurum Dersi': 3 }
        const aT = typeOrder[a.tip] || 99
        const bT = typeOrder[b.tip] || 99
        if (aT < bT) return -1;
        if (aT > bT) return 1;
        if (a.ad < b.ad) return -1;
        if (a.ad > b.ad) return 1;
        return 0;
      })
      setDersler(data)
    })

    const unsubAtama = onSnapshot(collection(db, 'dersAtamalari'), snap => {
      setAtamalar(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    return () => { unsubOgr(); unsubSart(); unsubDers(); unsubAtama() }
  }, [])

  useEffect(() => {
    if (!seciliKurumId) {
      setSiniflar([])
      return
    }
    const qSinif = query(collection(db, 'siniflar'), where('kurumId', '==', seciliKurumId))
    const unsubSinif = onSnapshot(qSinif, snap => {
      setSiniflar(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => Number(a.seviye || 0) - Number(b.seviye || 0) || (a.sube || '').localeCompare(b.sube || '')))
    })
    return () => unsubSinif()
  }, [seciliKurumId])

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

  const hucreTikla = (sinif, ders, atama, isActive) => {
    if (!isActive) return // Eğer ders o sınıf için tanımlı değilse tıklanamaz
    setAktifHucre({ sinif, ders, atama })
    if (atama) {
      setSeciliOgretmenId(atama.ogretmenId)
      setPlanlananSaat(atama.planlananSaat)
    } else {
      setSeciliOgretmenId('')
      setPlanlananSaat(ders.saatler?.[sinif.seviye] || 1)
    }
    setModalAcik(true)
  }

  const handleAtamaKaydet = async (e) => {
    e.preventDefault()
    if (!seciliOgretmenId || planlananSaat <= 0) return
    setIslemYapiliyor(true)
    
    try {
      if (aktifHucre.atama) {
        await deleteDoc(doc(db, 'dersAtamalari', aktifHucre.atama.id))
      }
      
      await addDoc(collection(db, 'dersAtamalari'), {
        kurumId: seciliKurumId,
        sinifId: aktifHucre.sinif.id,
        dersId: aktifHucre.ders.id,
        ogretmenId: seciliOgretmenId,
        planlananSaat: Number(planlananSaat),
        eklenmeTarihi: serverTimestamp()
      })
      
      setModalAcik(false)
    } catch (err) {
      console.error(err)
      alert('Atama kaydedilirken hata oluştu.')
    } finally {
      setIslemYapiliyor(false)
    }
  }

  const handleAtamaSil = async () => {
    if(!aktifHucre.atama) return
    if(!window.confirm('Bu atamayı silmek istediğinize emin misiniz?')) return
    setIslemYapiliyor(true)
    try {
      await deleteDoc(doc(db, 'dersAtamalari', aktifHucre.atama.id))
      setModalAcik(false)
    } catch(err) {
      console.error(err)
      alert('Atama silinirken hata oluştu.')
    } finally {
      setIslemYapiliyor(false)
    }
  }

  const grupluDersler = dersler.reduce((acc, ders) => {
    const tip = ders.tip || 'Zorunlu'
    if (!acc[tip]) acc[tip] = []
    acc[tip].push(ders)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'calc(100vh - 120px)' }}>
      
      <div style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1E293B', flexShrink: 0 }}>40 Saat Hedefli Okul Matrisi</h3>
        <select 
          value={seciliKurumId} onChange={e => setSeciliKurumId(e.target.value)}
          style={{ maxWidth: '400px', width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
        >
          <option value="">— Planlama Yapılacak Okulu Seçin —</option>
          {okullar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
        </select>
      </div>

      {seciliKurumId && siniflar.length > 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #E2E8F0', flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <tr>
                <th style={{ padding: '1rem', borderBottom: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', textAlign: 'left', minWidth: '250px', background: '#F1F5F9' }}>
                  Dersler / Sınıflar
                </th>
                {siniflar.map(sinif => {
                  const toplamSaat = atamalar.filter(a => a.sinifId === sinif.id).reduce((sum, a) => sum + (a.planlananSaat || 0), 0)
                  const eksik = 40 - toplamSaat
                  return (
                    <th key={sinif.id} style={{ padding: '1rem', borderBottom: '2px solid #CBD5E1', borderRight: '1px solid #E2E8F0', textAlign: 'center', minWidth: '160px' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1E293B' }}>{sinif.seviye}. Sınıf - {sinif.sube}</div>
                      <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: eksik === 0 ? '#10B981' : (eksik > 0 ? '#F59E0B' : '#EF4444'), fontWeight: '700' }}>
                        Toplam: {toplamSaat} / 40 Saat
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {['Zorunlu', 'Seçmeli', 'Kurum Dersi'].map(tipKategori => {
                const kategoriDersleri = grupluDersler[tipKategori]
                if (!kategoriDersleri || kategoriDersleri.length === 0) return null

                return (
                  <React.Fragment key={tipKategori}>
                    <tr>
                      <td colSpan={siniflar.length + 1} style={{ padding: '0.75rem 1rem', background: '#334155', color: '#fff', fontWeight: '700', fontSize: '1rem' }}>
                        {tipKategori.toUpperCase()} DERSLER
                      </td>
                    </tr>
                    
                    {kategoriDersleri.map(ders => (
                      <tr key={ders.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '1rem', borderRight: '2px solid #CBD5E1', background: '#F8FAFC', fontWeight: '600', color: '#334155' }}>
                          <div>{ders.ad}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.25rem' }}>{ders.brans}</div>
                        </td>
                        
                        {siniflar.map(sinif => {
                          const atama = atamalar.find(a => a.sinifId === sinif.id && a.dersId === ders.id)
                          const hedefSaat = ders.saatler?.[sinif.seviye]
                          const isApplicable = hedefSaat && hedefSaat > 0
                          
                          let hucreIcerik = null;
                          let bgRenk = 'transparent'
                          let borderRenk = '#E2E8F0'
                          let cursor = 'pointer'
                          
                          if (!isApplicable && !atama) {
                            // Bu seviye için ders tanımlı değil ve atanmamış
                            hucreIcerik = <div style={{ color: '#CBD5E1', fontSize: '1.2rem', textAlign: 'center' }}>-</div>
                            bgRenk = '#F8FAFC'
                            cursor = 'not-allowed'
                          } 
                          else if (atama) {
                            // Atama var
                            const ogr = ogretmenler.find(o => o.id === atama.ogretmenId)
                            const sart = sartlar[atama.ogretmenId]
                            const yuk = getOgretmenYuk(atama.ogretmenId)
                            const limit = sart?.toplamSaat || 0
                            const orantili = limit > 0 ? yuk / limit : 0
                            
                            if (yuk > limit && limit > 0) {
                              bgRenk = '#FEF2F2' 
                              borderRenk = '#F87171'
                            } else if (orantili > 0.8) {
                              bgRenk = '#FFFBEB' 
                              borderRenk = '#FBBF24'
                            } else {
                              bgRenk = '#F0FDF4' 
                              borderRenk = '#86EFAC'
                            }
                            
                            hucreIcerik = (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: '600', color: '#1E293B', fontSize: '0.85rem', marginBottom: '0.2rem' }}>{ogr?.ad || 'Bilinmiyor'}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                  <span style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px' }}>{atama.planlananSaat}s</span>
                                  {limit > 0 && <span style={{ color: yuk > limit ? '#DC2626' : 'inherit' }}>Yük: {yuk}/{limit}</span>}
                                </div>
                              </div>
                            )
                          } 
                          else {
                            // Atama yok ama uygulanabilir (isApplicable true)
                            if (ders.tip === 'Zorunlu') {
                              hucreIcerik = <div style={{ textAlign: 'center', color: '#EF4444', fontSize: '0.8rem', fontWeight: '600' }}>⚠️ Atanmadı<br/>({hedefSaat} Saat)</div>
                              bgRenk = '#FEF2F2'
                            } else {
                              hucreIcerik = <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '1.5rem', opacity: 0.5 }}>+</div>
                            }
                          }

                          return (
                            <td 
                              key={`${ders.id}-${sinif.id}`} 
                              onClick={() => hucreTikla(sinif, ders, atama, isApplicable || atama)}
                              style={{ 
                                padding: '0.5rem', 
                                borderRight: '1px solid #E2E8F0',
                                border: `2px solid ${borderRenk}`,
                                background: bgRenk,
                                cursor: cursor,
                                transition: 'all 0.2s',
                                verticalAlign: 'middle'
                              }}
                              onMouseEnter={e => { if(isApplicable || atama) e.currentTarget.style.filter = 'brightness(0.95)' }}
                              onMouseLeave={e => { if(isApplicable || atama) e.currentTarget.style.filter = 'brightness(1)' }}
                            >
                              {hucreIcerik}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
              
              {/* Toplam Satırı */}
              <tr style={{ position: 'sticky', bottom: 0, zIndex: 10, background: '#F1F5F9', boxShadow: '0 -1px 2px rgba(0,0,0,0.05)' }}>
                <td style={{ padding: '1rem', borderRight: '2px solid #CBD5E1', borderTop: '2px solid #CBD5E1', fontWeight: '800', color: '#0F172A', textAlign: 'right' }}>
                  HAFTALIK TOPLAM SAAT
                </td>
                {siniflar.map(sinif => {
                  const toplamSaat = atamalar.filter(a => a.sinifId === sinif.id).reduce((sum, a) => sum + (a.planlananSaat || 0), 0)
                  const eksik = 40 - toplamSaat
                  return (
                    <td key={`total-${sinif.id}`} style={{ padding: '1rem', borderRight: '1px solid #E2E8F0', borderTop: '2px solid #CBD5E1', textAlign: 'center', fontWeight: '800', fontSize: '1.2rem', color: eksik === 0 ? '#10B981' : (eksik > 0 ? '#F59E0B' : '#EF4444') }}>
                      {toplamSaat} / 40
                    </td>
                  )
                })}
              </tr>

            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '4rem', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏫</div>
          <h2 style={{ color: '#334155', margin: '0 0 0.5rem' }}>Matrisi Görüntülemek İçin Okul Seçin</h2>
        </div>
      )}

      {/* Modal */}
      {modalAcik && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', color: '#0F172A' }}>Öğretmen Ataması</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ color: '#64748B', fontWeight: '600', fontSize: '0.9rem' }}>Sınıf:</span>
                <span style={{ color: '#1E293B', fontWeight: '700' }}>{aktifHucre.sinif?.seviye}. Sınıf - {aktifHucre.sinif?.sube}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ color: '#64748B', fontWeight: '600', fontSize: '0.9rem' }}>Ders:</span>
                <span style={{ color: '#1E293B', fontWeight: '700' }}>{aktifHucre.ders?.ad} ({aktifHucre.ders?.tip})</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Planlanan Ders Saati</label>
                <input 
                  type="number" value={planlananSaat} onChange={e => setPlanlananSaat(e.target.value)} required min="1" max="40"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '1rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Öğretmen Seçimi</label>
                <select 
                  value={seciliOgretmenId} onChange={e => setSeciliOgretmenId(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '1rem' }}
                >
                  <option value="">— Öğretmen Seçin —</option>
                  {uygunOgretmenler.map(ogr => {
                    const s = sartlar[ogr.id]
                    const load = getOgretmenYuk(ogr.id)
                    const max = s?.toplamSaat || 0
                    const isOver = load >= max && max > 0
                    return (
                      <option key={ogr.id} value={ogr.id} disabled={isOver && ogr.id !== seciliOgretmenId}>
                        {ogr.ad} - {s?.brans || 'Tanımsız'} {max > 0 ? `(Yük: ${load}/${max})` : `(Yük: ${load})`} {isOver ? ' - LİMİT DOLU' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setModalAcik(false)} style={{ flex: 1, padding: '0.8rem', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>İptal</button>
              {aktifHucre.atama && (
                <button onClick={handleAtamaSil} disabled={islemYapiliyor} style={{ padding: '0.8rem', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', fontWeight: '600', cursor: islemYapiliyor ? 'not-allowed' : 'pointer' }}>Sil</button>
              )}
              <button onClick={handleAtamaKaydet} disabled={islemYapiliyor || !seciliOgretmenId} style={{ flex: 2, padding: '0.8rem', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: (islemYapiliyor || !seciliOgretmenId) ? 'not-allowed' : 'pointer' }}>
                {islemYapiliyor ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
