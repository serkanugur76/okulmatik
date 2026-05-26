import { useEffect, useState, useMemo } from 'react'
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../../services/firebase'

const MODUL_ETİKET = {
  kurumlar:        { ad: 'Kurumlar',         ikon: '🏛' },
  siniflar:        { ad: 'Sınıflar',         ikon: '🏫' },
  ogrenciler:      { ad: 'Öğrenciler',       ikon: '🎒' },
  kullanicilar:    { ad: 'Kullanıcılar',     ikon: '👥' },
  rubrikler:       { ad: 'Rubrikler',        ikon: '📋' },
  sablonlar:       { ad: 'Rubrik Şablonlar', ikon: '📝' },
  degerlendirmeler:{ ad: 'Değerlendirmeler', ikon: '✅' },
}

const ISLEM_STİL = {
  olustur:    { etiket: 'Oluşturuldu', renk: '#065F46', bg: '#D1FAE5', ikon: '✚' },
  guncelle:   { etiket: 'Güncellendi', renk: '#1D4ED8', bg: '#DBEAFE', ikon: '✎' },
  sil:        { etiket: 'Silindi',     renk: '#991B1B', bg: '#FEE2E2', ikon: '✕' },
  yukle:      { etiket: 'Toplu Yüklendi', renk: '#92400E', bg: '#FEF3C7', ikon: '⬆' },
  davet:      { etiket: 'Davet Gönderildi', renk: '#5B21B6', bg: '#EDE9FE', ikon: '✉' },
  davetIptal: { etiket: 'Davet İptal',  renk: '#374151', bg: '#F1F5F9', ikon: '✕' },
}

const ROL_ETİKET = {
  platform_admin: { etiket: 'Platform Admin', renk: '#7C3AED', bg: '#EDE9FE' },
  kurum_admin:    { etiket: 'Kurum Admin',    renk: '#0369A1', bg: '#E0F2FE' },
  ogretmen:       { etiket: 'Öğretmen',       renk: '#065F46', bg: '#D1FAE5' },
}

