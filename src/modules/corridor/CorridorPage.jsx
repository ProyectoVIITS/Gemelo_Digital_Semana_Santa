/**
 * CorridorPage — Vista de corredor con tarjetas de peaje (mini-canvas)
 * El corredor es un agrupador de módulos de peaje.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip, Polyline } from 'react-leaflet';
import { ArrowLeft, Shield, Wifi, Gauge, Activity, AlertTriangle, Skull, Zap, Car, Clock, Search, Calendar, MapPin } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getCorridorById, getIRTLevel } from '../../data/nexusCorridors';
import { useCorridorData } from '../../hooks/useCorridorData';
import { useGlobalAlerts } from '../../hooks/useGlobalAlerts';
import { getOperationMode, CRITICAL_RETURN_CORRIDORS } from '../../utils/operationMode';
import { useAccidentData } from '../../hooks/useAccidentData';
import { getNivelRiesgo, RIESGO_COLORS, RIESGO_LABELS } from '../../data/accidentUtils';
import TollStationCard from './components/TollStationCard';
import LoadingScreen from '../../components/shared/LoadingScreen';

const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };

/* ─── Header ─── */
function CorridorHeader({ corridor, data, clock }) {
  const level = data ? getIRTLevel(data.irt) : { color: '#22c55e', label: 'NORMAL' };

  return (
    <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b"
      style={{ backgroundColor: 'rgba(10, 15, 30, 0.85)', backdropFilter: 'blur(12px)', borderColor: `${corridor.color}33` }}>
      <div className="flex items-center gap-3">
        <Link to="/monitor" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Monitor</span>
        </Link>
        <div className="w-px h-6 bg-slate-700" />
        <div className="w-8 h-8 rounded flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${corridor.color}, ${corridor.color}88)` }}>
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-wide" style={{ color: corridor.color, fontFamily: 'JetBrains Mono, monospace' }}>
            {corridor.shortName}
          </span>
          {(() => {
            const { isRetorno } = getOperationMode();
            if (!isRetorno) return <span className="text-[10px] text-slate-500 hidden lg:inline">{corridor.route}</span>;
            const isCritical = CRITICAL_RETURN_CORRIDORS.includes(corridor.id);
            const badgeColor = isCritical ? '#ef4444' : '#f59e0b';
            return (
              <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded animate-pulse"
                style={{ backgroundColor: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}44` }}>
                {isCritical ? 'RETORNO CRÍTICO' : 'RETORNO'}
              </span>
            );
          })()}
        </div>
      </div>

      <div className="text-center hidden md:flex items-center gap-4">
        <span className="text-sm font-semibold text-white">{corridor.name}</span>
        <span className="text-xs text-slate-500">{corridor.distanceKm} km · {corridor.tollStations.length} peajes</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm tabular-nums text-slate-300" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
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

/* ─── IRT History Chart ─── */
function CorridorIRTChart({ irtHistory, corridor }) {
  return (
    <div className="rounded-lg border p-3" style={CARD}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Historial IRT — {corridor.shortName}</span>
        <span className="text-[10px] font-mono text-slate-600">Tiempo real</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={irtHistory} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={`irtGrad-${corridor.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={corridor.color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={corridor.color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" />
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
          <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.5}
            label={{ value: 'Crítico', position: 'right', fill: '#ef4444', fontSize: 9 }} />
          <Area type="monotone" dataKey="irt" stroke={corridor.color} strokeWidth={2}
            fill={`url(#irtGrad-${corridor.id})`} dot={false} animationDuration={500} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Corridor Alerts ─── */
function CorridorAlerts({ alerts, corridorColor }) {
  const SEVERITY = {
    emergency: { bg: 'rgba(220, 38, 38, 0.08)', border: 'rgba(220, 38, 38, 0.3)', color: '#dc2626' },
    critical: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' },
    warning: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b' },
    info: { bg: 'rgba(14, 165, 233, 0.08)', border: 'rgba(14, 165, 233, 0.3)', color: '#0ea5e9' },
  };

  function timeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m`;
  }

  return (
    <div className="rounded-lg border p-3" style={CARD}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Alertas del Corredor</span>
        <span className="text-[10px] font-mono text-slate-600">{alerts.length} activas</span>
      </div>
      <div className="space-y-1.5 overflow-y-auto max-h-[250px]" style={{ scrollbarWidth: 'thin' }}>
        {alerts.length === 0 && <p className="text-xs text-slate-600 text-center py-4">Sin alertas recientes</p>}
        {alerts.slice(0, 8).map(alert => {
          const sev = SEVERITY[alert.severity] || SEVERITY.info;
          return (
            <div key={alert.id} className="rounded p-2 border text-xs flex items-start gap-2"
              style={{ backgroundColor: sev.bg, borderColor: sev.border }}>
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: sev.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-slate-300 leading-snug">{alert.message}</p>
                <div className="flex items-center gap-2 mt-1">
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

/* ─── Corridor Accident Panel (IRA) — Rediseño moderno ─── */
function CorridorAccidentPanel({ corridorId, corridorColor }) {
  const accData = useAccidentData();
  const stats = accData.getCorridorStats(corridorId);
  const top5 = accData.getTopHotspots(corridorId, 5);
  const ssHots = accData.getSemSantaHotspots(corridorId);

  if (!accData.hasData || !stats) return null;

  const NIVEL_BADGE = {
    MUY_ALTO: { label: 'ZONA NEGRA', bg: '#7f1d1d', text: '#fca5a5' },
    ALTO:     { label: 'ALTO',       bg: '#7f1d1d88', text: '#fca5a5' },
    MEDIO:    { label: 'MEDIO',      bg: '#78350f88', text: '#fbbf24' },
    BAJO:     { label: 'BAJO',       bg: '#1a2d4a',   text: '#94a3b8' },
  };

  const kpis = [
    { label: 'INCIDENTES',  value: stats.totalIncidentes?.toLocaleString('es-CO'), color: '#f59e0b', Icon: AlertTriangle },
    { label: 'FALLECIDOS',  value: stats.muertos,       color: '#ef4444', Icon: Skull },
    { label: 'LESIONADOS',  value: stats.lesionados?.toLocaleString('es-CO'), color: '#fb923c', Icon: Zap },
    { label: 'IRA PROMEDIO',value: stats.iraPromedio?.toFixed(1), color: corridorColor, Icon: Gauge },
  ];

  const insights = [
    { label: 'Vehículo dominante', value: stats.vehiculoDominante, Icon: Car, color: '#38bdf8' },
    { label: 'Hora crítica',       value: stats.horaCritica,       Icon: Clock, color: '#a78bfa' },
    { label: 'Causa principal',    value: (stats.hipotesisPrincipal || '').slice(0, 30), Icon: Search, color: '#f59e0b' },
  ];

  const avgSSFactor = ssHots.length > 0
    ? Math.round(ssHots.reduce((s, h) => s + h.factorSemSanta, 0) / ssHots.length)
    : 0;

  return (
    <div className="rounded-lg border p-4" style={CARD}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-200">Índice Predictivo de Accidentabilidad</div>
            <div className="text-[8px] text-slate-600 font-mono">Fuente: Base DITRA/INVÍAS · 2023–2025 · {stats.totalIncidentes?.toLocaleString('es-CO')} registros</div>
          </div>
        </div>
        <div className="px-2 py-1 rounded text-[8px] font-mono font-bold" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
          IRA {stats.iraPromedio?.toFixed(1)}
        </div>
      </div>

      {/* ── KPIs con íconos ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {kpis.map(({ label, value, color, Icon }) => (
          <div key={label} className="rounded-lg p-3 flex items-center gap-3"
            style={{ backgroundColor: '#090f1c', borderLeft: `3px solid ${color}` }}>
            <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
            <div>
              <div className="text-lg font-bold font-mono leading-none" style={{ color }}>{value}</div>
              <div className="text-[7px] text-slate-600 tracking-wider mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Insights como pills ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {insights.map(({ label, value, Icon, color }) => (
          <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: '#090f1c', border: '1px solid #1a2d4a' }}>
            <Icon className="w-3 h-3" style={{ color }} />
            <span className="text-[8px] text-slate-500">{label}:</span>
            <span className="text-[9px] font-bold text-slate-200">{value || '—'}</span>
          </div>
        ))}
      </div>

      {/* ── Alerta Semana Santa ── */}
      {ssHots.length > 0 && (
        <div className="mb-4 rounded-lg p-3 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Calendar className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-amber-400 mb-1">
              {ssHots.length} zona{ssHots.length > 1 ? 's' : ''} con alto riesgo en Semana Santa
            </div>
            <div className="text-[8px] text-slate-500 mb-1.5">
              Estos puntos concentran &gt;40% de incidentes en marzo-abril. Factor promedio: {avgSSFactor}%
            </div>
            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-[#1a2d4a] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${avgSSFactor}%`, background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Mapa de Hotspots del Corredor ── */}
      {top5.length > 0 && (
        <div className="mb-4">
          <div className="text-[9px] text-slate-600 tracking-widest uppercase mb-2">
            <MapPin className="w-3 h-3 inline mr-1" style={{ color: corridorColor }} />
            Ubicación de zonas de riesgo — {corridorId}
          </div>
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: '#1a2d4a', height: 280 }}>
            <MapContainer
              center={[
                top5.reduce((s, h) => s + h.lat, 0) / top5.length,
                top5.reduce((s, h) => s + h.lng, 0) / top5.length,
              ]}
              zoom={9}
              zoomControl={true}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%', background: '#06111e' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
                maxZoom={18}
              />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
                maxZoom={18}
                opacity={0.5}
              />

              {/* Corridor route polyline */}
              {(() => {
                const corridor = getCorridorById(corridorId);
                if (!corridor) return null;
                const positions = corridor.tollStations.map(t => [t.lat, t.lng]);
                return (
                  <Polyline
                    positions={positions}
                    pathOptions={{ color: corridorColor, weight: 3, opacity: 0.4, dashArray: '8 4' }}
                  />
                );
              })()}

              {/* All corridor hotspots (dimmed) */}
              {accData.getHotspotsByCorridor(corridorId)
                .filter(h => !top5.find(t => t.id === h.id))
                .map(hs => (
                  <CircleMarker
                    key={hs.id}
                    center={[hs.lat, hs.lng]}
                    radius={3}
                    pathOptions={{ color: '#475569', fillColor: '#475569', fillOpacity: 0.3, weight: 1, opacity: 0.4 }}
                  />
                ))
              }

              {/* Top 5 hotspots (highlighted) */}
              {top5.map((hs, idx) => {
                const nivel = getNivelRiesgo(hs.iraScore);
                const hColor = RIESGO_COLORS[nivel];
                return (
                  <React.Fragment key={hs.id}>
                    {/* Outer pulse */}
                    <CircleMarker
                      center={[hs.lat, hs.lng]}
                      radius={14}
                      pathOptions={{ color: hColor, fillColor: hColor, fillOpacity: 0.08, weight: 1, opacity: 0.3 }}
                    />
                    {/* Main marker */}
                    <CircleMarker
                      center={[hs.lat, hs.lng]}
                      radius={8}
                      pathOptions={{
                        color: hs.severidadMax === 'FATAL' ? '#fff' : hColor,
                        fillColor: hColor,
                        fillOpacity: 0.9,
                        weight: 2,
                        opacity: 1,
                      }}
                    >
                      <LTooltip direction="top" offset={[0, -10]} className="viits-toll-label" permanent={false}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: hColor, fontSize: 11, marginBottom: 2 }}>
                            #{idx + 1} · IRA {hs.iraScore}/100
                          </div>
                          <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>
                            {hs.totalIncidentes} incidentes · {hs.muertos > 0 ? `☠ ${hs.muertos} muertos · ` : ''}{hs.lesionados} heridos
                          </div>
                          <div style={{ fontSize: 8, color: '#64748b' }}>
                            {hs.vehiculoPrincipal} · {hs.horaCritica}
                          </div>
                          {hs.hipotesisPrincipal && hs.hipotesisPrincipal !== 'SIN DATOS' && (
                            <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 2 }}>
                              Causa: {hs.hipotesisPrincipal.slice(0, 30)}
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
        </div>
      )}

      {/* ── Top 5 Hotspots — Card Grid ── */}
      <div className="mb-3">
        <div className="text-[9px] text-slate-600 tracking-widest uppercase mb-3">
          Top zonas de riesgo predictivo
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {top5.map((hs, idx) => {
            const nivel = getNivelRiesgo(hs.iraScore);
            const color = RIESGO_COLORS[nivel];
            const badge = NIVEL_BADGE[nivel];
            return (
              <div key={hs.id} className="rounded-lg overflow-hidden"
                style={{ backgroundColor: color + '08', border: `1px solid ${color}22` }}>

                {/* Card header with IRA */}
                <div className="flex items-center gap-3 p-3 pb-2">
                  <div className="flex items-center gap-2 flex-shrink-0" style={{ borderLeft: `4px solid ${color}`, paddingLeft: 8 }}>
                    <div className="text-[10px] font-mono text-slate-600">#{idx + 1}</div>
                    <div className="text-2xl font-bold font-mono leading-none" style={{ color }}>{hs.iraScore}</div>
                    <div className="text-[7px] text-slate-600 font-mono">/ 100</div>
                  </div>
                  <div className="ml-auto">
                    <span className="text-[8px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: badge.bg, color: badge.text }}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* IRA progress bar */}
                <div className="px-3 mb-2">
                  <div className="h-1.5 w-full rounded-full bg-[#0a0f1e] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${hs.iraScore}%`,
                        background: `linear-gradient(90deg, ${color}88, ${color})`,
                      }} />
                  </div>
                </div>

                {/* Micro-metrics 2x2 */}
                <div className="grid grid-cols-4 gap-px mx-3 mb-2 rounded overflow-hidden">
                  {[
                    { icon: '☠', label: 'Muertos', val: hs.muertos, c: hs.muertos > 0 ? '#ef4444' : '#334155' },
                    { icon: '⚡', label: 'Heridos', val: hs.lesionados, c: hs.lesionados > 0 ? '#fb923c' : '#334155' },
                    { icon: '📍', label: 'Incid.', val: hs.totalIncidentes, c: '#38bdf8' },
                    { icon: '📅', label: 'Sem.S', val: `${hs.factorSemSanta}%`, c: hs.factorSemSanta > 40 ? '#f59e0b' : '#334155' },
                  ].map(m => (
                    <div key={m.label} className="text-center py-1.5" style={{ backgroundColor: '#090f1c' }}>
                      <div className="text-[10px] font-bold font-mono" style={{ color: m.c }}>{m.icon} {m.val}</div>
                      <div className="text-[6px] text-slate-700 uppercase">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Footer: causa + vehículo + hora */}
                <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                  {hs.hipotesisPrincipal && hs.hipotesisPrincipal !== 'SIN DATOS' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[7px] text-slate-400"
                      style={{ backgroundColor: '#0a0f1e', border: '1px solid #1a2d4a' }}>
                      <Search className="w-2.5 h-2.5" /> {hs.hipotesisPrincipal.slice(0, 22)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[7px] text-slate-400"
                    style={{ backgroundColor: '#0a0f1e', border: '1px solid #1a2d4a' }}>
                    <Car className="w-2.5 h-2.5" /> {hs.vehiculoPrincipal}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[7px] text-slate-400"
                    style={{ backgroundColor: '#0a0f1e', border: '1px solid #1a2d4a' }}>
                    <Clock className="w-2.5 h-2.5" /> {hs.horaCritica}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Leyenda IRA compacta ── */}
      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #1a2d4a' }}>
        <div className="flex gap-3">
          {[
            { label: 'ZONA NEGRA', range: '80-100', color: '#7f1d1d' },
            { label: 'ALTO',       range: '60-79',  color: '#ef4444' },
            { label: 'MEDIO',      range: '40-59',  color: '#f97316' },
            { label: 'BAJO',       range: '<40',     color: '#eab308' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-[7px] text-slate-600 font-mono">{item.label}</span>
            </div>
          ))}
        </div>
        <span className="text-[7px] text-slate-700 font-mono">IRA = Severidad × Hora × Vehículo × Estacional</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ★ MAIN: CorridorPage
   ═══════════════════════════════════════════════════════════════ */
export default function CorridorPage() {
  const { corridorId } = useParams();
  const navigate = useNavigate();
  const corridor = getCorridorById(corridorId);
  const { corridorData, irtHistory } = useCorridorData(2000);
  const { alerts, alertsByCorridor } = useGlobalAlerts(corridorData);
  const [clock, setClock] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const handleLoadComplete = useCallback(() => setLoading(false), []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!corridor) {
    return (
      <div className="min-h-screen bg-viits-bg flex items-center justify-center">
        <div className="text-center text-slate-400">
          <p>Corredor no encontrado</p>
          <button onClick={() => navigate('/monitor')} className="text-cyan-400 mt-4 text-sm">Volver al monitor</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <LoadingScreen
        title={corridor.shortName}
        subtitle={`${corridor.name} · ${corridor.tollStations.length} peajes`}
        color={corridor.color}
        onComplete={handleLoadComplete}
      />
    );
  }

  const data = corridorData[corridorId];
  const history = irtHistory[corridorId] || [];
  const level = data ? getIRTLevel(data.irt) : { color: '#22c55e', label: 'NORMAL' };
  const corridorAlerts = alertsByCorridor ? alertsByCorridor(corridorId) : [];

  return (
    <div className="flex flex-col min-h-screen bg-[#06111e] text-slate-200"
         style={{ fontFamily: '"JetBrains Mono", monospace', paddingBottom: 36 }}>

      <CorridorHeader corridor={corridor} data={data} clock={clock} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-[#090f1c] text-[9px] text-[#475569]"
        style={{ borderColor: '#1a2d4a' }}>
        <Link to="/monitor" className="hover:text-[#38bdf8] transition-colors">Monitor Global</Link>
        <span>/</span>
        <span style={{ color: corridor.color }}>{corridor.shortName}</span>
      </div>

      <main className="max-w-[1600px] mx-auto px-3 py-3 flex-1">
        {/* KPIs del corredor */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'IRT CORREDOR', value: String(data?.irt || 0), color: level.color, unit: '' },
            { label: 'VEL. MEDIA', value: String(data?.avgSpeed || 0), color: '#38bdf8', unit: ' km/h' },
            { label: 'FLUJO TOTAL', value: (data?.flowVph || 0).toLocaleString('es-CO'), color: '#a78bfa', unit: ' veh/h' },
            { label: 'ALERTAS', value: String(corridorAlerts.length), color: corridorAlerts.length > 0 ? '#ef4444' : '#22c55e', unit: '' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-lg border p-3" style={CARD}>
              <div className="text-[9px] text-[#475569] tracking-widest uppercase mb-1">{kpi.label}</div>
              <div className="text-2xl font-bold" style={{ color: kpi.color, fontFamily: 'JetBrains Mono, monospace' }}>
                {kpi.value}{kpi.unit}
              </div>
            </div>
          ))}
        </div>

        {/* IRT Chart */}
        <CorridorIRTChart irtHistory={history} corridor={corridor} />

        {/* ── ACCIDENTABILIDAD PREDICTIVA ─────────────────── */}
        <div className="mt-4">
          <CorridorAccidentPanel corridorId={corridorId} corridorColor={corridor.color} />
        </div>

        {/* ── PEAJES DEL CORREDOR ─────────────────────────── */}
        <div className="mt-4">
          <div className="text-[9px] text-[#475569] tracking-widest uppercase mb-3">
            Peajes del corredor — {corridor.tollStations.length} estaciones
          </div>

          {/* GRID DE TARJETAS DE PEAJE CON MINI-CANVAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {corridor.tollStations.map(toll => (
              <TollStationCard
                key={toll.id}
                corridor={corridor}
                toll={toll}
              />
            ))}
          </div>
        </div>

        {/* Alertas del corredor */}
        <div className="mt-4">
          <CorridorAlerts alerts={corridorAlerts} corridorColor={corridor.color} />
        </div>

        {/* Corridor Info */}
        <div className="rounded-lg border p-3 mt-4" style={CARD}>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Información del Corredor</span>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Departamentos</div>
              <div className="text-xs text-slate-300">{corridor.departments.join(', ')}</div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Vel. Límite</div>
              <div className="text-xs text-slate-300 font-mono">{corridor.speedLimit} km/h</div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Waypoints</div>
              <div className="text-xs text-slate-300">{corridor.waypoints.join(' → ')}</div>
            </div>
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 h-8 flex items-center justify-between px-4 text-[9px] font-mono"
        style={{ backgroundColor: '#040a14', borderTop: '1px solid #1a2d4a', color: '#475569' }}>
        <span>DITRA · INVÍAS · {corridor.name}</span>
        <span>{corridor.tollStations.length} peajes · DATOS SIMULADOS</span>
        <span>{new Date().toLocaleString('es-CO', { hour12: false })} · VIITS-NEXUS v2.0</span>
      </footer>
    </div>
  );
}
