import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { getNivelAlerta, calcularTiempoViaje, calcularVelocidadPromedio } from '../utils/irtEngine';
import { getHourlyProfile } from '../data/corridors';

/**
 * Tarjeta de corredor con métricas IRT, volumen, tiempo, velocidad.
 * Incluye gráfica horaria expandible con Recharts.
 */

function formatTime(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}min`;
}

function IRTBar({ irt }) {
  const alerta = getNivelAlerta(irt);
  const fillPercent = Math.min(irt, 100);

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm font-mono font-bold" style={{ color: alerta.color }}>
        {irt}
      </div>
      <div className="flex-1 h-3 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${fillPercent}%`,
            backgroundColor: alerta.color,
            boxShadow: irt > 80 ? `0 0 8px ${alerta.color}` : 'none',
          }}
        />
      </div>
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{
          color: alerta.color,
          backgroundColor: `${alerta.color}20`,
        }}
      >
        {alerta.label}
      </span>
    </div>
  );
}

function HourlyChart({ corridor, dayIndex, selectedHour, capacity, nivelLluvia }) {
  const hourlyData = getHourlyProfile(corridor, dayIndex, nivelLluvia);
  const data = hourlyData.map((vol, hour) => ({
    hour: `${String(hour).padStart(2, '0')}h`,
    hourNum: hour,
    volumen: vol,
    capacidad: capacity,
  }));

  return (
    <div className="mt-3 bg-slate-800/40 rounded-lg p-3 border border-viits-border">
      <div className="text-[10px] text-slate-400 mb-2 font-semibold">
        PERFIL HORARIO — Volumen vs Capacidad
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 8, fill: '#64748b' }}
            interval={3}
          />
          <YAxis
            tick={{ fontSize: 8, fill: '#64748b' }}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#e2e8f0',
            }}
            formatter={(value, name) => [
              value.toLocaleString(),
              name === 'volumen' ? 'Vehículos/h' : 'Capacidad'
            ]}
          />
          <ReferenceLine
            y={capacity}
            stroke="#ef4444"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            label={{ value: 'Capacidad', position: 'right', fontSize: 9, fill: '#ef4444' }}
          />
          {/* Zona de sobrecarga */}
          <Area
            type="monotone"
            dataKey="volumen"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          {/* Marcador de hora seleccionada */}
          <ReferenceLine
            x={`${String(selectedHour).padStart(2, '0')}h`}
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="3 3"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function CorridorCard({ corridor, irt, volume, dayIndex, selectedHour, nivelLluvia }) {
  const [expanded, setExpanded] = useState(false);
  const alerta = getNivelAlerta(irt);
  const tiempoViaje = calcularTiempoViaje(corridor.normalTravelTimeHrs, irt);
  const velocidad = calcularVelocidadPromedio(corridor.freeFlowSpeedKmh, irt);
  const excedido = volume > corridor.normalCapacityVehHr;
  const rainLabels = ['', '🌦️ Lluvia moderada', '🌧️ Lluvia intensa'];

  return (
    <div
      className="bg-viits-card border border-viits-border rounded-lg p-3 transition-all hover:border-slate-500"
      style={{ borderLeftColor: alerta.color, borderLeftWidth: '3px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: alerta.color }} />
            <span className="text-sm font-semibold text-slate-200">{corridor.name}</span>
          </div>
          <div className="text-[10px] text-slate-500 ml-4.5 pl-0.5">
            {corridor.route} · {corridor.distanceKm} km
          </div>
        </div>
      </div>

      {/* IRT Bar */}
      <div className="mb-3">
        <IRTBar irt={irt} />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-800/40 rounded px-2 py-1.5">
          <div className={`font-mono text-sm font-bold ${excedido ? 'text-red-400' : 'text-slate-200'}`}>
            {volume.toLocaleString()}
          </div>
          <div className="text-[8px] text-slate-500">veh/h (Cap: {corridor.normalCapacityVehHr.toLocaleString()})</div>
        </div>
        <div className="bg-slate-800/40 rounded px-2 py-1.5">
          <div className="font-mono text-sm font-bold text-slate-200">
            {formatTime(tiempoViaje)}
          </div>
          <div className="text-[8px] text-slate-500">Normal: {formatTime(corridor.normalTravelTimeHrs)}</div>
        </div>
        <div className="bg-slate-800/40 rounded px-2 py-1.5">
          <div className="font-mono text-sm font-bold text-slate-200">
            {Math.round(velocidad)} km/h
          </div>
          <div className="text-[8px] text-slate-500">Normal: {corridor.freeFlowSpeedKmh} km/h</div>
        </div>
      </div>

      {/* Puntos críticos y clima */}
      <div className="mt-2 space-y-1">
        {irt > 60 && (
          <div className="text-[10px] text-orange-400">
            ⚠ Puntos críticos: {corridor.criticalPoints.slice(0, 3).join(' · ')}
          </div>
        )}
        {nivelLluvia > 0 && (
          <div className="text-[10px] text-blue-400">
            {rainLabels[nivelLluvia]} activa (+{Math.round((corridor.rainImpactFactor - 1) * 100 * nivelLluvia / 2)}% tiempo)
          </div>
        )}
      </div>

      {/* Toggle gráfica */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
      >
        {expanded ? '▼ Ocultar gráfica' : '▶ Ver gráfica horaria'}
      </button>

      {expanded && (
        <HourlyChart
          corridor={corridor}
          dayIndex={dayIndex}
          selectedHour={selectedHour}
          capacity={corridor.normalCapacityVehHr}
          nivelLluvia={nivelLluvia}
        />
      )}
    </div>
  );
}
