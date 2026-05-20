import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, doc,
  serverTimestamp, query, orderBy, writeBatch,
} from 'firebase/firestore'
import { db } from '../../services/firebase'

const TIP_ETİKET = {
  kurum:    { etiket: 'Kurum',     renk: '#1B3A6B', bg: '#DBEAFE', girinti: 0 },
  kampus:   { etiket: 'Kampüs',    renk: '#0369A1', bg: '#E0F2FE', girinti: 24 },
  altKurum: { etiket: 'Alt Kurum', renk: '#065F46', bg: '#D1FAE5', girinti: 48 },
}

const BOŞ_FORM = { ad: '', email: '', telefon: '', adres: '', durum: 'aktif', tip: 'kurum', parentId: null, rootKurumId: null, googleAltyapisi: false, okulTuru: '' }

function agacOlustur(liste) {
  const map = {}
  liste.forEach(k => { map[k.id] = { ...k, cocuklar: [] } })
  const kokler = []
  liste.forEach(k => {
    if (k.parentId && map[k.parentId]) map[k.parentId].cocuklar.push(map[k.id])
    else if (!k.parentId) kokler.push(map[k.id])
  })
  return kokler
}

function agacDüzlestir(dugumler, sonuc = []) {
  dugumler.forEach(d => {
    sonuc.push(d)
    if (d.cocuklar?.length) agacDüzlestir(d.cocuklar, sonuc)
  })
  return sonuc
}

