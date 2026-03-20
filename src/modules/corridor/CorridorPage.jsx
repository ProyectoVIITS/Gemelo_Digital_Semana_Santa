/**
 * CorridorPage — Vista de corredor con tarjetas de peaje (mini-canvas)
 * El corredor es un agrupador de módulos de peaje.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Wifi, Gauge, Activity, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getCorridorById, getIRTLevel } from '../../data/nexusCorridors';
import { useCorridorData } from '../../hooks/useCorridorData';
import { useGlobalAlerts } from '../../hooks/useGlobalAlerts';
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
        <div>
          <span className="text-sm font-bold tracking-wide" style={{ color: corridor.color, fontFamily: 'JetBrains Mono, monospace' }}>
            {corridor.shortName}
          </span>
          <span className="text-[10px] text-slate-500 ml-2 hidden lg:inline">{corridor.route}</span>
        </div>
      </div>

      <div className="text-center hidden md:flex items-center gap-4">
        <span className="text-sm font-semibold text-white">{corridor.name}</span>
        <span className="text-xs text-slate-500">{corridor.distanceKm} km · {corridor.tollStations.length} peajes</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm tabular-nums text-slate-300" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {clock.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
