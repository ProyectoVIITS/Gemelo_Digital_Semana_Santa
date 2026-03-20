import React, { useState } from 'react';
import { Eye, Satellite, MapPin } from 'lucide-react';
import { MAPS, CHUZACA } from '../lib/constants';

const TABS = [
  { id: 'street', label: 'Street View', icon: Eye, url: MAPS.streetView, credit: 'Google Street View — Datos abiertos / uso libre' },
  { id: 'satellite', label: 'Satélite', icon: Satellite, url: MAPS.satellite, credit: 'Google Maps Satellite — Embed público' },
  { id: 'osm', label: 'OpenStreetMap', icon: MapPin, url: MAPS.osm, credit: 'OpenStreetMap — ODbL 1.0' },
];

export default function StreetViewPanel() {
  const [activeTab, setActiveTab] = useState('street');
  const tab = TABS.find(t => t.id === activeTab);

  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' }}>
      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: '#1a2d4a' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs transition-colors cursor-pointer"
            style={{
              color: activeTab === id ? '#0ea5e9' : '#475569',
              borderBottom: activeTab === id ? '2px solid #0ea5e9' : '2px solid transparent',
              backgroundColor: activeTab === id ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Iframe container */}
      <div className="relative">
        {/* Coordinate overlay */}
        <div className="absolute top-2 left-2 z-10 rounded px-2 py-1 text-[10px] font-mono"
          style={{ backgroundColor: 'rgba(4, 10, 20, 0.8)', color: '#0ea5e9' }}>
          {CHUZACA.coordinates.dms} · {CHUZACA.coordinates.altitude}m
        </div>
        <iframe
          src={tab.url}
          width="100%"
          height="300"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={tab.label}
        />
      </div>

      {/* Credit footer */}
      <div className="px-3 py-1.5 text-[9px] font-mono text-slate-600 border-t" style={{ borderColor: '#1a2d4a' }}>
        {tab.credit}
      </div>
    </div>
  );
}
