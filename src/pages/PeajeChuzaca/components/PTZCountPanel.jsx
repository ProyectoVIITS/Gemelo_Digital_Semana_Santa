import React from 'react';
import { Camera, Car, Truck, Bus } from 'lucide-react';

export default function PTZCountPanel({ counting }) {
  return (
    <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' }}>
      <div className="flex items-center gap-2 mb-1">
        <Camera className="w-4 h-4 text-cyan-400" />
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Cámara PTZ — Conteo Vehicular</span>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-slate-500">Conteo Hoy</p>
          <p className="text-xl font-bold text-white tabular-nums" style={{ fontFamily: 'JetBrains Mono, Space Mono, monospace' }}>
            {counting.totalCount}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Última Hora</p>
          <p className="text-xl font-bold tabular-nums" style={{
            color: '#0ea5e9',
            fontFamily: 'JetBrains Mono, Space Mono, monospace',
          }}>
            {counting.lastHourCount}
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Distribución por categoría</p>
        {[
          { icon: Car, label: 'C1 — Automóviles', count: counting.byCategory.C1, color: '#38bdf8' },
          { icon: Bus, label: 'C2 — Buses', count: counting.byCategory.C2, color: '#f97316' },
          { icon: Truck, label: 'C3-C5 — Carga', count: counting.byCategory.heavy, color: '#a78bfa' },
        ].map(({ icon: Icon, label, count, color }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="w-3 h-3" style={{ color }} />
            <span className="text-[10px] text-slate-400 flex-1">{label}</span>
            <span className="text-xs font-mono font-bold" style={{ color }}>{count}</span>
            <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min((count / Math.max(counting.totalCount, 1)) * 100, 100)}%`, backgroundColor: color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Last detection */}
      <div className="rounded p-2 border text-xs"
        style={{ backgroundColor: 'rgba(30, 58, 95, 0.4)', borderColor: '#1a2d4a' }}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-slate-400">Última detección</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-slate-300">{counting.lastPlate}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            color: '#a78bfa',
          }}>
            {counting.lastCategory}
          </span>
          <span className="font-mono text-cyan-400 text-[10px]">
            {counting.lastSpeed} km/h
          </span>
        </div>
      </div>
    </div>
  );
}
