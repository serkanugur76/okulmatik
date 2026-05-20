import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'

const BOŞ_FORM = { ad: '', soyad: '', ogrenciNo: '', sinifId: '', sinifAd: '', cinsiyet: '', dogumTarihi: '', veliadSoyad: '', veliTelefon: '' }

export default function KurumOgrenciler() {
  const { secilenKurumId: kurumId } = useKurumYonetim()
  const [ogrenciler, setOgrenciler] = useState([])
  const [siniflar, setSiniflar]     = useState([])
  const [form, setForm]             = useState(BOŞ_FORM)
  const [modal, setModal]           = useState(false)
  const [duzenlenen, setDuzenlenen] = useState(null)
  const [kaydediyor, setKaydediyor] = useState(false)
  const [hata, setHata]             = useState('')
  const [aramaMetni, setAramaMetni] = useState('')

  useEffect(() => {
    if (!kurumId) return
    const qO = query(collection(db, 'kurumlar', kurumId, 'ogrenciler'), orderBy('ad', 'asc'))
    const qS = query(collection(db, 'kurumlar', kurumId, 'siniflar'), orderBy('ad', 'asc'))
    const u1 = onSnapshot(qO, snap => setOgrenciler(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const u2 = onSnapshot(qS, snap => setSiniflar(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    return () => { u1(); u2() }
  }, [kurumId])

  function modalAc(ogr = null) {
    setDuzenlenen(ogr)
    setForm(ogr ? {
      ad: ogr.ad, soyad: ogr.soyad || '', ogrenciNo: ogr.ogrenciNo || '',
      sinifId: ogr.sinifId || '', sinifAd: ogr.sinifAd || '',
      cinsiyet: ogr.cinsiyet || '', dogumTarihi: ogr.dogumTarihi || '',
      veliadSoyad: ogr.veliadSoyad || '', veliTelefon: ogr.veliTelefon || '',
    } : BOŞ_FORM)
    setHata('')
    setModal(true)
  }

  function modalKapat() { setModal(false); setDuzenlenen(null); setForm(BOŞ_FORM) }

  function sinifSec(sinifId) {
    const s = siniflar.find(x => x.id === sinifId)
    setForm(f => ({ ...f, sinifId, sinifAd: s?.ad || '' }))
  }

  async function kaydet(e) {
    e.preventDefault()
    if (!form.ad.trim()) { setHata('Ad zorunludur.'); return }
    setKaydediyor(true)
    try {
      if (duzenlenen) {
        await updateDoc(doc(db, 'kurumlar', kurumId, 'ogrenciler', duzenlenen.id), { ...form })
      } else {
        await addDoc(collection(db, 'kurumlar', kurumId, 'ogrenciler'), { ...form, olusturmaTarihi: serverTimestamp() })
      }
      modalKapat()
    } catch (err) {
      setHata('Kayıt hatası: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  async function sil(id) {
    if (!window.confirm('Bu öğrenciyi silmek istediğinize emin misiniz?')) return
    await deleteDoc(doc(db, 'kurumlar', kurumId, 'ogrenciler', id))
  }

  const liste = ogrenciler.filter(o =>
    `${o.ad} ${o.soyad} ${o.ogrenciNo}`.toLowerCase().includes(aramaMetni.toLowerCase())
  )

  const s = {
    th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    td: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    eylem: { background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 9px', fontSize: '0.75rem', cursor: 'pointer', color: '#374151' },
    alan: { display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' },
    etiket: { fontSize: '0.875rem', fontWeight: '500', color: '#374151' },
    girdi: { padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', color: '#1E293B' },
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Öğrenciler</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Öğrenci kayıt ve yönetimi</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <input value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
          placeholder="Ad, soyad veya öğrenci no ara..."
          style={{ padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', width: '280px', color: '#1E293B' }} />
        <button onClick={() => modalAc()} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
          + Yeni Öğrenci
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Ad Soyad', 'Öğrenci No', 'Sınıf', 'Veli', 'Veli Tel.', 'İşlemler'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>
                {aramaMetni ? 'Sonuç bulunamadı' : 'Henüz öğrenci eklenmemiş'}
              </td></tr>
            ) : liste.map(o => (
              <tr key={o.id}>
                <td style={s.td}><strong>{o.ad} {o.soyad}</strong></td>
                <td style={s.td}>{o.ogrenciNo || '—'}</td>
                <td style={s.td}>{o.sinifAd || '—'}</td>
                <td style={s.td}>{o.veliadSoyad || '—'}</td>
                <td style={s.td}>{o.veliTelefon || '—'}</td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={s.eylem} onClick={() => modalAc(o)}>Düzenle</button>
                    <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => sil(o.id)}>Sil</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && modalKapat()}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '1.5rem' }}>
              {duzenlenen ? 'Öğrenciyi Düzenle' : 'Yeni Öğrenci Ekle'}
            </h2>
            <form onSubmit={kaydet}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}>
                  <label style={s.etiket}>Ad *</label>
                  <input style={s.girdi} value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} autoFocus />
                </div>
                <div style={s.alan}>
                  <label style={s.etiket}>Soyad</label>
                  <input style={s.girdi} value={form.soyad} onChange={e => setForm(f => ({ ...f, soyad: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}>
                  <label style={s.etiket}>Öğrenci No</label>
                  <input style={s.girdi} value={form.ogrenciNo} onChange={e => setForm(f => ({ ...f, ogrenciNo: e.target.value }))} />
                </div>
                <div style={s.alan}>
                  <label style={s.etiket}>Cinsiyet</label>
                  <select style={s.girdi} value={form.cinsiyet} onChange={e => setForm(f => ({ ...f, cinsiyet: e.target.value }))}>
                    <option value="">Seçin</option>
                    <option value="erkek">Erkek</option>
                    <option value="kız">Kız</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={s.alan}>
                  <label style={s.etiket}>Sınıf</label>
                  <select style={s.girdi} value={form.sinifId} onChange={e => sinifSec(e.target.value)}>
                    <option value="">Seçin</option>
                    {siniflar.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
                  </select>
                </div>
                <div style={s.alan}>
                  <label style={s.etiket}>Doğum Tarihi</label>
                  <input style={s.girdi} type="date" value={form.dogumTarihi} onChange={e => setForm(f => ({ ...f, dogumTarihi: e.target.value }))} />
                </div>
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>Veli Ad Soyad</label>
                <input style={s.girdi} value={form.veliadSoyad} onChange={e => setForm(f => ({ ...f, veliadSoyad: e.target.value }))} />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>Veli Telefon</label>
                <input style={s.girdi} value={form.veliTelefon} onChange={e => setForm(f => ({ ...f, veliTelefon: e.target.value }))} placeholder="0555 000 00 00" />
              </div>
              {hata && <p style={{ fontSize: '0.875rem', color: '#991B1B', background: '#FEE2E2', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>{hata}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={modalKapat} style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>İptal</button>
                <button type="submit" disabled={kaydediyor} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                  {kaydediyor ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