function formatTarih(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const tarih = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const saat  = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${tarih} ${saat}`
}

function bugun() {
  const d = new Date(); d.setHours(0,0,0,0); return d
}

export default function PlatformLoglar() {
  const [loglar,       setLoglar]       = useState([])
  const [yukleniyor,   setYukleniyor]   = useState(true)
  const [modulFiltre,  setModulFiltre]  = useState('')
  const [islemFiltre,  setIslemFiltre]  = useState('')
  const [aramaMetni,   setAramaMetni]   = useState('')
  const [tarihFiltre,  setTarihFiltre]  = useState('hepsi') // 'hepsi' | 'bugun' | 'bu_hafta'
  const [gorunenSayi,  setGorunenSayi]  = useState(100)

  useEffect(() => {
    setYukleniyor(true)
    const q = query(collection(db, 'islemLoglari'), orderBy('tarih', 'desc'), limit(500))
    const unsub = onSnapshot(q, snap => {
      setLoglar(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setYukleniyor(false)
    }, () => setYukleniyor(false))
    return unsub
  }, [])

  const filtrelenmis = useMemo(() => {
    const simdi = new Date()
    const haftaBasi = new Date(simdi); haftaBasi.setDate(simdi.getDate() - 7); haftaBasi.setHours(0,0,0,0)

    return loglar.filter(l => {
      if (modulFiltre && l.modul !== modulFiltre) return false
      if (islemFiltre && l.islem !== islemFiltre) return false
      if (aramaMetni) {
        const q = aramaMetni.toLocaleLowerCase('tr')
        if (!`${l.kullaniciAd} ${l.hedefAd} ${l.detay}`.toLocaleLowerCase('tr').includes(q)) return false
      }
      if (tarihFiltre === 'bugun') {
        const ld = l.tarih?.toDate ? l.tarih.toDate() : null
        if (!ld || ld < bugun()) return false
      }
      if (tarihFiltre === 'bu_hafta') {
        const ld = l.tarih?.toDate ? l.tarih.toDate() : null
        if (!ld || ld < haftaBasi) return false
      }
      return true
    })
  }, [loglar, modulFiltre, islemFiltre, aramaMetni, tarihFiltre])

  const gorunen = filtrelenmis.slice(0, gorunenSayi)

  // İstatistikler
  const bugunLoglar  = loglar.filter(l => { const d = l.tarih?.toDate?.(); return d && d >= bugun() })
  const islemSayilari = loglar.reduce((a, l) => { a[l.islem] = (a[l.islem] || 0) + 1; return a }, {})

  const s = {
    th: { padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' },
    td: { padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' },
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1E293B', marginBottom: '0.25rem' }}>İşlem Logları</h1>
      <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.75rem' }}>Kim ne zaman ne yapmış — tüm sistem aktivitesi</p>

      {/* İstatistik Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { etiket: 'Toplam İşlem',  deger: loglar.length,       ikon: '📊', renk: '#1B3A6B', bg: '#EFF6FF' },
          { etiket: 'Bugün',         deger: bugunLoglar.length,   ikon: '📅', renk: '#065F46', bg: '#F0FDF4' },
          { etiket: 'Oluşturma',     deger: islemSayilari.olustur    || 0, ikon: '✚', renk: '#065F46', bg: '#D1FAE5' },
          { etiket: 'Güncelleme',    deger: islemSayilari.guncelle   || 0, ikon: '✎', renk: '#1D4ED8', bg: '#DBEAFE' },
          { etiket: 'Silme',         deger: islemSayilari.sil        || 0, ikon: '✕', renk: '#991B1B', bg: '#FEE2E2' },
          { etiket: 'Toplu Yükleme', deger: islemSayilari.yukle      || 0, ikon: '⬆', renk: '#92400E', bg: '#FEF3C7' },
        ].map(k => (
          <div key={k.etiket} style={{ background: k.bg, border: `1px solid ${k.bg}`, borderRadius: '10px', padding: '0.875rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '1rem' }}>{k.ikon}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: '600', color: k.renk, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.etiket}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: k.renk, lineHeight: 1 }}>{k.deger}</div>
          </div>
        ))}
      </div>

      {/* Filtreler */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
          placeholder="🔍 Kullanıcı, hedef veya detay ara…"
          style={{ flex: '1 1 200px', padding: '0.5rem 0.75rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', color: '#1E293B', outline: 'none', minWidth: '160px' }} />

        <select value={modulFiltre} onChange={e => setModulFiltre(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151', background: '#fff' }}>
          <option value="">Tüm Modüller</option>
          {Object.entries(MODUL_ETİKET).map(([k, v]) => <option key={k} value={k}>{v.ikon} {v.ad}</option>)}
        </select>

        <select value={islemFiltre} onChange={e => setIslemFiltre(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151', background: '#fff' }}>
          <option value="">Tüm İşlemler</option>
          {Object.entries(ISLEM_STİL).map(([k, v]) => <option key={k} value={k}>{v.ikon} {v.etiket}</option>)}
        </select>

        <select value={tarihFiltre} onChange={e => setTarihFiltre(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151', background: '#fff' }}>
          <option value="hepsi">Tüm Zamanlar</option>
          <option value="bugun">Bugün</option>
          <option value="bu_hafta">Son 7 Gün</option>
        </select>

        {(modulFiltre || islemFiltre || aramaMetni || tarihFiltre !== 'hepsi') && (
          <button onClick={() => { setModulFiltre(''); setIslemFiltre(''); setAramaMetni(''); setTarihFiltre('hepsi') }}
            style={{ padding: '0.5rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', color: '#64748B', background: '#F8FAFC' }}>
            ✕ Sıfırla
          </button>
        )}

        <span style={{ fontSize: '0.78rem', color: '#94A3B8', marginLeft: 'auto' }}>
          {filtrelenmis.length} kayıt{filtrelenmis.length > gorunenSayi ? ` (${gorunenSayi} gösteriliyor)` : ''}
        </span>
      </div>

      {/* Tablo */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {yukleniyor ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>Yükleniyor…</div>
        ) : filtrelenmis.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>Kayıt bulunamadı</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={s.th}>Tarih / Saat</th>
                  <th style={s.th}>Kullanıcı</th>
                  <th style={s.th}>Modül</th>
                  <th style={s.th}>İşlem</th>
                  <th style={s.th}>Hedef</th>
                  <th style={s.th}>Detay</th>
                </tr>
              </thead>
              <tbody>
                {gorunen.map(log => {
                  const islemStil = ISLEM_STİL[log.islem] || { etiket: log.islem, renk: '#374151', bg: '#F1F5F9', ikon: '•' }
                  const modülBilgi = MODUL_ETİKET[log.modul] || { ad: log.modul, ikon: '📄' }
                  const rolBilgi   = ROL_ETİKET[log.kullaniciRol] || { etiket: log.kullaniciRol, renk: '#374151', bg: '#F1F5F9' }
                  return (
                    <tr key={log.id} style={{ transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>

                      {/* Tarih */}
                      <td style={{ ...s.td, whiteSpace: 'nowrap', color: '#64748B', fontSize: '0.75rem' }}>
                        {formatTarih(log.tarih)}
                      </td>

                      {/* Kullanıcı */}
                      <td style={s.td}>
                        <div style={{ fontWeight: '600', color: '#1E293B', fontSize: '0.825rem' }}>
                          {log.kullaniciAd || '—'}
                        </div>
                        {log.kullaniciRol && (
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '999px', fontWeight: '600', background: rolBilgi.bg, color: rolBilgi.renk, display: 'inline-block', marginTop: '2px' }}>
                            {rolBilgi.etiket}
                          </span>
                        )}
                      </td>

                      {/* Modül */}
                      <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 8px', fontSize: '0.78rem', fontWeight: '600', color: '#374151' }}>
                          {modülBilgi.ikon} {modülBilgi.ad}
                        </span>
                      </td>

                      {/* İşlem */}
                      <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: islemStil.bg, borderRadius: '6px', padding: '3px 8px', fontSize: '0.78rem', fontWeight: '700', color: islemStil.renk }}>
                          <span style={{ fontSize: '0.7rem' }}>{islemStil.ikon}</span>
                          {islemStil.etiket}
                        </span>
                      </td>

                      {/* Hedef */}
                      <td style={{ ...s.td, maxWidth: '220px' }}>
                        <span style={{ fontSize: '0.825rem', color: '#1E293B', fontWeight: '500' }}>
                          {log.hedefAd || '—'}
                        </span>
                      </td>

                      {/* Detay */}
                      <td style={{ ...s.td, maxWidth: '200px', color: '#64748B', fontSize: '0.78rem' }}>
                        {log.detay || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daha Fazla Yükle */}
      {filtrelenmis.length > gorunenSayi && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button onClick={() => setGorunenSayi(n => n + 100)}
            style={{ padding: '0.6rem 1.5rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', color: '#374151', fontWeight: '600' }}>
            ⬇ 100 Kayıt Daha Yükle
          </button>
        </div>
      )}
    </div>
  )
}
