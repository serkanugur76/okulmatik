import React, { useState, useEffect } from 'react'
import { db } from '../../../services/firebase'
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore'
import { BRANSLAR } from './DersTanimlari'
import { useKurumYonetim } from '../../../contexts/KurumYonetimContext'

export default function OgretmenSartlari() {
  const { erisimKurumlar } = useKurumYonetim()
  const [ogretmenler, setOgretmenler] = useState([])
  const [sartlar, setSartlar] = useState({}) // { ogretmenId: { brans, toplamSaat, kurumKisitlari } }
  
  // Panel States
  const [seciliOgretmen, setSeciliOgretmen] = useState(null)
  const [formSartlar, setFormSartlar] = useState({ brans: 'Sınıf Öğretmenliği', toplamSaat: 20, kurumKisitlari: [] })
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
    setSeciliOgretmen(ogr)
    const mevcutSart = sartlar[ogr.id] || { brans: 'Sınıf Öğretmenliği', toplamSaat: 20, kurumKisitlari: [] }
    setFormSartlar({
      brans: mevcutSart.brans || 'Sınıf Öğretmenliği',
      toplamSaat: mevcutSart.toplamSaat || 20,
      kurumKisitlari: mevcutSart.kurumKisitlari || []
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!seciliOgretmen) return
    setIslemYapiliyor(true)
    try {
      await setDoc(doc(db, 'ogretmenSartlari', seciliOgretmen.id), {
        ogretmenId: seciliOgretmen.id,
        ...formSartlar
      }, { merge: true })
      setSeciliOgretmen(null)
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

  const filteredOgretmenler = ogretmenler.filter(o => 
    (o.ad || '').toLowerCase().includes(aramaMetni.toLowerCase()) ||
    (o.email || '').toLowerCase().includes(aramaMetni.toLowerCase())
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: seciliOgretmen ? '1fr 400px' : '1fr', gap: '2rem', alignItems: 'start', transition: 'all 0.3s' }}>
      
      {/* Sol: Öğretmen Listesi */}
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
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', borderBottom: '1px solid #E2E8F0', textAlign: 'center' }}>İzinli Kurumlar</th>
              <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredOgretmenler.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Kayıtlı öğretmen bulunamadı.</td>
              </tr>
            ) : (
              filteredOgretmenler.map(ogr => {
                const srt = sartlar[ogr.id]
                return (
                  <tr key={ogr.id} style={{ borderBottom: '1px solid #F1F5F9', background: seciliOgretmen?.id === ogr.id ? '#EFF6FF' : 'transparent' }}>
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
                      {srt?.kurumKisitlari?.length > 0 
                        ? <span style={{ background: '#E0E7FF', color: '#4338CA', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>{srt.kurumKisitlari.length} Okul</span>
                        : <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>Tümü (Sınırsız)</span>
                      }
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                      <button 
                        onClick={() => handleEdit(ogr)}
                        style={{ padding: '6px 12px', background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Düzenle
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Sağ: Düzenleme Paneli */}
      {seciliOgretmen && (
        <div style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)', border: '1px solid #E2E8F0', position: 'sticky', top: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1E293B' }}>Çalışma Şartları</h3>
            <button onClick={() => setSeciliOgretmen(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94A3B8' }}>✖</button>
          </div>
          
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontWeight: '700', color: '#0F172A' }}>{seciliOgretmen.ad}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748B' }}>{seciliOgretmen.email}</div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Öğretmen Branşı</label>
              <select 
                value={formSartlar.brans} onChange={e => setFormSartlar({...formSartlar, brans: e.target.value})} required
                style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
              >
                {BRANSLAR.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Maksimum Haftalık Ders Saati</label>
              <input 
                type="number" value={formSartlar.toplamSaat} onChange={e => setFormSartlar({...formSartlar, toplamSaat: Number(e.target.value)})} required min="1" max="60"
                style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
              />
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.4rem' }}>
                Öğretmenin anlaşması gereği haftada girebileceği toplam maksimum saat sınırıdır.
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>
                Derse Girebileceği Kurumlar
              </label>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.75rem' }}>
                Hiçbiri seçilmezse tüm kurumlara (şubelere) atanabilir sayılır. Sadece belirli şubelere atanacaksa aşağıdan işaretleyin.
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', padding: '0.5rem', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#F8FAFC' }}>
                {erisimKurumlar.filter(k => k.tip !== 'root').map(kurum => (
                  <label key={kurum.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', padding: '0.25rem' }}>
                    <input 
                      type="checkbox" 
                      checked={(formSartlar.kurumKisitlari || []).includes(kurum.id)}
                      onChange={() => toggleKurumKisit(kurum.id)}
                      style={{ width: '16px', height: '16px', accentColor: '#4338CA' }}
                    />
                    <span style={{ color: '#334155', fontWeight: '500' }}>
                      {kurum.tip === 'kampus' ? '🏫' : '🎒'} {kurum.ad}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button 
              type="submit" disabled={islemYapiliyor}
              style={{ marginTop: '0.5rem', padding: '0.85rem', background: '#4338CA', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: islemYapiliyor ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}
            >
              {islemYapiliyor ? 'Kaydediliyor...' : 'Şartları Kaydet'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
