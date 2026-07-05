import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, query, orderBy, doc, updateDoc,
  getDoc, getDocs, setDoc, writeBatch,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { davetEt, davetIptal } from '../../services/davetEt'
import { useAuth } from '../../contexts/AuthContext'
import { logKaydet } from '../../services/logService'
import KurumSecici from '../../components/KurumSecici'

const DERS_LİSTESİ = [
  'Türkçe', 'Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler', 'İngilizce',
  'Seçmeli Yabancı Dil',
  'Din Kültürü ve Ahlak Bilgisi', 'Görsel Sanatlar', 'Müzik',
  'Beden Eğitimi ve Spor', 'Bilişim Teknolojileri', 'Teknoloji ve Tasarım',
  'Trafik Güvenliği', 'Türk Dili ve Edebiyatı', 'Tarih', 'Coğrafya',
  'Fizik', 'Kimya', 'Biyoloji',
]

function rolEtiketi(k, kurumlar) {
  if (k.rol === 'platform_admin') return { etiket: 'Platform Admin', renk: '#7C3AED', bg: '#EDE9FE' }
  if (k.rol === 'ogretmen')       return { etiket: 'Öğretmen',       renk: '#065F46', bg: '#D1FAE5' }
  if (k.rol === 'kurum_admin') {
    const kurum = kurumlar.find(x => x.id === k.kurumId)
    if (kurum?.tip === 'kampus')   return { etiket: 'Kampüs Admin', renk: '#0369A1', bg: '#E0F2FE' }
    if (kurum?.tip === 'altKurum') return { etiket: 'Okul Admin',   renk: '#0369A1', bg: '#DBEAFE' }
    return { etiket: 'Kurum Admin', renk: '#0369A1', bg: '#E0F2FE' }
  }
  return { etiket: k.rol || '—', renk: '#374151', bg: '#F1F5F9' }
}

const BOŞ_FORM = {
  email: '', ad: '', rol: 'kurum_admin', kurumId: '',
  rubrikOlustur: false, branslar: [], sinifAtamalari: [],
}

