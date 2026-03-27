import React, { useState } from 'react';
import { CORRIDORS, getTrafficVolume } from '../data/corridors';
import { calcularIRT, calcularTiempoViaje, getNivelAlerta, generarAnalisisSalida, calcularTasaCrecimiento } from '../utils/irtEngine';

function formatTime(hrs) {
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return `${h}h ${m}m`;
}

const SEV_STYLES = {
  emergency: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: '🔴', text: 'text-red-400' },
  critical:  { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: '🟠', text: 'text-orange-400' },
  warning:   { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: '🟡', text: 'text-amber-400' },
  info:      { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'ℹ️', text: 'text-blue-400' },
};

function DepartureSimulator({ selectedDay, rainByRegion, restriccionPesados, carrilReversible }) {
  const [simCorridor, setSimCorridor] = useState('C3');
  const [sortByBest, setSortByBest] = useState(true);
  const corridor = CORRIDORS.find(c => c.id === simCorridor);
  if (!corridor) return null;

  const regionKey = corridor.region === 'andina' ? 'andina'
    : corridor.region === 'pacifica' ? 'pacifica'
    : corridor.region === 'orinoquia' ? 'orinoquia' : 'caribe';
  const nivelLluvia = rainByRegion[regionKey] || 0;

  const analysis = generarAnalisisSalida(corridor, selectedDay, nivelLluvia, restriccionPesados, carrilReversible, getTrafficVolume);
  const sorted = sortByBest
    ? [...analysis].sort((a, b) => a.irt - b.irt)
    : analysis;

  // Ranking labels
  const ranked = sorted.map((a, i) => ({ ...a, rank: i + 1 }));

  return (
    <div className="bg-viits-card border border-viits-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500">Mejor horario para viajar</h3>
        <button onClick={() => setSortByBest(!sortByBest)}
          className="text-[8px] text-sky-400 hover:text-sky-300 font-mono">
          {sortByBest ? '⏱ Por hora' : '★ Por ranking'}
        </button>
      </div>
      <select value={simCorridor} onChange={e => setSimCorridor(e.target.value)}
        className="w-full bg-slate-900 border border-viits-border rounded px-2 py-1 text-[10px] text-slate-300 font-mono mb-3">
        {CORRIDORS.map(c => (
          <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
        ))}
      </select>

      <div className="space-y-1.5">
        {ranked.map(a => {
          const barW = Math.min(a.irt, 100);
          const isBest = a.rank <= 2;
          const isWorst = a.rank >= ranked.length - 1;
          return (
            <div key={a.hour} className={`flex items-center gap-2 rounded px-1.5 py-1 ${
              isBest ? 'bg-emerald-500/8 border border-emerald-500/20' : isWorst ? 'bg-red-500/5' : ''
            }`}>
              {/* Ranking */}
              <span className={`text-[10px] font-bold w-4 text-center ${
                a.rank === 1 ? 'text-emerald-400' : a.rank === 2 ? 'text-emerald-500/70' : 'text-slate-600'
              }`}>
                {a.rank === 1 ? '#1' : a.rank === 2 ? '#2' : `#${a.rank}`}
              </span>

              {/* Hora */}
              <span className="text-[10px] font-mono text-slate-300 w-10 font-bold">
                {String(a.hour).padStart(2,'0')}:00
              </span>

              {/* Barra IRT */}
              <div className="flex-1 h-3.5 bg-slate-800/60 rounded overflow-hidden">
                <div className="h-full rounded transition-all"
                  style={{ width: `${barW}%`, backgroundColor: a.alerta.color }} />
              </div>

              {/* IRT */}
              <span className="text-[10px] font-mono font-bold w-7 text-right" style={{ color: a.alerta.color }}>
                {a.irt}
              </span>

              {/* Tiempo estimado */}
              <span className="text-[9px] font-mono text-slate-400 w-12 text-right">{formatTime(a.tiempo)}</span>

              {/* Badge */}
              {a.rank === 1 && (
                <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                  MEJOR
                </span>
              )}
              {a.rank === 2 && (
                <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500/70 whitespace-nowrap">
                  BUENA
                </span>
              )}
              {isWorst && a.irt >= 80 && (
                <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 whitespace-nowrap">
                  EVITAR
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-[7px] text-slate-500">IRT &lt;40</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-[7px] text-slate-500">40-60</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-400" /><span className="text-[7px] text-slate-500">60-80</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[7px] text-slate-500">&gt;80</span></div>
      </div>
    </div>
  );
}

export default function AlertsPanel({
  selectedDay, selectedHour, rainByRegion, restriccionPesados, carrilReversible,
  irtValues, smartAlerts, criticalEventsLog,
}) {
  const [showSimulator, setShowSimulator] = useState(true);

  return (
    <div className="space-y-2">
      {/* Smart Alerts */}
      <div className="bg-viits-card border border-viits-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500">
            Alertas Activas ({smartAlerts.length})
          </h3>
          {smartAlerts.filter(a => a.severity === 'emergency').length > 0 && (
            <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 rounded font-bold animate-pulse">
              EMERGENCIA
            </span>
          )}
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {smartAlerts.length === 0 ? (
            <div className="text-[9px] text-slate-600 py-2 text-center">Sin alertas activas</div>
          ) : (
            smartAlerts.slice(0, 12).map(a => {
              const st = SEV_STYLES[a.severity] || SEV_STYLES.info;
              return (
                <div key={a.id} className={`${st.bg} border ${st.border} rounded px-2 py-1.5`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">{st.icon}</span>
                    <span className={`text-[9px] font-semibold ${st.text}`}>{a.title}</span>
                  </div>
                  <div className="text-[8px] text-slate-400 ml-5 mt-0.5">{a.message}</div>
                  {a.recommendation && (
                    <div className="text-[8px] text-slate-500 ml-5 mt-0.5 italic">→ {a.recommendation}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Departure Simulator */}
      {showSimulator && (
        <DepartureSimulator
          selectedDay={selectedDay}
          rainByRegion={rainByRegion}
          restriccionPesados={restriccionPesados}
          carrilReversible={carrilReversible}
        />
      )}

      {/* Critical Events Log */}
      {criticalEventsLog.length > 0 && (
        <div className="bg-viits-card border border-viits-border rounded-lg p-3">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
            Log de Eventos Críticos ({criticalEventsLog.length})
          </h3>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {criticalEventsLog.slice(-8).reverse().map((e, i) => (
              <div key={`${e.id}-${i}`} className="text-[8px] text-slate-500 font-mono">
                <span className="text-red-400/60">{new Date(e.loggedAt).toLocaleTimeString()}</span>
                {' '}{e.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
