import React from 'react'

export default function IhtiyacAnaliziModal({ 
  kapat, 
  seciliKurumId, 
  siniflar, 
  dersler, 
  ogretmenler, 
  sartlar, 
  atamalar 
}) {
  
  // 1. Her branş için temel ihtiyacı hesapla (Dersin ana branşına göre)
  const bransIhtiyaclari = {}
  
  siniflar.forEach(sinif => {
    dersler.forEach(ders => {
      const saat = ders.saatler?.[sinif.seviye] || 0
      if (saat > 0) {
        // Dersin birincil branşı (atanabilirBranslar'ın ilki veya brans)
        const anaBrans = ders.atanabilirBranslar?.[0] || ders.brans || 'Tanımsız'
        if (!bransIhtiyaclari[anaBrans]) bransIhtiyaclari[anaBrans] = { gerekenSaat: 0, mevcutKapasite: 0, ogretmenler: [] }
        bransIhtiyaclari[anaBrans].gerekenSaat += saat
      }
    })
  })

  // 2. Her branşın mevcut öğretmen kapasitesini hesapla
  // Sadece bu kurumda çalışabilen öğretmenler
  const kurumOgretmenleri = ogretmenler.filter(ogr => {
    const srt = sartlar[ogr.id]
    if (!srt) return true 
    if (srt.kurumKisitlari && srt.kurumKisitlari.length > 0) {
      return srt.kurumKisitlari.includes(seciliKurumId)
    }
    return true
  })

  kurumOgretmenleri.forEach(ogr => {
    const srt = sartlar[ogr.id]
    const brans = srt?.brans || 'Tanımsız'
    const kapasite = srt?.toplamSaat || 30 // Varsayılan 30 saat
    
    // Öğretmenin atandığı toplam saat (bu kurumda veya genel)
    const atananSaat = atamalar.filter(a => a.ogretmenId === ogr.id).reduce((sum, a) => sum + (a.planlananSaat || 0), 0)
    const bosSaat = Math.max(0, kapasite - atananSaat)

    if (!bransIhtiyaclari[brans]) bransIhtiyaclari[brans] = { gerekenSaat: 0, mevcutKapasite: 0, ogretmenler: [] }
    
    bransIhtiyaclari[brans].mevcutKapasite += kapasite
    bransIhtiyaclari[brans].ogretmenler.push({ ad: ogr.ad, kapasite, atananSaat, bosSaat })
  })

  // 3. Akıllı Öneriler (Optimizasyon)
  const oneriler = []
  
  // Hangi dersler çapraz branşlara verilebilir?
  siniflar.forEach(sinif => {
    dersler.forEach(ders => {
      const hedefSaat = ders.saatler?.[sinif.seviye] || 0
      if (hedefSaat === 0) return;
      
      const atama = atamalar.find(a => a.sinifId === sinif.id && a.dersId === ders.id)
      if (atama) return; // Zaten atanmış
      
      const anaBrans = ders.atanabilirBranslar?.[0] || ders.brans
      const alternatifBranslar = ders.atanabilirBranslar?.slice(1) || []
      
      if (alternatifBranslar.length > 0) {
        // Bu dersin ana branşında açık var mı?
        const anaBransDurumu = bransIhtiyaclari[anaBrans]
        const anaBransAcik = anaBransDurumu ? (anaBransDurumu.gerekenSaat - anaBransDurumu.mevcutKapasite > 0) : true
        
        if (anaBransAcik) {
          // Alternatif branşlarda boşluğu olan öğretmen var mı?
          alternatifBranslar.forEach(altBrans => {
            const altDurum = bransIhtiyaclari[altBrans]
            if (altDurum && altDurum.ogretmenler) {
              const bosHocalar = altDurum.ogretmenler.filter(o => o.bosSaat >= hedefSaat)
              if (bosHocalar.length > 0) {
                oneriler.push({
                  dersAd: ders.ad,
                  sinifAd: `${sinif.seviye}. Sınıf ${sinif.sube}`,
                  saat: hedefSaat,
                  anaBrans: anaBrans,
                  altBrans: altBrans,
                  hocaAdlari: bosHocalar.map(h => h.ad).join(', ')
                })
              }
            }
          })
        }
      }
    })
  })

  // Sonuçları sırala
  const bransListesi = Object.keys(bransIhtiyaclari).sort()

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '2rem' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📊 Öğretmen İhtiyaç (Norm Kadro) Analizi
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#64748B', fontSize: '0.9rem' }}>
              MEB yönetmeliği ve çapraz branş atama mantığına göre kurumunuzun kaynak optimizasyon raporu.
            </p>
          </div>
          <button onClick={kapat} style={{ background: '#F1F5F9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Akıllı Öneriler Section */}
          {oneriler.length > 0 && (
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '16px', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💡 Yapay Zeka Tasarruf Önerileri
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {oneriler.map((oneri, idx) => (
                  <div key={idx} style={{ background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ fontSize: '1.5rem' }}>🔄</div>
                    <div>
                      <div style={{ fontWeight: '600', color: '#166534', marginBottom: '0.25rem' }}>
                        {oneri.sinifAd} - {oneri.dersAd} ({oneri.saat} Saat)
                      </div>
                      <div style={{ color: '#15803D', fontSize: '0.9rem', lineHeight: '1.5' }}>
                        Bu ders normalde <strong>{oneri.anaBrans}</strong> öğretmenlerine verilir. Ancak okulunuzdaki <strong>{oneri.altBrans}</strong> öğretmeni olan <strong>{oneri.hocaAdlari}</strong> müsait durumda. Bu dersi ona atayarak {oneri.anaBrans} ihtiyacınızı {oneri.saat} saat azaltabilirsiniz.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Branş Bazlı Tablo */}
          <div>
            <h3 style={{ margin: '0 0 1rem', color: '#1E293B' }}>Branş Bazlı Kapasite Durumu</h3>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F8FAFC' }}>
                  <tr>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: '600' }}>Branş Adı</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: '600', textAlign: 'center' }}>Mevcut Öğretmenler</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: '600', textAlign: 'center' }}>Toplam Kapasite</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: '600', textAlign: 'center' }}>Gereken Ders Yükü</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: '600', textAlign: 'center' }}>Fark (Norm Durumu)</th>
                  </tr>
                </thead>
                <tbody>
                  {bransListesi.map(brans => {
                    const veri = bransIhtiyaclari[brans]
                    const fark = veri.mevcutKapasite - veri.gerekenSaat
                    let durumRenk = '#64748B'
                    let durumText = 'Dengeli'
                    
                    if (fark < 0) {
                      durumRenk = '#DC2626'
                      durumText = `${Math.abs(fark)} Saat AÇIK`
                    } else if (fark > 0) {
                      durumRenk = '#059669'
                      durumText = `${fark} Saat FAZLA`
                    }

                    return (
                      <tr key={brans} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '1rem', fontWeight: '600', color: '#334155' }}>{brans}</td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          {veri.ogretmenler.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {veri.ogretmenler.map((o, i) => (
                                <span key={i} style={{ fontSize: '0.85rem', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>
                                  {o.ad} ({o.atananSaat}/{o.kapasite})
                                </span>
                              ))}
                            </div>
                          ) : <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Öğretmen Yok</span>}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>{veri.mevcutKapasite} Saat</td>
                        <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>{veri.gerekenSaat} Saat</td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <span style={{ background: `${durumRenk}15`, color: durumRenk, padding: '0.4rem 0.75rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.9rem' }}>
                            {durumText}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {bransListesi.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>Gösterilecek veri bulunamadı.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}
