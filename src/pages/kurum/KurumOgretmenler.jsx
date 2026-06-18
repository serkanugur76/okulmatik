import { useEffect, useState, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  collection, onSnapshot, query, orderBy
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useKurumYonetim } from '../../contexts/KurumYonetimContext'
import { useAuth } from '../../contexts/AuthContext'

export default function KurumOgretmenler() {
  const { secilenKurumId, secilenKurum, erisimKurumlar, ogretmenModu } = useKurumYonetim()
  const { profil } = useAuth()

  const ust = erisimKurumlar.find(k => k.id === secilenKurum?.parentId)
  const seviye = !secilenKurum?.parentId ? 'root' : !ust?.parentId ? 'kampus' : 'altKurum'

  // Alt kurumlar listesi (seçim için)
  const sayimKurumlar = useMemo(() => {
    if (seviye === 'root') return erisimKurumlar.filter(k => k.rootKurumId === secilenKurumId && k.tip === 'altKurum')
    if (seviye === 'kampus') return erisimKurumlar.filter(k => k.parentId === secilenKurumId && k.tip === 'altKurum')
    return secilenKurum ? [secilenKurum] : []
  }, [seviye, secilenKurumId, erisimKurumlar, secilenKurum])

  // URL parameters for sub-institution selection persistence
  const [searchParams, setSearchParams] = useSearchParams()
  function updateParam(updates) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([k, v]) => {
        if (v != null && v !== '') next.set(k, String(v))
        else next.delete(k)
      })
      return next
    }, { replace: true })
  }

  const secilenAltKurumId = searchParams.get('ak') || ''
  function setSecilenAltKurumId(id) { updateParam({ ak: id }) }

  // Reset selected altKurum when parent institution changes
  const altKurumInitRef = useRef(false)
  useEffect(() => {
    if (!secilenKurumId) return
    if (!altKurumInitRef.current) { altKurumInitRef.current = true; return }
    updateParam({ ak: null })
  }, [secilenKurumId])

  // Active leaf school ID for data queries
  const hedefKurumId = ogretmenModu
    ? (secilenKurumId || null)
    : seviye === 'altKurum' ? secilenKurumId : (secilenAltKurumId || null)

  // ── State variables ───────────────────────────────────────
  const [kullanicilar, setKullanicilar] = useState([])
  const [siniflar, setSiniflar] = useState([])
  const [aramaMetni, setAramaMetni] = useState('')
  const [bransFiltre, setBransFiltre] = useState('')
  const [koordinatorFiltre, setKoordinatorFiltre] = useState('hepsi') // 'hepsi' | 'koordinator' | 'normal'

  // ── Firestore Listeners ───────────────────────────────────
  useEffect(() => {
    if (!hedefKurumId) {
      setKullanicilar([])
      setSiniflar([])
      return
    }

    // Teachers / Users subcollection listener
    const qKullanicilar = query(collection(db, 'kurumlar', hedefKurumId, 'kullanicilar'), orderBy('ad', 'asc'))
    const unsubKullanicilar = onSnapshot(qKullanicilar, snap => {
      setKullanicilar(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => {
      console.error("Kullanıcılar dinleme hatası:", err)
    })

    // Classes subcollection listener
    const qSiniflar = query(collection(db, 'kurumlar', hedefKurumId, 'siniflar'), orderBy('ad', 'asc'))
    const unsubSiniflar = onSnapshot(qSiniflar, snap => {
      setSiniflar(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => {
      console.error("Sınıflar dinleme hatası:", err)
    })

    return () => {
      unsubKullanicilar()
      unsubSiniflar()
    }
  }, [hedefKurumId])

  // Only teachers list
  const ogretmenler = useMemo(() => {
    return kullanicilar.filter(k => k.rol === 'ogretmen')
  }, [kullanicilar])

  // Classes map for quick lookup: ID -> class object
  const sinifMap = useMemo(() => {
    return new Map(siniflar.map(s => [s.id, s]))
  }, [siniflar])

  // Get resolved class names list for a teacher
  const getOgretmenSinifAdlari = (ogretmen) => {
    const atamalar = ogretmen.sinifAtamalari || []
    // Get class IDs for the active school
    const activeAtama = atamalar.find(a => a.kurumId === hedefKurumId)
    if (!activeAtama || !activeAtama.siniflar) return []
    return activeAtama.siniflar
      .map(cid => sinifMap.get(cid)?.ad)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'tr'))
  };

  // Distinct branches list for filter select
  const branslarListesi = useMemo(() => {
    const set = new Set()
    ogretmenler.forEach(o => {
      const branches = o.branslar || []
      branches.forEach(b => {
        if (b && b.trim()) set.add(b.trim())
      })
    })
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [ogretmenler])

  // ── Statistics calculation ───────────────────────────────
  const istatistikler = useMemo(() => {
    const toplamOgretmen = ogretmenler.length
    const koordinatorSayisi = ogretmenler.filter(o => o.modulIzinler?.rubrik_olustur).length
    const benzersizBransSayisi = branslarListesi.length
    const atamasizSayisi = ogretmenler.filter(o => {
      const activeAtama = (o.sinifAtamalari || []).find(a => a.kurumId === hedefKurumId)
      return !activeAtama || !activeAtama.siniflar || activeAtama.siniflar.length === 0
    }).length

    return {
      toplamOgretmen,
      koordinatorSayisi,
      benzersizBransSayisi,
      atamasizSayisi
    }
  }, [ogretmenler, branslarListesi, hedefKurumId])

  // ── Filtered Teachers ─────────────────────────────────────
  const filtreliOgretmenler = useMemo(() => {
    return ogretmenler.filter(o => {
      const sinifAdlari = getOgretmenSinifAdlari(o)
      const matchesSearch = !aramaMetni ||
        (o.ad || '').toLowerCase().includes(aramaMetni.toLowerCase()) ||
        (o.email || '').toLowerCase().includes(aramaMetni.toLowerCase()) ||
        (o.branslar || []).some(b => b.toLowerCase().includes(aramaMetni.toLowerCase())) ||
        sinifAdlari.some(sa => sa.toLowerCase().includes(aramaMetni.toLowerCase()))

      const matchesBranch = !bransFiltre || (o.branslar || []).includes(bransFiltre)

      let matchesKoordinator = true
      if (koordinatorFiltre === 'koordinator') {
        matchesKoordinator = !!o.modulIzinler?.rubrik_olustur
      } else if (koordinatorFiltre === 'normal') {
        matchesKoordinator = !o.modulIzinler?.rubrik_olustur
      }

      return matchesSearch && matchesBranch && matchesKoordinator
    })
  }, [ogretmenler, aramaMetni, bransFiltre, koordinatorFiltre, sinifMap, hedefKurumId]) // eslint-disable-line

  // Styles
  const styles = {
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' },
    statCard: {
      background: 'rgba(255, 255, 255, 0.75)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      borderRadius: '16px',
      padding: '1.25rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      transition: 'all 0.2s ease'
    },
    statIcon: {
      width: '48px', height: '48px', borderRadius: '12px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.5rem', fontWeight: 'bold'
    },
    tableHeader: { padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    tableRow: { transition: 'background-color 0.15s ease' },
    tableCell: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#1E293B', borderBottom: '1px solid #F1F5F9' },
    input: { padding: '0.65rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', color: '#1E293B' },
    select: { padding: '0.65rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', color: '#1E293B', background: '#fff', cursor: 'pointer' },
    badge: { display: 'inline-block', fontSize: '0.72rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', marginRight: '4px', marginBottom: '4px' },
    bransBadge: { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' },
    sinifBadge: { background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }
  }

  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            🧑‍🏫 Öğretmen Listesi
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.925rem', marginTop: '0.25rem' }}>
            Kurum öğretmenleri, ders branşları, koordinatörlük yetkileri ve aktif sınıf atamaları
          </p>
        </div>

        {/* Institution dropdown if platform admin or campus managers */}
        {seviye !== 'altKurum' && !ogretmenModu && (
          <div style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', border: '1px solid #C7D2FE', borderRadius: '12px', padding: '0.75rem 1.125rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#3730A3' }}>🏫 Okul Seçimi:</span>
            <select value={secilenAltKurumId} onChange={e => setSecilenAltKurumId(e.target.value)}
              style={{ padding: '6px 12px', border: '1.5px solid #4F46E5', borderRadius: '8px', fontSize: '0.875rem', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: '600' }}>
              <option value="">— Öğretmenleri listelenecek okulu seçin —</option>
              {(() => {
                const OKUL_SIRA = { ilkokul: 1, ortaokul: 2, lise: 3 }
                const kampusIdler = [...new Set(sayimKurumlar.map(k => k.parentId).filter(Boolean))]
                const kampusGruplari = kampusIdler
                  .map(kpId => ({
                    kampus: erisimKurumlar.find(x => x.id === kpId),
                    altlar: sayimKurumlar
                      .filter(k => k.parentId === kpId)
                      .sort((a, b) => (OKUL_SIRA[a.okulTuru] || 9) - (OKUL_SIRA[b.okulTuru] || 9) || (a.ad || '').localeCompare(b.ad || '', 'tr')),
                  }))
                  .filter(g => g.kampus)
                  .sort((a, b) => (a.kampus.ad || '').localeCompare(b.kampus.ad || '', 'tr'))

                return kampusGruplari.map(({ kampus, altlar }) => (
                  <optgroup key={kampus.id} label={`🏛 ${kampus.ad}`}>
                    {altlar.map(k => (
                      <option key={k.id} value={k.id}>{k.ad}</option>
                    ))}
                  </optgroup>
                ))
              })()}
            </select>
          </div>
        )}
      </div>

      {!hedefKurumId ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.6)', border: '1.5px dashed #CBD5E1', borderRadius: '16px' }}>
          <span style={{ fontSize: '3rem' }}>🧑‍🏫</span>
          <h3 style={{ color: '#1E293B', marginTop: '1rem', fontSize: '1.1rem', fontWeight: '700' }}>Aktif Okul Seçilmedi</h3>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: '0.5rem', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
            Öğretmen listesini görüntülemek ve sınıf atamalarını incelemek için lütfen yukarıdaki menüden bir okul seçin.
          </p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={{ ...styles.statIcon, background: '#E0E7FF', color: '#4F46E5' }}>👥</div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Toplam Öğretmen</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', marginTop: '0.15rem' }}>{istatistikler.toplamOgretmen}</div>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={{ ...styles.statIcon, background: '#FEF3C7', color: '#D97706' }}>⭐</div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Koordinatör Sayısı</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', marginTop: '0.15rem' }}>{istatistikler.koordinatorSayisi}</div>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={{ ...styles.statIcon, background: '#ECFDF5', color: '#059669' }}>📚</div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Farklı Branş</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', marginTop: '0.15rem' }}>{istatistikler.benzersizBransSayisi}</div>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={{ ...styles.statIcon, background: '#FEF2F2', color: '#DC2626' }}>🎒</div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Atamasız Öğretmen</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', marginTop: '0.15rem' }}>{istatistikler.atamasizSayisi}</div>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <input value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
              placeholder="Öğretmen adı, e-posta, branş veya sınıf ara..."
              style={{ ...styles.input, width: '300px' }} />

            <select value={bransFiltre} onChange={e => setBransFiltre(e.target.value)}
              style={{ ...styles.select, width: '180px' }}>
              <option value="">— Tüm Branşlar —</option>
              {branslarListesi.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <select value={koordinatorFiltre} onChange={e => setKoordinatorFiltre(e.target.value)}
              style={{ ...styles.select, width: '180px' }}>
              <option value="hepsi">Tüm Yetkiler</option>
              <option value="koordinator">Sadece Koordinatörler ⭐</option>
              <option value="normal">Normal Yetki</option>
            </select>

            {(aramaMetni || bransFiltre || koordinatorFiltre !== 'hepsi') && (
              <button onClick={() => { setAramaMetni(''); setBransFiltre(''); setKoordinatorFiltre('hepsi') }}
                style={{ padding: '0.55rem 1.1rem', fontSize: '0.875rem', fontWeight: '600', borderRadius: '8px', cursor: 'pointer', border: '1.5px solid #D1D5DB', background: '#fff', color: '#374151' }}>
                Temizle
              </button>
            )}
          </div>

          {/* Table representation */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Öğretmen Adı Soyadı</th>
                  <th style={styles.tableHeader}>E-posta Adresi</th>
                  <th style={styles.tableHeader}>Branşlar</th>
                  <th style={styles.tableHeader}>Koordinatör mü?</th>
                  <th style={styles.tableHeader}>Atandığı Sınıflar</th>
                </tr>
              </thead>
              <tbody>
                {filtreliOgretmenler.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                      Kriterlere uygun öğretmen bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filtreliOgretmenler.map(o => {
                    const siniflarList = getOgretmenSinifAdlari(o)
                    const koordinator = !!o.modulIzinler?.rubrik_olustur
                    return (
                      <tr key={o.id} style={styles.tableRow} className="table-row-hover">
                        <td style={{ ...styles.tableCell, fontWeight: '700', color: '#1B3A6B' }}>{o.ad || '—'}</td>
                        <td style={styles.tableCell}>{o.email || '—'}</td>
                        <td style={styles.tableCell}>
                          {o.branslar && o.branslar.length > 0 ? (
                            o.branslar.map(b => (
                              <span key={b} style={{ ...styles.badge, ...styles.bransBadge }}>{b}</span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontStyle: 'italic' }}>Tanımlanmamış</span>
                          )}
                        </td>
                        <td style={styles.tableCell}>
                          {koordinator ? (
                            <span style={{ fontSize: '0.75rem', background: '#FEF3C7', color: '#92400E', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
                              Evet ⭐ (Koordinatör)
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Hayır</span>
                          )}
                        </td>
                        <td style={styles.tableCell}>
                          {siniflarList.length > 0 ? (
                            siniflarList.map(s => (
                              <span key={s} style={{ ...styles.badge, ...styles.sinifBadge }}>{s}</span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.75rem', background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>Sınıf Ataması Yok</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
