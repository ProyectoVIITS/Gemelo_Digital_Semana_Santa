import React, { useState, useEffect } from 'react';
import { Globe, Satellite, MapPin, BarChart3 } from 'lucide-react';
import { CHUZACA } from '../lib/constants';

const sources = [
  { icon: Globe, label: 'Google Street View' },
  { icon: Satellite, label: 'Copernicus/ESA' },
  { icon: MapPin, label: 'OpenStreetMap' },
  { icon: BarChart3, label: 'INVÍAS VIITS (sim.)' },
];

export default function StatusBar() {
  const [ts, setTs] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTs(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 h-8 flex items-center justify-between px-4 text-[9px] font-mono"
      style={{
        backgroundColor: '#040a14',
        borderTop: '1px solid #1a2d4a',
        color: '#475569',
      }}>
      <span>
        {CHUZACA.coordinates.dms} · ALT {CHUZACA.coordinates.altitude}m
      </span>
      <div className="flex items-center gap-3">
        {sources.map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1">
            <Icon className="w-3 h-3" />
            {label}
          </span>
        ))}
      </div>
      <span>
        {ts.toLocaleString('es-CO', { hour12: false })} · VIITS-NEXUS v0.1-PILOT
      </span>
    </footer>
  );
}
