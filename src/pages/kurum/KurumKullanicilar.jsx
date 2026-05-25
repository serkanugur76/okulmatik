import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, doc, updateDoc, getDoc, setDoc, deleteDoc,
  query, orderBy, where, writeBatch, getDocs,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { davetEt, davetIptal } from '../../services/davetEt'

const ROL_ETİKET = {
  platform_admin: { etiket: 'Platform Admin', renk: '#7C3AED', bg: '#EDE9FE' },
  kurum_admin:    { etiket: 'Kurum Admin',    renk: '#0369A1', bg: '#E0F2FE' },
  ogretmen:       { etiket: 'Öğretmen',       renk: '#065F46', bg: '#D1FAE5' },
}

// Seviyeye göre atanabilir roller
const ROL_SEÇENEKLERİ = {
  platform_admin: [
    { value: 'ogretmen',    label: 'Öğretmen' },
    { value: 'kurum_admin', label: 'Kurum Admin' },
  ],
  kurum:    [
    { value: 'ogretmen',    label: 'Öğretmen' },
    { value: 'kurum_admin', label: 'Kurum Admin' },
  ],
  kampus:   [
    { value: 'ogretmen',    label: 'Öğretmen' },
    { value: 'kurum_admin', label: 'Kurum Admin' },
  ],
  altKurum: [
    { value: 'ogretmen',    label: 'Öğretmen' },
  ],
}

const BOŞ_FORM = {
  email: '', ad: '', rol: 'ogretmen', hedefKurumId: '',
  rubrikOlustur: false,
  sinifAtamalari: [], // [{ kurumId, siniflar: [id, ...] }]
}

