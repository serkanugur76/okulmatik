import { useState, useEffect } from 'react'

/**
 * Kademeli kurum seçici: Kurum → Kampüs → Alt Kurum
 * value: seçili ID
 * onChange: (id) => void
 * kurumlar: [{id, ad, tip, parentId}]
 */
export default function KurumSecici({ value, onChange, kurumlar, style }) {
  const kokler   = kurumlar.filter(k => !k.parentId)
  const [secKurum,   setSecKurum]   = useState('')
  const [secKampus,  setSecKampus]  = useState('')
  const [secAltKurum, setSecAltKurum] = useState('')

  // Dışarıdan value değişirse sıfırla
  useEffect(() => {
    if (!value) { setSecKurum(''); setSecKampus(''); setSecAltKurum('') }
  }, [value])

  const kampusler   = kurumlar.filter(k => k.parentId === secKurum)
  const altKurumlar = kurumlar.filter(k => k.parentId === secKampus)

  function kurumSec(id) {
    setSecKurum(id)
    setSecKampus('')
    setSecAltKurum('')
    onChange(id)
  }

  function kampusSec(id) {
    setSecKampus(id)
    setSecAltKurum('')
    onChange(id)
  }

  function altKurumSec(id) {
    setSecAltKurum(id)
    onChange(id)
  }

  const inputStyle = { ...style, marginBottom: '0.5rem' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Kurum */}
      <select value={secKurum} onChange={e => kurumSec(e.target.value)} style={inputStyle}>
        <option value="">— Kurum seçin —</option>
        {kokler.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
      </select>

      {/* Kampüs — sadece kampüs varsa göster */}
      {secKurum && kampusler.length > 0 && (
        <select value={secKampus} onChange={e => kampusSec(e.target.value)} style={inputStyle}>
          <option value="">— Kampüs seçin (opsiyonel) —</option>
          {kampusler.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
        </select>
      )}

      {/* Alt Kurum — sadece alt kurum varsa göster */}
      {secKampus && altKurumlar.length > 0 && (
        <select value={secAltKurum} onChange={e => altKurumSec(e.target.value)} style={inputStyle}>
          <option value="">— Alt kurum seçin (opsiyonel) —</option>
          {altKurumlar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
        </select>
      )}
    </div>
  )
}
