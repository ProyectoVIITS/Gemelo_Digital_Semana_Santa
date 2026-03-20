import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded px-3 py-2 text-xs font-mono" style={{
      backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0',
    }}>
      <p className="text-slate-400 mb-1">{label}</p>
      <p style={{ color: '#38bdf8' }}>Velocidad: {payload[0]?.value} km/h</p>
      {payload[0]?.payload?.violations > 0 && (
        <p style={{ color: '#ef4444' }}>Infracciones: {payload[0].payload.violations}</p>
      )}
    </div>
  );
};

export default function SpeedChart({ history }) {
  return (
    <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Historial de Velocidad (2h)</span>
        <span className="text-[10px] font-mono text-slate-600">km/h</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={history} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" />
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 120]} tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.6} label={{
            value: 'Límite 80',
            position: 'right',
            fill: '#ef4444',
            fontSize: 9,
          }} />
          <Area type="monotone" dataKey="avgSpeed" stroke="#38bdf8" strokeWidth={2}
            fill="url(#speedGrad)" dot={false} animationDuration={500} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
