/**
 * Kurum / Kampüs / Alt Kurum hiyerarşisini girintili olarak gösteren select bileşeni.
 * value: seçili kurumun Firestore ID'si
 * onChange: (id) => void
 * kurumlar: Firestore'dan gelen düz liste [{id, ad, tip, parentId}]
 */
export default function KurumSecici({ value, onChange, kurumlar, style }) {
  const secenek = hiyerarsiOlustur(kurumlar)

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={style}
    >
      <option value="">— Seçin —</option>
      {secenek.map(s => (
        <option key={s.id} value={s.id}>
          {s.onEk}{s.ad}
        </option>
      ))}
    </select>
  )
}

const SP = ' '

function hiyerarsiOlustur(liste) {
  const map = {}
  liste.forEach(k => { map[k.id] = { ...k, cocuklar: [] } })
  const kokler = []
  liste.forEach(k => {
    if (k.parentId && map[k.parentId]) map[k.parentId].cocuklar.push(map[k.id])
    else if (!k.parentId) kokler.push(map[k.id])
  })
  const sonuc = []
  function gez(dugum, derinlik) {
    const onEk = derinlik === 0 ? '' : SP.repeat(derinlik * 3) + '↳' + SP
    sonuc.push({ id: dugum.id, ad: dugum.ad, onEk })
    dugum.cocuklar.forEach(c => gez(c, derinlik + 1))
  }
  kokler.forEach(k => gez(k, 0))
  return sonuc
}
