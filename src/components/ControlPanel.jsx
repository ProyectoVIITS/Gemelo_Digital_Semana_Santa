import React from 'react';
import { DAYS } from '../data/corridors';
import { SCENARIOS } from '../data/scenarios';

/**
 * Panel de controles: selector de día, slider de hora, toggles de lluvia, escenarios.
 */

const RAIN_LEVELS = ['Sin lluvia', 'Moderada', 'Intensa'];
const RAIN_COLORS = ['#64748b', '#60a5fa', '#3b82f6'];
const REGIONS = [
  { key: 'andina', label: 'Andina', sub: 'Bogotá–Girardot, Bogotá–Medellín' },
  { key: 'orinoquia', label: 'Orinoquía', sub: 'Vía al Llano' },
  { key: 'caribe', label: 'Caribe', sub: 'Ruta 90 Costera' },
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

  const cycleRain = (regionKey) => {
    setRainByRegion(prev => ({
      ...prev,
      [regionKey]: (prev[regionKey] + 1) % 3
    }));
  };

  return (
    <div className="space-y-4">
      {/* Selector de día */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 tracking-wider mb-2 uppercase">
          Día de Semana Santa
        </h3>
        <div className="grid grid-cols-4 gap-1">
          {DAYS.map(day => (
            <button
              key={day.index}
              onClick={() => setSelectedDay(day.index)}
              className={`px-1.5 py-1.5 rounded text-[10px] font-medium transition-all border ${
                selectedDay === day.index
                  ? day.isHighlight
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'bg-blue-500/20 border-blue-500 text-blue-400'
                  : 'bg-viits-card border-viits-border text-slate-400 hover:border-slate-500'
              }`}
            >
              <div className="font-bold">{day.short}</div>
              {day.isHighlight && (
                <div className="text-[8px] opacity-75 truncate">{day.name.split(' ').slice(-1)}</div>
              )}
            </button>
          ))}
        </div>
        <div className="mt-1.5 text-center text-xs text-slate-500">
          {currentDay.name} — {currentDay.date} 2026
        </div>
      </div>

      {/* Slider de hora */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 tracking-wider mb-2 uppercase">
          Hora del día
        </h3>
        <div className="relative">
          <input
            type="range"
            min={0}
            max={23}
            value={selectedHour}
            onChange={(e) => setSelectedHour(parseInt(e.target.value))}
            className="w-full h-2 bg-viits-card rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[9px] text-slate-500 mt-1">
            <span>0:00</span>
            <span>6:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>
        <div className="text-center mt-1">
          <span className="font-mono text-lg text-amber-400 font-bold">
            {String(selectedHour).padStart(2, '0')}:00
          </span>
        </div>
      </div>

      {/* Toggles de lluvia */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 tracking-wider mb-2 uppercase">
          Condición Climática
        </h3>
        <div className="space-y-1.5">
          {REGIONS.map(region => (
            <button
              key={region.key}
              onClick={() => cycleRain(region.key)}
              className="w-full flex items-center justify-between bg-viits-card border border-viits-border rounded px-2.5 py-1.5 hover:border-slate-500 transition-colors"
            >
              <div className="text-left">
                <div className="text-[11px] text-slate-300">{region.label}</div>
                <div className="text-[8px] text-slate-500">{region.sub}</div>
              </div>
              <div
                className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{
                  color: RAIN_COLORS[rainByRegion[region.key]],
                  backgroundColor: `${RAIN_COLORS[rainByRegion[region.key]]}15`,
                }}
              >
                {rainByRegion[region.key] === 2 ? '🌧️ ' : rainByRegion[region.key] === 1 ? '🌦️ ' : '☀️ '}
                {RAIN_LEVELS[rainByRegion[region.key]]}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Medidas operativas */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 tracking-wider mb-2 uppercase">
          Medidas Operativas
        </h3>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 bg-viits-card border border-viits-border rounded px-2.5 py-2 cursor-pointer hover:border-slate-500">
            <input
              type="checkbox"
              checked={restriccionPesados}
              onChange={(e) => setRestricionPesados(e.target.checked)}
              className="accent-amber-500"
            />
            <div>
              <div className="text-[11px] text-slate-300">Restricción de Pesados</div>
              <div className="text-[8px] text-slate-500">Vehículos ≥3.4 ton fuera de vía</div>
            </div>
          </label>
          <label className="flex items-center gap-2 bg-viits-card border border-viits-border rounded px-2.5 py-2 cursor-pointer hover:border-slate-500">
            <input
              type="checkbox"
              checked={carrilReversible}
              onChange={(e) => setCarrilReversible(e.target.checked)}
              className="accent-amber-500"
            />
            <div>
              <div className="text-[11px] text-slate-300">Carril Reversible</div>
              <div className="text-[8px] text-slate-500">Salida sur Bogotá activo</div>
            </div>
          </label>
        </div>
      </div>

      {/* Escenarios precargados */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 tracking-wider mb-2 uppercase">
          Escenarios Rápidos
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {SCENARIOS.map(scenario => (
            <button
              key={scenario.id}
              onClick={() => onLoadScenario(scenario)}
              className={`text-left px-2 py-2 rounded border transition-all text-[10px] ${
                activeScenario === scenario.id
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                  : 'bg-viits-card border-viits-border text-slate-400 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              <div className="font-semibold">{scenario.icon} {scenario.name}</div>
              <div className="text-[8px] opacity-70 mt-0.5">{scenario.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
