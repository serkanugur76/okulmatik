import React from 'react'
import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import DersTanimlari from './DersProgrami/DersTanimlari'
import OgretmenSartlari from './DersProgrami/OgretmenSartlari'
import IsYukuPlanlama from './DersProgrami/IsYukuPlanlama'

export default function DersProgramiYonetimi() {
  return (
    <div className="sayfa-container" style={{ padding: '1.5rem', background: '#F8FAFC', minHeight: '100%' }}>
      <div className="sayfa-baslik" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
          <span style={{ fontSize: '1.75rem' }}>📆</span>
          Ders & İş Yükü Yönetimi
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          MEB standartlarına göre dersleri, öğretmenlerin çalışma şartlarını ve atanabilir iş yüklerini yönetin.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #E2E8F0', marginBottom: '1.5rem' }}>
        <NavLink 
          to="dersler" 
          style={({isActive}) => ({
            padding: '0.75rem 1.5rem', fontWeight: '600', color: isActive ? '#4338CA' : '#64748B',
            borderBottom: isActive ? '3px solid #4338CA' : '3px solid transparent', textDecoration: 'none', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '-2px'
          })}
        >
          📚 Ders Tanımları
        </NavLink>
        <NavLink 
          to="ogretmenler" 
          style={({isActive}) => ({
            padding: '0.75rem 1.5rem', fontWeight: '600', color: isActive ? '#4338CA' : '#64748B',
            borderBottom: isActive ? '3px solid #4338CA' : '3px solid transparent', textDecoration: 'none', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '-2px'
          })}
        >
          👨‍🏫 Öğretmen Şartları
        </NavLink>
        <NavLink 
          to="is-yuku" 
          style={({isActive}) => ({
            padding: '0.75rem 1.5rem', fontWeight: '600', color: isActive ? '#4338CA' : '#64748B',
            borderBottom: isActive ? '3px solid #4338CA' : '3px solid transparent', textDecoration: 'none', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '-2px'
          })}
        >
          ⚖️ İş Yükü Planlama
        </NavLink>
      </div>

      <div className="tab-icerik">
        <Routes>
          <Route path="/" element={<Navigate to="dersler" replace />} />
          <Route path="dersler" element={<DersTanimlari />} />
          <Route path="ogretmenler" element={<OgretmenSartlari />} />
          <Route path="is-yuku" element={<IsYukuPlanlama />} />
        </Routes>
      </div>
    </div>
  )
}
