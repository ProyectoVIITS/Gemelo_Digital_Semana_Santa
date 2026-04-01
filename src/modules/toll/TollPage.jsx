/**
 * TollPage — Módulo de peaje individual (= réplica del piloto Chuzacá)
 * Cada peaje es una aplicación autónoma con su propio estado y datos en tiempo real.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Wifi, MapPin, Gauge, Activity, AlertTriangle, Car, BarChart2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getCorridorById, getIRTLevel } from '../../data/nexusCorridors';
import useTollData from './hooks/useTollData';
import TollCanvas from './components/TollCanvas';
import LoadingScreen from '../../components/shared/LoadingScreen';
import { getOperationMode } from '../../utils/operationMode';
import { useGlobalTraffic } from '../../hooks/useTrafficAPI';
import CongestionForecast from '../../components/shared/CongestionForecast';

const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };

/* ─── Header ─── */
function TollHeader({ toll, corridor, clock }) {
  return (
    <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b"
      style={{ backgroundColor: 'rgba(10, 15, 30, 0.85)', backdropFilter: 'blur(12px)', borderColor: `${corridor.color}33` }}>
      <div className="flex items-center gap-3">
        <Link to={`/monitor/${corridor.id}`} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{corridor.shortName}</span>
        </Link>
        <div className="w-px h-6 bg-slate-700" />
        <div className="w-8 h-8 rounded flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${corridor.color}, ${corridor.color}88)` }}>
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-sm font-bold tracking-wide" style={{ color: corridor.color, fontFamily: 'JetBrains Mono, monospace' }}>
            {toll.name}
          </span>
          <span className="text-[10px] text-slate-500 ml-2 hidden lg:inline">{toll.km} · {toll.department}</span>
        </div>
        {toll.isCritical && (
          <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            CRÍTICO
          </span>
        )}
      </div>

      <div className="text-center hidden md:block">
        <span className="text-sm font-semibold text-white">{corridor.name}</span>
        <span className="text-xs text-slate-500 ml-2">{corridor.distanceKm} km</span>
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

/* ─── Breadcrumb ─── */
function Breadcrumb({ corridor, toll }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-[#090f1c] text-[9px] text-[#475569]"
      style={{ borderColor: '#1a2d4a' }}>
      <Link to="/monitor" className="hover:text-[#38bdf8] transition-colors cursor-pointer">Monitor Global</Link>
      <span>/</span>
      <Link to={`/monitor/${corridor.id}`} className="hover:text-[#38bdf8] transition-colors cursor-pointer"
        style={{ color: corridor.color + 'cc' }}>
        {corridor.shortName}
      </Link>
      <span>/</span>
      <span className="text-slate-300">{toll.name}</span>
    </div>
  );
}

/* ─── Street View Panel ─── */
function StreetViewPanel({ toll, corridorColor }) {
  const url = toll.streetViewUrl ||
    `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1500!2d${toll.lng}!3d${toll.lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e1!3m2!1ses!2sco`;

  return (
    <div className="rounded-lg border overflow-hidden" style={CARD}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: '#1a2d4a' }}>
        <div className="flex items-center gap-2">
          <MapPin className="w-3 h-3" style={{ color: corridorColor }} />
          <span className="text-xs font-semibold text-white">{toll.name}</span>
          <span className="text-[10px] text-slate-500 font-mono">{toll.km}</span>
        </div>
        <span className="text-[9px] text-slate-600">{toll.department}</span>
      </div>
      <iframe src={url} width="100%" height="220" style={{ border: 0 }}
        allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={toll.name} />
    </div>
  );
}

