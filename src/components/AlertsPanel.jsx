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
  const corridor = CORRIDORS.find(c => c.id === simCorridor);
  if (!corridor) return null;

  const regionKey = corridor.region === 'andina' ? 'andina'
    : corridor.region === 'pacifica' ? 'pacifica'
    : corridor.region === 'orinoquia' ? 'orinoquia' : 'caribe';
  const nivelLluvia = rainByRegion[regionKey] || 0;

  const analysis = generarAnalisisSalida(corridor, selectedDay, nivelLluvia, restriccionPesados, carrilReversible, getTrafficVolume);

  return (
    <div className="bg-viits-card border border-viits-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500">Simulador: ¿Cuándo salir?</h3>
      </div>
      <select value={simCorridor} onChange={e => setSimCorridor(e.target.value)}
        className="w-full bg-slate-900 border border-viits-border rounded px-2 py-1 text-[10px] text-slate-300 font-mono mb-2">
        {CORRIDORS.map(c => (
          <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
        ))}
      </select>

      <div className="space-y-1">
        {analysis.map(a => {
          const barW = Math.min(a.irt, 100);
          return (
            <div key={a.hour} className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-slate-400 w-8">{String(a.hour).padStart(2,'0')}:00</span>
              <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${barW}%`, backgroundColor: a.alerta.color }} />
              </div>
              <span className="text-[9px] font-mono w-8" style={{ color: a.alerta.color }}>{a.irt}</span>
              <span className="text-[8px] font-mono text-slate-400 w-14">{formatTime(a.tiempo)}</span>
              {a.recomendacion && (
                <span className={`text-[7px] font-bold px-1 rounded ${
                  a.recomendacion.includes('MEJOR') || a.recomendacion.includes('BUENA')
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : a.recomendacion === 'EVITAR'
                    ? 'bg-red-500/20 text-red-400'
                    : 'text-amber-400'
                }`}>
                  {a.recomendacion === 'MEJOR OPCIÓN' ? '✅' : a.recomendacion === 'EVITAR' ? '🔴' : ''} {a.recomendacion}
                </span>
              )}
            </div>
          );
        })}
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
