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
      {/* Yeşil Yaprak ve Gövde (Bütünleşik Sistem Altyapısı) */}
      <path d="M12 2C12 2 12.5 3.5 14.5 3.5" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 2.5C12 2.5 10.5 3 9.5 4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9.5 4C8.5 5 8.5 6 8.5 6" stroke="#10B981" strokeWidth="1.2"/>
      <path d="M12 2C12.8 2.8 12.8 3.5 11.5 4.3C10.2 5.1 9.5 4.3 9.5 4.3C9.5 4.3 10.2 3.5 11 3.1C11.8 2.7 12 2 12 2Z" fill="#10B981"/>

      {/* Modüller Arası Ağ Bağlantıları (İnce Bağlantı Çizgileri) */}
      <path d="M7.5 7L16.5 7M10.5 6.5L12 10M13.5 6.5L12 10M9 10.5L12 10M15 10.5L12 10M9 10.5L10.5 14M15 10.5L13.5 14M12 10L12 17.5M10.5 14L12 17.5M13.5 14L12 17.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.8"/>

      {/* Her Biri Bir Modülü Temsil Eden Renkli Üzüm Taneleri (Modüler Düğümler) */}
      {/* Üst Sıra */}
      <circle cx="7.5" cy="7" r="2.1" fill="url(#og-grad-1)"/> {/* Modül 1: Kurumlar */}
      <circle cx="10.5" cy="6.5" r="2.1" fill="url(#og-grad-2)"/> {/* Modül 2: Kullanıcılar */}
      <circle cx="13.5" cy="6.5" r="2.1" fill="url(#og-grad-3)"/> {/* Modül 3: Sınıflar */}
      <circle cx="16.5" cy="7" r="2.1" fill="url(#og-grad-4)"/> {/* Modül 4: Öğrenciler */}

      {/* Orta Sıra */}
      <circle cx="9" cy="10.5" r="2.1" fill="url(#og-grad-5)"/> {/* Modül 5: Değerlendirmeler */}
      <circle cx="12" cy="10" r="2.1" fill="url(#og-grad-6)"/> {/* Modül 6: Rubrikler */}
      <circle cx="15" cy="10.5" r="2.1" fill="url(#og-grad-7)"/> {/* Modül 7: Kütüphane */}

      {/* Alt Sıra */}
      <circle cx="10.5" cy="14" r="2.1" fill="url(#og-grad-8)"/> {/* Modül 8: Nöbetçi Öğretmen */}
      <circle cx="13.5" cy="14" r="2.1" fill="url(#og-grad-9)"/> {/* Modül 9: Öğrenci Kulüpleri */}

      {/* En Alt Tane */}
      <circle cx="12" cy="17.5" r="2.1" fill="url(#og-grad-10)"/> {/* Modül 10: Raporlama ve Analiz */}

      {/* İnce Parlama Efektleri (Her Tanenin Sol Üstünde Hafif Noktalar) */}
      <circle cx="6.8" cy="6.3" r="0.4" fill="#ffffff" fillOpacity="0.6"/>
      <circle cx="9.8" cy="5.8" r="0.4" fill="#ffffff" fillOpacity="0.6"/>
      <circle cx="12.8" cy="5.8" r="0.4" fill="#ffffff" fillOpacity="0.6"/>
      <circle cx="15.8" cy="6.3" r="0.4" fill="#ffffff" fillOpacity="0.6"/>
      <circle cx="8.3" cy="9.8" r="0.4" fill="#ffffff" fillOpacity="0.6"/>
      <circle cx="11.3" cy="9.3" r="0.4" fill="#ffffff" fillOpacity="0.6"/>
      <circle cx="14.3" cy="9.8" r="0.4" fill="#ffffff" fillOpacity="0.6"/>
      <circle cx="9.8" cy="13.3" r="0.4" fill="#ffffff" fillOpacity="0.6"/>
      <circle cx="12.8" cy="13.3" r="0.4" fill="#ffffff" fillOpacity="0.6"/>
      <circle cx="11.3" cy="16.8" r="0.4" fill="#ffffff" fillOpacity="0.6"/>

      {/* Renk Gradyanları Tanımları */}
      <defs>
        <linearGradient id="og-grad-1" x1="7.5" y1="4.9" x2="7.5" y2="9.1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C084FC"/>
          <stop offset="100%" stopColor="#7E22CE"/>
        </linearGradient>
        <linearGradient id="og-grad-2" x1="10.5" y1="4.4" x2="10.5" y2="8.6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818CF8"/>
          <stop offset="100%" stopColor="#4338CA"/>
        </linearGradient>
        <linearGradient id="og-grad-3" x1="13.5" y1="4.4" x2="13.5" y2="8.6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F472B6"/>
          <stop offset="100%" stopColor="#BE185D"/>
        </linearGradient>
        <linearGradient id="og-grad-4" x1="16.5" y1="4.9" x2="16.5" y2="9.1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8"/>
          <stop offset="100%" stopColor="#0369A1"/>
        </linearGradient>
        <linearGradient id="og-grad-5" x1="9" y1="8.4" x2="9" y2="12.6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24"/>
          <stop offset="100%" stopColor="#D97706"/>
        </linearGradient>
        <linearGradient id="og-grad-6" x1="12" y1="7.9" x2="12" y2="12.1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399"/>
          <stop offset="100%" stopColor="#059669"/>
        </linearGradient>
        <linearGradient id="og-grad-7" x1="15" y1="8.4" x2="15" y2="12.6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB7185"/>
          <stop offset="100%" stopColor="#E11D48"/>
        </linearGradient>
        <linearGradient id="og-grad-8" x1="10.5" y1="11.9" x2="10.5" y2="16.1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A78BFA"/>
          <stop offset="100%" stopColor="#6D28D9"/>
        </linearGradient>
        <linearGradient id="og-grad-9" x1="13.5" y1="11.9" x2="13.5" y2="16.1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2DD4BF"/>
          <stop offset="100%" stopColor="#0D9488"/>
        </linearGradient>
        <linearGradient id="og-grad-10" x1="12" y1="15.4" x2="12" y2="19.6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EC4899"/>
          <stop offset="100%" stopColor="#C11574"/>
        </linearGradient>
      </defs>
    </svg>
  )
}