/* ─── Lane Status Panel ─── */
function LaneStatusPanel({ lanes, corridorColor }) {
  return (
    <div className="rounded-lg border p-3" style={CARD}>
      <div className="text-[9px] text-[#475569] tracking-widest uppercase mb-2">
        🚦 Estado de Carriles — Tiempo Real
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(lanes || []).map(lane => (
          <div key={lane.id} className="rounded-md border p-2"
            style={{
              borderColor: lane.active ? corridorColor + '44' : '#1a2d4a',
              background: lane.active ? corridorColor + '0a' : 'transparent',
            }}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-slate-200">{lane.label}</span>
              <span className="text-[8px] px-1.5 py-0.5 rounded"
                style={{
                  color: lane.active ? '#22c55e' : '#ef4444',
                  background: lane.active ? '#22c55e18' : '#ef444418',
                }}>
                {lane.active ? 'ACTIVO' : 'CERRADO'}
              </span>
            </div>
            <div className="text-[8px] text-[#475569] mb-1">{lane.type}</div>
            {lane.active && (
              <div className="flex gap-3">
                <span className="text-[9px]"
                  style={{ color: lane.speed > 90 ? '#ef4444' : lane.speed > 70 ? '#eab308' : '#22c55e' }}>
                  ⚡ {Math.round(lane.speed)} km/h
                </span>
                <span className="text-[9px]"
                  style={{ color: lane.queue > 3 ? '#ef4444' : '#94a3b8' }}>
                  🚗 Cola: {lane.queue}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Alert Feed ─── */
function TollAlertFeed({ alerts, corridorColor }) {
  const SEVERITY = {
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
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Alertas del Peaje</span>
        <span className="text-[10px] font-mono text-slate-600">{alerts.length} activas</span>
      </div>
      <div className="space-y-1.5 overflow-y-auto max-h-[200px]" style={{ scrollbarWidth: 'thin' }}>
        {alerts.length === 0 && <p className="text-xs text-slate-600 text-center py-4">Sin alertas recientes</p>}
        {alerts.slice(0, 6).map(alert => {
          const sev = SEVERITY[alert.severity] || SEVERITY.info;
          return (
            <div key={alert.id} className="rounded p-2 border text-xs flex items-start gap-2"
              style={{ backgroundColor: sev.bg, borderColor: sev.border }}>
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: sev.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-slate-300 leading-snug text-[11px]">{alert.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[8px] font-mono px-1 py-px rounded" style={{ backgroundColor: `${corridorColor}20`, color: corridorColor }}>
                    {alert.source}
                  </span>
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

/* ─── Sensor Panel (KPIs) ─── */
function SensorPanel({ metrics, corridorColor, speedLimit }) {
  const kpis = [
    { label: 'Vehículos Hoy', value: (metrics.vehiclesTotal || 0).toLocaleString('es-CO'), icon: Car, color: corridorColor },
    { label: 'Flujo / Hora', value: `${metrics.vehiclesHour || 0}`, icon: Activity, color: '#6366f1' },
    { label: 'Velocidad Media', value: `${metrics.avgSpeed || 0} km/h`, icon: Gauge,
      color: (metrics.avgSpeed || 0) > speedLimit ? '#ef4444' : (metrics.avgSpeed || 0) < 40 ? '#f59e0b' : '#22c55e' },
    { label: 'Ocupación Vial', value: `${metrics.occupancy || 0}%`, icon: BarChart2,
      color: (metrics.occupancy || 0) > 80 ? '#ef4444' : (metrics.occupancy || 0) > 60 ? '#f59e0b' : '#22c55e' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {kpis.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="rounded-lg border p-3" style={{ ...CARD, borderColor: `${color}25` }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Icon className="w-3.5 h-3.5" style={{ color }} />
            <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
          </div>
          <span className="text-lg font-bold tabular-nums" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Speed Chart ─── */
function SpeedChart({ history, speedLimit, corridorColor }) {
  return (
    <div className="rounded-lg border p-3" style={CARD}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Velocidad · Últimas 2h</span>
        <span className="text-[10px] font-mono text-slate-600">Tiempo real</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={history} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={corridorColor} stopOpacity={0.15} />
              <stop offset="100%" stopColor={corridorColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" />
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 120]} tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            formatter={(val, name) => name === 'avgSpeed' ? [`${val} km/h`, 'Velocidad'] : [val, name]} />
          <ReferenceLine y={speedLimit || 80} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.5}
            label={{ value: `Límite ${speedLimit || 80}`, position: 'right', fill: '#ef4444', fontSize: 9 }} />
          <Area type="monotone" dataKey="avgSpeed" stroke={corridorColor} strokeWidth={2}
            fill="url(#speedGrad)" dot={false} animationDuration={500} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Status Bar ─── */
function TollStatusBar({ toll, corridor }) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 h-8 flex items-center justify-between px-4 text-[9px] font-mono"
      style={{ backgroundColor: '#040a14', borderTop: '1px solid #1a2d4a', color: '#475569' }}>
      <span>{toll.lat.toFixed(4)}°N  {Math.abs(toll.lng).toFixed(4)}°W · {toll.department}</span>
      <span>{corridor.name} · {toll.km} · DATOS SIMULADOS</span>
      <span>{new Date().toLocaleString('es-CO', { hour12: false })} · VIITS-NEXUS v2.0</span>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ★ MAIN: TollPage — Réplica del piloto Chuzacá para cualquier peaje
   ═══════════════════════════════════════════════════════════════ */
export default function TollPage() {
  const { corridorId, tollId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date());

  const corridor = getCorridorById(corridorId);
  const toll = corridor?.tollStations.find(
    t => t.id.toLowerCase() === tollId?.toLowerCase()
  );

  const { traffic } = useGlobalTraffic(toll?.id || '');
  const data = useTollData(toll?.id || '', corridorId || '', traffic);

  const handleLoadComplete = useCallback(() => setLoading(false), []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!corridor || !toll) {
    return (
      <div className="min-h-screen bg-viits-bg flex items-center justify-center">
        <div className="text-center text-slate-400">
          <p>Peaje no encontrado</p>
          <button onClick={() => navigate('/monitor')} className="text-cyan-400 mt-4 text-sm">Volver al monitor</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <LoadingScreen
        title={toll.name}
        subtitle={`${corridor.name} · ${toll.km}`}
        color={corridor.color}
        onComplete={handleLoadComplete}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#06111e] text-slate-200"
         style={{ fontFamily: '"JetBrains Mono", monospace', paddingBottom: 36 }}>

      <TollHeader toll={toll} corridor={corridor} clock={clock} />
      <Breadcrumb corridor={corridor} toll={toll} />

      {/* ── Cuerpo principal — layout idéntico al piloto Chuzacá ── */}
      <main className="max-w-[1600px] mx-auto px-3 py-3 flex-1">
        <div className="grid grid-cols-12 gap-3">

          {/* COLUMNA IZQUIERDA — 5/12 */}
          <div className="col-span-12 xl:col-span-5 space-y-3 order-2 xl:order-1">
            <StreetViewPanel toll={toll} corridorColor={corridor.color} />
            <LaneStatusPanel lanes={data.lanes} corridorColor={corridor.color} />
            <TollAlertFeed alerts={data.alerts} corridorColor={corridor.color} />
          </div>

          {/* COLUMNA DERECHA — 7/12 */}
          <div className="col-span-12 xl:col-span-7 space-y-3 order-1 xl:order-2">
            {/* ★ GEMELO DIGITAL — VISTA CENITAL */}
            <TollCanvas
              mode="full"
              stationName={toll.name}
              corridorColor={corridor.color}
              lanes={data.lanes}
              metrics={data.metrics}
              showHeader={true}
              showMetrics={false}
              direction={getOperationMode().mode}
              realTraffic={traffic}
            />

            <SensorPanel metrics={data.metrics} corridorColor={corridor.color} speedLimit={toll.speedLimit} />
            <SpeedChart history={data.speedHistory} speedLimit={toll.speedLimit} corridorColor={corridor.color} />
            <CongestionForecast currentIrt={data.metrics.irt || 0} accentColor={corridor.color} />
          </div>
        </div>
      </main>

      <TollStatusBar toll={toll} corridor={corridor} />
    </div>
  );
}
