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
import { useTrafficStore } from '../../store/trafficStore';

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
          <div className="flex-1" style={{ height: 28, minHeight: 28, minWidth: 100 }}>
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

function WazeJamMarker({ jam }) {
  const map = useMap();
  const jamCenter = jam.line?.[Math.floor((jam.line?.length || 0) / 2)];
  if (!jamCenter) return null;
  const isSevere = jam.jamLevel >= 4;
  const levelColor = isSevere ? '#ef4444' : '#f59e0b';
  
  const handleClick = (e) => {
    e.originalEvent?.stopPropagation?.();
    map.setView([jamCenter.y, jamCenter.x], 13, { animate: true, duration: 1.5 });
  };

  return (
    <React.Fragment>
      {/* Outer pulsing ring */}
      <div className={`viits-toll-pulse ${isSevere ? 'critical' : ''}`} style={{
        left: '50%', top: '50%', width: 0, height: 0 /* Leaflet can't overlay HTML easily inside SVG here without Marker, so we use CircleMarker glow */
      }} />
      <CircleMarker
        center={[jamCenter.y, jamCenter.x]}
        radius={isSevere ? 13 : 9}
        pathOptions={{
          color: levelColor,
          fillColor: levelColor,
          fillOpacity: 0.25,
          weight: 1,
          opacity: 0.6,
          dashArray: '2 4'
        }}
        eventHandlers={{ click: handleClick }}
      />
      <CircleMarker
        center={[jamCenter.y, jamCenter.x]}
        radius={isSevere ? 5 : 4}
        pathOptions={{
          color: '#fff',
          fillColor: levelColor,
          fillOpacity: 1,
          weight: 2,
          opacity: 1,
        }}
        eventHandlers={{ click: handleClick }}
      >
        <LTooltip direction="top" offset={[0, -8]} className="viits-toll-label">
          <div>
            <div style={{ color: levelColor, fontWeight: 'bold', fontSize: 11, marginBottom: 2 }}>
              {(jam.name || 'CONGESTIÓN EN TRAMO DE VÍA').toUpperCase()}
              {jam.leadAlert?.type === 'ACCIDENT' && ' ⚠'}
            </div>
            <div style={{ display: 'flex', gap: 6, fontSize: 9 }}>
              <span style={{ color: '#f59e0b' }}>Nivel {jam.jamLevel}</span>
              <span style={{ color: '#ef4444' }}>{Math.round(jam.time/60)} min</span>
              <span style={{ color: '#38bdf8' }}>{(jam.length/1000).toFixed(1)} km</span>
            </div>
            <div style={{ marginTop: 4, color: '#94a3b8', fontSize: 8 }}>Haz click para enfocar al corredor</div>
          </div>
        </LTooltip>
      </CircleMarker>
    </React.Fragment>
  );
}

