/**
 * VIITS NEXUS — Monitor de 7 Corredores · Semana Santa 2026
 * Estética idéntica al piloto Peaje Chuzacá
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip as LTooltip, useMap } from 'react-leaflet';
import { ArrowLeft, Shield, Wifi, Activity, AlertTriangle, Gauge, ChevronRight, Radio, TrendingUp, Car, BarChart2 } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { NEXUS_CORRIDORS, getIRTLevel, TOTAL_TOLL_STATIONS, CORRIDOR_COLORS } from '../../data/nexusCorridors';
import { getOperationMode, getColombiaHour } from '../../utils/operationMode';
import { useCorridorData } from '../../hooks/useCorridorData';
import { useGlobalAlerts } from '../../hooks/useGlobalAlerts';
import { useAccidentData } from '../../hooks/useAccidentData';
import { getNivelRiesgo, RIESGO_COLORS, RIESGO_LABELS, RIESGO_RANGES } from '../../data/accidentUtils';
import MonitorLoadingScreen from './LoadingScreen';

/* ─── Shared style constants (matching Chuzacá) ─── */
const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };
const HEADER_BG = { backgroundColor: 'rgba(10, 15, 30, 0.85)', backdropFilter: 'blur(12px)', borderColor: 'rgba(14, 165, 233, 0.2)' };

/* ─── Sub-components ─── */

function MonitorHeader({ globalMetrics, clock }) {
  const maxIrt = globalMetrics?.maxIrt || 0;
  const level = getIRTLevel(maxIrt);

  return (
    <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b" style={HEADER_BG}>
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Módulos</span>
        </Link>
        <div className="w-px h-6 bg-slate-700" />
        <div className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>
          <Shield className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-wide" style={{ color: '#0ea5e9', fontFamily: 'JetBrains Mono, Space Mono, monospace' }}>
            VIITS NEXUS
          </span>
          {(() => {
            const { isRetorno, label } = getOperationMode();
            return isRetorno ? (
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded animate-pulse"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                OPERACIÓN RETORNO
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 hidden lg:inline">{label}</span>
            );
          })()}
        </div>
      </div>

      <div className="text-center hidden md:flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Corredores</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace' }}>
            {globalMetrics?.activeCorridors || 0}/7
          </span>
        </div>
        <div className="w-px h-4 bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Peajes</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: '#a78bfa', fontFamily: 'JetBrains Mono, monospace' }}>
            {TOTAL_TOLL_STATIONS}
          </span>
        </div>
        <div className="w-px h-4 bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">IRT Máx</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: level.color, fontFamily: 'JetBrains Mono, monospace' }}>
            {maxIrt}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm tabular-nums text-slate-300" style={{ fontFamily: 'JetBrains Mono, Space Mono, monospace' }}>
          {clock.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' })}
        </span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-mono text-green-400 uppercase tracking-wider hidden sm:inline">LIVE</span>
          <Wifi className="w-3 h-3 text-green-400 ml-1" />
        </div>
      </div>
    </header>
  );
}