export default function KurumKullanicilar() {
  const { kurumId: kullanicininKurumId, platformAdmin } = useAuth()
  const { secilenKurumId: kurumId, erisimKurumlar } = useKurumYonetim()

  // Kurum hiyerarşisi
  const rootKurumlar   = erisimKurumlar.filter(k => !k.parentId)
  const kampusKurumlar = erisimKurumlar.filter(k => k.parentId && !erisimKurumlar.find(x => x.id === k.parentId)?.parentId)
  const altKurumlar    = erisimKurumlar.filter(k => {
    if (!k.parentId) return false
    const u = erisimKurumlar.find(x => x.id === k.parentId)
    return !!u?.parentId
  })

  // Kullanıcının kendi seviyesi → hangi rolleri atayabilir
  const kullanicininKurumu  = erisimKurumlar.find(k => k.id === kullanicininKurumId)
  const kullanicininSeviyesi = platformAdmin
    ? 'platform_admin'
    : (kullanicininKurumu?.tip || 'kurum')
  const atanabilirRoller = ROL_SEÇENEKLERİ[kullanicininSeviyesi] || ROL_SEÇENEKLERİ.kurum

  const [kullanicilar, setKullanicilar] = useState([])
  const [bekleyenler,  setBekleyenler]  = useState([])
  const [googleAltyapisi, setGoogleAltyapisi] = useState(false)
  const [form,         setForm]         = useState(BOŞ_FORM)
  const [modal,        setModal]        = useState(false)
  const [duzenlenen,   setDuzenlenen]   = useState(null)
  const [kaydediyor,   setKaydediyor]   = useState(false)
  const [hata,         setHata]         = useState('')
  const [basari,       setBasari]       = useState('')
  const [aramaMetni,   setAramaMetni]   = useState('')
  const [sekme,        setSekme]        = useState('aktif')

  // Sınıf cache: { [kurumId]: [siniflar] }
  const [kurumSiniflar, setKurumSiniflar] = useState({})

  useEffect(() => {
    if (!kurumId) return
    const q1 = query(collection(db, 'kurumlar', kurumId, 'kullanicilar'), orderBy('ad', 'asc'))
    const q2 = query(collection(db, 'yetkiliKullanicilar'), where('kurumId', '==', kurumId))
    const u1 = onSnapshot(q1, snap => setKullanicilar(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const u2 = onSnapshot(q2, snap => {
      setBekleyenler(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    getDoc(doc(db, 'kurumlar', kurumId)).then(snap => {
      if (snap.exists()) setGoogleAltyapisi(!!snap.data().googleAltyapisi)
    })
    return () => { u1(); u2() }
  }, [kurumId])

  // Sınıfları lazy yükle (cache'de yoksa Firestore'dan çek)
  async function sinifYukle(kid) {
    if (!kid || kurumSiniflar[kid] !== undefined) return
    try {
      const snap = await getDocs(collection(db, 'kurumlar', kid, 'siniflar'))
      const liste = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (Number(a.seviye) || 0) - (Number(b.seviye) || 0) || (a.sube || '').localeCompare(b.sube || '', 'tr'))
      setKurumSiniflar(prev => ({ ...prev, [kid]: liste }))
    } catch (err) {
      console.error('Sınıf yüklenemedi:', err)
      setKurumSiniflar(prev => ({ ...prev, [kid]: [] }))
    }
  }

  function modalAc(k = null) {
    setDuzenlenen(k)
    if (k) {
      const atamalar = k.sinifAtamalari || []
      setForm({
        ad: k.ad || '', email: k.email, rol: k.rol,
        hedefKurumId: k.kurumId || kurumId || '',
        rubrikOlustur: k.modulIzinler?.rubrik_olustur || false,
        sinifAtamalari: atamalar,
      })
      // Mevcut atamaların sınıflarını önceden yükle
      atamalar.forEach(a => sinifYukle(a.kurumId))
    } else {
      setForm(BOŞ_FORM)
    }
    setHata('')
    setBasari('')
    setModal(true)
  }

  function modalKapat() { setModal(false); setDuzenlenen(null); setForm(BOŞ_FORM) }

  // Sınıf atama yardımcıları
  function atamaKurumDegistir(idx, yeniKurumId) {
    setForm(f => ({
      ...f,
      sinifAtamalari: f.sinifAtamalari.map((a, i) =>
        i === idx ? { kurumId: yeniKurumId, siniflar: [] } : a
      ),
    }))
    if (yeniKurumId) sinifYukle(yeniKurumId)
  }
  function atamaSinifToggle(idx, sinifId) {
    setForm(f => ({
      ...f,
      sinifAtamalari: f.sinifAtamalari.map((a, i) => {
        if (i !== idx) return a
        const var_ = a.siniflar.includes(sinifId)
        return { ...a, siniflar: var_ ? a.siniflar.filter(s => s !== sinifId) : [...a.siniflar, sinifId] }
      }),
    }))
  }
  function atamaKaldir(idx) {
    setForm(f => ({ ...f, sinifAtamalari: f.sinifAtamalari.filter((_, i) => i !== idx) }))
  }
  function atamaEkle() {
    setForm(f => ({ ...f, sinifAtamalari: [...f.sinifAtamalari, { kurumId: '', siniflar: [] }] }))
  }

  async function kaydet(e) {
    e.preventDefault()
    if (!form.email.trim()) { setHata('E-posta zorunludur.'); return }
    setKaydediyor(true); setHata('')

    // Öğretmen için ek alanlar
    // sinifIdler ve erisimKurumIdler: Firestore rules'da array-contains ile kullanılır
    const atamalari = form.sinifAtamalari || []
    // parentKurumIdler: atanan altKurumların parent (kampüs) ID'leri — kurum adını göstermek için
    const parentKurumIdler = form.rol === 'ogretmen'
      ? [...new Set(atamalari.map(a => {
          const k = erisimKurumlar.find(x => x.id === a.kurumId)
          return k?.parentId
        }).filter(Boolean))]
      : []

    const ogretmenEkstra = form.rol === 'ogretmen' ? {
      modulIzinler:     { rubrik_olustur: form.rubrikOlustur || false },
      sinifAtamalari:   atamalari,
      sinifIdler:       [...new Set(atamalari.flatMap(a => a.siniflar || []))],
      erisimKurumIdler: [...new Set(atamalari.map(a => a.kurumId).filter(Boolean))],
      parentKurumIdler,
    } : {
      modulIzinler:     {},
      sinifAtamalari:   [],
      sinifIdler:       [],
      erisimKurumIdler: [],
      parentKurumIdler: [],
    }

    try {
      if (duzenlenen) {
        const uid = duzenlenen.id
        const eskiKurumId = duzenlenen.kurumId || kurumId
        const yeniKurumId = form.hedefKurumId || eskiKurumId
        if (!yeniKurumId) { setHata('Lütfen bir kurum seçin.'); setKaydediyor(false); return }

        // Global kullanicilar kaydını güncelle
        await updateDoc(doc(db, 'kullanicilar', uid), {
          ad: form.ad, rol: form.rol, kurumId: yeniKurumId, ...ogretmenEkstra,
        })

        if (yeniKurumId !== eskiKurumId) {
          const batch = writeBatch(db)
          batch.delete(doc(db, 'kurumlar', eskiKurumId, 'kullanicilar', uid))
          batch.set(doc(db, 'kurumlar', yeniKurumId, 'kullanicilar', uid), {
            ad: form.ad, email: duzenlenen.email,
            rol: form.rol, kurumId: yeniKurumId, durum: 'aktif',
          })
          await batch.commit()
        } else {
          await updateDoc(doc(db, 'kurumlar', yeniKurumId, 'kullanicilar', uid), {
            ad: form.ad, rol: form.rol,
          })
        }

        setBasari('Kullanıcı güncellendi.')
        setTimeout(modalKapat, 1200)
      } else {
        await davetEt({
          email: form.email.trim(), rol: form.rol, kurumId, googleAltyapisi,
          ...ogretmenEkstra,
        })
        setBasari(`Davet gönderildi: ${form.email}`)
        setTimeout(modalKapat, 1500)
      }
    } catch (err) {
      setHata(err.message)
    } finally {
      setKaydediyor(false)
    }
  }

  async function davetSil(email) {
    if (!confirm(`${email} davetini iptal etmek istediğinize emin misiniz?`)) return
    await davetIptal(email)
  }

  const aktifListe    = kullanicilar.filter(k => `${k.ad} ${k.email}`.toLowerCase().includes(aramaMetni.toLowerCase()))
  const bekleyenListe = bekleyenler.filter(k => k.email.toLowerCase().includes(aramaMetni.toLowerCase()))

  const s = {
    th:     { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    td:     { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    eylem:  { background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 9px', fontSize: '0.75rem', cursor: 'pointer', color: '#374151' },
    alan:   { display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' },
    etiket: { fontSize: '0.875rem', fontWeight: '500', color: '#374151' },
    girdi:  { padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', color: '#1E293B' },
  }

  // Modal genişliği: öğretmense daha geniş
  const modalGenislik = form.rol === 'ogretmen' ? '580px' : '420px'

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Kullanıcılar</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>
        Öğretmen ve yönetici listesi
        {googleAltyapisi && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#E8F0FE', color: '#1557B0', padding: '2px 8px', borderRadius: '999px', fontWeight: '600' }}>Google Workspace</span>}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
            placeholder="Ad veya e-posta ara..."
            style={{ padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', width: '260px', color: '#1E293B' }} />
          {['aktif', 'bekleyen'].map(s2 => (
            <button key={s2} onClick={() => setSekme(s2)}
              style={{ padding: '0.5rem 1rem', border: '1.5px solid', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                borderColor: sekme === s2 ? '#1B3A6B' : '#E2E8F0',
                background:  sekme === s2 ? '#1B3A6B' : '#fff',
                color:       sekme === s2 ? '#fff' : '#64748B' }}>
              {s2 === 'aktif' ? `Aktif (${kullanicilar.length})` : `Bekleyen (${bekleyenler.length})`}
            </button>
          ))}
        </div>
        <button onClick={() => modalAc()} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
          + Kullanıcı Davet Et
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {sekme === 'aktif' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Ad', 'E-posta', 'Rol', 'Atamalar', 'İşlemler'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {aktifListe.length === 0 ? (
                <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>
                  {aramaMetni ? 'Sonuç bulunamadı' : 'Henüz kullanıcı eklenmemiş'}
                </td></tr>
              ) : aktifListe.map(k => {
                const rolBilgi = ROL_ETİKET[k.rol] || { etiket: k.rol, renk: '#374151', bg: '#F1F5F9' }
                const koordinator = k.rol === 'ogretmen' && k.modulIzinler?.rubrik_olustur
                const toplamSinif = (k.sinifAtamalari || []).reduce((t, a) => t + (a.siniflar?.length || 0), 0)
                return (
                  <tr key={k.id}>
                    <td style={s.td}><strong>{k.ad || '—'}</strong></td>
                    <td style={s.td}>{k.email}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600', background: rolBilgi.bg, color: rolBilgi.renk }}>
                          {rolBilgi.etiket}
                        </span>
                        {koordinator && (
                          <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600', background: '#FEF3C7', color: '#92400E' }}>
                            Koordinatör
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={s.td}>
                      {k.rol === 'ogretmen' ? (
                        toplamSinif > 0
                          ? <span style={{ fontSize: '0.75rem', color: '#1B3A6B', fontWeight: '600' }}>{toplamSinif} sınıf</span>
                          : <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>—</span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>—</span>
                      )}
                    </td>
                    <td style={s.td}>
                      <button style={s.eylem} onClick={() => modalAc(k)}>Düzenle</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['E-posta', 'Rol', 'Giriş Yöntemi', 'İşlemler'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {bekleyenListe.length === 0 ? (
                <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Bekleyen davet yok</td></tr>
              ) : bekleyenListe.map(k => {
                const rolBilgi = ROL_ETİKET[k.rol] || { etiket: k.rol, renk: '#374151', bg: '#F1F5F9' }
                return (
                  <tr key={k.id}>
                    <td style={s.td}>{k.email}</td>
                    <td style={s.td}>
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600', background: rolBilgi.bg, color: rolBilgi.renk }}>
                        {rolBilgi.etiket}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontSize: '0.75rem', color: k.googleAltyapisi ? '#1557B0' : '#374151' }}>
                        {k.googleAltyapisi ? 'Google' : 'E-posta / Şifre'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => davetSil(k.email)}>
                        İptal Et
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, overflowY: 'auto', padding: '2rem 1rem' }}
          onClick={e => e.target === e.currentTarget && modalKapat()}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: modalGenislik, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.5rem' }}>
              {duzenlenen ? 'Kullanıcıyı Düzenle' : 'Kullanıcı Davet Et'}
            </h2>
            {!duzenlenen && (
              <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1.25rem' }}>
                {googleAltyapisi ? 'Kullanıcı Google hesabıyla giriş yapacak.' : 'Kullanıcıya şifre belirleme e-postası gönderilecek.'}
              </p>
            )}

            <form onSubmit={kaydet}>
              {/* Ad Soyad (sadece düzenleme) */}
              {duzenlenen && (
                <div style={s.alan}>
                  <label style={s.etiket}>Ad Soyad</label>
                  <input style={s.girdi} value={form.ad || ''} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} autoFocus />
                </div>
              )}

              {/* E-posta */}
              <div style={s.alan}>
                <label style={s.etiket}>E-posta *</label>
                <input style={s.girdi} type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  disabled={!!duzenlenen} autoFocus={!duzenlenen} />
              </div>

              {/* Rol */}
              <div style={s.alan}>
                <label style={s.etiket}>Rol</label>
                <select style={s.girdi} value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                  {atanabilirRoller.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                {kullanicininSeviyesi === 'altKurum' && (
                  <span style={{ fontSize: '0.75rem', color: '#92400E', background: '#FEF3C7', padding: '2px 8px', borderRadius: '6px', marginTop: '4px' }}>
                    ℹ Alt kurum admini yalnızca öğretmen ekleyebilir
                  </span>
                )}
              </div>

              {/* ── Öğretmen Alanları ── */}
              {form.rol === 'ogretmen' && (
                <>
                  {/* Koordinatör checkbox */}
                  <div style={{ ...s.alan, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.rubrikOlustur}
                        onChange={e => setForm(f => ({ ...f, rubrikOlustur: e.target.checked }))}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400E' }}>
                        Koordinatör / Zümre Başkanı
                      </span>
                    </label>
                    <span style={{ fontSize: '0.75rem', color: '#B45309', marginLeft: '1.5rem' }}>
                      ✓ Rubrik oluşturabilir ve düzenleyebilir
                    </span>
                  </div>

                  {/* Sınıf Atamaları */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.625rem' }}>
                      Sınıf Atamaları
                      <span style={{ fontSize: '0.75rem', fontWeight: '400', color: '#94A3B8', marginLeft: '0.5rem' }}>
                        Farklı kampüs ve okullarda birden fazla atama yapılabilir
                      </span>
                    </div>

                    {form.sinifAtamalari.length === 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '0.5rem', padding: '0.5rem', background: '#F8FAFC', borderRadius: '6px', textAlign: 'center' }}>
                        Henüz sınıf ataması yok
                      </div>
                    )}

                    {form.sinifAtamalari.map((atama, idx) => {
                      const sinifler = kurumSiniflar[atama.kurumId] || []
                      const yukleniyor = atama.kurumId && kurumSiniflar[atama.kurumId] === undefined
                      return (
                        <div key={idx} style={{ border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '0.875rem', marginBottom: '0.5rem' }}>
                          {/* Kurum seçimi */}
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem', alignItems: 'center' }}>
                            <select value={atama.kurumId}
                              onChange={e => atamaKurumDegistir(idx, e.target.value)}
                              style={{ ...s.girdi, flex: 1, fontSize: '0.85rem' }}>
                              <option value="">— Okul / Kurum seçin —</option>
                              {altKurumlar.map(k => {
                                const kampus = erisimKurumlar.find(x => x.id === k.parentId)
                                return (
                                  <option key={k.id} value={k.id}>
                                    {kampus ? `${kampus.ad} · ` : ''}{k.ad}
                                  </option>
                                )
                              })}
                            </select>
                            <button type="button" onClick={() => atamaKaldir(idx)}
                              style={{ padding: '5px 10px', background: 'none', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', cursor: 'pointer', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              Kaldır
                            </button>
                          </div>

                          {/* Sınıf seçimi */}
                          {atama.kurumId && (
                            <div>
                              {yukleniyor ? (
                                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Sınıflar yükleniyor…</span>
                              ) : sinifler.length === 0 ? (
                                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Bu kurumda sınıf tanımlı değil</span>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {sinifler.map(sinif => {
                                    const secili = atama.siniflar.includes(sinif.id)
                                    return (
                                      <button type="button" key={sinif.id}
                                        onClick={() => atamaSinifToggle(idx, sinif.id)}
                                        style={{
                                          padding: '3px 10px', borderRadius: '20px', border: '1.5px solid',
                                          borderColor: secili ? '#1B3A6B' : '#E2E8F0',
                                          background:  secili ? '#1B3A6B' : '#fff',
                                          color:       secili ? '#fff' : '#64748B',
                                          fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.1s',
                                        }}>
                                        {sinif.ad}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <button type="button" onClick={atamaEkle}
                      style={{ width: '100%', padding: '7px', border: '1.5px dashed #CBD5E1', borderRadius: '8px', background: '#F8FAFC', color: '#64748B', fontSize: '0.8rem', cursor: 'pointer', marginTop: '2px' }}>
                      + Okul / Kampüs Ekle
                    </button>
                  </div>
                </>
              )}

              {/* Yönetim Kapsamı (sadece kurum_admin düzenlemede) */}
              {duzenlenen && form.rol === 'kurum_admin' && erisimKurumlar.length > 1 && (
                <div style={s.alan}>
                  <label style={s.etiket}>Yönetim Kapsamı</label>
                  <select style={s.girdi} value={form.hedefKurumId}
                    onChange={e => setForm(f => ({ ...f, hedefKurumId: e.target.value }))}>
                    {!form.hedefKurumId && <option value="">— Seçin —</option>}
                    {rootKurumlar.map(k => (
                      <option key={k.id} value={k.id}>🏛 {k.ad} — tüm kampüsler</option>
                    ))}
                    {kampusKurumlar.map(k => (
                      <option key={k.id} value={k.id}>🏫 {k.ad} — tüm alt okullar</option>
                    ))}
                    {altKurumlar.map(k => {
                      const kampus = erisimKurumlar.find(x => x.id === k.parentId)
                      return <option key={k.id} value={k.id}>🏢 {kampus ? `${kampus.ad} · ` : ''}{k.ad}</option>
                    })}
                  </select>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '3px' }}>
                    {form.hedefKurumId && (() => {
                      if (rootKurumlar.find(k => k.id === form.hedefKurumId))   return '✓ Tüm kampüs ve alt okulları yönetir'
                      if (kampusKurumlar.find(k => k.id === form.hedefKurumId)) return '✓ Bu kampüse bağlı tüm okulları yönetir'
                      if (altKurumlar.find(k => k.id === form.hedefKurumId))    return '✓ Yalnızca bu okulu yönetir'
                    })()}
                  </div>
                  {form.hedefKurumId !== (duzenlenen.kurumId || '') && form.hedefKurumId && (
                    <div style={{ fontSize: '0.78rem', color: '#D97706', marginTop: '2px' }}>
                      ⚠ Kullanıcı yeni kapsama taşınacak
                    </div>
                  )}
                </div>
              )}

              {basari && <p style={{ fontSize: '0.875rem', color: '#065F46', background: '#D1FAE5', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>{basari}</p>}
              {hata    && <p style={{ fontSize: '0.875rem', color: '#991B1B', background: '#FEE2E2', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>{hata}</p>}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={modalKapat}
                  style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>
                  İptal
                </button>
                <button type="submit" disabled={kaydediyor}
                  style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                  {kaydediyor ? 'Gönderiliyor...' : duzenlenen ? 'Kaydet' : 'Davet Gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
