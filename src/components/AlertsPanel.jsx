import React, { useState } from 'react';
import { CORRIDORS, getTrafficVolume } from '../data/corridors';
import { calcularIRT, calcularTiempoViaje, getNivelAlerta, generarAnalisisSalida, calcularTasaCrecimiento } from '../utils/irtEngine';

function formatTime(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}min`;
}

const SEVERITY_ICONS = {
  emergency: { icon: '!!', bg: 'bg-red-900/30', border: 'border-red-800', pulse: true },
  critical: { icon: '!', bg: 'bg-red-900/20', border: 'border-red-900/50', pulse: true },
  warning: { icon: '~', bg: 'bg-amber-900/15', border: 'border-amber-900/30', pulse: false },
  info: { icon: 'i', bg: 'bg-blue-900/15', border: 'border-blue-900/30', pulse: false },
};

const TYPE_LABELS = {
  irt_threshold: 'IRT',
  weather_compound: 'CLIMA',
  rapid_growth: 'CREC',
  capacity_breach: 'CAP',
  bottleneck: 'BLOQ',
  time_window: 'HORA',
};

function SmartAlertItem({ alert }) {
  const sev = SEVERITY_ICONS[alert.severity] || SEVERITY_ICONS.info;
  const typeLabel = TYPE_LABELS[alert.type] || alert.type;

  return (
    <div className={`${sev.bg} border ${sev.border} rounded-lg p-2.5 mb-1.5 ${sev.pulse ? 'alert-pulse' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white"
            style={{ backgroundColor: alert.color }}>
            {sev.icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-white/5 text-slate-400 uppercase">
              {typeLabel}
            </span>
            <span className="text-[8px] font-mono text-slate-500 uppercase">
              {alert.severity}
            </span>
          </div>
          <div className="text-[11px] font-semibold text-slate-200 mb-0.5">
            {alert.title}
          </div>
          <div className="text-[10px] text-slate-400 mb-1">
            {alert.message}
          </div>
          <div className="text-[9px] text-emerald-400/80 italic">
            {alert.recommendation}
          </div>
        </div>
      </div>
    </div>
  );
}

function CriticalEventsLog({ events }) {
  if (events.length === 0) return null;

  return (
    <div className="bg-viits-card border border-viits-border rounded-lg p-3">
      <h4 className="text-xs font-semibold text-red-400 tracking-wider uppercase mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        Registro de Eventos Críticos
        <span className="text-[9px] font-mono text-slate-500 ml-auto">{events.length}</span>
      </h4>
      <div className="max-h-32 overflow-y-auto space-y-1">
        {events.slice().reverse().map((evt, i) => (
          <div key={`${evt.id}-${i}`} className="flex items-start gap-2 py-1 border-b border-viits-border/30 last:border-0">
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: evt.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-300 font-semibold">{evt.title}</div>
              <div className="text-[9px] text-slate-500">{evt.message}</div>
            </div>
            <span className="text-[8px] font-mono text-slate-600 flex-shrink-0">
              {new Date(evt.loggedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepartureSimulator({ selectedDay, rainByRegion, restriccionPesados, carrilReversible }) {
  const [destino, setDestino] = useState('bogota-girardot');
  const corridor = CORRIDORS.find(c => c.id === destino);
  if (!corridor) return null;

  const regionKey = corridor.region === 'andina' ? 'andina' : corridor.region === 'orinoquia' ? 'orinoquia' : 'caribe';
  const nivelLluvia = rainByRegion[regionKey];

  const analisis = generarAnalisisSalida(
    corridor, selectedDay, nivelLluvia,
    restriccionPesados, carrilReversible,
    getTrafficVolume
  );

  return (
    <div className="bg-viits-card border border-viits-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-slate-300 tracking-wider uppercase">
          ¿Cuándo salir de Bogotá?
        </h4>
        <select
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          className="bg-slate-800 text-[10px] text-slate-300 border border-viits-border rounded px-2 py-1"
        >
          {CORRIDORS.filter(c => c.id !== 'costa-caribe').map(c => (
            <option key={c.id} value={c.id}>{c.name.split('–')[1] || c.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        {analisis.map(({ hour, irt, tiempo, alerta, recomendacion }) => {
          const barWidth = Math.min(irt, 100);
          return (
            <div key={hour} className="flex items-center gap-2 text-[10px]">
              <span className="font-mono text-slate-400 w-10 text-right">
                {String(hour).padStart(2, '0')}:00
              </span>
              <div className="flex-1 h-4 bg-slate-800/60 rounded overflow-hidden relative">
                <div
                  className="h-full rounded transition-all duration-300"
                  style={{ width: `${barWidth}%`, backgroundColor: alerta.color }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-white/80">
                  IRT {irt}
                </span>
              </div>
              <span className="font-mono text-slate-400 w-16 text-right">
                {formatTime(tiempo)}
              </span>
              {recomendacion && (
                <span className={`text-[8px] font-bold w-20 text-right ${
                  recomendacion === 'EVITAR' ? 'text-red-400' :
                  recomendacion === 'MEJOR OPCIÓN' ? 'text-emerald-400' :
                  'text-amber-400'
                }`}>
                  {recomendacion}
                </span>
              )}
              {!recomendacion && <span className="w-20" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AlertsPanel({
  selectedDay, selectedHour,
  rainByRegion, restriccionPesados, carrilReversible,
  irtValues,
  smartAlerts = [],
  criticalEventsLog = [],
}) {
  return (
    <div className="space-y-3">
      {/* Smart Alerts */}
      <div className="bg-viits-card border border-viits-border rounded-lg p-3">
        <h4 className="text-xs font-semibold text-slate-300 tracking-wider uppercase mb-2 flex items-center gap-2">
          Alertas Inteligentes
          {smartAlerts.filter(a => a.severity === 'emergency' || a.severity === 'critical').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
          <span className="text-[9px] font-mono text-slate-500 ml-auto">
            {smartAlerts.length} activas
          </span>
        </h4>
        {smartAlerts.length > 0 ? (
          <div className="max-h-60 overflow-y-auto">
            {smartAlerts.map(alert => (
              <SmartAlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-emerald-400 py-2 text-center">
            Todos los corredores en flujo normal
          </div>
        )}
      </div>

      {/* Critical Events Log */}
      <CriticalEventsLog events={criticalEventsLog} />

      {/* Departure Simulator */}
      <DepartureSimulator
        selectedDay={selectedDay}
        rainByRegion={rainByRegion}
        restriccionPesados={restriccionPesados}
        carrilReversible={carrilReversible}
      />
    </div>
  );
}