function GlobalKPIs({ globalMetrics, alertCount }) {
  const metrics = [
    { label: 'Flujo Total', value: `${(globalMetrics?.totalFlowVph || 0).toLocaleString('es-CO')} veh/h`, icon: Car, color: '#0ea5e9' },
    { label: 'IRT Máximo', value: globalMetrics?.maxIrt || 0, icon: Activity, color: globalMetrics?.worstCorridor?.statusColor || '#22c55e' },
    { label: 'Alertas', value: alertCount, icon: AlertTriangle, color: alertCount > 5 ? '#ef4444' : '#f59e0b' },
    { label: 'Incidentes', value: globalMetrics?.totalIncidents || 0, icon: TrendingUp, color: (globalMetrics?.totalIncidents || 0) > 0 ? '#ef4444' : '#22c55e' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {metrics.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="rounded-lg border p-3" style={{ ...CARD, borderColor: `${color}25` }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Icon className="w-3.5 h-3.5" style={{ color }} />
            <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
          </div>
          <span className="text-lg font-bold tabular-nums" style={{ color, fontFamily: 'JetBrains Mono, Space Mono, monospace' }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function CorridorCard({ corridor, data, irtHistory, alertCount, onNavigate }) {
  if (!data) return null;
  const level = getIRTLevel(data.irt);

  return (
    <div
      className="rounded-lg border overflow-hidden cursor-pointer hover:border-opacity-60 transition-all group"
      style={{ ...CARD, borderLeftWidth: 3, borderLeftColor: corridor.color }}
      onClick={() => onNavigate(corridor.id)}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{corridor.name}</div>
            <div className="text-[10px] text-slate-500 font-mono">{corridor.route} · {corridor.distanceKm} km · {corridor.tollStations.length} peajes</div>
          </div>
          <div className="flex flex-col items-center px-2 py-1 rounded border ml-2" style={{
            backgroundColor: `${level.color}10`, borderColor: `${level.color}40`,
          }}>
            <span className="text-base font-bold tabular-nums leading-none" style={{ color: level.color, fontFamily: 'JetBrains Mono, monospace' }}>
              {data.irt}
            </span>
            <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: level.color }}>{level.label}</span>
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 mb-2">
          <span className="flex items-center gap-1"><Gauge className="w-3 h-3" /> {data.avgSpeed} km/h</span>
          <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {data.flowVph} veh/h</span>
          {alertCount > 0 && (
            <span className="flex items-center gap-1 text-red-400"><AlertTriangle className="w-3 h-3" /> {alertCount}</span>
          )}
        </div>

        {/* Sparkline */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-7">
            {(irtHistory || []).length > 2 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={irtHistory}>
                  <Line type="monotone" dataKey="irt" stroke={corridor.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}

/* ─── Leaflet: Pulsing toll marker via CSS ─── */
const PULSE_CSS_ID = 'viits-leaflet-pulse';
function injectPulseCSS() {
  if (document.getElementById(PULSE_CSS_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_CSS_ID;
  style.textContent = `
    .leaflet-container { background: #06111e !important; }
    .leaflet-control-zoom a { background: #0d1a2e !important; color: #94a3b8 !important; border-color: #1a2d4a !important; }
    .leaflet-control-zoom a:hover { background: #1a2d4a !important; color: #e2e8f0 !important; }
    .leaflet-control-attribution { display: none !important; }
    @keyframes viits-pulse { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(2.5); opacity: 0; } }
    .viits-toll-pulse { position: absolute; border-radius: 50%; animation: viits-pulse 2s ease-out infinite; pointer-events: none; }
    .viits-toll-pulse.critical { animation-duration: 1s; }
    .viits-toll-label {
      background: rgba(6, 17, 30, 0.88) !important;
      border: 1px solid #1a2d4a !important;
      color: #e2e8f0 !important;
      font-family: 'JetBrains Mono', monospace !important;
      font-size: 10px !important;
      padding: 4px 8px !important;
      border-radius: 6px !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
      white-space: nowrap !important;
    }
    .viits-toll-label::before { border-bottom-color: #1a2d4a !important; }
  `;
  document.head.appendChild(style);
}

/* ─── Map FitBounds helper ─── */
function MapBoundsController({ corridors }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const allPts = corridors.flatMap(c => c.tollStations.map(t => [t.lat, t.lng]));
    if (allPts.length > 0) {
      map.fitBounds(allPts, { padding: [30, 30], maxZoom: 7 });
      fitted.current = true;
    }
  }, [map, corridors]);
  return null;
}

function ColombiaMapPanel({ corridorData, onSelectCorridor, onSelectToll, showAccidentLayer, accidentHotspots }) {
  useEffect(() => { injectPulseCSS(); }, []);

  /* Memo: corridor polyline paths */
  const corridorLines = useMemo(() =>
    NEXUS_CORRIDORS.map(c => ({
      id: c.id,
      color: c.color,
      positions: c.tollStations.map(t => [t.lat, t.lng]),
    }))
  , []);

  /* All toll stations flat */
  const allTolls = useMemo(() =>
    NEXUS_CORRIDORS.flatMap(c =>
      c.tollStations.map(t => ({ ...t, corridorId: c.id, corridorColor: c.color }))
    )
  , []);

  return (
    <div className="rounded-lg border overflow-hidden" style={CARD}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: '#1a2d4a' }}>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Mapa de Corredores — Colombia</span>
        <span className="text-[10px] font-mono text-slate-600">{TOTAL_TOLL_STATIONS} peajes</span>
      </div>

      {/* ── Leaflet Map ── */}
      <div style={{ height: 480 }}>
        <MapContainer
          center={[5.5, -74.5]}
          zoom={6}
          zoomControl={true}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          dragging={true}
          style={{ height: '100%', width: '100%' }}
        >
          <MapBoundsController corridors={NEXUS_CORRIDORS} />

          {/* Dark tile layer — CartoDB Dark Matter */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            maxZoom={18}
          />
          {/* Subtle labels layer on top */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
            maxZoom={18}
            opacity={0.45}
          />

          {/* ── Corridor polylines ── */}
          {corridorLines.map(cl => {
            const d = corridorData[cl.id];
            const irt = d?.irt || 0;
            const weight = irt > 75 ? 5 : irt > 50 ? 4 : 3;
            return (
              <React.Fragment key={cl.id}>
                {/* Glow layer */}
                <Polyline
                  positions={cl.positions}
                  pathOptions={{
                    color: cl.color,
                    weight: weight + 6,
                    opacity: 0.1,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                  eventHandlers={{ click: () => onSelectCorridor(cl.id) }}
                />
                {/* Main line */}
                <Polyline
                  positions={cl.positions}
                  pathOptions={{
                    color: cl.color,
                    weight,
                    opacity: 0.85,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                  eventHandlers={{ click: () => onSelectCorridor(cl.id) }}
                />
              </React.Fragment>
            );
          })}

          {/* ── Toll station markers ── */}
          {allTolls.map(t => {
            const cd = corridorData[t.corridorId];
            const td = cd?.tollData?.find(td => td.stationId === t.id);
            const tirt = td?.irt || cd?.irt || 0;
            const tl = getIRTLevel(tirt);
            const isCrit = tirt > 75;
            const r = t.isCritical ? 7 : 5;

            return (
              <CircleMarker
                key={t.id}
                center={[t.lat, t.lng]}
                radius={r}
                pathOptions={{
                  color: isCrit ? tl.color : t.corridorColor,
                  fillColor: isCrit ? tl.color : t.corridorColor,
                  fillOpacity: 0.85,
                  weight: isCrit ? 2 : 1,
                  opacity: 1,
                }}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent?.stopPropagation?.();
                    onSelectToll && onSelectToll(t.corridorId, t.id);
                  },
                }}
              >
                <LTooltip
                  direction="top"
                  offset={[0, -8]}
                  className="viits-toll-label"
                  permanent={false}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{t.name}</div>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>{t.km} · {t.department}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                      <span style={{ color: tl.color, fontWeight: 'bold' }}>IRT {tirt}</span>
                      {td && <span style={{ color: '#38bdf8' }}>⚡ {td.speed} km/h</span>}
                      {td && <span style={{ color: '#a78bfa' }}>↑ {td.flow} veh/h</span>}
                    </div>
                  </div>
                </LTooltip>
              </CircleMarker>
            );
          })}
          {/* ── Accident Hotspot markers ── */}
          {showAccidentLayer && accidentHotspots && accidentHotspots.map(hs => {
            const nivel = getNivelRiesgo(hs.iraScore);
            const color = RIESGO_COLORS[nivel];
            const isFatal = hs.severidadMax === 'FATAL';
            const r = isFatal ? 9 : hs.iraScore >= 60 ? 7 : 5;

            return (
              <React.Fragment key={hs.id}>
                {/* Outer glow ring */}
                <CircleMarker
                  center={[hs.lat, hs.lng]}
                  radius={r + 6}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.08,
                    weight: 1,
                    opacity: 0.25,
                  }}
                />
                {/* Semana Santa ring */}
                {hs.factorSemSanta > 40 && (
                  <CircleMarker
                    center={[hs.lat, hs.lng]}
                    radius={r + 3}
                    pathOptions={{
                      color: '#f59e0b',
                      fillColor: 'transparent',
                      fillOpacity: 0,
                      weight: 1.5,
                      opacity: 0.7,
                      dashArray: '3 3',
                    }}
                  />
                )}
                {/* Main hotspot marker */}
                <CircleMarker
                  center={[hs.lat, hs.lng]}
                  radius={r}
                  pathOptions={{
                    color: isFatal ? '#fff' : color,
                    fillColor: color,
                    fillOpacity: 0.85,
                    weight: isFatal ? 2 : 1,
                    opacity: 1,
                  }}
                >
                  <LTooltip direction="top" offset={[0, -10]} className="viits-toll-label">
                    <div>
                      <div style={{ color, fontWeight: 'bold', fontSize: 11, marginBottom: 3 }}>
                        ⚠ {RIESGO_LABELS[nivel]} — IRA {hs.iraScore}/100
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 3, fontSize: 9 }}>
                        {hs.muertos > 0 && <span style={{ color: '#ef4444' }}>☠ {hs.muertos} muertos</span>}
                        <span style={{ color: '#f59e0b' }}>⚡ {hs.lesionados} heridos</span>
                        <span style={{ color: '#94a3b8' }}>📍 {hs.totalIncidentes} inc.</span>
                      </div>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>
                        Causa: <span style={{ color: '#e2e8f0' }}>{hs.hipotesisPrincipal}</span>
                      </div>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>
                        Veh: <span style={{ color: '#e2e8f0' }}>{hs.vehiculoPrincipal}</span> · Hora: <span style={{ color: '#f97316' }}>{hs.horaCritica}</span>
                      </div>
                      {hs.factorSemSanta > 30 && (
                        <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 3, padding: '2px 4px', background: 'rgba(245,158,11,0.1)', borderRadius: 3 }}>
                          📅 {hs.factorSemSanta}% ocurren en Semana Santa
                        </div>
                      )}
                    </div>
                  </LTooltip>
                </CircleMarker>
              </React.Fragment>
            );
          })}

        </MapContainer>
      </div>

      {/* ── Corridor legend ── */}
      <div className="grid grid-cols-2 gap-1 px-3 py-2 border-t" style={{ borderColor: '#1a2d4a' }}>
        {NEXUS_CORRIDORS.map(c => {
          const d = corridorData[c.id];
          const level = d ? getIRTLevel(d.irt) : null;
          return (
            <div key={c.id} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded cursor-pointer hover:bg-slate-800/40 transition-colors"
              onClick={() => onSelectCorridor(c.id)}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <span className="text-[9px] text-slate-400 font-mono truncate flex-1">{c.shortName}</span>
              {d && <span className="text-[9px] font-mono font-bold" style={{ color: level?.color }}>{d.irt}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertFeedPanel({ alerts }) {
  const SEVERITY = {
    emergency: { icon: AlertTriangle, bg: 'rgba(220, 38, 38, 0.08)', border: 'rgba(220, 38, 38, 0.3)', color: '#dc2626' },
    critical: { icon: AlertTriangle, bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' },
    warning:  { icon: AlertTriangle, bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b' },
    info:     { icon: Activity,      bg: 'rgba(14, 165, 233, 0.08)', border: 'rgba(14, 165, 233, 0.3)', color: '#0ea5e9' },
  };

  function timeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m`;
  }

  return (
    <div className="rounded-lg border p-3 flex flex-col" style={CARD}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Alertas en Tiempo Real</span>
        <span className="text-[10px] font-mono text-slate-600">{alerts.length} activas</span>
      </div>
      <div className="space-y-1.5 overflow-y-auto max-h-[280px] pr-1" style={{ scrollbarWidth: 'thin' }}>
        {alerts.length === 0 && <p className="text-xs text-slate-600 text-center py-4">Sin alertas recientes</p>}
        {alerts.slice(0, 10).map(alert => {
          const sev = SEVERITY[alert.severity] || SEVERITY.info;
          const Icon = sev.icon;
          return (
            <div key={alert.id} className="rounded p-2 border text-xs flex items-start gap-2"
              style={{ backgroundColor: sev.bg, borderColor: sev.border, animation: 'slideIn 0.3s ease-out' }}>
              <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: sev.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-slate-300 leading-snug">{alert.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-1 py-px rounded text-[9px] font-mono" style={{
                    backgroundColor: `${alert.corridorColor}20`, color: alert.corridorColor,
                  }}>{alert.corridorName}</span>
                  <span className="text-[9px] text-slate-600">{alert.stationName}</span>
                  <span className="text-[9px] text-slate-600 ml-auto">{timeAgo(alert.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IRTComparisonChart({ irtHistory }) {
  const data = [];
  const maxLen = Math.max(...NEXUS_CORRIDORS.map(c => (irtHistory[c.id] || []).length), 0);
  for (let i = 0; i < maxLen; i++) {
    const point = {};
    let hasTime = false;
    NEXUS_CORRIDORS.forEach(c => {
      const h = irtHistory[c.id] || [];
      if (h[i]) { if (!hasTime) { point.time = h[i].time; hasTime = true; } point[c.id] = h[i].irt; }
    });
    if (hasTime) data.push(point);
  }

  return (
    <div className="rounded-lg border p-3" style={CARD}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">IRT Comparativo — 7 Corredores</span>
        <span className="text-[10px] font-mono text-slate-600">Tiempo real</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" />
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
          {NEXUS_CORRIDORS.map(c => (
            <Line key={c.id} type="monotone" dataKey={c.id} name={c.shortName}
              stroke={c.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {NEXUS_CORRIDORS.map(c => (
          <span key={c.id} className="flex items-center gap-1 text-[9px] font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
            {c.shortName}
          </span>
        ))}
      </div>
    </div>
  );
}

function MonitorStatusBar() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 h-8 flex items-center justify-between px-4 text-[9px] font-mono"
      style={{ backgroundColor: '#040a14', borderTop: '1px solid #1a2d4a', color: '#475569' }}>
      <span>DITRA · Dirección Técnica de Carreteras · INVÍAS</span>
      <span>{TOTAL_TOLL_STATIONS} peajes · 7 corredores · DATOS SIMULADOS</span>
      <span>{new Date().toLocaleString('es-CO', { hour12: false })} · VIITS-NEXUS v2.0</span>
    </footer>
  );
}

/* ─── Main Component ─── */
/* ─── Global Accident Summary Panel ─── */
function GlobalAccidentSummary({ accData }) {
  if (!accData.hasData) return null;

  const ranking = Object.values(accData.data.resumenPorCorredor || {})
    .sort((a, b) => b.iraTotal - a.iraTotal);
  const maxIRA = Math.max(...ranking.map(r => r.iraTotal), 1);

  return (
    <div className="rounded-lg border p-4" style={CARD}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] font-bold text-slate-200">
            Inteligencia de Seguridad Vial — DITRA
          </div>
          <div className="text-[8px] text-slate-600 mt-0.5 font-mono">
            {accData.totalIncidentes.toLocaleString('es-CO')} incidentes históricos · {accData.totalHotspots} zonas de riesgo · {accData.hotspotsZonaNegra} zonas negras
          </div>
        </div>
        <div className="text-[8px] text-slate-700 font-mono">Fuente: Base DITRA/INVÍAS</div>
      </div>

      <div className="text-[9px] text-slate-600 tracking-widest uppercase mb-2">
        Ranking de riesgo — 7 corredores
      </div>
      <div className="flex flex-col gap-1">
        {ranking.map((stats, idx) => {
          const nivelColor = stats.iraPromedio >= 8 ? '#ef4444'
                           : stats.iraPromedio >= 5 ? '#f97316'
                           : stats.iraPromedio >= 3 ? '#eab308' : '#22c55e';
          const corridor = NEXUS_CORRIDORS.find(c => c.id === stats.corridorId);
          const pctBar = Math.min(100, stats.iraTotal / maxIRA * 100);

          return (
            <div key={stats.corridorId} className="flex items-center gap-3">
              <div className="text-[9px] font-bold font-mono w-4 text-slate-600">{idx + 1}</div>
              <div className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ background: corridor?.color || '#38bdf8' }} />
              <div className="text-[9px] text-slate-300 w-36 truncate">{stats.nombre}</div>
              <div className="flex-1 h-2 bg-[#090f1c] rounded overflow-hidden">
                <div className="h-full rounded transition-all duration-500"
                     style={{ width: `${pctBar}%`, background: nivelColor + 'cc' }} />
              </div>
              <div className="text-[8px] font-mono w-20 text-right">
                <span style={{ color: '#ef4444' }}>☠{stats.muertos}</span>
                <span style={{ color: '#f59e0b' }}> ⚡{stats.lesionados.toLocaleString('es-CO')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Accident Legend ─── */
function AccidentLegend({ accData }) {
  if (!accData.hasData) return null;
  const items = [
    { nivel: 'IRA 80-100', label: 'ZONA NEGRA', color: '#7f1d1d', icon: '▲' },
    { nivel: 'IRA 60-79',  label: 'ALTO',       color: '#ef4444', icon: '▲' },
    { nivel: 'IRA 40-59',  label: 'MEDIO',      color: '#f97316', icon: '◆' },
    { nivel: 'IRA < 40',   label: 'BAJO',       color: '#eab308', icon: '●' },
  ];
  return (
    <div className="rounded-lg border p-3" style={{ ...CARD, backgroundColor: 'rgba(9, 15, 28, 0.8)' }}>
      <div className="text-[9px] text-slate-600 tracking-widest uppercase mb-2">
        Índice de Riesgo de Accidentabilidad (IRA) — Metodología
      </div>
      <div className="flex gap-3 mb-2 flex-wrap">
        {items.map(item => (
          <div key={item.nivel} className="flex items-center gap-1.5">
            <span style={{ color: item.color, fontSize: 10 }}>{item.icon}</span>
            <div>
              <div className="text-[7px] font-bold" style={{ color: item.color }}>{item.label}</div>
              <div className="text-[6px] text-slate-700">{item.nivel}</div>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-[#1a2d4a]">
          <span style={{ color: '#f59e0b', fontSize: 10 }}>◌</span>
          <div className="text-[7px] text-[#f59e0b]">Alto riesgo<br/>Semana Santa</div>
        </div>
      </div>
      <div className="text-[7px] text-slate-700 font-mono">
        IRA = Severidad(☠×10 / ⚡×5 / ×2) × FactorHorario × FactorVehicular × FactorEstacional
        <br/>Clustering: radio 500m · Top 15 hotspots por corredor
        <br/>Fuente: Base de incidentes DITRA/INVÍAS 2023–2025 · {accData.totalIncidentes.toLocaleString('es-CO')} registros procesados
      </div>
    </div>
  );
}

/* ─── ALERTA DITRA: Panel de congestión en tiempo real para reporte Policía ─── */
function AlertaDITRA({ corridorData }) {
  const [wazeJams, setWazeJams] = React.useState([]);
  const [lastUpdate, setLastUpdate] = React.useState(null);
  const hour = getColombiaHour();

  // Solo visible entre 5AM y 23PM (siempre activo en horario operativo éxodo)
  const isVisible = hour >= 5 && hour <= 23;

  React.useEffect(() => {
    if (!isVisible) return;
    async function fetchWaze() {
      try {
        const IS_PROD = window.location.hostname !== 'localhost';
        const url = IS_PROD ? '/api/waze-tvt' : 'https://www.waze.com/row-partnerhub-api/feeds-tvt/?id=1761151881648';
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        const jams = (json.irregularities || [])
          .filter(j => j.jamLevel >= 3 && j.type !== 'STATIC') // Excluir eventos estáticos (procesiones, cierres programados)
          .sort((a, b) => {
            if (b.jamLevel !== a.jamLevel) return b.jamLevel - a.jamLevel;
            return (b.length || 0) - (a.length || 0);
          })
          .slice(0, 10);
        setWazeJams(jams);
        setLastUpdate(new Date());
      } catch (e) { /* silently fail */ }
    }
    fetchWaze();
    const id = setInterval(fetchWaze, 180000); // cada 3 min
    return () => clearInterval(id);
  }, [isVisible]);

  if (!isVisible || wazeJams.length === 0) return null;

  // Top 5 corredores VIITS por IRT
  const topCorridors = NEXUS_CORRIDORS
    .map(c => ({ ...c, irt: corridorData[c.id]?.irt || 0 }))
    .sort((a, b) => b.irt - a.irt)
    .slice(0, 5);

  const isPeakAlert = hour >= 17 && hour <= 19;

  return (
    <div className="rounded-lg border-2 p-4 mb-3" style={{
      backgroundColor: 'rgba(220, 38, 38, 0.06)',
      borderColor: isPeakAlert ? '#dc2626' : '#f59e0b',
      animation: isPeakAlert ? 'pulse 2s infinite' : 'none',
    }}>
      <style>{`@keyframes pulse { 0%,100% { border-color: #dc2626; } 50% { border-color: #7f1d1d; } }`}</style>

      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{
          backgroundColor: isPeakAlert ? 'rgba(220, 38, 38, 0.2)' : 'rgba(245, 158, 11, 0.2)',
        }}>
          <AlertTriangle className="w-4 h-4" style={{ color: isPeakAlert ? '#dc2626' : '#f59e0b' }} />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: isPeakAlert ? '#dc2626' : '#f59e0b' }}>
            {isPeakAlert ? '🚨 ALERTA DITRA — REPORTE POLICÍA NACIONAL' : '⚠ MONITOR DE CONGESTIÓN VIAL — DITRA'}
          </div>
          <div className="text-[9px] text-slate-400">
            Datos Waze en tiempo real · {lastUpdate ? lastUpdate.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }) : '...'} · Semana Santa 2026
          </div>
        </div>
      </div>

      {/* Top corredores VIITS por IRT */}
      <div className="mb-3">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Corredores VIITS — IRT más alto</div>
        <div className="grid grid-cols-5 gap-1.5">
          {topCorridors.map(c => {
            const level = getIRTLevel(c.irt);
            return (
              <div key={c.id} className="rounded px-2 py-1.5 text-center border" style={{
                backgroundColor: `${level.color}10`, borderColor: `${level.color}30`,
              }}>
                <div className="font-mono text-sm font-bold" style={{ color: level.color }}>{c.irt}</div>
                <div className="text-[8px] text-slate-400 truncate">{c.shortName}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top jams Waze con links a peajes/simulación */}
      <div>
        <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
          Top puntos de congestión Waze — Colombia ({wazeJams.length} tramos nivel ≥3) · Click para ver simulación
        </div>
        <div className="space-y-1">
          {wazeJams.slice(0, 7).map((jam, i) => {
            const colaKm = ((jam.length || 0) / 1000).toFixed(1);
            const tiempoMin = Math.round((jam.time || 0) / 60);
            const ratio = jam.historicTime > 0 ? (jam.time / jam.historicTime).toFixed(1) : '?';
            const hasAccident = jam.leadAlert?.type === 'ACCIDENT';
            const isClosed = jam.leadAlert?.type === 'ROAD_CLOSED';
            const levelColor = jam.jamLevel >= 4 ? '#dc2626' : '#f59e0b';

            // Match con peajes VIITS: buscar peaje más cercano
            const jamCenter = jam.line?.[Math.floor((jam.line?.length || 0) / 2)];
            let matchedToll = null;
            let matchedCorridor = null;
            if (jamCenter) {
              const R = 6371;
              let minDist = 15; // radio máximo 15km
              NEXUS_CORRIDORS.forEach(c => {
                c.tollStations.forEach(t => {
                  const dLat = (t.lat - jamCenter.y) * Math.PI / 180;
                  const dLng = (t.lng - jamCenter.x) * Math.PI / 180;
                  const a = Math.sin(dLat/2)**2 + Math.cos(jamCenter.y*Math.PI/180)*Math.cos(t.lat*Math.PI/180)*Math.sin(dLng/2)**2;
                  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  if (d < minDist) { minDist = d; matchedToll = t; matchedCorridor = c; }
                });
              });
            }

            const linkUrl = matchedToll
              ? `/monitor/${matchedCorridor.id}/${matchedToll.id.toLowerCase()}`
              : `/monitor/waze/${jam.id || i}`;

            return (
              <div key={jam.id || i}
                className="flex items-center gap-2 rounded px-2 py-1.5 border text-[10px] cursor-pointer hover:bg-slate-800/60 transition-colors"
                style={{ backgroundColor: 'rgba(6, 17, 30, 0.5)', borderColor: `${levelColor}30` }}
                onClick={() => { window.location.href = linkUrl; }}
              >
                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 font-mono font-bold text-[9px]" style={{
                  backgroundColor: `${levelColor}20`, color: levelColor,
                }}>
                  {jam.jamLevel}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-slate-300 truncate font-medium">
                    {jam.name || 'Tramo sin nombre'}
                    {hasAccident && <span className="ml-1 text-red-400">⚠ ACCIDENTE</span>}
                    {isClosed && <span className="ml-1 text-red-500">🚫 CERRADA</span>}
                  </div>
                  {matchedToll && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="px-1 py-px rounded text-[8px] font-mono" style={{
                        backgroundColor: `${matchedCorridor.color}20`, color: matchedCorridor.color,
                      }}>{matchedCorridor.id}</span>
                      <span className="text-[8px] text-cyan-400">→ {matchedToll.name}</span>
                      <ChevronRight className="w-3 h-3 text-cyan-400" />
                    </div>
                  )}
                  {!matchedToll && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="px-1 py-px rounded text-[8px] font-mono bg-purple-500/20 text-purple-400">WAZE</span>
                      <span className="text-[8px] text-purple-300">Ver simulación del tramo →</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 font-mono text-[9px]">
                  <span className="text-orange-400">{colaKm} km</span>
                  <span className="text-red-400">{tiempoMin} min</span>
                  <span className="text-slate-500">{ratio}x</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isPeakAlert && (
        <div className="mt-3 pt-2 border-t text-center" style={{ borderColor: 'rgba(220, 38, 38, 0.2)' }}>
          <div className="text-[9px] text-red-400 font-mono">
            REPORTE GENERADO PARA POLICÍA NACIONAL · DITRA · MINTRANSPORTE · {new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MonitorPage() {
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date());
  const [showAccidentLayer, setShowAccidentLayer] = useState(false);
  const { corridorData, irtHistory, globalMetrics } = useCorridorData(2000);
  const { alerts, alertsByCorridor } = useGlobalAlerts(corridorData);
  const accData = useAccidentData();

  const handleLoadComplete = useCallback(() => setLoading(false), []);

  // Clock tick — Colombia official time (America/Bogota UTC-5), never drifts
  React.useEffect(() => {
    const tick = () => setClock(new Date());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <MonitorLoadingScreen onComplete={handleLoadComplete} />;

  const navigateTo = (path) => {
    window.location.href = path;
  };

  return (
    <div className="min-h-screen bg-viits-bg text-viits-text font-sans" style={{ paddingBottom: 36 }}>
      <MonitorHeader globalMetrics={globalMetrics} clock={clock} />

      <main className="max-w-[1600px] mx-auto px-3 py-3">
        {/* ALERTA DITRA — Panel de congestión para reporte Policía */}
        <AlertaDITRA corridorData={corridorData} />

        {/* Global KPIs */}
        <GlobalKPIs globalMetrics={globalMetrics} alertCount={alerts.length} />

        <div className="grid grid-cols-12 gap-3 mt-3">
          {/* Left column — Map + Layers + Alerts (5/12) */}
          <div className="col-span-12 xl:col-span-5 space-y-3">
            <ColombiaMapPanel
              corridorData={corridorData}
              onSelectCorridor={(id) => navigateTo(`/monitor/${id}`)}
              onSelectToll={(cId, tId) => navigateTo(`/monitor/${cId}/${tId.toLowerCase()}`)}
              showAccidentLayer={showAccidentLayer}
              accidentHotspots={accData.hotspots}
            />

            {/* Map Layer Controls */}
            <AlertFeedPanel alerts={alerts} />
          </div>

          {/* Right column — Cards + Accident Summary + Chart (7/12) */}
          <div className="col-span-12 xl:col-span-7 space-y-3">
            {/* Corridor Cards Grid */}
            <div className="rounded-lg border p-3" style={CARD}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Corredores Semana Santa 2026</span>
                <span className="text-[10px] font-mono text-slate-600">7 corredores activos</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {NEXUS_CORRIDORS.map(c => (
                  <CorridorCard
                    key={c.id}
                    corridor={c}
                    data={corridorData[c.id]}
                    irtHistory={irtHistory[c.id]}
                    alertCount={alertsByCorridor(c.id).length}
                    onNavigate={(id) => navigateTo(`/monitor/${id}`)}
                  />
                ))}
              </div>
            </div>

            {/* Global Accident Summary */}
            <GlobalAccidentSummary accData={accData} />

            {/* IRT Comparison Chart */}
            <IRTComparisonChart irtHistory={irtHistory} />

            {/* Accident Legend */}
            <AccidentLegend accData={accData} />
          </div>
        </div>
      </main>

      <MonitorStatusBar />
    </div>
  );
}
