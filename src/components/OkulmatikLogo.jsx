import React from 'react'

export default function OkulmatikLogo({ size = 28, style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {/* Yeşil Dal (Stem) */}
      <path 
        d="M12 2C12 2 12.5 5 15.5 5" 
        stroke="#059669" 
        strokeWidth="2" 
        strokeLinecap="round"
      />
      
      {/* Yeşil Yaprak (Leaf) */}
      <path 
        d="M12 3.5C10.5 4.5 7.5 4 6.5 6C6 7 7 8 8 8C9.5 8 10.5 6.5 12 6" 
        fill="#10B981"
        stroke="#059669" 
        strokeWidth="1.2" 
        strokeLinecap="round"
      />

      {/* Canlı ve Belirgin Renkli Üzüm Taneleri (Her Biri Bir Modül) */}
      {/* Arka Sıra Taneler (Daha Koyu Tonlar) */}
      <circle cx="9.2" cy="9.2" r="2.4" fill="#7C3AED" />
      <circle cx="14.8" cy="9.2" r="2.4" fill="#6D28D9" />
      <circle cx="7.2" cy="13.2" r="2.4" fill="#4F46E5" />
      <circle cx="16.8" cy="13.2" r="2.4" fill="#4338CA" />
      <circle cx="9.2" cy="17.2" r="2.4" fill="#BE185D" />
      <circle cx="14.8" cy="17.2" r="2.4" fill="#9D174D" />

      {/* Ön Sıra Taneler (Daha Açık ve Parlak Tonlar - Boyutsal Etki) */}
      <circle cx="12" cy="8.2" r="2.4" fill="#A78BFA" />
      <circle cx="12" cy="12.2" r="2.4" fill="#818CF8" />
      <circle cx="12" cy="16.2" r="2.4" fill="#F472B6" />
      
      {/* En Alt Tane */}
      <circle cx="12" cy="20.2" r="2.4" fill="#EC4899" />

      {/* Mini Işık Noktaları (Her Tanenin Üzerinde Parlama Efekti) */}
      <circle cx="8.5" cy="8.5" r="0.4" fill="#FFF" fillOpacity="0.8" />
      <circle cx="14.1" cy="8.5" r="0.4" fill="#FFF" fillOpacity="0.8" />
      <circle cx="6.5" cy="12.5" r="0.4" fill="#FFF" fillOpacity="0.8" />
      <circle cx="16.1" cy="12.5" r="0.4" fill="#FFF" fillOpacity="0.8" />
      <circle cx="8.5" cy="16.5" r="0.4" fill="#FFF" fillOpacity="0.8" />
      <circle cx="14.1" cy="16.5" r="0.4" fill="#FFF" fillOpacity="0.8" />
      
      <circle cx="11.3" cy="7.5" r="0.4" fill="#FFF" fillOpacity="0.8" />
      <circle cx="11.3" cy="11.5" r="0.4" fill="#FFF" fillOpacity="0.8" />
      <circle cx="11.3" cy="15.5" r="0.4" fill="#FFF" fillOpacity="0.8" />
      <circle cx="11.3" cy="19.5" r="0.4" fill="#FFF" fillOpacity="0.8" />
    </svg>
  )
}
