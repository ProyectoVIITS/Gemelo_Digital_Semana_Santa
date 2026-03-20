import React from 'react';
import { getColorForOccupancy } from '../lib/utils';

export default function OccupancyGauge({ occupancy }) {
  const color = getColorForOccupancy(occupancy);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - occupancy / 100);

  return (
    <div className="rounded-lg border p-4 flex flex-col items-center justify-center"
      style={{ backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' }}>
      <span className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Ocupación Vial</span>
      <svg width="120" height="120" viewBox="0 0 120 120" className="transform -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#1a2d4a" strokeWidth="8" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center" style={{ marginTop: '-4px' }}>
        <span className="text-2xl font-bold tabular-nums" style={{ color, fontFamily: 'JetBrains Mono, Space Mono, monospace' }}>
          {occupancy}%
        </span>
      </div>
    </div>
  );
}