function ColombiaMapPanel({ corridorData, onSelectCorridor, onSelectToll, showAccidentLayer, accidentHotspots }) {
  const wazeJams = useTrafficStore(state => state.nationalWazeJams) || [];
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
            const weight = irt > 75 ? 3 : irt > 50 ? 2.5 : 1.5;
            return (
              <React.Fragment key={cl.id}>
                {/* Glow layer */}
                <Polyline
                  positions={cl.positions}
                  pathOptions={{
                    color: cl.color,
                    weight: weight + 3,
                    opacity: 0.05,
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
                    opacity: 0.45,
                    dashArray: '5 5',
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

          {/* ── Waze Jam markers ── */}
          {wazeJams.map(jam => (
            <WazeJamMarker key={jam.uuid || jam.id} jam={jam} />
          ))}
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
  const wazeJams = useTrafficStore(state => state.nationalWazeJams) || [];
  const hour = getColombiaHour();
  
  // Siempre visible, diseño de centro de comando
  const isPeakAlert = hour >= 16 && hour <= 20;

  // Top corredores VIITS por IRT
  const topCorridors = NEXUS_CORRIDORS
    .map(c => ({ ...c, irt: corridorData[c.id]?.irt || 0 }))
    .sort((a, b) => b.irt - a.irt)
    .slice(0, 5);

  return (
    <div className="relative rounded-2xl border p-5 mb-4 overflow-hidden group shadow-2xl" style={{
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(16px)',
      borderColor: isPeakAlert ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.2)',
      boxShadow: isPeakAlert ? '0 0 40px rgba(239, 68, 68, 0.1)' : '0 0 30px rgba(245, 158, 11, 0.05)',
      animation: isPeakAlert ? 'pulse-border 3s infinite' : 'none'
    }}>
      <style>{`
        @keyframes pulse-border { 0%,100% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 0 40px rgba(239, 68, 68, 0.15); } 50% { border-color: rgba(153, 27, 27, 0.2); box-shadow: 0 0 20px rgba(239, 68, 68, 0.05); } }
        /* Animación para barras de slider de tráfico */
        @keyframes flow-gradient { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
      `}</style>
      
      {/* Background radial gradient */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-4 mb-4 relative z-10">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg" style={{
          background: isPeakAlert ? 'linear-gradient(135deg, #ef4444, #991b1b)' : 'linear-gradient(135deg, #f59e0b, #b45309)',
        }}>
          <AlertTriangle className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-white flex items-center gap-2">
            {isPeakAlert ? '🚨 ALERTA DITRA — REPORTE POLICÍA NACIONAL' : '⚠ MONITOR DE CONGESTIÓN VIAL'}
            <div className="px-2 py-0.5 rounded text-[8px] tracking-widest font-bold bg-white/10 text-white/90">LIVE</div>
          </div>
          <div className="text-[10px] text-slate-400 tracking-wide mt-0.5 font-mono">
            Radar Global Waze TVT · Datos Sincronizados · Top Nacional ({wazeJams.length} incidentes críticos)
          </div>
        </div>
      </div>

      {/* Top corredores VIITS por IRT */}
      <div className="mb-4 relative z-10">
        <div className="text-[9px] uppercase tracking-[0.15em] text-slate-500 mb-2">Corredores Principales (Top IRT)</div>
        <div className="grid grid-cols-5 gap-2">
          {topCorridors.map(c => {
            const level = getIRTLevel(c.irt);
            return (
              <div key={c.id} className="rounded-lg px-3 py-2 border relative overflow-hidden transition-colors hover:bg-white/5" style={{
                backgroundColor: `${level.color}0a`, borderColor: `${level.color}30`,
              }}>
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: level.color }} />
                <div className="font-mono text-lg font-bold" style={{ color: level.color }}>{c.irt}</div>
                <div className="text-[9px] text-slate-400 truncate">{c.shortName}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 10 jams Waze */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[9px] uppercase tracking-[0.15em] text-slate-500">
            Top puntos de congestión críticos (Nivel ≥3)
          </div>
        </div>
        <div className="space-y-1.5">
          {wazeJams.length === 0 ? (
            <div className="text-center py-6 px-4 border border-dashed rounded-lg border-slate-700/50 bg-slate-800/20">
              <span className="text-slate-400 text-xs tracking-widest uppercase">
                ✅ Sin congestión crítica a nivel nacional en este momento
              </span>
            </div>
          ) : wazeJams.map((jam, i) => {
              const colaKm = ((jam.length || 0) / 1000).toFixed(1);
              const tiempoMin = Math.round((jam.time || 0) / 60);
            
            let ratioValue = 1;
            if (jam.historicTime > 0) ratioValue = (jam.time / jam.historicTime);
            const ratio = ratioValue > 1 ? ratioValue.toFixed(1) : '?';
            
            const hasAccident = jam.leadAlert?.type === 'ACCIDENT';
            const isClosed = jam.leadAlert?.type === 'ROAD_CLOSED';
            const isSevere = jam.jamLevel >= 4 || ratioValue >= 4;
            const levelColor = jam.jamLevel >= 4 ? '#ef4444' : '#f59e0b';
            
            const linkUrl = `/monitor/waze/${jam.uuid || jam.id || i}`;

            // Calculando UI de barra
            const ratioPct = Math.min(100, Math.max(0, (ratioValue / 10) * 100)); // 10x is 100%

            return (
              <div key={jam.uuid || jam.id || i}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-all hover:scale-[1.01] hover:bg-slate-800/80 cursor-pointer relative overflow-hidden group"
                style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', borderColor: isSevere ? `${levelColor}40` : `${levelColor}20`,
                         boxShadow: isSevere ? `0 0 15px ${levelColor}15` : 'none' }}
                onClick={() => { window.location.href = linkUrl; }}
              >
                {/* Highlight slider en la fila cuando el mouse pasa */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
                
                {/* Nivel indicator */}
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 font-mono font-bold text-[13px]" style={{
                  background: `linear-gradient(135deg, ${levelColor}40, ${levelColor}10)`, 
                  color: levelColor, border: `1px solid ${levelColor}40`,
                  boxShadow: isSevere ? `0 0 10px ${levelColor}40` : 'none'
                }}>
                  {jam.jamLevel}
                </div>

                {/* Name y etiquetas */}
                <div className="flex-1 min-w-0">
                  <div className="text-slate-200 truncate font-semibold text-[11px] tracking-wide">
                    {jam.name || 'Tramo Departamental'}
                    {hasAccident && <span className="ml-1.5 px-1.5 py-0.5 rounded-sm bg-red-500/20 text-red-400 text-[8px] uppercase tracking-widest border border-red-500/30 font-bold">⚠ ACCIDENTE</span>}
                    {isClosed && <span className="ml-1.5 px-1.5 py-0.5 rounded-sm bg-red-900/40 text-red-500 text-[8px] uppercase tracking-widest border border-red-500/30 font-bold">🚫 CERRADO</span>}
                  </div>
                  <div className="flex items-center mt-1 flex-wrap gap-1.5">
                    <span className="px-1 py-0.5 rounded text-[8px] font-mono font-bold border border-purple-500/30" style={{
                       background: 'linear-gradient(45deg, rgba(168,85,247,0.2), rgba(168,85,247,0.05))', color: '#c084fc'
                    }}>WAZE LIVE</span>
                    <span className="text-[9px] text-slate-400">Punto Geográfico Exacto DITRA</span>
                  </div>
                </div>

                {/* Métricas y Barra UI */}
                <div className="flex items-center gap-4 flex-shrink-0 font-mono">
                  <div className="flex flex-col items-end w-12">
                    <span className="text-[12px] text-slate-300 font-bold">{colaKm} km</span>
                    <span className="text-[8px] text-slate-500 tracking-widest">COLA</span>
                  </div>
                  <div className="w-px h-6 bg-slate-700/50" />
                  <div className="flex flex-col items-end w-12">
                    <span className="text-[12px] font-bold" style={{ color: isSevere ? '#ef4444' : '#f59e0b' }}>{tiempoMin} min</span>
                    <span className="text-[8px] text-slate-500 tracking-widest">DEMORA</span>
                  </div>
                  <div className="w-px h-6 bg-slate-700/50" />
                  
                  {/* Multiplier con Barra */}
                  <div className="w-24 pl-1">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-[8px] text-slate-500 tracking-widest">MULTIPLICADOR</span>
                      <span className="text-[12px] font-bold" style={{ color: ratioValue >= 5 ? '#ef4444' : '#fbbf24' }}>{ratio}x</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                      <div className="h-full rounded-full transition-all duration-1000" 
                           style={{ 
                             width: `${ratioPct}%`, 
                             background: ratioValue >= 5 ? 'linear-gradient(90deg, #f97316, #ef4444)' : 'linear-gradient(90deg, #ca8a04, #f59e0b)',
                             boxShadow: ratioValue >= 5 ? '0 0 10px #ef4444' : 'none'
                           }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t text-center relative z-10" style={{ borderColor: 'rgba(148, 163, 184, 0.1)' }}>
        <div className="text-[9px] text-slate-500 font-mono tracking-widest uppercase flex items-center justify-center gap-2">
          <span>CENTRO DE CONTROL DITRA — {new Date().toLocaleDateString('es-CO')}</span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span>MINTRANSPORTE COLOMBIA</span>
        </div>
      </div>
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
