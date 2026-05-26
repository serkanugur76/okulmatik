import { useEffect, useState, useMemo } from 'react'
import {
  collection, onSnapshot, doc, setDoc, deleteDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { logKaydet } from '../../services/logService'

// ── Likert Kriterleri ─────────────────────────────────────────────────────────
const KRITERLER = [
  { id: 'odevSorumlulugu',      ad: 'Ödev Sorumluluğu',       ikon: '📚',
    secenekler: [{ d:4, e:'Her Zaman' },{ d:3, e:'Çoğunlukla' },{ d:2, e:'Bazen' },{ d:1, e:'Nadiren' }] },
  { id: 'denemeSinaviBasarisi', ad: 'Deneme Sınavı Başarısı', ikon: '📝',
    secenekler: [{ d:4, e:'Çok İyi' },{ d:3, e:'İyi' },{ d:2, e:'Gelişiyor' },{ d:1, e:'Başlangıç' }] },
  { id: 'devamsizlik',          ad: 'Devamsızlık',            ikon: '📅',
    secenekler: [{ d:4, e:'Yok / Çok Az' },{ d:3, e:'Az' },{ d:2, e:'Orta' },{ d:1, e:'Fazla' }] },
  { id: 'davranis',             ad: 'Davranış',               ikon: '🤝',
    secenekler: [{ d:4, e:'Mükemmel' },{ d:3, e:'İyi' },{ d:2, e:'Gelişiyor' },{ d:1, e:'Dikkat Gerekiyor' }] },
  { id: 'dersKatilimi',         ad: 'Derse Katılım',          ikon: '✋',
    secenekler: [{ d:4, e:'Çok Aktif' },{ d:3, e:'Aktif' },{ d:2, e:'Pasif' },{ d:1, e:'Çok Pasif' }] },
  { id: 'sosyalUyum',           ad: 'Sosyal Uyum',            ikon: '👥',
    secenekler: [{ d:4, e:'Çok İyi' },{ d:3, e:'İyi' },{ d:2, e:'Gelişiyor' },{ d:1, e:'Zayıf' }] },
]

const PUAN_STIL = {
  4: { bg: '#D1FAE5', renk: '#065F46' },
  3: { bg: '#DBEAFE', renk: '#1E40AF' },
  2: { bg: '#FEF3C7', renk: '#92400E' },
  1: { bg: '#FEE2E2', renk: '#991B1B' },
}

function ortHesapla(rapor) {
  if (!rapor) return null
  const degerler = KRITERLER.map(k => rapor[k.id]).filter(v => v > 0)
  if (!degerler.length) return null
  return degerler.reduce((a, b) => a + b, 0) / degerler.length
}

function OrtBadge({ ort }) {
  if (ort == null) return <span style={{ color: '#CBD5E1', fontSize: '0.82rem' }}>—</span>
  const n = parseFloat(ort)
  const st = n >= 3.5 ? PUAN_STIL[4] : n >= 2.5 ? PUAN_STIL[3] : n >= 1.5 ? PUAN_STIL[2] : PUAN_STIL[1]
  return (
    <span style={{ ...st, padding: '2px 10px', borderRadius: '6px', fontWeight: '700', fontSize: '0.82rem' }}>
      {n.toFixed(2)}
    </span>
  )
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function KurumMentor() {
  const { profil } = useAuth()
  const { secilenKurumId, ogretmenModu, erisimKurumlar } = useKurumYonetim()

  // ── Veri ──────────────────────────────────────────────────
  const [atamalar,    setAtamalar]    = useState([])
  const [raporlar,    setRaporlar]    = useState([])
  const [ogretmenler, setOgretmenler] = useState([])
  const [ogrenciler,  setOgrenciler]  = useState([])
  const [siniflar,    setSiniflar]    = useState([])

  // ── UI ────────────────────────────────────────────────────
  const [sekme,      setSekme]      = useState('atamalar')
  const [donem,      setDonem]      = useState(1)
  const [acikOgret,  setAcikOgret]  = useState(new Set()) // genişletilmiş öğretmen kartları

  // Atama modal (admin)
  const [atamaModal,  setAtamaModal]  = useState(false)
  const [atamaForm,   setAtamaForm]   = useState({ ogretmenId: '', ogrenciIds: [] })
  const [atamaKayded, setAtamaKayded] = useState(false)
  const [atamaHata,   setAtamaHata]   = useState('')
  const [sinifFiltre, setSinifFiltre] = useState('')

  // Değerlendirme modal
  const [degModal,  setDegModal]  = useState(null)  // ogrenci nesnesi
  const [degForm,   setDegForm]   = useState({})
  const [degKayded, setDegKayded] = useState(false)
  const [degHata,   setDegHata]   = useState('')

  const hedefKurumId = secilenKurumId

  useEffect(() => {
    if (!hedefKurumId) return
    const unsubs = [
      onSnapshot(collection(db, 'kurumlar', hedefKurumId, 'mentorAtamalari'),
        snap => setAtamalar(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'kurumlar', hedefKurumId, 'mentorRaporlari'),
        snap => setRaporlar(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, 'kurumlar', hedefKurumId, 'ogrenciler'), orderBy('soyad')),
        snap => setOgrenciler(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'kurumlar', hedefKurumId, 'siniflar'),
        snap => setSiniflar(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (Number(a.seviye)||0) - (Number(b.seviye)||0) || (a.sube||'').localeCompare(b.sube||'', 'tr')))),
    ]
    return () => unsubs.forEach(u => u())
  }, [hedefKurumId])

  // Öğretmenler: hiyerarşideki tüm kurumlardan yükle (root/kampüs/altKurum)
  // Çünkü öğretmenin kurumId'si farklı bir seviyede olabilir
  useEffect(() => {
    if (!erisimKurumlar.length) return
    const allIds = erisimKurumlar.map(k => k.id)
    const parcalar = {}
    const unsubs = allIds.map(kid => {
      const q = query(collection(db, 'kurumlar', kid, 'kullanicilar'), orderBy('ad'))
      return onSnapshot(q, snap => {
        parcalar[kid] = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(k => k.rol === 'ogretmen')
        const hepsi = [...new Map(
          Object.values(parcalar).flat().map(k => [k.id, k])
        ).values()].sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
        setOgretmenler(hepsi)
      })
    })
    return () => unsubs.forEach(u => u())
  }, [erisimKurumlar.map(k => k.id).join(',')]) // eslint-disable-line

  // ── Türetilmiş ────────────────────────────────────────────
  const benimAtamam      = ogretmenModu ? atamalar.find(a => a.ogretmenId === profil?.uid) : null
  const benimOgrencilerim = benimAtamam?.ogrenciler || []

  const raporIndex = useMemo(() => {
    const idx = {}
    raporlar.forEach(r => { idx[`${r.ogrenciId}_d${r.donem}`] = r })
    return idx
  }, [raporlar])

  // Sınıfa göre gruplu öğrenci listesi (atama modalı için)
  const sinifaGoreOgrenciler = useMemo(() => {
    const gruplar = {}
    ogrenciler.forEach(o => {
      const key = o.sinifId || '__atamasiz__'
      if (!gruplar[key]) gruplar[key] = []
      gruplar[key].push(o)
    })
    return gruplar
  }, [ogrenciler])

  // ── Atama İşlemleri ───────────────────────────────────────
  function atamaModalAc(mevcut = null) {
    setAtamaForm({
      ogretmenId: mevcut?.ogretmenId || '',
      ogrenciIds: (mevcut?.ogrenciler || []).map(o => o.id),
    })
    setSinifFiltre('')
    setAtamaHata('')
    setAtamaModal(true)
  }

  async function atamaKaydet(e) {
    e.preventDefault()
    if (!atamaForm.ogretmenId) { setAtamaHata('Öğretmen seçiniz.'); return }
    if (!atamaForm.ogrenciIds.length) { setAtamaHata('En az bir öğrenci seçiniz.'); return }
    setAtamaKayded(true)
    try {
      const ogretmen = ogretmenler.find(o => o.id === atamaForm.ogretmenId)
      const secilenOgr = ogrenciler
        .filter(o => atamaForm.ogrenciIds.includes(o.id))
        .map(o => ({
          id: o.id, ad: o.ad || '', soyad: o.soyad || '',
          sinifId: o.sinifId || '',
          sinifAd: siniflar.find(s => s.id === o.sinifId)?.ad || '',
        }))
      await setDoc(doc(db, 'kurumlar', hedefKurumId, 'mentorAtamalari', atamaForm.ogretmenId), {
        ogretmenId: atamaForm.ogretmenId,
        ogretmenAd: ogretmen?.ad || '',
        ogrenciler: secilenOgr,
        kurumId: hedefKurumId,
        guncellenmeTarihi: serverTimestamp(),
      })
      logKaydet({ profil, islem: 'guncelle', modul: 'mentor', hedefAd: ogretmen?.ad || '', kurumId: hedefKurumId, detay: `${secilenOgr.length} öğrenci atandı` })
      setAtamaModal(false)
    } catch (err) { setAtamaHata(err.message) }
    finally { setAtamaKayded(false) }
  }

  async function atamaKaldir(ogretmenId, ogretmenAd) {
    if (!confirm(`${ogretmenAd} öğretmeninin tüm mentor atamalarını kaldırmak istediğinize emin misiniz?`)) return
    await deleteDoc(doc(db, 'kurumlar', hedefKurumId, 'mentorAtamalari', ogretmenId))
    logKaydet({ profil, islem: 'sil', modul: 'mentor', hedefAd: ogretmenAd, kurumId: hedefKurumId, detay: 'atama silindi' })
  }

  // ── Değerlendirme İşlemleri ───────────────────────────────
  function degModalAc(ogrenci) {
    const mevcutRapor = raporIndex[`${ogrenci.id}_d${donem}`]
    const form = { yorum: mevcutRapor?.yorum || '' }
    KRITERLER.forEach(k => { form[k.id] = mevcutRapor?.[k.id] || null })
    setDegForm(form)
    setDegModal(ogrenci)
    setDegHata('')
  }

  async function degKaydet(e) {
    e.preventDefault()
    const eksik = KRITERLER.filter(k => !degForm[k.id])
    if (eksik.length) { setDegHata(`Lütfen tüm kriterleri doldurun: ${eksik.map(k => k.ad).join(', ')}`); return }
    setDegKayded(true)
    try {
      const o = degModal
      const sinif = siniflar.find(s => s.id === o.sinifId)
      const veri = {
        ogrenciId: o.id, ogrenciAd: o.ad || '', ogrenciSoyad: o.soyad || '',
        sinifId: o.sinifId || '', sinifAd: sinif?.ad || o.sinifAd || '',
        donem,
        mentorOgretmenId: profil?.uid || '', mentorOgretmenAd: profil?.ad || '',
        yorum: degForm.yorum || '',
        degerlendiriciId: profil?.uid || '', degerlendiriciAd: profil?.ad || profil?.email || '',
        guncellenmeTarihi: serverTimestamp(),
      }
      KRITERLER.forEach(k => { veri[k.id] = degForm[k.id] })
      await setDoc(doc(db, 'kurumlar', hedefKurumId, 'mentorRaporlari', `${o.id}_d${donem}`), veri)
      logKaydet({ profil, islem: 'guncelle', modul: 'mentor', hedefAd: `${o.ad} ${o.soyad}`, kurumId: hedefKurumId, detay: `Dönem ${donem} raporu` })
      setDegModal(null)
    } catch (err) { setDegHata(err.message) }
    finally { setDegKayded(false) }
  }

  // ── Ortak Stiller ─────────────────────────────────────────
  const s = {
    th:     { padding:'0.75rem 1rem', textAlign:'left', fontSize:'0.75rem', fontWeight:'600', color:'#64748B', textTransform:'uppercase', letterSpacing:'0.05em', background:'#F8FAFC', borderBottom:'1px solid #E2E8F0' },
    td:     { padding:'0.875rem 1rem', fontSize:'0.875rem', color:'#1E293B', borderBottom:'1px solid #F1F5F9' },
    alan:   { display:'flex', flexDirection:'column', gap:'0.375rem', marginBottom:'1rem' },
    etiket: { fontSize:'0.875rem', fontWeight:'500', color:'#374151' },
    girdi:  { padding:'0.6rem 0.875rem', border:'1.5px solid #E2E8F0', borderRadius:'8px', fontSize:'0.9rem', color:'#1E293B' },
    btn:    (aktif) => ({ padding:'0.5rem 1.25rem', border:'1.5px solid', borderRadius:'8px', fontSize:'0.8rem', fontWeight:'600', cursor:'pointer', borderColor: aktif ? '#1B3A6B' : '#E2E8F0', background: aktif ? '#1B3A6B' : '#fff', color: aktif ? '#fff' : '#64748B' }),
  }

  // ── Değerlendirme Modalı (ortak: hem admin hem öğretmen) ──
  const degModalJSX = degModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:200, overflowY:'auto', padding:'2rem 1rem' }}
      onClick={e => e.target === e.currentTarget && setDegModal(null)}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'2rem', width:'100%', maxWidth:'600px', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }}>

        {/* Başlık */}
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem', paddingBottom:'1rem', borderBottom:'1px solid #F1F5F9' }}>
          <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:'linear-gradient(135deg,#6366F1,#4338CA)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', color:'#fff', flexShrink:0 }}>
            {degModal.ad?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontWeight:'700', fontSize:'1rem', color:'#1E293B' }}>{degModal.ad} {degModal.soyad}</div>
            <div style={{ fontSize:'0.8rem', color:'#64748B' }}>
              {siniflar.find(s => s.id === degModal.sinifId)?.ad || degModal.sinifAd || '—'}
            </div>
          </div>
          {/* Dönem seçici */}
          <div style={{ marginLeft:'auto', display:'flex', gap:'0.5rem' }}>
            {[1,2].map(d => (
              <button key={d} type="button" onClick={() => { setDonem(d); degModalAc(degModal) }}
                style={s.btn(donem === d)}>
                {d}. Dönem
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={degKaydet}>
          {/* Likert Kriterleri */}
          {KRITERLER.map(kriter => (
            <div key={kriter.id} style={{ marginBottom:'1.25rem' }}>
              <div style={{ fontSize:'0.875rem', fontWeight:'600', color:'#374151', marginBottom:'0.5rem' }}>
                {kriter.ikon} {kriter.ad}
              </div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {kriter.secenekler.map(({ d, e }) => {
                  const secili = degForm[kriter.id] === d
                  const stil = PUAN_STIL[d]
                  return (
                    <button type="button" key={d}
                      onClick={() => setDegForm(f => ({ ...f, [kriter.id]: d }))}
                      style={{
                        padding:'6px 14px', borderRadius:'999px', border:'2px solid',
                        borderColor: secili ? stil.renk : '#E2E8F0',
                        background:  secili ? stil.bg : '#fff',
                        color:       secili ? stil.renk : '#64748B',
                        fontSize:'0.8rem', fontWeight: secili ? '700' : '500', cursor:'pointer',
                        transition:'all 0.1s',
                      }}>
                      {e}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Mentor Yorumu */}
          <div style={s.alan}>
            <label style={s.etiket}>💬 Mentor Öğretmen Yorumu</label>
            <textarea
              value={degForm.yorum}
              onChange={e => setDegForm(f => ({ ...f, yorum: e.target.value }))}
              placeholder="Öğrenci hakkında gözlem ve değerlendirmenizi yazınız..."
              rows={4}
              style={{ ...s.girdi, resize:'vertical', lineHeight:'1.5' }}
            />
          </div>

          {degHata && <p style={{ fontSize:'0.875rem', color:'#991B1B', background:'#FEE2E2', borderRadius:'6px', padding:'0.5rem 0.75rem', marginBottom:'1rem' }}>{degHata}</p>}

          <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
            <button type="button" onClick={() => setDegModal(null)}
              style={{ padding:'0.6rem 1.25rem', background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:'8px', fontSize:'0.875rem', cursor:'pointer', color:'#374151' }}>
              İptal
            </button>
            <button type="submit" disabled={degKayded}
              style={{ padding:'0.6rem 1.5rem', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:'8px', fontSize:'0.875rem', fontWeight:'600', cursor:'pointer' }}>
              {degKayded ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  // ── ÖĞRETMEN MODU ─────────────────────────────────────────
  if (ogretmenModu) {
    const tamamlananlar = benimOgrencilerim.filter(o => raporIndex[`${o.id}_d${donem}`])
    const eksikler      = benimOgrencilerim.filter(o => !raporIndex[`${o.id}_d${donem}`])

    return (
      <div>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <h1 style={{ fontSize:'1.5rem', fontWeight:'700', color:'#1E293B', marginBottom:'0.25rem' }}>Mentor Öğrencilerim</h1>
            <p style={{ color:'#64748B', fontSize:'0.9rem' }}>
              {benimOgrencilerim.length > 0
                ? `${benimOgrencilerim.length} öğrenci atanmış · ${tamamlananlar.length} değerlendirme tamamlandı`
                : 'Henüz öğrenci ataması yapılmamış'}
            </p>
          </div>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            {[1,2].map(d => (
              <button key={d} onClick={() => setDonem(d)} style={s.btn(donem === d)}>
                {d}. Dönem
              </button>
            ))}
          </div>
        </div>

        {benimOgrencilerim.length === 0 ? (
          <div style={{ textAlign:'center', padding:'4rem 2rem', background:'#fff', borderRadius:'12px', border:'1px solid #E2E8F0' }}>
            <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🎓</div>
            <p style={{ color:'#94A3B8', fontSize:'0.9rem' }}>Kurum yöneticiniz sizi henüz öğrencilerle eşleştirmemiş.</p>
          </div>
        ) : (
          <>
            {/* Değerlendirilmemiş öğrenciler */}
            {eksikler.length > 0 && (
              <div style={{ marginBottom:'2rem' }}>
                <div style={{ fontSize:'0.8rem', fontWeight:'700', color:'#92400E', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:'8px', padding:'0.5rem 1rem', marginBottom:'1rem', display:'inline-flex', alignItems:'center', gap:'0.5rem' }}>
                  ⏳ {eksikler.length} öğrencinin {donem}. dönem değerlendirmesi eksik
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:'0.75rem' }}>
                  {eksikler.map(o => (
                    <OgrenciKarti key={o.id} ogrenci={o} rapor={null} siniflar={siniflar} onClick={() => degModalAc(o)} />
                  ))}
                </div>
              </div>
            )}

            {/* Tamamlananlar */}
            {tamamlananlar.length > 0 && (
              <div>
                <div style={{ fontSize:'0.8rem', fontWeight:'700', color:'#065F46', background:'#D1FAE5', border:'1px solid #A7F3D0', borderRadius:'8px', padding:'0.5rem 1rem', marginBottom:'1rem', display:'inline-flex', alignItems:'center', gap:'0.5rem' }}>
                  ✓ {tamamlananlar.length} değerlendirme tamamlandı
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:'0.75rem' }}>
                  {tamamlananlar.map(o => (
                    <OgrenciKarti key={o.id} ogrenci={o} rapor={raporIndex[`${o.id}_d${donem}`]} siniflar={siniflar} onClick={() => degModalAc(o)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {degModalJSX}
      </div>
    )
  }

  // ── ADMİN MODU ────────────────────────────────────────────
  const toplamAtanan = atamalar.reduce((t, a) => t + (a.ogrenciler?.length || 0), 0)
  const toplamRapor  = raporlar.filter(r => r.donem === donem).length

  return (
    <div>
      {/* Başlık */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1 style={{ fontSize:'1.5rem', fontWeight:'700', color:'#1E293B', marginBottom:'0.25rem' }}>Mentor Modülü</h1>
          <p style={{ color:'#64748B', fontSize:'0.9rem' }}>Öğretmen-öğrenci mentor atamaları ve akademik takip</p>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          {[1,2].map(d => (
            <button key={d} onClick={() => setDonem(d)} style={s.btn(donem === d)}>
              {d}. Dönem
            </button>
          ))}
        </div>
      </div>

      {/* İstatistik Kartları */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'1rem', marginBottom:'2rem' }}>
        {[
          { etiket:'Mentor Öğretmen', deger: atamalar.length,  renk:'#4F46E5', bg:'#EEF2FF', ikon:'👨‍🏫' },
          { etiket:'Atanmış Öğrenci', deger: toplamAtanan,     renk:'#0369A1', bg:'#E0F2FE', ikon:'🎒' },
          { etiket:`${donem}. Dönem Rapor`, deger: toplamRapor, renk:'#065F46', bg:'#D1FAE5', ikon:'📋' },
          { etiket:'Tamamlanma',      deger: toplamAtanan > 0 ? `%${Math.round(toplamRapor/toplamAtanan*100)}` : '—', renk:'#92400E', bg:'#FEF3C7', ikon:'📊' },
        ].map(({ etiket, deger, renk, bg, ikon }) => (
          <div key={etiket} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:'10px', padding:'1rem' }}>
            <div style={{ fontSize:'1.2rem', marginBottom:'0.25rem' }}>{ikon}</div>
            <div style={{ fontSize:'1.6rem', fontWeight:'800', color:renk }}>{deger}</div>
            <div style={{ fontSize:'0.75rem', color:'#64748B', fontWeight:'500' }}>{etiket}</div>
          </div>
        ))}
      </div>

      {/* Sekmeler */}
      <div style={{ display:'flex', gap:'0', marginBottom:'0', borderBottom:'2px solid #E2E8F0' }}>
        {[
          { id:'atamalar',       label:'🔗 Mentor Atamaları' },
          { id:'degerlendirmeler', label:'📊 Değerlendirmeler' },
        ].map(t => (
          <button key={t.id} onClick={() => setSekme(t.id)}
            style={{ padding:'0.75rem 1.5rem', border:'none', borderBottom: sekme===t.id ? '2px solid #1B3A6B' : '2px solid transparent', marginBottom:'-2px', background:'none', fontSize:'0.875rem', fontWeight: sekme===t.id ? '700' : '500', color: sekme===t.id ? '#1B3A6B' : '#64748B', cursor:'pointer' }}>
            {t.label}
          </button>
        ))}
        {sekme === 'atamalar' && (
          <button onClick={() => atamaModalAc()}
            style={{ marginLeft:'auto', padding:'0.5rem 1.25rem', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:'8px', fontSize:'0.8rem', fontWeight:'600', cursor:'pointer', marginBottom:'0.25rem' }}>
            + Atama Yap
          </button>
        )}
      </div>

      {/* ── ATAMALAR SEKMESİ ── */}
      {sekme === 'atamalar' && (
        <div style={{ background:'#fff', borderRadius:'0 0 12px 12px', border:'1px solid #E2E8F0', borderTop:'none', overflow:'hidden' }}>
          {atamalar.length === 0 ? (
            <div style={{ padding:'4rem', textAlign:'center', color:'#94A3B8', fontSize:'0.9rem' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>🔗</div>
              Henüz mentor ataması yapılmamış.<br />
              <span style={{ fontSize:'0.8rem' }}>Öğretmenlere öğrenci atamak için "+ Atama Yap" butonunu kullanın.</span>
            </div>
          ) : atamalar
              .sort((a, b) => (a.ogretmenAd||'').localeCompare(b.ogretmenAd||'', 'tr'))
              .map(atama => {
            const acik = acikOgret.has(atama.ogretmenId)
            const ogrList = atama.ogrenciler || []
            const tamamlananSayi = ogrList.filter(o => raporIndex[`${o.id}_d${donem}`]).length

            return (
              <div key={atama.ogretmenId} style={{ borderBottom:'1px solid #E2E8F0' }}>
                {/* Öğretmen satırı */}
                <div style={{ display:'flex', alignItems:'center', padding:'1rem 1.25rem', cursor:'pointer', background: acik ? '#F8FAFC' : '#fff', gap:'0.75rem' }}
                  onClick={() => setAcikOgret(prev => { const next=new Set(prev); acik ? next.delete(atama.ogretmenId) : next.add(atama.ogretmenId); return next })}>
                  <span style={{ color:'#94A3B8', fontSize:'0.75rem' }}>{acik ? '▼' : '▶'}</span>
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'linear-gradient(135deg,#6366F1,#4338CA)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:'700', fontSize:'0.9rem', flexShrink:0 }}>
                    {atama.ogretmenAd?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:'700', fontSize:'0.9rem', color:'#1E293B' }}>{atama.ogretmenAd || atama.ogretmenId}</div>
                    <div style={{ fontSize:'0.75rem', color:'#64748B' }}>{ogrList.length} öğrenci atanmış</div>
                  </div>
                  {/* Dönem ilerleme */}
                  <div style={{ textAlign:'right', marginRight:'0.5rem' }}>
                    <div style={{ fontSize:'0.75rem', color:'#64748B' }}>{donem}. Dönem</div>
                    <div style={{ fontSize:'0.82rem', fontWeight:'700', color: tamamlananSayi === ogrList.length ? '#065F46' : '#92400E' }}>
                      {tamamlananSayi}/{ogrList.length} rapor
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={e => { e.stopPropagation(); atamaModalAc(atama) }}
                      style={{ padding:'4px 12px', border:'1px solid #E2E8F0', borderRadius:'6px', background:'none', fontSize:'0.75rem', cursor:'pointer', color:'#374151' }}>
                      Düzenle
                    </button>
                    <button onClick={e => { e.stopPropagation(); atamaKaldir(atama.ogretmenId, atama.ogretmenAd) }}
                      style={{ padding:'4px 12px', border:'1px solid #FECACA', borderRadius:'6px', background:'none', fontSize:'0.75rem', cursor:'pointer', color:'#991B1B' }}>
                      Kaldır
                    </button>
                  </div>
                </div>

                {/* Öğrenci listesi */}
                {acik && (
                  <div style={{ padding:'0.75rem 1.25rem 1rem 3.5rem', background:'#FAFBFF' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'0.5rem' }}>
                      {ogrList.map(o => {
                        const rapor = raporIndex[`${o.id}_d${donem}`]
                        const ort   = ortHesapla(rapor)
                        return (
                          <div key={o.id}
                            onClick={() => { setDonem(donem); degModalAc(o) }}
                            style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.5rem 0.75rem', background:'#fff', borderRadius:'8px', border:`1px solid ${rapor ? '#A7F3D0' : '#FDE68A'}`, cursor:'pointer' }}>
                            <div style={{ width:'28px', height:'28px', borderRadius:'50%', background: rapor ? '#D1FAE5' : '#FEF3C7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:'700', color: rapor ? '#065F46' : '#92400E', flexShrink:0 }}>
                              {o.ad?.[0]?.toUpperCase()}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:'0.8rem', fontWeight:'600', color:'#1E293B', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                {o.ad} {o.soyad}
                              </div>
                              <div style={{ fontSize:'0.7rem', color:'#94A3B8' }}>{o.sinifAd || '—'}</div>
                            </div>
                            <OrtBadge ort={ort} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── DEĞERLENDİRMELER SEKMESİ ── */}
      {sekme === 'degerlendirmeler' && (
        <div style={{ background:'#fff', borderRadius:'0 0 12px 12px', border:'1px solid #E2E8F0', borderTop:'none', overflow:'hidden' }}>
          {raporlar.filter(r => r.donem === donem).length === 0 ? (
            <div style={{ padding:'4rem', textAlign:'center', color:'#94A3B8', fontSize:'0.9rem' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>📊</div>
              {donem}. dönem için henüz değerlendirme yapılmamış.
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Öğrenci', 'Sınıf', 'Mentor Öğretmen', ...KRITERLER.map(k => k.ikon), 'Ort.', 'Yorum'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {raporlar
                  .filter(r => r.donem === donem)
                  .sort((a,b) => (a.sinifAd||'').localeCompare(b.sinifAd||'','tr') || (a.ogrenciSoyad||'').localeCompare(b.ogrenciSoyad||'','tr'))
                  .map(r => (
                    <tr key={r.id}
                      onClick={() => {
                        const o = { id:r.ogrenciId, ad:r.ogrenciAd, soyad:r.ogrenciSoyad, sinifId:r.sinifId, sinifAd:r.sinifAd }
                        degModalAc(o)
                      }}
                      style={{ cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background='#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={s.td}><strong>{r.ogrenciAd} {r.ogrenciSoyad}</strong></td>
                      <td style={{ ...s.td, fontSize:'0.8rem', color:'#64748B' }}>{r.sinifAd}</td>
                      <td style={{ ...s.td, fontSize:'0.8rem' }}>{r.mentorOgretmenAd}</td>
                      {KRITERLER.map(k => (
                        <td key={k.id} style={{ ...s.td, textAlign:'center' }}>
                          {r[k.id] ? (
                            <span style={{ ...PUAN_STIL[r[k.id]], padding:'2px 8px', borderRadius:'4px', fontSize:'0.75rem', fontWeight:'700' }}>
                              {r[k.id]}
                            </span>
                          ) : <span style={{ color:'#CBD5E1' }}>—</span>}
                        </td>
                      ))}
                      <td style={{ ...s.td, textAlign:'center' }}><OrtBadge ort={ortHesapla(r)} /></td>
                      <td style={{ ...s.td, maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.8rem', color:'#64748B' }}>
                        {r.yorum || <span style={{ color:'#CBD5E1' }}>—</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── ATAMA MODALI ── */}
      {atamaModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:200, overflowY:'auto', padding:'2rem 1rem' }}
          onClick={e => e.target === e.currentTarget && setAtamaModal(false)}>
          <div style={{ background:'#fff', borderRadius:'16px', padding:'2rem', width:'100%', maxWidth:'600px', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontSize:'1.125rem', fontWeight:'700', color:'#1E293B', marginBottom:'1.5rem' }}>Mentor Ataması</h2>

            <form onSubmit={atamaKaydet}>
              {/* Öğretmen seçimi */}
              <div style={s.alan}>
                <label style={s.etiket}>Mentor Öğretmen *</label>
                <select style={s.girdi} value={atamaForm.ogretmenId}
                  onChange={e => setAtamaForm(f => ({ ...f, ogretmenId: e.target.value }))}>
                  <option value="">— Öğretmen seçin —</option>
                  {ogretmenler.map(o => (
                    <option key={o.id} value={o.id}>{o.ad || o.email}</option>
                  ))}
                </select>
              </div>

              {/* Sınıf filtresi */}
              <div style={s.alan}>
                <label style={s.etiket}>Öğrenci Seçimi</label>
                <select style={{ ...s.girdi, marginBottom:'0.5rem' }} value={sinifFiltre}
                  onChange={e => setSinifFiltre(e.target.value)}>
                  <option value="">— Tüm sınıflar —</option>
                  {siniflar.map(s2 => (
                    <option key={s2.id} value={s2.id}>{s2.ad}</option>
                  ))}
                </select>

                {/* Tümünü seç / kaldır (o sınıf için) */}
                {sinifFiltre && (
                  <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.5rem' }}>
                    <button type="button"
                      onClick={() => {
                        const ids = (sinifaGoreOgrenciler[sinifFiltre] || []).map(o => o.id)
                        setAtamaForm(f => ({ ...f, ogrenciIds: [...new Set([...f.ogrenciIds, ...ids])] }))
                      }}
                      style={{ padding:'3px 10px', border:'1px solid #A7F3D0', borderRadius:'6px', background:'#D1FAE5', color:'#065F46', fontSize:'0.75rem', cursor:'pointer', fontWeight:'600' }}>
                      Tümünü Seç
                    </button>
                    <button type="button"
                      onClick={() => {
                        const ids = (sinifaGoreOgrenciler[sinifFiltre] || []).map(o => o.id)
                        setAtamaForm(f => ({ ...f, ogrenciIds: f.ogrenciIds.filter(id => !ids.includes(id)) }))
                      }}
                      style={{ padding:'3px 10px', border:'1px solid #FECACA', borderRadius:'6px', background:'#FEE2E2', color:'#991B1B', fontSize:'0.75rem', cursor:'pointer', fontWeight:'600' }}>
                      Tümünü Kaldır
                    </button>
                  </div>
                )}

                {/* Öğrenci listesi */}
                <div style={{ maxHeight:'280px', overflowY:'auto', border:'1px solid #E2E8F0', borderRadius:'8px', padding:'0.5rem' }}>
                  {(sinifFiltre
                    ? (sinifaGoreOgrenciler[sinifFiltre] || [])
                    : ogrenciler
                  ).map(o => {
                    const secili = atamaForm.ogrenciIds.includes(o.id)
                    const sinif = siniflar.find(s2 => s2.id === o.sinifId)
                    return (
                      <label key={o.id} style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.4rem 0.5rem', borderRadius:'6px', cursor:'pointer', background: secili ? '#EEF2FF' : 'transparent' }}>
                        <input type="checkbox" checked={secili}
                          onChange={() => setAtamaForm(f => ({
                            ...f,
                            ogrenciIds: secili ? f.ogrenciIds.filter(id => id !== o.id) : [...f.ogrenciIds, o.id]
                          }))} />
                        <span style={{ fontSize:'0.85rem', flex:1 }}>{o.ad} {o.soyad}</span>
                        <span style={{ fontSize:'0.72rem', color:'#94A3B8' }}>{sinif?.ad || '—'}</span>
                      </label>
                    )
                  })}
                  {ogrenciler.length === 0 && (
                    <div style={{ textAlign:'center', color:'#94A3B8', padding:'1rem', fontSize:'0.82rem' }}>Bu kurumda öğrenci bulunamadı</div>
                  )}
                </div>
                {atamaForm.ogrenciIds.length > 0 && (
                  <div style={{ fontSize:'0.78rem', color:'#4F46E5', fontWeight:'600', marginTop:'0.375rem' }}>
                    ✓ {atamaForm.ogrenciIds.length} öğrenci seçildi
                  </div>
                )}
              </div>

              {atamaHata && <p style={{ fontSize:'0.875rem', color:'#991B1B', background:'#FEE2E2', borderRadius:'6px', padding:'0.5rem 0.75rem', marginBottom:'1rem' }}>{atamaHata}</p>}

              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setAtamaModal(false)}
                  style={{ padding:'0.6rem 1.25rem', background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:'8px', fontSize:'0.875rem', cursor:'pointer', color:'#374151' }}>
                  İptal
                </button>
                <button type="submit" disabled={atamaKayded}
                  style={{ padding:'0.6rem 1.5rem', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:'8px', fontSize:'0.875rem', fontWeight:'600', cursor:'pointer' }}>
                  {atamaKayded ? 'Kaydediliyor...' : 'Atamaları Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {degModalJSX}
    </div>
  )
}

// ── Öğrenci Kartı (Öğretmen Modunda) ─────────────────────────────────────────
function OgrenciKarti({ ogrenci, rapor, siniflar, onClick }) {
  const ort   = ortHesapla(rapor)
  const sinif = siniflar.find(s => s.id === ogrenci.sinifId)
  const tamam = rapor != null

  return (
    <div onClick={onClick} style={{
      background:'#fff', border:`2px solid ${tamam ? '#A7F3D0' : '#FDE68A'}`,
      borderRadius:'12px', padding:'1rem', cursor:'pointer',
      transition:'all 0.15s', boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.transform='translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)'; e.currentTarget.style.transform='none' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', marginBottom:'0.75rem' }}>
        <div style={{ width:'36px', height:'36px', borderRadius:'50%', background: tamam ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#F59E0B,#D97706)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:'700', fontSize:'0.9rem', flexShrink:0 }}>
          {ogrenci.ad?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <div style={{ fontWeight:'700', fontSize:'0.875rem', color:'#1E293B' }}>{ogrenci.ad} {ogrenci.soyad}</div>
          <div style={{ fontSize:'0.72rem', color:'#94A3B8' }}>{sinif?.ad || ogrenci.sinifAd || '—'}</div>
        </div>
      </div>

      {tamam ? (
        <div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'0.5rem' }}>
            {KRITERLER.map(k => {
              const puan = rapor[k.id]
              const stil = PUAN_STIL[puan] || {}
              return (
                <span key={k.id} title={k.ad} style={{ ...stil, padding:'2px 6px', borderRadius:'4px', fontSize:'0.7rem', fontWeight:'700' }}>
                  {k.ikon}
                </span>
              )
            })}
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:'0.72rem', color:'#065F46', fontWeight:'600' }}>✓ Değerlendirildi</span>
            <OrtBadge ort={ort} />
          </div>
        </div>
      ) : (
        <div style={{ textAlign:'center', padding:'0.375rem 0' }}>
          <span style={{ fontSize:'0.78rem', color:'#D97706', fontWeight:'600' }}>⏳ Değerlendirme Bekliyor</span>
        </div>
      )}
    </div>
  )
}
