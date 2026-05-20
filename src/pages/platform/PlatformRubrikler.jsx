import { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'

const VARSAYILAN_SEVİYELER = [
  { ad: 'Başlangıç', puan: 1, aciklama: '' },
  { ad: 'Gelişiyor', puan: 2, aciklama: '' },
  { ad: 'İyi',       puan: 3, aciklama: '' },
  { ad: 'Mükemmel',  puan: 4, aciklama: '' },
]
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const yeniAltKriter  = () => ({ id: 'ak' + uid(), ad: '', seviyeler: VARSAYILAN_SEVİYELER.map(s => ({ ...s })) })
const yeniAnaKriter  = () => { const ak = yeniAltKriter(); return { id: 'k' + uid(), ad: '', altKriterler: [ak] } }

const BOŞ_FORM = { ad: '', aciklama: '', kriterler: [] }

function toplamAltKriter(kriterler) {
  return (kriterler || []).reduce((t, k) => t + (k.altKriterler?.length || 0), 0)
}
function toplamMaksPuan(kriterler) {
  return (kriterler || []).reduce((t, k) =>
    t + (k.altKriterler || []).reduce((tt, ak) =>
      tt + Math.max(...(ak.seviyeler || []).map(s => s.puan || 0), 0), 0), 0)
}

export default function PlatformRubrikler() {
  const { profil } = useAuth()
  const [sablonlar,  setSablonlar]  = useState([])
  const [modal,      setModal]      = useState(false)
  const [duzenlenen, setDuzenlenen] = useState(null)
  const [form,       setForm]       = useState(BOŞ_FORM)
  const [acikAna,    setAcikAna]    = useState({})   // ana kriter accordion
  const [acikAlt,    setAcikAlt]    = useState({})   // alt kriter seviye accordion
  const [onizleme,   setOnizleme]   = useState(null)
  const [kaydediyor, setKaydediyor] = useState(false)
  const [hata,       setHata]       = useState('')
  const xlsxRef = useRef()

  useEffect(() => {
    const q = query(collection(db, 'rubrikSablonlar'), orderBy('olusturmaTarihi', 'desc'))
    return onSnapshot(q, snap => setSablonlar(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  // ── Modal ────────────────────────────────────────────────
  function modalAc(sablon = null) {
    setDuzenlenen(sablon)
    if (sablon) {
      setForm({
        ad: sablon.ad, aciklama: sablon.aciklama || '',
        kriterler: (sablon.kriterler || []).map(k => ({
          ...k,
          altKriterler: (k.altKriterler || []).map(ak => ({
            ...ak, seviyeler: (ak.seviyeler || []).map(s => ({ ...s })),
          })),
        })),
      })
      const a = {}; sablon.kriterler?.forEach(k => { a[k.id] = false }); setAcikAna(a)
    } else {
      const ilk = yeniAnaKriter()
      setForm({ ...BOŞ_FORM, kriterler: [ilk] })
      setAcikAna({ [ilk.id]: true })
      setAcikAlt({ [ilk.altKriterler[0].id]: true })
    }
    setHata(''); setModal(true)
  }
  function modalKapat() { setModal(false); setDuzenlenen(null) }

  // ── Ana Kriter ───────────────────────────────────────────
  function anaEkle() {
    const k = yeniAnaKriter()
    setForm(f => ({ ...f, kriterler: [...f.kriterler, k] }))
    setAcikAna(a => ({ ...a, [k.id]: true }))
    setAcikAlt(a => ({ ...a, [k.altKriterler[0].id]: true }))
  }
  function anaSil(id) { setForm(f => ({ ...f, kriterler: f.kriterler.filter(k => k.id !== id) })) }
  function anaAdGuncelle(id, val) {
    setForm(f => ({ ...f, kriterler: f.kriterler.map(k => k.id === id ? { ...k, ad: val } : k) }))
  }

  // ── Alt Kriter ───────────────────────────────────────────
  function altEkle(kId) {
    const ak = yeniAltKriter()
    setForm(f => ({
      ...f,
      kriterler: f.kriterler.map(k => k.id === kId ? { ...k, altKriterler: [...k.altKriterler, ak] } : k),
    }))
    setAcikAlt(a => ({ ...a, [ak.id]: true }))
  }
  function altSil(kId, akId) {
    setForm(f => ({
      ...f,
      kriterler: f.kriterler.map(k => k.id !== kId ? k : {
        ...k, altKriterler: k.altKriterler.filter(ak => ak.id !== akId),
      }),
    }))
  }
  function altAdGuncelle(kId, akId, val) {
    setForm(f => ({
      ...f,
      kriterler: f.kriterler.map(k => k.id !== kId ? k : {
        ...k, altKriterler: k.altKriterler.map(ak => ak.id === akId ? { ...ak, ad: val } : ak),
      }),
    }))
  }

  // ── Seviye ───────────────────────────────────────────────
  function seviyeGuncelle(kId, akId, idx, alan, val) {
    setForm(f => ({
      ...f,
      kriterler: f.kriterler.map(k => k.id !== kId ? k : {
        ...k,
        altKriterler: k.altKriterler.map(ak => ak.id !== akId ? ak : {
          ...ak,
          seviyeler: ak.seviyeler.map((s, i) =>
            i === idx ? { ...s, [alan]: alan === 'puan' ? Number(val) : val } : s),
        }),
      }),
    }))
  }
  function seviyeEkle(kId, akId) {
    setForm(f => ({
      ...f,
      kriterler: f.kriterler.map(k => k.id !== kId ? k : {
        ...k,
        altKriterler: k.altKriterler.map(ak => ak.id !== akId ? ak : {
          ...ak,
          seviyeler: [...ak.seviyeler, {
            ad: '', puan: Math.max(...ak.seviyeler.map(s => s.puan || 0), 0) + 1, aciklama: '',
          }],
        }),
      }),
    }))
  }
  function seviyeSil(kId, akId, idx) {
    setForm(f => ({
      ...f,
      kriterler: f.kriterler.map(k => k.id !== kId ? k : {
        ...k,
        altKriterler: k.altKriterler.map(ak => ak.id !== akId ? ak : {
          ...ak, seviyeler: ak.seviyeler.filter((_, i) => i !== idx),
        }),
      }),
    }))
  }

  // ── Kaydet ───────────────────────────────────────────────
  async function kaydet(e) {
    e.preventDefault()
    if (!form.ad.trim()) { setHata('Rubrik adı zorunludur.'); return }
    if (!form.kriterler.length) { setHata('En az bir ana başlık ekleyin.'); return }
    for (const k of form.kriterler) {
      if (!k.ad.trim()) { setHata('Tüm ana başlıklara ad verilmelidir.'); return }
      if (!k.altKriterler?.length) { setHata(`"${k.ad || 'Başlık'}" altına en az bir kriter ekleyin.`); return }
      for (const ak of k.altKriterler) {
        if (!ak.ad.trim()) { setHata('Tüm alt kriterlere ad verilmelidir.'); return }
        if ((ak.seviyeler?.length || 0) < 2) { setHata(`"${ak.ad}" için en az 2 seviye gerekli.`); return }
      }
    }
    setKaydediyor(true)
    try {
      const veri = { ad: form.ad.trim(), aciklama: form.aciklama.trim(), kriterler: form.kriterler }
      if (duzenlenen) {
        await updateDoc(doc(db, 'rubrikSablonlar', duzenlenen.id), veri)
      } else {
        await addDoc(collection(db, 'rubrikSablonlar'), {
          ...veri,
          olusturanId: profil?.uid || '',
          olusturanAd: profil?.ad || profil?.email || '',
          olusturmaTarihi: serverTimestamp(),
        })
      }
      modalKapat()
    } catch (err) { setHata('Kayıt hatası: ' + err.message) }
    finally { setKaydediyor(false) }
  }

  // ── Excel Şablon İndir ────────────────────────────────────
  function sablonXlsxIndir() {
    const header = ['Ana Başlık', 'Alt Kriter', 'Başlangıç (1 puan)', 'Gelişiyor (2 puan)', 'İyi (3 puan)', 'Mükemmel (4 puan)']
    const ornek = [
      ['Dijital Üretim', 'Araç Kullanımı', 'Araçları hiç kullanamıyor', 'Temel kullanım var', 'Araçları etkin kullanıyor', 'Yaratıcı ve özgün kullanım'],
      ['Dijital Üretim', 'İçerik Kalitesi', 'İçerik yetersiz', 'Kısmen yeterli', 'Yeterli ve doğru içerik', 'Zengin ve özgün içerik'],
      ['Tasarım', 'Tasarım Fikri', 'Fikir belirgin değil', 'Basit bir fikir var', 'İyi geliştirilmiş fikir', 'Özgün ve detaylı fikir'],
      ['Tasarım', 'Model Doğruluğu', 'Model hatalı', 'Kısmen doğru', 'Büyük ölçüde doğru', 'Eksiksiz ve doğru model'],
      ['Proje Geliştirme', 'Problem Tanımlama', 'Problem tanımlanamıyor', 'Problem kısmen tanımlanmış', 'Problem açıkça tanımlanmış', 'Kapsamlı ve analitik tanım'],
      ['Proje Geliştirme', 'Çözüm Üretme', 'Çözüm önerilemiyor', 'Sınırlı çözüm', 'Uygulanabilir çözüm', 'Yaratıcı ve çok boyutlu çözüm'],
    ]
    const ws = XLSX.utils.aoa_to_sheet([header, ...ornek])
    ws['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rubrik Şablonu')
    XLSX.writeFile(wb, 'rubrik_sablonu.xlsx')
  }

  // ── Excel'den Rubrik Yükle ────────────────────────────────
  function rubrikXlsxOku(e) {
    const dosya = e.target.files[0]; if (!dosya) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (rows.length < 2) { alert('Dosyada veri bulunamadı.'); return }

        // Başlık satırından seviye sütunlarını çıkar (2. sütundan itibaren)
        const seviyeler_meta = rows[0].slice(2).map((h, i) => {
          const ad  = h?.toString().trim() || `Seviye ${i + 1}`
          const m   = ad.match(/\((\d+)\s*puan?\)/i) || ad.match(/\((\d+)\)/)
          const puan = m ? parseInt(m[1]) : i + 1
          return { ad: ad.replace(/\s*\(\d+\s*puan?\)/i, '').trim() || `Seviye ${i + 1}`, puan }
        })

        // Satırları ana başlığa göre grupla (boş hücre = bir önceki ana başlık)
        const gruplar = new Map()
        const sira    = []
        let sonAna    = ''
        rows.slice(1).forEach(row => {
          const anaAd = row[0]?.toString().trim() || sonAna
          const altAd = row[1]?.toString().trim()
          if (!altAd) return
          if (anaAd) sonAna = anaAd
          if (!gruplar.has(sonAna)) { gruplar.set(sonAna, []); sira.push(sonAna) }
          const seviyeler = seviyeler_meta.map((sv, i) => ({
            ad: sv.ad, puan: sv.puan,
            aciklama: row[2 + i]?.toString().trim() || '',
          }))
          gruplar.get(sonAna).push({ altAd, seviyeler })
        })

        if (!sira.length) { alert('Rubrik yapısı okunamadı. Şablonu indirip formatı kontrol edin.'); return }

        const kriterler = sira.map(anaAd => ({
          id: 'k' + uid(),
          ad: anaAd,
          altKriterler: gruplar.get(anaAd).map(({ altAd, seviyeler }) => ({
            id: 'ak' + uid(), ad: altAd, seviyeler,
          })),
        }))

        const aciklar = {}; kriterler.forEach(k => { aciklar[k.id] = false })
        setDuzenlenen(null)
        setForm({ ad: dosya.name.replace(/\.xlsx?$/i, '').replace(/_/g, ' '), aciklama: '', kriterler })
        setAcikAna(aciklar)
        setAcikAlt({})
        setHata('')
        setModal(true)
      } catch (err) { alert('Dosya okunamadı: ' + err.message) }
    }
    reader.readAsArrayBuffer(dosya); e.target.value = ''
  }

  async function sil(sablon) {
    if (!window.confirm(`"${sablon.ad}" şablonunu silmek istediğinize emin misiniz?`)) return
    await deleteDoc(doc(db, 'rubrikSablonlar', sablon.id))
  }

  // ── Stiller ──────────────────────────────────────────────
  const s = {
    th:     { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    td:     { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    eylem:  { background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 9px', fontSize: '0.75rem', cursor: 'pointer', color: '#374151' },
    alan:   { display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' },
    etiket: { fontSize: '0.875rem', fontWeight: '500', color: '#374151' },
    girdi:  { padding: '0.6rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', color: '#1E293B', width: '100%', boxSizing: 'border-box' },
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>Rubrik Şablonlar</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Platform genelinde kullanılacak rubrik şablonları</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#64748B' }}>{sablonlar.length} şablon</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={sablonXlsxIndir}
            style={{ padding: '0.6rem 1.1rem', background: '#F0FDF4', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
            ⬇ Şablon İndir
          </button>
          <button onClick={() => xlsxRef.current?.click()}
            style={{ padding: '0.6rem 1.1rem', background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
            📥 Excel'den Yükle
          </button>
          <input ref={xlsxRef} type="file" accept=".xlsx,.xls" onChange={rubrikXlsxOku} style={{ display: 'none' }} />
          <button onClick={() => modalAc()}
            style={{ padding: '0.6rem 1.25rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
            + Sıfırdan Oluştur
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Rubrik Adı', 'Yapı', 'Maks. Puan', 'Oluşturan', 'İşlemler'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sablonlar.length === 0 ? (
              <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#94A3B8', padding: '3rem' }}>Henüz şablon eklenmemiş</td></tr>
            ) : sablonlar.map(sablon => (
              <tr key={sablon.id}>
                <td style={s.td}>
                  <div style={{ fontWeight: '600', color: '#1E293B' }}>{sablon.ad}</div>
                  {sablon.aciklama && <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>{sablon.aciklama}</div>}
                </td>
                <td style={s.td}>
                  <span style={{ background: '#EEF2FF', color: '#4338CA', padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', marginRight: '4px' }}>
                    {sablon.kriterler?.length || 0} başlık
                  </span>
                  <span style={{ background: '#F0FDF4', color: '#065F46', padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600' }}>
                    {toplamAltKriter(sablon.kriterler)} kriter
                  </span>
                </td>
                <td style={s.td}>
                  <span style={{ fontWeight: '700', color: '#1B3A6B' }}>{toplamMaksPuan(sablon.kriterler)}</span>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}> puan</span>
                </td>
                <td style={{ ...s.td, fontSize: '0.8rem', color: '#64748B' }}>{sablon.olusturanAd || '—'}</td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <button style={s.eylem} onClick={() => setOnizleme(sablon)}>Önizle</button>
                    <button style={s.eylem} onClick={() => modalAc(sablon)}>Düzenle</button>
                    <button style={{ ...s.eylem, color: '#991B1B', borderColor: '#FECACA' }} onClick={() => sil(sablon)}>Sil</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Oluştur / Düzenle Modal ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, overflowY: 'auto', padding: '2rem 1rem' }}
          onClick={e => e.target === e.currentTarget && modalKapat()}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '760px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ padding: '1.5rem 1.75rem 0' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>
                {duzenlenen ? 'Şablonu Düzenle' : 'Yeni Rubrik Şablonu'}
              </h2>
              <p style={{ fontSize: '0.825rem', color: '#94A3B8', marginBottom: '1.25rem' }}>
                Ana başlıklar altında alt kriterler tanımlayın (ör: Dijital Üretim → Araç Kullanımı)
              </p>
            </div>

            <form onSubmit={kaydet}>
              <div style={{ padding: '0 1.75rem' }}>
                {/* Rubrik adı & açıklama */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={s.alan}>
                    <label style={s.etiket}>Rubrik Adı *</label>
                    <input style={s.girdi} value={form.ad}
                      onChange={e => setForm(f => ({ ...f, ad: e.target.value }))}
                      placeholder="Bilişim Teknolojileri Rubriği" autoFocus />
                  </div>
                  <div style={s.alan}>
                    <label style={s.etiket}>Açıklama</label>
                    <input style={s.girdi} value={form.aciklama}
                      onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))}
                      placeholder="Kısa açıklama (isteğe bağlı)" />
                  </div>
                </div>

                {/* Ana Başlıklar */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1.25rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                      Ana Başlıklar&nbsp;
                      <span style={{ fontWeight: '400', color: '#94A3B8' }}>({form.kriterler.length})</span>
                      <span style={{ fontWeight: '400', color: '#94A3B8', fontSize: '0.78rem' }}>
                        &nbsp;· {toplamAltKriter(form.kriterler)} alt kriter
                      </span>
                    </span>
                    <button type="button" onClick={anaEkle}
                      style={{ padding: '4px 12px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', color: '#4338CA', cursor: 'pointer' }}>
                      + Ana Başlık Ekle
                    </button>
                  </div>

                  {form.kriterler.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', background: '#F8FAFC', borderRadius: '8px', color: '#94A3B8', fontSize: '0.875rem' }}>
                      Henüz başlık eklenmedi. "+ Ana Başlık Ekle" butonuna tıklayın.
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {form.kriterler.map((kriter, ki) => {
                      const anaAcik = !!acikAna[kriter.id]
                      const akSayisi = kriter.altKriterler?.length || 0
                      const anaMaks  = (kriter.altKriterler || []).reduce((t, ak) =>
                        t + Math.max(...(ak.seviyeler || []).map(s => s.puan || 0), 0), 0)

                      return (
                        <div key={kriter.id} style={{ border: '2px solid ' + (anaAcik ? '#818CF8' : '#E2E8F0'), borderRadius: '12px', overflow: 'hidden' }}>

                          {/* Ana Kriter Başlığı */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: anaAcik ? '#EEF2FF' : '#F8FAFC', cursor: 'pointer' }}
                            onClick={() => setAcikAna(a => ({ ...a, [kriter.id]: !a[kriter.id] }))}>
                            <span style={{ fontSize: '0.7rem', color: '#94A3B8', flexShrink: 0 }}>{anaAcik ? '▼' : '▶'}</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', flexShrink: 0 }}>{ki + 1}.</span>
                            <input
                              value={kriter.ad}
                              onChange={e => { e.stopPropagation(); anaAdGuncelle(kriter.id, e.target.value) }}
                              onClick={e => e.stopPropagation()}
                              placeholder="Ana başlık (ör: Dijital Üretim)"
                              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.925rem', fontWeight: '700', color: '#1E293B', outline: 'none' }}
                            />
                            <span style={{ fontSize: '0.7rem', color: '#94A3B8', flexShrink: 0, whiteSpace: 'nowrap' }}>
                              {akSayisi} alt kriter · maks {anaMaks} puan
                            </span>
                            <button type="button" onClick={e => { e.stopPropagation(); anaSil(kriter.id) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '0.9rem', padding: '0 2px', flexShrink: 0 }}>✕</button>
                          </div>

                          {/* Alt Kriterler Listesi */}
                          {anaAcik && (
                            <div style={{ padding: '0.75rem', background: '#FAFBFF', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {(kriter.altKriterler || []).map((ak, aki) => {
                                const altAcik = !!acikAlt[ak.id]
                                const akMaks  = Math.max(...(ak.seviyeler || []).map(s => s.puan || 0), 0)

                                return (
                                  <div key={ak.id} style={{ border: '1.5px solid ' + (altAcik ? '#7DD3FC' : '#E2E8F0'), borderRadius: '8px', overflow: 'hidden' }}>

                                    {/* Alt Kriter Başlığı */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: altAcik ? '#F0F9FF' : '#fff', cursor: 'pointer' }}
                                      onClick={() => setAcikAlt(a => ({ ...a, [ak.id]: !a[ak.id] }))}>
                                      <span style={{ fontSize: '0.65rem', color: '#94A3B8', flexShrink: 0 }}>{altAcik ? '▼' : '▶'}</span>
                                      <span style={{ fontSize: '0.7rem', color: '#94A3B8', flexShrink: 0 }}>{aki + 1}.</span>
                                      <input
                                        value={ak.ad}
                                        onChange={e => { e.stopPropagation(); altAdGuncelle(kriter.id, ak.id, e.target.value) }}
                                        onClick={e => e.stopPropagation()}
                                        placeholder="Alt kriter (ör: Araç Kullanımı)"
                                        style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.825rem', fontWeight: '600', color: '#374151', outline: 'none' }}
                                      />
                                      <span style={{ fontSize: '0.68rem', color: '#94A3B8', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                        {ak.seviyeler?.length || 0} seviye · maks {akMaks} puan
                                      </span>
                                      <button type="button"
                                        onClick={e => { e.stopPropagation(); altSil(kriter.id, ak.id) }}
                                        disabled={(kriter.altKriterler?.length || 0) <= 1}
                                        title={(kriter.altKriterler?.length || 0) <= 1 ? 'En az 1 alt kriter olmalı' : 'Sil'}
                                        style={{ background: 'none', border: 'none', cursor: (kriter.altKriterler?.length || 0) <= 1 ? 'not-allowed' : 'pointer', color: '#CBD5E1', fontSize: '0.8rem', padding: '0 2px', flexShrink: 0 }}>✕</button>
                                    </div>

                                    {/* Seviye Editörü */}
                                    {altAcik && (
                                      <div style={{ padding: '0.625rem 0.75rem', background: '#fff' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: '0.5rem' }}>
                                          {(ak.seviyeler || []).map((seviye, si) => (
                                            <div key={si} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.5rem', background: '#FAFAFA', position: 'relative' }}>
                                              <button type="button"
                                                onClick={() => seviyeSil(kriter.id, ak.id, si)}
                                                disabled={(ak.seviyeler?.length || 0) <= 2}
                                                style={{ position: 'absolute', top: '4px', right: '4px', background: 'none', border: 'none', cursor: (ak.seviyeler?.length || 0) <= 2 ? 'not-allowed' : 'pointer', color: '#CBD5E1', fontSize: '0.7rem', padding: 0, lineHeight: 1 }}>✕</button>
                                              <input value={seviye.ad}
                                                onChange={e => seviyeGuncelle(kriter.id, ak.id, si, 'ad', e.target.value)}
                                                placeholder="Seviye adı"
                                                style={{ width: '100%', border: 'none', borderBottom: '1px solid #E2E8F0', background: 'transparent', fontSize: '0.78rem', fontWeight: '600', color: '#1E293B', outline: 'none', paddingBottom: '2px', boxSizing: 'border-box', marginBottom: '4px' }}
                                              />
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Puan:</span>
                                                <input type="number" min="0" max="100" value={seviye.puan}
                                                  onChange={e => seviyeGuncelle(kriter.id, ak.id, si, 'puan', e.target.value)}
                                                  style={{ width: '44px', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '2px 4px', fontSize: '0.78rem', textAlign: 'center' }}
                                                />
                                              </div>
                                              <textarea value={seviye.aciklama}
                                                onChange={e => seviyeGuncelle(kriter.id, ak.id, si, 'aciklama', e.target.value)}
                                                placeholder="Açıklama (isteğe bağlı)"
                                                rows={2}
                                                style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '3px 5px', fontSize: '0.72rem', color: '#64748B', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                              />
                                            </div>
                                          ))}
                                          <div onClick={() => seviyeEkle(kriter.id, ak.id)}
                                            style={{ border: '1.5px dashed #E2E8F0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94A3B8', fontSize: '0.78rem', minHeight: '80px' }}>
                                            + Seviye
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}

                              <button type="button" onClick={() => altEkle(kriter.id)}
                                style={{ padding: '6px', background: '#F0FDF4', border: '1.5px dashed #86EFAC', borderRadius: '7px', fontSize: '0.78rem', fontWeight: '600', color: '#16A34A', cursor: 'pointer' }}>
                                + Alt Kriter Ekle
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {hata && (
                <div style={{ margin: '0 1.75rem 1rem', fontSize: '0.875rem', color: '#991B1B', background: '#FEE2E2', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>{hata}</div>
              )}

              <div style={{ padding: '1rem 1.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  {form.kriterler.length} ana başlık · {toplamAltKriter(form.kriterler)} alt kriter · maks {toplamMaksPuan(form.kriterler)} puan
                </span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" onClick={modalKapat}
                    style={{ padding: '0.6rem 1.25rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>
                    İptal
                  </button>
                  <button type="submit" disabled={kaydediyor}
                    style={{ padding: '0.6rem 1.5rem', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                    {kaydediyor ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Önizleme Modal ── */}
      {onizleme && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, overflowY: 'auto', padding: '2rem 1rem' }}
          onClick={e => e.target === e.currentTarget && setOnizleme(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '900px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1E293B' }}>{onizleme.ad}</h2>
                {onizleme.aciklama && <p style={{ fontSize: '0.825rem', color: '#64748B', marginTop: '2px' }}>{onizleme.aciklama}</p>}
              </div>
              <button onClick={() => setOnizleme(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#94A3B8' }}>✕</button>
            </div>

            {/* Önizleme Tablosu */}
            {(() => {
              const ilkAlt = onizleme.kriterler?.[0]?.altKriterler?.[0]
              const sevAdlari = ilkAlt?.seviyeler || []
              return (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#1B3A6B' }}>
                        <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', color: '#fff', fontWeight: '600', borderBottom: '2px solid #E2E8F0', minWidth: '180px' }}>Kriter</th>
                        {sevAdlari.map((sv, i) => (
                          <th key={i} style={{ padding: '0.625rem 0.875rem', textAlign: 'center', color: '#fff', fontWeight: '600', borderBottom: '2px solid #E2E8F0', minWidth: '120px' }}>
                            {sv.ad || `Seviye ${i + 1}`}
                            <div style={{ fontWeight: '400', fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)' }}>{sv.puan} puan</div>
                          </th>
                        ))}
                        <th style={{ padding: '0.625rem 0.875rem', textAlign: 'center', color: '#fff', fontWeight: '600', borderBottom: '2px solid #E2E8F0' }}>Maks.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onizleme.kriterler.map((k, ki) => (
                        <>
                          {/* Ana Başlık Satırı */}
                          <tr key={'ana_' + k.id} style={{ background: '#EEF2FF' }}>
                            <td colSpan={2 + sevAdlari.length}
                              style={{ padding: '0.5rem 0.875rem', fontWeight: '700', color: '#4338CA', fontSize: '0.85rem', borderBottom: '1px solid #E2E8F0' }}>
                              {ki + 1}. {k.ad}
                            </td>
                          </tr>
                          {/* Alt Kriterler */}
                          {(k.altKriterler || []).map((ak, aki) => (
                            <tr key={ak.id} style={{ background: aki % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                              <td style={{ padding: '0.625rem 0.875rem 0.625rem 1.75rem', fontWeight: '500', color: '#374151', borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' }}>
                                ↳ {ak.ad}
                              </td>
                              {(ak.seviyeler || []).map((sv, si) => (
                                <td key={si} style={{ padding: '0.625rem 0.875rem', color: '#64748B', borderBottom: '1px solid #F1F5F9', verticalAlign: 'top', textAlign: 'center', maxWidth: '150px', lineHeight: '1.4' }}>
                                  {sv.aciklama || <span style={{ color: '#CBD5E1' }}>—</span>}
                                </td>
                              ))}
                              <td style={{ padding: '0.625rem 0.875rem', fontWeight: '700', color: '#1B3A6B', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>
                                {Math.max(...(ak.seviyeler || []).map(s => s.puan || 0), 0)}
                              </td>
                            </tr>
                          ))}
                        </>
                      ))}
                      <tr style={{ background: '#F8FAFC' }}>
                        <td colSpan={1 + sevAdlari.length}
                          style={{ padding: '0.625rem 0.875rem', fontWeight: '600', color: '#64748B', textAlign: 'right', fontSize: '0.8rem' }}>
                          Toplam Maksimum:
                        </td>
                        <td style={{ padding: '0.625rem 0.875rem', fontWeight: '800', color: '#1B3A6B', textAlign: 'center' }}>
                          {toplamMaksPuan(onizleme.kriterler)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
