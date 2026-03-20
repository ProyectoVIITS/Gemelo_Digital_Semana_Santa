import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { getNivelAlerta, calcularTiempoViaje, calcularVelocidadPromedio, calcularIRTpeaje } from '../utils/irtEngine';
import { getHourlyProfile } from '../data/corridors';

function formatTime(hrs) {
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return `${h}h ${m}m`;
}

export default function CorridorCard({ corridor, irt, volume, dayIndex, selectedHour, nivelLluvia }) {
  const [expanded, setExpanded] = useState(false);
  const alerta = getNivelAlerta(irt);
  const tiempo = calcularTiempoViaje(corridor.normalTravelTimeHrs, irt);
  const velocidad = calcularVelocidadPromedio(corridor.freeFlowSpeedKmh, irt);

  // Hourly profile for chart
  const hourlyData = getHourlyProfile(corridor, dayIndex, nivelLluvia).map((v, h) => ({
    h: `${String(h).padStart(2,'0')}:00`,
    vol: v,
    capacity: corridor.normalCapacityVehHr,
  }));

  // Toll IRT
  const tollData = corridor.peajes.map(p => {
    const pVol = Math.round(volume * (0.7 + Math.random() * 0.6));
    const pIrt = calcularIRTpeaje(pVol, corridor.normalCapacityVehHr, irt, p.critico);
    return { ...p, irt: pIrt, vol: pVol, vel: Math.round(calcularVelocidadPromedio(corridor.freeFlowSpeedKmh, pIrt)) };
  });

  const criticalTolls = tollData.filter(t => t.critico && t.irt > 75);

  return (
    <div className="bg-viits-card border border-viits-border rounded-lg overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: corridor.color }}>

      {/* Header */}
      <div className="px-3 py-2 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: corridor.color + '40', border: `1px solid ${corridor.color}` }}>
              {corridor.id}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-200 truncate">{corridor.name}</div>
              <div className="text-[8px] text-slate-500">{corridor.route} · {corridor.distanceKm} km · {corridor.peajes.length} peajes</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <div className="font-mono text-lg font-bold" style={{ color: alerta.color }}>{irt}</div>
              <div className="text-[8px] font-mono" style={{ color: alerta.color }}>{alerta.label}</div>
            </div>
            <span className="text-slate-600 text-xs">{expanded ? '▼' : '▶'}</span>
          </div>
        </div>

        {/* Quick metrics row */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div>
            <div className="text-[8px] text-slate-500 uppercase">Vol. actual</div>
            <div className="text-[11px] font-mono text-slate-300">
              {volume.toLocaleString()} <span className="text-[8px] text-slate-500">veh/h</span>
            </div>
          </div>
          <div>
            <div className="text-[8px] text-slate-500 uppercase">Tiempo est.</div>
            <div className="text-[11px] font-mono text-slate-300">
              {formatTime(tiempo)} <span className="text-[8px] text-slate-500">({formatTime(corridor.normalTravelTimeHrs)})</span>
            </div>
          </div>
          <div>
            <div className="text-[8px] text-slate-500 uppercase">Vel. media</div>
            <div className="text-[11px] font-mono text-slate-300">
              {Math.round(velocidad)} <span className="text-[8px] text-slate-500">km/h ({corridor.freeFlowSpeedKmh})</span>
            </div>
          </div>
        </div>

        {/* IRT bar */}
        <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${irt}%`, backgroundColor: alerta.color }} />
        </div>

        {/* Critical toll warnings */}
        {criticalTolls.length > 0 && (
          <div className="mt-1.5 text-[8px] text-amber-400">
            ⚠ Puntos críticos: {criticalTolls.map(t => `${t.nombre} (${t.km})`).join(' · ')}
          </div>
        )}
      </div>

      {/* Expanded: Chart + Tolls */}
      {expanded && (
        <div className="border-t border-viits-border">
          {/* Hourly profile chart */}
          <div className="px-3 py-2">
            <div className="text-[9px] text-slate-500 uppercase mb-1">Perfil horario — {corridor.shortName}</div>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id={`grad-${corridor.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={corridor.color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={corridor.color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="h" tick={{ fontSize: 8, fill: '#64748b' }} interval={5} />
                  <YAxis tick={{ fontSize: 8, fill: '#64748b' }} width={35} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 10 }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <ReferenceLine y={corridor.normalCapacityVehHr} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1} />
                  <ReferenceLine x={hourlyData[selectedHour]?.h} stroke="#facc15" strokeDasharray="3 3" strokeWidth={1} />
                  <Area type="monotone" dataKey="vol" stroke={corridor.color} fill={`url(#grad-${corridor.id})`}
                    strokeWidth={1.5} name="Volumen" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Toll stations */}
          <div className="px-3 py-2 border-t border-viits-border">
            <div className="text-[9px] text-slate-500 uppercase mb-1.5">
              Peajes del corredor ({corridor.peajes.length})
            </div>
            <div className="space-y-1">
              {tollData.map(t => {
                const tl = getNivelAlerta(t.irt);
                return (
                  <div key={t.id} className="flex items-center gap-2 px-2 py-1 rounded bg-slate-900/40">
                    {t.critico && <span className="text-amber-400 text-[10px]">★</span>}
                    <span className="text-[9px] text-slate-300 font-medium w-28 truncate">{t.nombre}</span>
                    <span className="text-[8px] text-slate-500 font-mono w-12">{t.km}</span>
                    <span className="text-[9px] font-mono w-10" style={{ color: '#38bdf8' }}>
                      {t.vel} km/h
                    </span>
                    <span className="text-[9px] font-mono w-14 text-slate-400">
                      {t.vol.toLocaleString()} v/h
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tl.color }} />
                      <span className="font-mono text-[10px] font-bold" style={{ color: tl.color }}>{t.irt}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