export default function PlatformKullanicilar() {
  const { profil, kullanici } = useAuth()
  const [kullanicilar, setKullanicilar] = useState([])
  const [bekleyenler, setBekleyenler]   = useState([])
  const [kurumlar, setKurumlar]         = useState([])
  const [filtre, setFiltre]             = useState('')
  const [modal, setModal]               = useState(false)
  const [duzenlenen, setDuzenlenen]     = useState(null)
  const [form, setForm]                 = useState(BOŞ_FORM)
  const [kaydediyor, setKaydediyor]     = useState(false)
  const [hata, setHata]                 = useState('')
  const [basari, setBasari]             = useState('')
  const [sekme, setSekme]               = useState('aktif') // 'aktif' | 'bekleyen'
  const [acikGruplar, setAcikGruplar]   = useState(new Set())
  const [kurumSiniflar, setKurumSiniflar] = useState({}) // { [kurumId]: [siniflar] }
  const [openMenuId, setOpenMenuId]   = useState(null)

  function toggleGrup(id) {
    setAcikGruplar(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Kurum hiyerarşisi (platform geneli)
  const altKurumlar = kurumlar
    .filter(k => k.parentId && kurumlar.find(x => x.id === k.parentId)?.parentId)
    .sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
  const kampusKurumlar = kurumlar
    .filter(k => k.parentId && !kurumlar.find(x => x.id === k.parentId)?.parentId)
    .sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))

  // Sınıfları lazy yükle
  async function sinifYukle(kid) {
    if (!kid || kurumSiniflar[kid] !== undefined) return
    try {
      const snap = await getDocs(collection(db, 'kurumlar', kid, 'siniflar'))
      const liste = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (Number(a.seviye) || 0) - (Number(b.seviye) || 0) || (a.sube || '').localeCompare(b.sube || '', 'tr'))
      setKurumSiniflar(prev => ({ ...prev, [kid]: liste }))
    } catch {
      setKurumSiniflar(prev => ({ ...prev, [kid]: [] }))
    }
  }

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

  useEffect(() => {
    const q1 = query(collection(db, 'kullanicilar'), orderBy('email'))
    const q2 = query(collection(db, 'kurumlar'), orderBy('ad'))
    const q3 = query(collection(db, 'yetkiliKullanicilar'), orderBy('olusturmaTarihi', 'desc'))
    const u1 = onSnapshot(q1, snap => setKullanicilar(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const u2 = onSnapshot(q2, snap => setKurumlar(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const u3 = onSnapshot(q3, snap => setBekleyenler(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    return () => { u1(); u2(); u3() }
  }, [])

  const aktifListe = kullanicilar.filter(k =>
    k.email?.toLowerCase().includes(filtre.toLowerCase()) ||
    k.ad?.toLowerCase().includes(filtre.toLowerCase())
  )

  // Kullanıcının root kurumunu bul
  function rootKurumId(k) {
    if (!k.kurumId) return null
    const kurum = kurumlar.find(x => x.id === k.kurumId)
    if (!kurum) return null
    return kurum.rootKurumId || k.kurumId
  }

  // Aktif listeyi gruplara ayır: platform → root kurumlara göre → diğer
  const rootKurumlar = kurumlar.filter(k => !k.parentId)
    .sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))

  const aktifGruplar = [
    // Platform adminler
    { id: '__platform__', ad: 'Platform', ikon: '⚙️',
      kullanicilar: aktifListe.filter(k => k.rol === 'platform_admin') },
    // Her root kurum
    ...rootKurumlar.map(root => ({
      id: root.id, ad: root.ad, ikon: '🏛',
      kullanicilar: aktifListe.filter(k => rootKurumId(k) === root.id),
    })),
    // Eşleşmeyen (kurumId var ama kurumlar listesinde yok)
    { id: '__diger__', ad: 'Diğer', ikon: '❓',
      kullanicilar: aktifListe.filter(k =>
        k.rol !== 'platform_admin' && k.kurumId && !kurumlar.find(x => x.id === k.kurumId)
      ),
    },
  ].filter(g => g.kullanicilar.length > 0)

  const bekleyenListe = bekleyenler.filter(k =>
    k.email?.toLowerCase().includes(filtre.toLowerCase())
  )

  function yeniModalAc() {
    setDuzenlenen(null)
    setForm(BOŞ_FORM)
    setHata('')
    setBasari('')
    setModal(true)
  }

  function duzenleModalAc(k) {
    setDuzenlenen(k)
    const ilkAtamalar = k.sinifAtamalari || []
    setForm({
      ad: k.ad || '', email: k.email, rol: k.rol || 'ogretmen',
      kurumId: k.kurumId || '',
      rubrikOlustur: k.modulIzinler?.rubrik_olustur || false,
      branslar: k.branslar || [],
      sinifAtamalari: ilkAtamalar,
    })
    ilkAtamalar.forEach(a => sinifYukle(a.kurumId))
    // Global profil → eksik alanları tamamla
    getDoc(doc(db, 'kullanicilar', k.id)).then(snap => {
      if (!snap.exists()) return
      const tam = snap.data()
      const atamalar = tam.sinifAtamalari || ilkAtamalar
      setForm(f => ({
        ...f,
        rubrikOlustur: tam.modulIzinler?.rubrik_olustur || false,
        branslar: tam.branslar || [],
        sinifAtamalari: atamalar,
      }))
      atamalar.forEach(a => sinifYukle(a.kurumId))
    })
    setHata('')
    setBasari('')
    setModal(true)
  }

  function modalKapat() { setModal(false); setDuzenlenen(null); setForm(BOŞ_FORM) }

  async function kaydet(e) {
    e.preventDefault()
    if (!form.email.trim()) { setHata('E-posta zorunludur.'); return }
    if ((form.rol === 'kurum_admin' || form.rol === 'ogretmen') && !form.kurumId) {
      setHata('Bu rol için kurum seçimi zorunludur.'); return
    }
    setKaydediyor(true)
    setHata('')

    // Öğretmen ek alanları
    const atamalari = form.sinifAtamalari || []
    const parentKurumIdler = form.rol === 'ogretmen'
      ? [...new Set(atamalari.map(a => {
          const k = kurumlar.find(x => x.id === a.kurumId)
          return k?.parentId
        }).filter(Boolean))]
      : []
    const ogretmenEkstra = form.rol === 'ogretmen' ? {
      modulIzinler:     { ...(duzenlenen?.modulIzinler || {}), rubrik_olustur: form.rubrikOlustur || false },
      sinifAtamalari:   atamalari,
      sinifIdler:       [...new Set(atamalari.flatMap(a => a.siniflar || []))],
      erisimKurumIdler: [...new Set(atamalari.map(a => a.kurumId).filter(Boolean))],
      parentKurumIdler,
      branslar:         form.branslar || [],
    } : {
      modulIzinler: {}, sinifAtamalari: [], sinifIdler: [],
      erisimKurumIdler: [], parentKurumIdler: [], branslar: [],
    }

    try {
      if (duzenlenen) {
        const uid = duzenlenen.id
        const eskiKurumId = duzenlenen.kurumId
        const yeniKurumId = form.kurumId || eskiKurumId

        const globalGuncelleme = { ad: form.ad, rol: form.rol, kurumId: yeniKurumId }
        if (form.rol === 'ogretmen') Object.assign(globalGuncelleme, ogretmenEkstra)
        await updateDoc(doc(db, 'kullanicilar', uid), globalGuncelleme)

        // Subcollection güncelle (kurum değiştiyse taşı)
        if (yeniKurumId) {
          if (eskiKurumId && yeniKurumId !== eskiKurumId) {
            const batch = writeBatch(db)
            batch.delete(doc(db, 'kurumlar', eskiKurumId, 'kullanicilar', uid))
            const subDoc = { ad: form.ad, email: duzenlenen.email, rol: form.rol, kurumId: yeniKurumId, durum: 'aktif' }
            if (form.rol === 'ogretmen') Object.assign(subDoc, ogretmenEkstra)
            batch.set(doc(db, 'kurumlar', yeniKurumId, 'kullanicilar', uid), subDoc)
            await batch.commit()
          } else {
            const subGuncelleme = { ad: form.ad, rol: form.rol }
            if (form.rol === 'ogretmen') Object.assign(subGuncelleme, ogretmenEkstra)
            await setDoc(doc(db, 'kurumlar', yeniKurumId, 'kullanicilar', uid), subGuncelleme, { merge: true })
          }
        }

        const detay = form.rol === 'ogretmen'
          ? `Öğretmen${form.rubrikOlustur ? ' · Koordinatör ✓' : ' · Koordinatör ✗'}${form.branslar?.length ? ' · ' + form.branslar.join(', ') : ''}`
          : form.rol === 'kurum_admin' ? 'Kurum Admin' : form.rol
        logKaydet({ profil, kullanici, islem: 'guncelle', modul: 'kullanicilar', hedefAd: form.ad || form.email, detay, kurumId: yeniKurumId })
        setBasari('Kullanıcı güncellendi.')
        setTimeout(modalKapat, 1200)
      } else {
        const secilenKurum = kurumlar.find(k => k.id === form.kurumId)
        const googleAltyapisi = !!secilenKurum?.googleAltyapisi
        await davetEt({ email: form.email.trim(), rol: form.rol, kurumId: form.kurumId || null, googleAltyapisi, ...ogretmenEkstra })
        logKaydet({ profil, kullanici, islem: 'davet', modul: 'kullanicilar', hedefAd: form.email.trim(), detay: form.rol, kurumId: form.kurumId })
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
    logKaydet({ profil, kullanici, islem: 'davetIptal', modul: 'kullanicilar', hedefAd: email })
  }

  const s = {
    th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    td: { padding: '1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    eylem: { background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 9px', fontSize: '0.75rem', cursor: 'pointer', color: '#374151' },
    alan: { display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' },
    etiket: { fontSize: '0.875rem', fontWeight: '500', color: '#374151' },
    girdi: { padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', color: '#1E293B' },
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .platform-actions-bar {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .filter-wrapper {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .search-input {
            width: 100% !important;
          }
          .add-user-btn {
            width: 100% !important;
          }
          .modal-box {
            max-height: 80vh !important;
            padding: 1.25rem !important;
          }
          .modal-field {
            margin-bottom: 0.75rem !important;
          }
          .modal-input {
            padding: 0.5rem 0.75rem !important;
            font-size: 0.85rem !important;
          }
          .modal-label {
            font-size: 0.8rem !important;
          }
          .table-wrapper {
            overflow: visible !important;
          }
          .desktop-only {
            display: none !important;
          }
          .mobile-only-cell {
            display: table-cell !important;
          }
          .mobile-only-flex {
            display: inline-flex !important;
          }
        }
      `}} />

      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Kullanıcılar</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Platform genelindeki tüm kullanıcılar</p>

      <div className="platform-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="filter-wrapper" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
          <input value={filtre} onChange={e => setFiltre(e.target.value)}
            placeholder="Ad veya e-posta ile ara..."
            className="search-input"
            style={{ padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', width: '240px', color: '#1E293B' }} />
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {['aktif', 'bekleyen'].map(s2 => (
              <button key={s2} onClick={() => setSekme(s2)}
                style={{ padding: '0.5rem 0.75rem', border: '1.5px solid', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                  borderColor: sekme === s2 ? '#1B3A6B' : '#E2E8F0',
                  background: sekme === s2 ? '#1B3A6B' : '#fff',
                  color: sekme === s2 ? '#fff' : '#64748B' }}>
                {s2 === 'aktif' ? `Aktif (${kullanicilar.length})` : `Bekleyen (${bekleyenler.length})`}
              </button>
            ))}
          </div>
        </div>
        <button onClick={yeniModalAc} className="add-user-btn" style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
          + Kullanıcı Davet Et
        </button>
      </div>

      <div className="table-wrapper" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {sekme === 'aktif' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={s.th}>Ad / Kullanıcı</th>
                <th style={s.th} className="desktop-only">E-posta</th>
                <th style={s.th} className="desktop-only">Rol</th>
                <th style={s.th} className="desktop-only">Kurum</th>
                <th style={s.th} className="desktop-only">Atamalar</th>
                <th style={s.th} className="desktop-only">İşlemler</th>
                <th style={{ display: 'none', ...s.th }} className="mobile-only-cell">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {aktifGruplar.length === 0 ? (
                <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Kullanıcı bulunamadı</td></tr>
              ) : aktifGruplar.map(grup => {
                const acik = acikGruplar.has(grup.id)
                return [
                  /* Grup başlığı */
                  <tr key={`grup-${grup.id}`}
                    onClick={() => toggleGrup(grup.id)}
                    style={{ cursor: 'pointer', background: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                    <td colSpan={6} className="desktop-only" style={{ padding: '0.6rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{acik ? '▼' : '▶'}</span>
                        <span style={{ fontSize: '0.75rem' }}>{grup.ikon}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {grup.ad}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: '400' }}>
                          ({grup.kullanicilar.length} kullanıcı)
                        </span>
                      </div>
                    </td>
                    <td colSpan={2} className="mobile-only-cell" style={{ display: 'none', padding: '0.6rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{acik ? '▼' : '▶'}</span>
                        <span style={{ fontSize: '0.75rem' }}>{grup.ikon}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {grup.ad}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: '400' }}>
                          ({grup.kullanicilar.length})
                        </span>
                      </div>
                    </td>
                  </tr>,
                  /* Grup kullanıcıları */
                  ...(!acik ? [] : grup.kullanicilar.map(k => {
                    const rol = rolEtiketi(k, kurumlar)
                    const kurum = kurumlar.find(x => x.id === k.kurumId)
                    const koordinator = k.rol === 'ogretmen' && k.modulIzinler?.rubrik_olustur
                    const toplamSinif = (k.sinifAtamalari || []).reduce((t, a) => t + (a.siniflar?.length || 0), 0)
                    return (
                      <tr key={k.id}>
                        <td style={{ ...s.td, paddingLeft: '2rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {k.photoURL ? (
                              <img
                                src={k.photoURL}
                                alt="Avatar"
                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #E2E8F0', flexShrink: 0 }}
                              />
                            ) : (
                              <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: '#E2E8F0', color: '#475569',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: '700', fontSize: '0.75rem', border: '1px solid #CBD5E1', flexShrink: 0
                              }}>
                                {(() => {
                                  const name = k.ad || k.email || '?';
                                  const parts = name.split(' ');
                                  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                                  return name[0].toUpperCase();
                                })()}
                              </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong style={{ color: '#1B3A6B' }}>{k.ad || '—'}</strong>
                              {/* Mobil Meta Bilgileri Alt Satırı */}
                              <div className="mobile-only-flex" style={{ display: 'none', fontSize: '0.7rem', color: '#64748B', marginTop: '4px', gap: '4px', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <span style={{ wordBreak: 'break-all' }}>{k.email}</span>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                  <span style={{ padding: '1px 8px', borderRadius: '999px', fontSize: '0.62rem', fontWeight: '700', background: rol.bg, color: rol.renk }}>
                                    {rol.etiket}
                                  </span>
                                  {koordinator && (
                                    <span style={{ padding: '1px 8px', borderRadius: '999px', fontSize: '0.62rem', fontWeight: '700', background: '#FEF3C7', color: '#92400E' }}>
                                      Koordinatör
                                    </span>
                                  )}
                                  {k.rol === 'ogretmen' && toplamSinif > 0 && (
                                    <span style={{ padding: '1px 8px', borderRadius: '999px', fontSize: '0.62rem', fontWeight: '700', background: '#DBEAFE', color: '#1E40AF' }}>
                                      {toplamSinif} sınıf
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: '2px' }}>
                                  🏢 {kurum?.ad || (k.kurumId ? k.kurumId : 'Atanmamış')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={s.td} className="desktop-only">{k.email}</td>
                        <td style={s.td} className="desktop-only">
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '600', background: rol.bg, color: rol.renk }}>
                              {rol.etiket}
                            </span>
                            {koordinator && (
                              <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '600', background: '#FEF3C7', color: '#92400E' }}>
                                Koordinatör
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="desktop-only" style={{ ...s.td, color: kurum ? '#1E293B' : '#94A3B8', fontSize: '0.82rem' }}>
                          {kurum?.ad || (k.kurumId ? k.kurumId : '— Atanmamış')}
                        </td>
                        <td style={s.td} className="desktop-only">
                          {k.rol === 'ogretmen' && toplamSinif > 0
                            ? <span style={{ fontSize: '0.75rem', color: '#1B3A6B', fontWeight: '600' }}>{toplamSinif} sınıf</span>
                            : <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>—</span>}
                        </td>
                        <td style={s.td} className="desktop-only">
                          <button style={s.eylem} onClick={() => duzenleModalAc(k)}>Düzenle</button>
                        </td>
                        {/* İşlemler - Mobil Dropdown Menu */}
                        <td style={{ ...s.td, display: 'none', verticalAlign: 'middle', textAlign: 'center' }} className="mobile-only-cell">
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              onClick={() => setOpenMenuId(openMenuId === k.id ? null : k.id)}
                              style={{
                                background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px',
                                padding: '6px 12px', fontSize: '1rem', cursor: 'pointer', color: '#475569',
                                fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              }}
                            >
                              ⋮
                            </button>
                            {openMenuId === k.id && (
                              <>
                                <div 
                                  onClick={() => setOpenMenuId(null)}
                                  style={{ position: 'fixed', inset: 0, zIndex: 9998 }} 
                                />
                                <div style={{
                                  position: 'absolute', right: 0, bottom: '100%', marginBottom: '6px',
                                  backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px',
                                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                  zIndex: 9999, minWidth: '130px', padding: '4px', display: 'flex', flexDirection: 'column'
                                }}>
                                  <button
                                    onClick={() => { setOpenMenuId(null); duzenleModalAc(k); }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', border: 'none', background: 'none', fontSize: '0.825rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left', borderRadius: '6px', color: '#1E293B' }}
                                  >
                                    <span>✏️</span> Düzenle
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })),
                ]
              })}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={s.th}>E-posta / Kullanıcı</th>
                <th style={s.th} className="desktop-only">Rol</th>
                <th style={s.th} className="desktop-only">Kurum</th>
                <th style={s.th} className="desktop-only">Giriş Yöntemi</th>
                <th style={s.th} className="desktop-only">İşlemler</th>
                <th style={{ display: 'none', ...s.th }} className="mobile-only-cell">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {bekleyenListe.length === 0 ? (
                <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Bekleyen davet yok</td></tr>
              ) : bekleyenListe.map(k => {
                const rol = rolEtiketi(k, kurumlar)
                const kurum = kurumlar.find(x => x.id === k.kurumId)
                return (
                  <tr key={k.id}>
                    <td style={s.td}>
                      <div>
                        <strong style={{ wordBreak: 'break-all', display: 'block' }}>{k.email}</strong>
                        <div className="mobile-only-flex" style={{ display: 'none', fontSize: '0.7rem', color: '#64748B', marginTop: '4px', gap: '6px', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <span style={{ padding: '1px 8px', borderRadius: '999px', fontSize: '0.62rem', fontWeight: '700', background: rol.bg, color: rol.renk }}>
                              {rol.etiket}
                            </span>
                            <span style={{ padding: '1px 8px', borderRadius: '999px', fontSize: '0.62rem', fontWeight: '700', background: '#F1F5F9', color: k.googleAltyapisi ? '#1557B0' : '#475569' }}>
                              {k.googleAltyapisi ? 'Google' : 'E-posta'}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: '2px' }}>
                            🏢 {kurum?.ad || (k.kurumId ? k.kurumId : 'Atanmamış')}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={s.td} className="desktop-only">
                      <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', background: rol.bg, color: rol.renk }}>
                        {rol.etiket}
                      </span>
                    </td>
                    <td className="desktop-only" style={{ ...s.td, color: kurum ? '#1E293B' : '#94A3B8' }}>
                      {kurum?.ad || (k.kurumId ? k.kurumId : '— Atanmamış')}
                    </td>
                    <td style={s.td} className="desktop-only">
                      <span style={{ fontSize: '0.75rem', color: k.googleAltyapisi ? '#1557B0' : '#374151' }}>
                        {k.googleAltyapisi ? 'Google' : 'E-posta / Şifre'}
                      </span>
                    </td>
                    <td style={s.td} className="desktop-only">
                      <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => davetSil(k.email)}>
                        İptal Et
                      </button>
                    </td>
                    {/* İşlemler - Mobil Dropdown Menu */}
                    <td style={{ ...s.td, display: 'none', verticalAlign: 'middle', textAlign: 'center' }} className="mobile-only-cell">
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === k.id ? null : k.id)}
                          style={{
                            background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px',
                            padding: '6px 12px', fontSize: '1rem', cursor: 'pointer', color: '#475569',
                            fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                        >
                          ⋮
                        </button>
                        {openMenuId === k.id && (
                          <>
                            <div 
                              onClick={() => setOpenMenuId(null)}
                              style={{ position: 'fixed', inset: 0, zIndex: 9998 }} 
                            />
                            <div style={{
                              position: 'absolute', right: 0, bottom: '100%', marginBottom: '6px',
                              backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px',
                              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                              zIndex: 9999, minWidth: '130px', padding: '4px', display: 'flex', flexDirection: 'column'
                            }}>
                              <button
                                onClick={() => { setOpenMenuId(null); davetSil(k.email); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', border: 'none', background: 'none', fontSize: '0.825rem', fontWeight: '700', cursor: 'pointer', textAlign: 'left', borderRadius: '6px', color: '#991B1B' }}
                              >
                                <span>🗑️</span> İptal Et
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && modalKapat()}>
          <div className="modal-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: form.rol === 'ogretmen' ? '580px' : '480px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.5rem' }}>
              {duzenlenen ? 'Kullanıcıyı Düzenle' : 'Kullanıcı Davet Et'}
            </h2>
            {!duzenlenen && (
              <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1.25rem' }}>
                Kullanıcıya e-posta gönderilecek. Kurumun Google altyapısı varsa Google ile, yoksa şifre belirleme linki ile giriş yapacak.
              </p>
            )}
            <form onSubmit={kaydet}>
              {duzenlenen && (
                <div className="modal-field" style={s.alan}>
                  <label className="modal-label" style={s.etiket}>Ad Soyad</label>
                  <input className="modal-input" style={s.girdi} value={form.ad || ''} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} autoFocus />
                </div>
              )}
              <div className="modal-field" style={s.alan}>
                <label className="modal-label" style={s.etiket}>E-posta *</label>
                <input className="modal-input" style={s.girdi} type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  disabled={!!duzenlenen} autoFocus={!duzenlenen} />
              </div>
              <div className="modal-field" style={s.alan}>
                <label className="modal-label" style={s.etiket}>Rol</label>
                <select className="modal-input" style={s.girdi} value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value, kurumId: '', sinifAtamalari: [], branslar: [], rubrikOlustur: false }))}>
                  <option value="platform_admin">Platform Admin</option>
                  <option value="kurum_admin">Kurum Admin</option>
                  <option value="ogretmen">Öğretmen</option>
                </select>
              </div>
              {(form.rol === 'kurum_admin' || form.rol === 'ogretmen') && (
                <div className="modal-field" style={s.alan}>
                  <label className="modal-label" style={s.etiket}>Kurum *</label>
                  <KurumSecici value={form.kurumId} onChange={v => setForm(f => ({ ...f, kurumId: v }))} kurumlar={kurumlar} style={s.girdi} />
                </div>
              )}

              {/* ── Öğretmen Alanları ── */}
              {form.rol === 'ogretmen' && (
                <>
                  {/* Koordinatör */}
                  <div style={{ ...s.alan, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.rubrikOlustur}
                        onChange={e => setForm(f => ({ ...f, rubrikOlustur: e.target.checked }))}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400E' }}>Koordinatör / Zümre Başkanı</span>
                    </label>
                    <span style={{ fontSize: '0.75rem', color: '#B45309', marginLeft: '1.5rem' }}>✓ Rubrik oluşturabilir ve düzenleyebilir</span>
                  </div>

                  {/* Branşlar */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                      Branşlar
                      <span style={{ fontSize: '0.75rem', fontWeight: '400', color: '#94A3B8', marginLeft: '0.5rem' }}>
                        Öğretmenin göreceği rubrikler branşa göre filtrelenir
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {DERS_LİSTESİ.map(ders => {
                        const secili = (form.branslar || []).includes(ders)
                        return (
                          <button type="button" key={ders}
                            onClick={() => setForm(f => ({
                              ...f,
                              branslar: secili
                                ? (f.branslar || []).filter(b => b !== ders)
                                : [...(f.branslar || []), ders],
                            }))}
                            style={{
                              padding: '4px 12px', borderRadius: '999px', border: '1.5px solid',
                              borderColor: secili ? '#1B3A6B' : '#E2E8F0',
                              background:  secili ? '#1B3A6B' : '#fff',
                              color:       secili ? '#fff' : '#64748B',
                              fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer',
                            }}>
                            {ders}
                          </button>
                        )
                      })}
                    </div>
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
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem', alignItems: 'center' }}>
                            <select value={atama.kurumId}
                              onChange={e => atamaKurumDegistir(idx, e.target.value)}
                              style={{ ...s.girdi, flex: 1, minWidth: 0, fontSize: '0.85rem' }}>
                              <option value="">— Okul / Kurum seçin —</option>
                              {altKurumlar.map(k => {
                                const kampus = kurumlar.find(x => x.id === k.parentId)
                                return (
                                  <option key={k.id} value={k.id}>
                                    {kampus ? `${kampus.ad} · ` : ''}{k.ad}
                                  </option>
                                )
                              })}
                            </select>
                            <button type="button" onClick={() => atamaKaldir(idx)}
                              style={{ padding: '5px 10px', background: 'none', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                              Kaldır
                            </button>
                          </div>
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
                                          fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
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

              {basari && <p style={{ fontSize: '0.875rem', color: '#065F46', background: '#D1FAE5', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>{basari}</p>}
              {hata && <p style={{ fontSize: '0.875rem', color: '#991B1B', background: '#FEE2E2', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>{hata}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={modalKapat} style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>İptal</button>
                <button type="submit" disabled={kaydediyor} style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
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
