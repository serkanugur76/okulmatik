import React, { useState, useEffect } from 'react'
import { db } from '../../../services/firebase'
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore'
import { BRANSLAR } from './DersTanimlari'
import { useKurumYonetim } from '../../../contexts/KurumYonetimContext'

export default function OgretmenSartlari() {
  const { erisimKurumlar } = useKurumYonetim()
  const [ogretmenler, setOgretmenler] = useState([])
  const [sartlar, setSartlar] = useState({}) // { ogretmenId: { brans, toplamSaat, kurumKisitlari, kademeKisitlari } }
  
  const defaultUygunluk = {
    'Pazartesi': [1,2,3,4,5,6,7,8], 'Salı': [1,2,3,4,5,6,7,8], 'Çarşamba': [1,2,3,4,5,6,7,8], 'Perşembe': [1,2,3,4,5,6,7,8], 'Cuma': [1,2,3,4,5,6,7,8]
  }

  // Panel States
  const [duzenlenenOgrId, setDuzenlenenOgrId] = useState(null)
  const [formSartlar, setFormSartlar] = useState({ brans: 'Sınıf Öğretmenliği', toplamSaat: 20, kurumKisitlari: [], kademeKisitlari: [], uygunluk: defaultUygunluk })
  const [islemYapiliyor, setIslemYapiliyor] = useState(false)
  const [aramaMetni, setAramaMetni] = useState('')

  useEffect(() => {
    // Öğretmenleri çek
    const qOgr = query(collection(db, 'kullanicilar'), where('rol', '==', 'ogretmen'))
    const unsubOgr = onSnapshot(qOgr, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // İsme göre sırala
      list.sort((a,b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
      setOgretmenler(list)
    })

    // Mevcut şartları çek
    const unsubSart = onSnapshot(collection(db, 'ogretmenSartlari'), snap => {
      const data = {}
      snap.docs.forEach(d => { data[d.id] = d.data() })
      setSartlar(data)
    })

    return () => { unsubOgr(); unsubSart() }
  }, [])

  const handleEdit = (ogr) => {
    setDuzenlenenOgrId(ogr.id)
    const mevcutSart = sartlar[ogr.id] || { brans: 'Sınıf Öğretmenliği', toplamSaat: 20, kurumKisitlari: [], kademeKisitlari: [] }
    setFormSartlar({
      brans: mevcutSart.brans || 'Sınıf Öğretmenliği',
      toplamSaat: mevcutSart.toplamSaat || 20,
      kurumKisitlari: mevcutSart.kurumKisitlari || [],
      kademeKisitlari: mevcutSart.kademeKisitlari || [],
      uygunluk: mevcutSart.uygunluk || defaultUygunluk
    })
  }

  const handleCancel = () => {
    setDuzenlenenOgrId(null)
  }

  const handleSave = async (e, ogretmenId) => {
    e.preventDefault()
    if (!ogretmenId) return
    setIslemYapiliyor(true)
    try {
      await setDoc(doc(db, 'ogretmenSartlari', ogretmenId), {
        ogretmenId: ogretmenId,
        ...formSartlar
      }, { merge: true })
      setDuzenlenenOgrId(null)
    } catch (err) {
      console.error(err)
      alert("Kaydedilirken bir hata oluştu.")
    } finally {
      setIslemYapiliyor(false)
    }
  }

  const toggleKurumKisit = (kurumId) => {
    setFormSartlar(prev => {
      const k = prev.kurumKisitlari || []
      if (k.includes(kurumId)) {
        return { ...prev, kurumKisitlari: k.filter(id => id !== kurumId) }
      } else {
        return { ...prev, kurumKisitlari: [...k, kurumId] }
      }
    })
  }

  const toggleKademeKisit = (kademe) => {
    setFormSartlar(prev => {
      const k = prev.kademeKisitlari || []
      if (k.includes(kademe)) {
        return { ...prev, kademeKisitlari: k.filter(s => s !== kademe) }
      } else {
        return { ...prev, kademeKisitlari: [...k, kademe].sort((a,b) => a-b) }
      }
    })
  }

  const toggleUygunlukSaat = (gun, saat) => {
    setFormSartlar(prev => {
      const g = prev.uygunluk?.[gun] || []
      const newG = g.includes(saat) ? g.filter(s => s !== saat) : [...g, saat].sort((a,b)=>a-b)
      return { ...prev, uygunluk: { ...prev.uygunluk, [gun]: newG } }
    })
  }

  const setUygunlukSablon = (gun, sablon) => {
    setFormSartlar(prev => {
      let arr = []
      if (sablon === 'tum') arr = [1,2,3,4,5,6,7,8]
      else if (sablon === 'ogleden_once') arr = [1,2,3,4]
      else if (sablon === 'ogleden_sonra') arr = [5,6,7,8]
      else if (sablon === 'hic') arr = []
      return { ...prev, uygunluk: { ...prev.uygunluk, [gun]: arr } }
    })
  }

  const filteredOgretmenler = ogretmenler.filter(o => 
    (o.ad || '').toLowerCase().includes(aramaMetni.toLowerCase()) ||
    (o.email || '').toLowerCase().includes(aramaMetni.toLowerCase())
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', alignItems: 'start', transition: 'all 0.3s' }}>
      
      {/* Öğretmen Listesi */}
      <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1E293B' }}>Öğretmen Listesi</h3>
          <input 
            type="text" placeholder="İsim veya E-posta ara..." 
            value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', width: '250px' }}
          />
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>Ad Soyad</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>Branş</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', borderBottom: '1px solid #E2E8F0', textAlign: 'center' }}>Maks. Saat</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', borderBottom: '1px solid #E2E8F0', textAlign: 'center' }}>İzinli Kademeler</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', borderBottom: '1px solid #E2E8F0', textAlign: 'center' }}>İzinli Kurumlar</th>
              <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', width: '100px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredOgretmenler.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Kayıtlı öğretmen bulunamadı.</td>
              </tr>
            ) : (
              filteredOgretmenler.map(ogr => {
                const srt = sartlar[ogr.id]
                const isEditing = duzenlenenOgrId === ogr.id
                
                return (
                  <React.Fragment key={ogr.id}>
                    {/* Normal Görünüm Satırı */}
                    <tr style={{ borderBottom: isEditing ? 'none' : '1px solid #F1F5F9', background: isEditing ? '#EFF6FF' : 'transparent', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ fontWeight: '600', color: '#0F172A', fontSize: '0.95rem' }}>{ogr.ad || 'İsimsiz'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{ogr.email}</div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: '#334155' }}>
                        {srt ? srt.brans : <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Tanımsız</span>}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: '#334155', textAlign: 'center' }}>
                        {srt ? <span style={{ fontWeight: '600' }}>{srt.toplamSaat}</span> : '-'}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748B', textAlign: 'center' }}>
                        {srt?.kademeKisitlari?.length > 0 
                          ? <span style={{ background: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>{srt.kademeKisitlari.length} Sınıf</span>
                          : <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>Tümü (Sınırsız)</span>
                        }
                      </td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748B', textAlign: 'center' }}>
                        {srt?.kurumKisitlari?.length > 0 
                          ? <span style={{ background: '#E0E7FF', color: '#4338CA', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>{srt.kurumKisitlari.length} Okul</span>
                          : <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>Tümü (Sınırsız)</span>
                        }
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                        {!isEditing && (
                          <button 
                            onClick={() => handleEdit(ogr)}
                            style={{ padding: '6px 12px', background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                          >
                            Düzenle
                          </button>
                        )}
                      </td>
                    </tr>
                    
                    {/* Genişleyen Düzenleme Paneli Satırı */}
                    {isEditing && (
                      <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#EFF6FF' }}>
                        <td colSpan="6" style={{ padding: '0' }}>
                          <div style={{ padding: '1.5rem', borderTop: '1px dashed #BFDBFE' }}>
                            <form onSubmit={(e) => handleSave(e, ogr.id)} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                              
                              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 300px' }}>
                                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Öğretmen Branşı</label>
                                  <select 
                                    value={formSartlar.brans} onChange={e => setFormSartlar({...formSartlar, brans: e.target.value})} required
                                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
                                  >
                                    {BRANSLAR.map(b => <option key={b} value={b}>{b}</option>)}
                                  </select>
                                </div>
                                <div style={{ flex: '1 1 200px' }}>
                                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Maksimum Haftalık Ders Saati</label>
                                  <input 
                                    type="number" value={formSartlar.toplamSaat} onChange={e => setFormSartlar({...formSartlar, toplamSaat: Number(e.target.value)})} required min="1" max="60"
                                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                {/* Kademeler */}
                                <div style={{ flex: '1 1 300px' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>
                                    Derse Girebileceği Kademeler
                                    <span title="Öğretmenin hangi sınıf seviyelerine derse girebileceğini belirler. Seçilmezse tüm seviyelere girebilir." style={{ cursor: 'help', background: '#E2E8F0', padding: '2px 6px', borderRadius: '50%', fontSize: '0.75rem' }}>?</span>
                                  </label>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.5rem' }}>
                                    {[1,2,3,4,5,6,7,8].map(k => (
                                      <label key={k} style={{ 
                                        display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem', 
                                        background: (formSartlar.kademeKisitlari || []).includes(k) ? '#FEF3C7' : '#fff', 
                                        border: (formSartlar.kademeKisitlari || []).includes(k) ? '1px solid #F59E0B' : '1px solid #CBD5E1', 
                                        borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', color: '#334155'
                                      }}>
                                        <input 
                                          type="checkbox" 
                                          checked={(formSartlar.kademeKisitlari || []).includes(k)}
                                          onChange={() => toggleKademeKisit(k)}
                                          style={{ width: '14px', height: '14px', accentColor: '#D97706' }}
                                        />
                                        {k}. Sınıf
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                {/* Kurumlar */}
                                <div style={{ flex: '2 1 400px' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>
                                    Derse Girebileceği Kurumlar
                                    <span title="Öğretmenin görevlendirileceği şube veya okulları seçin. Boş bırakılırsa tüm kurumlarda görev alabilir." style={{ cursor: 'help', background: '#E2E8F0', padding: '2px 6px', borderRadius: '50%', fontSize: '0.75rem' }}>?</span>
                                  </label>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '5px' }}>
                                    {erisimKurumlar.filter(k => k.tip !== 'root').map(kurum => (
                                      <label key={kurum.id} style={{ 
                                        display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem',
                                        background: (formSartlar.kurumKisitlari || []).includes(kurum.id) ? '#E0E7FF' : '#fff', 
                                        border: (formSartlar.kurumKisitlari || []).includes(kurum.id) ? '1px solid #4F46E5' : '1px solid #CBD5E1', 
                                        borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', color: '#334155', fontWeight: '500',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                      }}>
                                        <input 
                                          type="checkbox" 
                                          checked={(formSartlar.kurumKisitlari || []).includes(kurum.id)}
                                          onChange={() => toggleKurumKisit(kurum.id)}
                                          style={{ width: '14px', height: '14px', accentColor: '#4338CA' }}
                                        />
                                        {kurum.tip === 'kampus' ? '🏫' : '🎒'} {kurum.ad}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>
                                  Çalışma Günleri ve Saatleri (40 Saatlik Çizelge)
                                  <span title="Öğretmenin okulda bulunabileceği saatleri işaretleyin. Otomatik ders programı oluşturulurken yeşil olan (müsait) saatler dikkate alınır." style={{ cursor: 'help', background: '#E2E8F0', padding: '2px 6px', borderRadius: '50%', fontSize: '0.75rem' }}>?</span>
                                </label>
                                <div style={{ overflowX: 'auto', border: '1px solid #CBD5E1', borderRadius: '8px' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.85rem' }}>
                                    <thead>
                                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #CBD5E1' }}>
                                        <th style={{ padding: '0.5rem', borderRight: '1px solid #CBD5E1', textAlign: 'left' }}>Gün / Hızlı Seçim</th>
                                        {[1,2,3,4,5,6,7,8].map(s => <th key={s} style={{ padding: '0.5rem', width: '40px', color: '#475569' }}>{s}.S</th>)}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'].map(gun => (
                                        <tr key={gun} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                          <td style={{ padding: '0.5rem', borderRight: '1px solid #CBD5E1', textAlign: 'left' }}>
                                            <div style={{ fontWeight: '600', color: '#334155', marginBottom: '4px' }}>{gun}</div>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                              <button type="button" onClick={() => setUygunlukSablon(gun, 'tum')} style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#E0E7FF', color: '#4338CA', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Tüm Gün</button>
                                              <button type="button" onClick={() => setUygunlukSablon(gun, 'ogleden_once')} style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#FEF3C7', color: '#D97706', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>ÖÖ</button>
                                              <button type="button" onClick={() => setUygunlukSablon(gun, 'ogleden_sonra')} style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#FCE7F3', color: '#BE185D', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>ÖS</button>
                                              <button type="button" onClick={() => setUygunlukSablon(gun, 'hic')} style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Boşalt</button>
                                            </div>
                                          </td>
                                          {[1,2,3,4,5,6,7,8].map(saat => {
                                            const isActive = (formSartlar.uygunluk?.[gun] || []).includes(saat);
                                            return (
                                              <td key={saat} style={{ padding: '2px' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => toggleUygunlukSaat(gun, saat)}
                                                  style={{ 
                                                    width: '100%', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s',
                                                    background: isActive ? '#10B981' : '#F1F5F9',
                                                    color: isActive ? '#fff' : '#CBD5E1',
                                                    fontWeight: 'bold', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                  }}
                                                >
                                                  {isActive ? '✓' : '×'}
                                                </button>
                                              </td>
                                            )
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button 
                                  type="button" 
                                  onClick={handleCancel}
                                  style={{ padding: '0.75rem 1.5rem', background: '#fff', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                                >
                                  İptal
                                </button>
                                <button 
                                  type="submit" disabled={islemYapiliyor}
                                  style={{ padding: '0.75rem 2rem', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: islemYapiliyor ? 'not-allowed' : 'pointer' }}
                                >
                                  {islemYapiliyor ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                                </button>
                              </div>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
