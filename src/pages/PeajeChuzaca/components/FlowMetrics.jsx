import React from 'react';
import { Car, TrendingUp, Gauge, LayoutGrid } from 'lucide-react';
import { getColorForSpeed, getColorForOccupancy } from '../lib/utils';

const metrics = [
  { key: 'vehiclesTotal', label: 'Vehículos Hoy', icon: Car, format: v => v.toLocaleString('es-CO'), colorFn: () => '#0ea5e9' },
  { key: 'vehiclesHour', label: 'Flujo / Hora', icon: TrendingUp, format: v => `${v} veh/h`, colorFn: () => '#6366f1' },
  { key: 'avgSpeed', label: 'Velocidad Media', icon: Gauge, format: v => `${v} km/h`, colorFn: v => getColorForSpeed(v) },
  { key: 'occupancy', label: 'Ocupación Vial', icon: LayoutGrid, format: v => `${v}%`, colorFn: v => getColorForOccupancy(v) },
];

export default function FlowMetrics({ flow }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {metrics.map(({ key, label, icon: Icon, format, colorFn }) => {
        const value = flow[key];
        const color = colorFn(value);
        return (
          <div key={key} className="rounded-lg border p-3"
            style={{ backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: `${color}25` }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Icon className="w-3.5 h-3.5" style={{ color }} />
              <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
            </div>
            <span className="text-lg font-bold tabular-nums" style={{ color, fontFamily: 'JetBrains Mono, Space Mono, monospace' }}>
              {format(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