export default function Kurumlar() {
  const [kurumlar, setKurumlar]     = useState([])
  const [acik, setAcik]             = useState({})
  const [form, setForm]             = useState(BOŞ_FORM)
  const [modal, setModal]           = useState(false)
  const [duzenlenen, setDuzenlenen] = useState(null)
  const [kaydediyor, setKaydediyor] = useState(false)
  const [hata, setHata]             = useState('')

  useEffect(() => {
    const q = query(collection(db, 'kurumlar'), orderBy('olusturmaTarihi', 'asc'))
    return onSnapshot(q, async snap => {
      const liste = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setKurumlar(liste)
      // Yeni eklenen kurumlar için varsayılan kapalı; mevcut açık/kapalı durumu koru
      setAcik(prev => {
        const guncellenen = { ...prev }
        liste.forEach(k => { if (!(k.id in guncellenen)) guncellenen[k.id] = false })
        return guncellenen
      })

      // rootKurumId migrasyonu: eksik olan kurumları güncelle
      const eksikler = liste.filter(k => k.parentId && !k.rootKurumId)
      if (eksikler.length > 0) {
        const batch = writeBatch(db)
        eksikler.forEach(k => {
          const rootId = k.tip === 'kampus'
            ? k.parentId
            : (liste.find(x => x.id === k.parentId)?.parentId || k.parentId)
          batch.update(doc(db, 'kurumlar', k.id), { rootKurumId: rootId })
        })
        await batch.commit().catch(console.error)
      }
    })
  }, [])

  function altEkleModalAc(parent) {
    const cocukTip = parent.tip === 'kurum' ? 'kampus' : 'altKurum'
    const rootKurumId = parent.tip === 'kurum' ? parent.id : (parent.parentId || parent.id)
    setDuzenlenen(null)
    setForm({ ...BOŞ_FORM, tip: cocukTip, parentId: parent.id, rootKurumId })
    setHata('')
    setModal(true)
  }

  function düzenleModalAc(kurum) {
    setDuzenlenen(kurum)
    setForm({ ad: kurum.ad, email: kurum.email || '', telefon: kurum.telefon || '', adres: kurum.adres || '', durum: kurum.durum, tip: kurum.tip, parentId: kurum.parentId || null, googleAltyapisi: !!kurum.googleAltyapisi, okulTuru: kurum.okulTuru || '' })
    setHata('')
    setModal(true)
  }

  function yeniKurumModalAc() {
    setDuzenlened(null)
    setForm(BOŞ_FORM)
    setHata('')
    setModal(true)
  }

  function modalKapat() { setModal(false); setDuzenlened(null); setForm(BOŞ_FORM) }

  async function kaydet(e) {
    e.preventDefault()
    if (!form.ad.trim()) { setHata('Ad zorunludur.'); return }
    setKaydediyor(true)
    try {
      if (duzenlenen) {
        const guncelleme = {
          ad: form.ad, email: form.email, telefon: form.telefon,
          adres: form.adres, durum: form.durum, googleAltyapisi: !!form.googleAltyapisi,
          okulTuru: form.okulTuru || '',
        }
        const googleDegisti = !!form.googleAltyapisi !== !!duzenlenen.googleAltyapisi
        const durumDegistiMi = form.durum !== duzenlenen.durum
        const altlar = torunlar(duzenlenen.id, kurumlar)

        if (altlar.length > 0 && (googleDegisti || durumDegistiMi)) {
          // Cascade gereken alanlar
          const cascadeAlanlari = {}
          if (googleDegisti)   cascadeAlanlari.googleAltyapisi = !!form.googleAltyapisi
          if (durumDegistiMi)  cascadeAlanlari.durum = form.durum

          const batch = writeBatch(db)
          batch.update(doc(db, 'kurumlar', duzenlenen.id), guncelleme)
          altlar.forEach(k => batch.update(doc(db, 'kurumlar', k.id), cascadeAlanlari))
          await batch.commit()
        } else {
          await updateDoc(doc(db, 'kurumlar', duzenlenen.id), guncelleme)
        }
      } else {
        await addDoc(collection(db, 'kurumlar'), { ...form, googleAltyapisi: !!form.googleAltyapisi, olusturmaTarihi: serverTimestamp() })
      }
      modalKapat()
    } catch (err) {
      setHata('Kayıt hatası: ' + err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  // Bir kurumun tüm alt torunlarını döndürür (kampüs + altKurum)
  function torunlar(kurumId, tumKurumlar) {
    const cocuklar = tumKurumlar.filter(k => k.parentId === kurumId)
    return cocuklar.flatMap(c => [c, ...torunlar(c.id, tumKurumlar)])
  }

  async function durumDegistir(kurum) {
    const yeniDurum = kurum.durum === 'aktif' ? 'pasif' : 'aktif'
    const altlar = torunlar(kurum.id, kurumlar)

    if (altlar.length > 0) {
      if (!window.confirm(`"${kurum.ad}" ve altındaki ${altlar.length} kurum da ${yeniDurum} yapılacak. Devam edilsin mi?`)) return
    }

    const batch = writeBatch(db)
    batch.update(doc(db, 'kurumlar', kurum.id), { durum: yeniDurum })
    altlar.forEach(k => batch.update(doc(db, 'kurumlar', k.id), { durum: yeniDurum }))
    await batch.commit()
  }

  // setDuzenlened hatası düzeltmesi
  function setDuzenlened(v) { setDuzenlenen(v) }

  const agac = agacOlustur(kurumlar)
  const duzListe = agacDüzlestir(agac)

  // Üst kurumdan gizlenmiş olanları filtrele
  const gorunenListe = duzListe.filter(k => {
    if (!k.parentId) return true
    const ust = kurumlar.find(x => x.id === k.parentId)
    if (!ust) return true
    if (!acik[k.parentId]) return false
    if (ust.parentId && !acik[ust.parentId]) return false
    return true
  })

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
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Kurumlar</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Kurum, kampüs ve alt kurum yönetimi</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#64748B' }}>{kurumlar.filter(k => k.tip === 'kurum').length} kurum</span>
        <button onClick={yeniKurumModalAc} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
          + Yeni Kurum
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Ad', 'Tip', 'E-posta', 'Google', 'Durum', 'İşlemler'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gorunenListe.length === 0 ? (
              <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Henüz kurum eklenmemiş</td></tr>
            ) : gorunenListe.map(k => {
              const tipBilgi = TIP_ETİKET[k.tip] || TIP_ETİKET.kurum
              const cocukSayisi = kurumlar.filter(x => x.parentId === k.id).length
              const altKurumSayisi = torunlar(k.id, kurumlar).length
              // Üst kurumdan Google ve durum mirası
              const ustKurum = k.parentId ? kurumlar.find(x => x.id === k.parentId) : null
              const googleMiras = !k.googleAltyapisi && !!ustKurum?.googleAltyapisi
              const durumMiras  = k.durum !== 'aktif' && ustKurum?.durum === 'pasif'
              return (
                <tr key={k.id} style={{ background: k.tip === 'altKurum' ? '#FAFAFA' : '#fff' }}>
                  <td style={{ ...s.td, paddingLeft: `${1 + tipBilgi.girinti / 16}rem` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {cocukSayisi > 0 && (
                        <button onClick={() => setAcik(a => ({ ...a, [k.id]: !a[k.id] }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: '0.75rem', padding: '0 2px' }}>
                          {acik[k.id] ? '▼' : '▶'}
                        </button>
                      )}
                      {cocukSayisi === 0 && <span style={{ width: '16px' }} />}
                      <span style={{ fontWeight: k.tip === 'kurum' ? '600' : '400' }}>{k.ad}</span>
                      {cocukSayisi > 0 && <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>({cocukSayisi})</span>}
                    </div>
                  </td>
                  <td style={s.td}>
                    <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600', background: tipBilgi.bg, color: tipBilgi.renk }}>
                      {tipBilgi.etiket}
                    </span>
                  </td>
                  <td style={s.td}>{k.email || '—'}</td>
                  <td style={s.td}>
                    {k.googleAltyapisi
                      ? <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#1557B0', background: '#E8F0FE', padding: '2px 8px', borderRadius: '999px' }}>Google</span>
                      : googleMiras
                      ? <span style={{ fontSize: '0.75rem', color: '#93C5FD', background: '#EFF6FF', padding: '2px 8px', borderRadius: '999px', border: '1px dashed #BFDBFE' }} title="Üst kurumdan miras">Google ↓</span>
                      : <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>—</span>}
                  </td>
                  <td style={s.td}>
                    <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600', background: k.durum === 'aktif' ? '#D1FAE5' : '#FEE2E2', color: k.durum === 'aktif' ? '#065F46' : '#991B1B' }}>
                      {k.durum}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      <button style={s.eylem} onClick={() => düzenleModalAc(k)}>Düzenle</button>
                      {k.tip !== 'altKurum' && (
                        <button style={{ ...s.eylem, color: '#0369A1', borderColor: '#BAE6FD' }} onClick={() => altEkleModalAc(k)}>
                          + {k.tip === 'kurum' ? 'Kampüs' : 'Alt Kurum'}
                        </button>
                      )}
                      <button
                        title={altKurumSayisi > 0 ? `Altındaki ${altKurumSayisi} kurum da etkilenir` : ''}
                        style={{ ...s.eylem, color: k.durum === 'aktif' ? '#991B1B' : '#065F46', borderColor: k.durum === 'aktif' ? '#FECACA' : '#A7F3D0', position: 'relative' }}
                        onClick={() => durumDegistir(k)}>
                        {k.durum === 'aktif' ? 'Pasif' : 'Aktif'}
                        {altKurumSayisi > 0 && <span style={{ fontSize: '0.6rem', marginLeft: '3px', opacity: 0.65 }}>({altKurumSayisi})</span>}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && modalKapat()}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.5rem' }}>
              {duzenlenen ? 'Düzenle' : (form.tip === 'kampus' ? 'Yeni Kampüs Ekle' : form.tip === 'altKurum' ? 'Yeni Alt Kurum Ekle' : 'Yeni Kurum Ekle')}
            </h2>
            {form.parentId && (
              <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1.25rem' }}>
                Üst: <strong>{kurumlar.find(k => k.id === form.parentId)?.ad}</strong>
              </p>
            )}
            <form onSubmit={kaydet}>
              <div style={s.alan}>
                <label style={s.etiket}>Ad *</label>
                <input style={s.girdi} value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} placeholder={form.tip === 'kampus' ? 'Mezitli Kampüsü' : form.tip === 'altKurum' ? 'İlkokul' : 'Kurum adı'} autoFocus />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>E-posta</label>
                <input style={s.girdi} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="okul@example.com" />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>Telefon</label>
                <input style={s.girdi} value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} placeholder="0212 000 00 00" />
              </div>
              <div style={s.alan}>
                <label style={s.etiket}>Adres</label>
                <textarea style={{ ...s.girdi, resize: 'vertical', minHeight: '60px' }} value={form.adres} onChange={e => setForm(f => ({ ...f, adres: e.target.value }))} />
              </div>
              {form.tip === 'altKurum' && (
                <div style={s.alan}>
                  <label style={s.etiket}>Okul Türü</label>
                  <select style={s.girdi} value={form.okulTuru} onChange={e => setForm(f => ({ ...f, okulTuru: e.target.value }))}>
                    <option value="">Seçin (isteğe bağlı)</option>
                    <option value="ilkokul">İlkokul (1–4. Sınıf)</option>
                    <option value="ortaokul">Ortaokul (5–8. Sınıf)</option>
                    <option value="lise">Lise (9–12. Sınıf)</option>
                  </select>
                </div>
              )}
              <div style={s.alan}>
                <label style={s.etiket}>Durum</label>
                <select style={s.girdi} value={form.durum} onChange={e => setForm(f => ({ ...f, durum: e.target.value }))}>
                  <option value="aktif">Aktif</option>
                  <option value="pasif">Pasif</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', padding: '0.75rem', background: '#F8FAFC', borderRadius: '8px', border: '1.5px solid #E2E8F0' }}>
                <input type="checkbox" id="googleAltyapisi" checked={!!form.googleAltyapisi}
                  onChange={e => setForm(f => ({ ...f, googleAltyapisi: e.target.checked }))}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                <label htmlFor="googleAltyapisi" style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
                  Google Workspace altyapısı kullanıyor
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', fontWeight: '400' }}>Kullanıcılar Google hesabıyla giriş yapar</span>
                </label>
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
