import React, { useState, useEffect } from 'react'
import { db } from '../../../services/firebase'
import { collection, onSnapshot, setDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'

export const KADEMELER = ['Okul Öncesi', 'İlkokul', 'Ortaokul', 'Lise']
export const BRANSLAR = [
  'Sınıf Öğretmenliği', 'Matematik', 'Türkçe', 'Türk Dili ve Edebiyatı', 'Fen Bilimleri', 
  'Sosyal Bilgiler', 'Tarih', 'Coğrafya', 'Fizik', 'Kimya', 'Biyoloji', 
  'İngilizce', 'Almanca', 'Fransızca', 'Din Kültürü ve Ahlak Bilgisi', 
  'Görsel Sanatlar', 'Müzik', 'Beden Eğitimi', 'Bilişim Teknolojileri', 'Rehberlik', 'Okul Öncesi Öğretmenliği', 'Diğer'
]

export default function DersTanimlari() {
  const [dersler, setDersler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)

  // Form State
  const [kademe, setKademe] = useState('Ortaokul')
  const [ad, setAd] = useState('')
  const [brans, setBrans] = useState('Matematik')
  const [haftalikSaat, setHaftalikSaat] = useState(5)
  const [islemYapiliyor, setIslemYapiliyor] = useState(false)
  const [hata, setHata] = useState(null)

  useEffect(() => {
    const q = collection(db, 'sistemDersleri')
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      data.sort((a, b) => {
        if (a.kademe < b.kademe) return -1;
        if (a.kademe > b.kademe) return 1;
        if (a.ad < b.ad) return -1;
        if (a.ad > b.ad) return 1;
        return 0;
      })
      setDersler(data)
      setYukleniyor(false)
    }, (err) => {
      console.error(err)
      setHata('Hata (Yükleme): ' + err.message)
      setYukleniyor(false)
    })
    return () => unsub()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!ad.trim()) return

    setIslemYapiliyor(true)
    setHata(null)
    
    // TR karakterleri ingilizceye çevir, boşlukları alt çizgi yap
    const charMap = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u' };
    let slug = ad.trim().toLowerCase().replace(/[çğıöşü]/g, m => charMap[m]);
    slug = slug.replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '_');
    const docId = `${kademe.toLowerCase()}_${slug}`;

    try {
      await setDoc(doc(db, 'sistemDersleri', docId), {
        kademe,
        ad: ad.trim(),
        brans,
        haftalikSaat: Number(haftalikSaat),
        eklenmeTarihi: serverTimestamp()
      })
      setAd('')
      setHaftalikSaat(5)
    } catch (error) {
      console.error(error)
      setHata('Hata: ' + error.message)
    } finally {
      setIslemYapiliyor(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bu dersi silmek istediğinize emin misiniz?')) return
    try {
      await deleteDoc(doc(db, 'sistemDersleri', id))
    } catch (error) {
      console.error(error)
      alert('Silme işlemi başarısız oldu.')
    }
  }

  if (yukleniyor) return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Yükleniyor...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', alignItems: 'start' }}>
      
      {/* Sol Form Alanı */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #E2E8F0' }}>
        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', color: '#1E293B' }}>Yeni Ders Ekle</h3>
        {hata && <div style={{ padding: '0.75rem', background: '#FEE2E2', color: '#991B1B', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>{hata}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Kademe</label>
            <select 
              value={kademe} onChange={e => setKademe(e.target.value)} required
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
            >
              {KADEMELER.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Branş</label>
            <select 
              value={brans} onChange={e => setBrans(e.target.value)} required
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
            >
              {BRANSLAR.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Ders Adı</label>
            <input 
              type="text" value={ad} onChange={e => setAd(e.target.value)} required placeholder="Örn: Matematik"
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Standart Haftalık Saat</label>
            <input 
              type="number" value={haftalikSaat} onChange={e => setHaftalikSaat(e.target.value)} required min="1" max="40"
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
            />
          </div>

          <button 
            type="submit" disabled={islemYapiliyor}
            style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#4338CA', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: islemYapiliyor ? 'not-allowed' : 'pointer' }}
          >
            {islemYapiliyor ? 'Ekleniyor...' : 'Dersi Ekle'}
          </button>
        </form>
      </div>

      {/* Sağ Tablo Alanı */}
      <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <tr>
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Kademe</th>
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Ders Adı</th>
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Branş</th>
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', textAlign: 'center' }}>Haftalık Saat</th>
              <th style={{ padding: '1rem', width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {dersler.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Henüz ders tanımlanmamış.</td>
              </tr>
            ) : (
              dersler.map(ders => (
                <tr key={ders.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#1E293B' }}>
                    <span style={{ background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '500' }}>
                      {ders.kademe}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: '600', color: '#0F172A' }}>{ders.ad}</td>
                  <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#475569' }}>{ders.brans}</td>
                  <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#1E293B', textAlign: 'center', fontWeight: '600' }}>
                    {ders.haftalikSaat}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDelete(ders.id)}
                      style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                      title="Sil"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
