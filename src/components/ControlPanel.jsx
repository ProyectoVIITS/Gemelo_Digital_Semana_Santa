import React from 'react';
import { DAYS, OPERATION_PHASES } from '../data/corridors';
import { SCENARIOS } from '../data/scenarios';

const REGIONS = [
  { key: 'andina',    label: 'Andina',    desc: 'C1 C3 C4 C5 C6' },
  { key: 'pacifica',  label: 'Pacífica',  desc: 'C2' },
  { key: 'orinoquia', label: 'Orinoquía', desc: 'C5' },
  { key: 'caribe',    label: 'Caribe',    desc: 'C7' },
];

// Agrupar días por fase
const PHASE_GROUPS = [
  { key: 'pre-exodo', days: DAYS.filter(d => d.phase === 'pre-exodo') },
  { key: 'exodo',     days: DAYS.filter(d => d.phase === 'exodo') },
  { key: 'retorno',   days: DAYS.filter(d => d.phase === 'retorno') },
];

export default function ControlPanel({
  selectedDay, setSelectedDay,
  selectedHour, setSelectedHour,
  rainByRegion, setRainByRegion,
  restriccionPesados, setRestricionPesados,
  carrilReversible, setCarrilReversible,
  activeScenario, onLoadScenario,
}) {
  const currentDay = DAYS[selectedDay];
  const currentPhase = currentDay ? OPERATION_PHASES[currentDay.phase] : null;

  return (
    <div className="space-y-3">
      {/* Fase operativa activa */}
      {currentPhase && (
        <div className="rounded-lg border p-2.5" style={{
          backgroundColor: `${currentPhase.color}10`,
          borderColor: `${currentPhase.color}40`,
        }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: currentPhase.color }} />
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: currentPhase.color }}>
              {currentPhase.label}
            </span>
          </div>
          <div className="text-[9px] text-slate-400 mt-1 ml-4">{currentPhase.description}</div>
        </div>
      )}

      {/* Calendario por fases */}
      <div className="bg-viits-card border border-viits-border rounded-lg p-3">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Semana Santa 2026</h3>
        {PHASE_GROUPS.map(group => {
          const phase = OPERATION_PHASES[group.key];
          return (
            <div key={group.key} className="mb-2 last:mb-0">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: phase.color }} />
                <span className="text-[8px] uppercase tracking-wider font-medium" style={{ color: phase.color }}>
                  {phase.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 ml-3">
                {group.days.map(d => (
                  <button key={d.index} onClick={() => setSelectedDay(d.index)}
                    className={`px-1 py-1.5 rounded text-[9px] font-mono transition-all border ${
                      selectedDay === d.index
                        ? 'text-white font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                    }`}
                    style={selectedDay === d.index ? {
                      backgroundColor: `${phase.color}25`,
                      borderColor: `${phase.color}60`,
                      color: phase.color,
                    } : {}}>
                    {d.short}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {currentDay && (
          <div className="mt-2 pt-2 border-t border-slate-800 text-[9px] text-center text-slate-400">
            {currentDay.name} · {currentDay.date} 2026
          </div>
        )}
      </div>

      {/* Hora */}
      <div className="bg-viits-card border border-viits-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500">Hora</h3>
          <span className="font-mono text-sm text-sky-400">{String(selectedHour).padStart(2,'0')}:00</span>
        </div>
        <input type="range" min={0} max={23} value={selectedHour}
          onChange={e => setSelectedHour(Number(e.target.value))}
          className="w-full h-1.5 accent-sky-500 cursor-pointer" />
        <div className="flex justify-between text-[8px] text-slate-600 mt-1">
          <span>00:00</span><span className="text-amber-500">06</span>
          <span className="text-red-500">12</span><span className="text-amber-500">18</span>
          <span>23:00</span>
        </div>
        {/* Indicador de pico para retorno */}
        {currentDay?.phase === 'retorno' && (
          <div className="mt-1.5 text-[8px] text-center" style={{ color: '#3b82f6' }}>
            {selectedHour >= 12 && selectedHour <= 20
              ? '▲ PICO RETORNO — máxima congestión entrada ciudades'
              : selectedHour >= 6 && selectedHour < 12
              ? '◆ Pre-pico retorno — acumulación gradual'
              : '▽ Valle nocturno — flujo bajo'}
          </div>
        )}
        {currentDay?.phase === 'exodo' && (
          <div className="mt-1.5 text-[8px] text-center" style={{ color: '#ef4444' }}>
            {selectedHour >= 5 && selectedHour <= 10
              ? '▲ PICO ÉXODO AM — salida masiva madrugada'
              : selectedHour >= 14 && selectedHour <= 18
              ? '▲ PICO ÉXODO PM — segundo pico de salida'
              : '◆ Flujo sostenido de salida'}
          </div>
        )}
      </div>

      {/* Lluvia por región */}
      <div className="bg-viits-card border border-viits-border rounded-lg p-3">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Lluvia por Región</h3>
        {REGIONS.map(r => (
          <div key={r.key} className="flex items-center justify-between mb-1.5 last:mb-0">
            <div>
              <span className="text-[10px] text-slate-300">{r.label}</span>
              <span className="text-[8px] text-slate-600 ml-1">({r.desc})</span>
            </div>
            <div className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <button key={i} onClick={() => setRainByRegion({ ...rainByRegion, [r.key]: i })}
                  className={`w-6 h-6 rounded text-[10px] transition-all border ${
                    rainByRegion[r.key] === i
                      ? i === 0 ? 'bg-slate-700/50 border-slate-500 text-slate-300'
                        : i === 1 ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        : 'bg-red-500/20 border-red-500/50 text-red-400'
                      : 'border-transparent text-slate-600 hover:text-slate-400'
                  }`}>
                  {i === 0 ? '☀' : i === 1 ? '🌧' : '⛈'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Medidas Operativas */}
      <div className="bg-viits-card border border-viits-border rounded-lg p-3">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Medidas Operativas</h3>
        <label className="flex items-center gap-2 cursor-pointer mb-1.5">
          <input type="checkbox" checked={carrilReversible}
            onChange={e => setCarrilReversible(e.target.checked)} className="accent-sky-500" />
          <span className="text-[10px] text-slate-300">Carril reversible <span className="text-slate-500">(C3, C6)</span></span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={restriccionPesados}
            onChange={e => setRestricionPesados(e.target.checked)} className="accent-sky-500" />
          <span className="text-[10px] text-slate-300">Restricción pesados <span className="text-slate-500">(C3, C5, C6)</span></span>
        </label>
      </div>

      {/* Escenarios */}
      <div className="bg-viits-card border border-viits-border rounded-lg p-3">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Escenarios ({SCENARIOS.length})</h3>
        <div className="space-y-1">
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => onLoadScenario(s)}
              className={`w-full text-left px-2 py-1.5 rounded text-[9px] transition-all border ${
                activeScenario === s.id
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}>
              <span className="mr-1">{s.icon}</span>
              <span className="font-medium">{s.name}</span>
              <div className="text-[8px] text-slate-600 mt-0.5 ml-5">{s.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
