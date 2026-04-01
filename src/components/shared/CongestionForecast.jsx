/**
 * CongestionForecast — Proyección de congestión vial para las próximas 8 horas
 * Usado en TollPage y WazeSegmentPage
 * Basado en patrón histórico Semana Santa + dato real actual (Waze/Google)
 */
import React from 'react';
import { TrendingDown, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { getColombiaHour } from '../../utils/operationMode';
import { getIRTLevel } from '../../data/nexusCorridors';

const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };

// Perfil de congestión Semana Santa por hora (0-23)
// Fuente: patrones INVÍAS 2019-2025
const SS_CONGESTION_PROFILE = [
  0.08, 0.05, 0.04, 0.04, 0.06, 0.15, 0.45, 0.75, 0.88, 0.82, 0.70, 0.62,
  0.58, 0.65, 0.78, 0.85, 0.90, 0.92, 0.82, 0.60, 0.35, 0.20, 0.12, 0.10,
];

export default function CongestionForecast({ currentIrt = 50, accentColor = '#a855f7', segmentName = '', delayRatio = null }) {
  const hour = getColombiaHour();

  const forecast = [];
  for (let i = 0; i < 8; i++) {
    const h = (hour + i) % 24;
    const hLabel = `${String(h).padStart(2, '0')}:00`;
    const baseProfile = SS_CONGESTION_PROFILE[h];
    const currentProfileExpected = SS_CONGESTION_PROFILE[hour] || 0.5;
    const realFactor = currentProfileExpected > 0.01 ? (currentIrt / 100) / currentProfileExpected : 1;
    const adjustedCongestion = Math.min(98, Math.max(2, Math.round(baseProfile * realFactor * 100)));

    let estado, color;
    if (adjustedCongestion >= 85) { estado = 'COLAPSO'; color = '#b91c1c'; }
    else if (adjustedCongestion >= 70) { estado = 'CRÍTICO'; color = '#ef4444'; }
    else if (adjustedCongestion >= 50) { estado = 'ALTO'; color = '#f97316'; }
    else if (adjustedCongestion >= 30) { estado = 'MODERADO'; color = '#f59e0b'; }
    else { estado = 'FLUIDO'; color = '#22c55e'; }

    forecast.push({ hora: hLabel, h, congestion: adjustedCongestion, estado, color, isCurrent: i === 0, isFuture: i > 0 });
  }

  const liberacion = forecast.find(f => f.isFuture && f.congestion < 35);
  const pico = forecast.reduce((max, f) => f.congestion > max.congestion ? f : max, forecast[0]);

  return (
    <div className="rounded-lg border-2 p-3" style={{
      ...CARD, borderColor: `${accentColor}40`,
      background: `linear-gradient(135deg, rgba(13, 26, 46, 0.8), ${accentColor}08)`,
    }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4" style={{ color: accentColor }} />
          <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: accentColor }}>
            Proyección de Congestión — Próximas 8h
          </span>
        </div>
        <span className="text-[8px] text-slate-500 font-mono">VIITS + Waze</span>
      </div>

      {/* Resumen ejecutivo */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg border px-3 py-2" style={{ backgroundColor: pico.color + '10', borderColor: pico.color + '40' }}>
          <div className="text-[8px] uppercase tracking-wider text-slate-500">Pico proyectado</div>
          <div className="font-mono text-lg font-bold" style={{ color: pico.color }}>{pico.hora}</div>
          <div className="text-[9px]" style={{ color: pico.color }}>{pico.congestion}% · {pico.estado}</div>
        </div>
        <div className="rounded-lg border px-3 py-2" style={{
          backgroundColor: liberacion ? '#22c55e10' : '#f59e0b10',
          borderColor: liberacion ? '#22c55e40' : '#f59e0b40',
        }}>
          <div className="text-[8px] uppercase tracking-wider text-slate-500">Liberación estimada</div>
          <div className="font-mono text-lg font-bold" style={{ color: liberacion ? '#22c55e' : '#f59e0b' }}>
            {liberacion ? liberacion.hora : 'No en 8h'}
          </div>
          <div className="text-[9px]" style={{ color: liberacion ? '#22c55e' : '#f59e0b' }}>
            {liberacion ? `${liberacion.congestion}% · Flujo liberado` : 'Congestión sostenida'}
          </div>
        </div>
      </div>

      {/* Gráfica de barras */}
      <div style={{ height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={forecast} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" />
            <XAxis dataKey="hora" tick={{ fill: '#94a3b8', fontSize: 9, fontFamily: 'JetBrains Mono' }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 8 }} />
            <Tooltip contentStyle={{ backgroundColor: '#0d1a2e', border: '1px solid #1a2d4a', borderRadius: 6, fontSize: 10 }}
              formatter={(val, name, props) => [`${val}% — ${props.payload.estado}`, props.payload.isCurrent ? 'AHORA' : 'Proyección']} />
            <ReferenceLine y={35} stroke="#22c55e" strokeDasharray="4 4" />
            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" />
            <Bar dataKey="congestion" radius={[4, 4, 0, 0]}>
              {forecast.map((e, i) => (
                <Cell key={i} fill={e.color} fillOpacity={e.isCurrent ? 1 : 0.6}
                  stroke={e.isCurrent ? '#fff' : 'none'} strokeWidth={e.isCurrent ? 2 : 0} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Timeline */}
      <div className="mt-2 space-y-0.5">
        {forecast.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-[9px] font-mono" style={{ opacity: f.isCurrent ? 1 : 0.7 }}>
            <span className="w-11 text-slate-400">{f.hora}</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${f.congestion}%`, backgroundColor: f.color }} />
            </div>
            <span className="w-8 text-right" style={{ color: f.color }}>{f.congestion}%</span>
            <span className="w-16 text-right font-bold" style={{ color: f.color }}>{f.estado}</span>
            {f.isCurrent && <Clock className="w-3 h-3 text-white animate-pulse" />}
          </div>
        ))}
      </div>

      <div className="mt-2 pt-1 border-t text-[7px] text-slate-600 text-center" style={{ borderColor: '#1a2d4a' }}>
        Modelo predictivo VIITS/INVÍAS · Patrón histórico SS 2019-2025 ajustado con Waze TVT · IRT actual: {currentIrt}
        {delayRatio && ` · Ratio delay: ${delayRatio}x`}
      </div>
    </div>
  );
}
