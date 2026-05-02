/**
 * WazeSegmentPage — Gemelo Digital de tramos congestionados
 * Replica la estructura de TollPage pero con datos Waze TVT en tiempo real
 */
import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Shield, Wifi, AlertTriangle, Activity, Radio, TrendingDown, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Polyline, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import useWazeSegmentData from './useWazeSegmentData';
import { getIRTLevel } from '../../data/nexusCorridors';
import { getColombiaHour } from '../../utils/operationMode';
import CongestionForecast from '../../components/shared/CongestionForecast';
import { useTrafficStore } from '../../store/trafficStore';
import RoadCanvas from './components/RoadCanvas';
import { computeJamHash } from '../../utils/jamHash';

const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };

export default function WazeSegmentPage() {
  const { wazeId } = useParams();
  const allJams = useTrafficStore(state => state.nationalWazeJams) || [];
  const [jam, setJam] = useState(null);
  const [clock, setClock] = useState(new Date());

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Encontrar el jam por ID de Waze (id o uuid)
  useEffect(() => {
    const found = allJams.find(j => String(j.uuid) === String(wazeId) || String(j.id) === String(wazeId));
    setJam(found || null);
  }, [allJams, wazeId]);

  const data = useWazeSegmentData(jam);

  if (!jam && allJams.length === 0) {
    return (
      <div className="min-h-screen bg-viits-bg flex items-center justify-center">
        <div className="text-center">
          <Radio className="w-8 h-8 text-purple-400 animate-pulse mx-auto mb-3" />
          <div className="text-sm text-slate-400 font-mono">Sincronizando con Gemelo Digital Global...</div>
        </div>
      </div>
    );
  }

  if (!jam) {
    return (
      <div className="min-h-screen bg-viits-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-slate-300 mb-2">Tramo no encontrado</div>
          <Link to="/monitor" className="text-sm text-cyan-400 hover:underline">← Volver al Monitor</Link>
        </div>
      </div>
    );
  }

  const colaKm = ((jam.length || 0) / 1000).toFixed(1);
  const tiempoMin = Math.round((jam.time || 0) / 60);
  const normalMin = Math.round((jam.historicTime || 0) / 60);
  const ratio = jam.historicTime > 0 ? (jam.time / jam.historicTime).toFixed(1) : '?';
  const level = getIRTLevel(data.metrics.irt || 0);
  const jamCenter = jam.line?.[Math.floor((jam.line?.length || 0) / 2)];
  const mapLat = jamCenter?.y || 4.5;
  const mapLng = jamCenter?.x || -74.5;
  const hasAccident = jam.leadAlert?.type === 'ACCIDENT';
  const isClosed = jam.leadAlert?.type === 'ROAD_CLOSED';

  return (
    <div className="min-h-screen bg-viits-bg text-viits-text font-sans" style={{ paddingBottom: 36 }}>
      {/* Header */}
      <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b"
        style={{ backgroundColor: 'rgba(10, 15, 30, 0.85)', backdropFilter: 'blur(12px)', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
        <div className="flex items-center gap-3">
          <Link to="/monitor" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs">
            <ArrowLeft className="w-4 h-4" />
            <span>Monitor</span>
          </Link>
          <div className="w-px h-6 bg-slate-700" />
          <div className="w-8 h-8 rounded flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-wide text-teal-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {jam.name || `Tramo Gemelo Digital #${wazeId}`}
            </span>
          </div>
          <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded" style={{
            backgroundColor: jam.jamLevel >= 4 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
            color: jam.jamLevel >= 4 ? '#ef4444' : '#f59e0b',
          }}>
            NIVEL {jam.jamLevel}
          </span>
          {hasAccident && <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">ACCIDENTE</span>}
          {isClosed && <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-900/30 text-red-500">VÍA CERRADA</span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm tabular-nums text-slate-300" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {clock.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' })}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-[10px] font-mono text-teal-400 uppercase tracking-wider">GEMELO DIGITAL LIVE</span>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="text-[9px] text-slate-600 px-4 py-1" style={{ backgroundColor: 'rgba(6, 17, 30, 0.5)' }}>
        <Link to="/monitor" className="hover:text-slate-400">Monitor Global</Link>
        <span className="mx-1">/</span>
        <span className="text-teal-400">Gemelo Digital — {jam.name}</span>
      </div>

      <main className="max-w-[1600px] mx-auto px-3 py-3">
        <div className="grid grid-cols-12 gap-3">
          {/* Left: Map + Info */}
          <div className="col-span-12 xl:col-span-5 space-y-3">
            {/* IRT + KPIs */}
            <div className="rounded-lg border p-4" style={CARD}>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="font-mono text-4xl font-bold" style={{ color: level.color }}>{data.metrics.irt || 0}</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">IRT</div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-sky-400">{data.metrics.avgSpeed} km/h</div>
                    <div className="text-[9px] text-slate-500">VELOCIDAD</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-orange-400">{colaKm} km</div>
                    <div className="text-[9px] text-slate-500">COLA</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-red-400">{ratio}x</div>
                    <div className="text-[9px] text-slate-500">DELAY</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[9px]">
                <span className="text-slate-500">Tiempo actual:</span>
                <span className="font-mono text-red-400">{tiempoMin} min</span>
                <span className="text-slate-500">· Normal:</span>
                <span className="font-mono text-green-400">{normalMin} min</span>
              </div>
            </div>

            {/* Mapa Interactivo Oscuro (Leaflet) */}
            <div className="rounded-lg border overflow-hidden relative" style={{ ...CARD, height: 320 }}>
              <div className="absolute top-2 right-2 z-50 px-2 py-1 bg-black/60 rounded border border-teal-500/30 text-[9px] text-teal-300 font-mono flex items-center md:hidden">
                <Radio className="w-3 h-3 mr-1" /> Satélite Radar Gemelo
              </div>
              <MapContainer 
                center={[mapLat, mapLng]} 
                zoom={14} 
                className="w-full h-full"
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                />
                <ZoomControl position="bottomright" />
                {jam.line && jam.line.length > 0 && (
                  <Polyline 
                    positions={jam.line.map(pt => [pt.y, pt.x])}
                    pathOptions={{ 
                      color: level.color, 
                      weight: jam.jamLevel >= 4 ? 6 : 4,
                      opacity: 0.8,
                      lineCap: 'round',
                      lineJoin: 'round',
                      dashArray: jam.jamLevel >= 4 ? '1, 8' : 'none',
                    }}
                  />
                )}
                {jam.line && jam.line.length > 0 && (
                  <Polyline 
                    positions={jam.line.map(pt => [pt.y, pt.x])}
                    pathOptions={{ 
                      color: '#ffffff', 
                      weight: 1,
                      opacity: 0.5
                    }}
                  />
                )}
              </MapContainer>
            </div>

            {/* Speed History Chart */}
            <div className="rounded-lg border p-3" style={CARD}>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Velocidad — Tiempo Real Gemelo Digital</div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.speedHistory}>
                    <defs>
                      <linearGradient id="wazeSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" />
                    <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 8, fontFamily: 'JetBrains Mono' }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 8, fontFamily: 'JetBrains Mono' }} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d1a2e', border: '1px solid #1a2d4a', borderRadius: 6, fontSize: 10 }} />
                    <Area type="monotone" dataKey="avgSpeed" stroke="#14b8a6" fill="url(#wazeSpeedGrad)" strokeWidth={2} name="Velocidad" />
                    <Area type="monotone" dataKey="limit" stroke="#334155" strokeDasharray="4 4" fill="none" strokeWidth={1} name="Límite" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ═══ PROYECCIÓN DE CONGESTIÓN — Siguiente 8 horas ═══ */}
            <CongestionForecast
              currentIrt={data.metrics.irt || 0}
              accentColor="#a855f7"
              delayRatio={jam?.historicTime > 0 ? (jam.time / jam.historicTime).toFixed(1) : null}
            />
          </div>

          {/* Right: TollCanvas + Lanes + Alerts */}
          <div className="col-span-12 xl:col-span-7 space-y-3">
            {/* RoadCanvas — Digital Twin de congestión continua */}
            <div className="rounded-lg border overflow-hidden" style={{ ...CARD, position: 'relative' }}>
              <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: '#1a2d4a', backgroundColor: '#06111e' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">Módulo Flujo Denso</span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-teal-500/15 text-teal-400">TVT GEMELO REALTIME</span>
                </div>
                <span className="text-[10px] font-mono text-slate-600">Sincronización Continua</span>
              </div>
              <div style={{ height: 260, width: '100%', position: 'relative' }}>
                 <RoadCanvas
                   jamLevel={jam.jamLevel || 3}
                   jamSpeed={data.metrics.avgSpeed || 5}
                   jamRatio={ratio === '?' ? 1 : parseFloat(ratio)}
                   polyline={jam.line || []}
                   jamHashId={jam.line?.length ? computeJamHash(jam) : null}
                 />
              </div>
            </div>

            {/* Lane Status */}
            <div className="rounded-lg border p-3" style={CARD}>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Estado de Carriles — Tiempo Real</div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {data.lanes.map(lane => {
                  const lLevel = getIRTLevel(lane.speed < 15 ? 80 : lane.speed < 30 ? 60 : 30);
                  return (
                    <div key={lane.id} className="rounded-lg border p-2" style={CARD}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-slate-300">{lane.label}</span>
                        <span className="text-[7px] font-mono px-1 py-0.5 rounded" style={{
                          backgroundColor: `${lLevel.color}15`, color: lLevel.color,
                        }}>{lane.type}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px]">
                        <span style={{ color: lLevel.color }}>⚡ {lane.speed} km/h</span>
                        <span className={lane.queue > 5 ? 'text-red-400' : 'text-slate-500'}>🚗 Cola: {lane.queue}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="rounded-lg border p-3 text-center" style={CARD}>
                <div className="font-mono text-xl font-bold text-purple-400">{data.metrics.vehiclesHour}</div>
                <div className="text-[9px] text-slate-500 uppercase">Flujo / Hora</div>
              </div>
              <div className="rounded-lg border p-3 text-center" style={CARD}>
                <div className="font-mono text-xl font-bold text-sky-400">{data.metrics.avgSpeed} km/h</div>
                <div className="text-[9px] text-slate-500 uppercase">Velocidad Media</div>
              </div>
              <div className="rounded-lg border p-3 text-center" style={CARD}>
                <div className="font-mono text-xl font-bold text-orange-400">{data.metrics.occupancy}%</div>
                <div className="text-[9px] text-slate-500 uppercase">Ocupación Vial</div>
              </div>
              <div className="rounded-lg border p-3 text-center" style={CARD}>
                <div className="font-mono text-xl font-bold text-red-400">{tiempoMin} min</div>
                <div className="text-[9px] text-slate-500 uppercase">Tiempo Travesía</div>
              </div>
            </div>

            {/* Alerts */}
            {data.alerts.length > 0 && (
              <div className="rounded-lg border p-3" style={CARD}>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Alertas Gemelo Digital</div>
                <div className="space-y-1">
                  {data.alerts.map(a => (
                    <div key={a.id} className="flex items-center gap-2 rounded px-2 py-1.5 border text-[10px]" style={{
                      backgroundColor: a.severity === 'emergency' ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.08)',
                      borderColor: a.severity === 'emergency' ? 'rgba(220,38,38,0.3)' : 'rgba(245,158,11,0.3)',
                    }}>
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{
                        color: a.severity === 'emergency' ? '#dc2626' : '#f59e0b',
                      }} />
                      <span className="text-slate-300">{a.message}</span>
                      <span className="ml-auto text-[8px] text-purple-400 font-mono">{a.source}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-8 flex items-center justify-between px-4 border-t text-[9px] font-mono z-30"
        style={{ backgroundColor: 'rgba(10, 15, 30, 0.95)', borderColor: '#1a2d4a' }}>
        <div className="flex items-center gap-3">
          <span className="text-teal-400">GEMELO DIGITAL</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">MINISTERIO DE TRANSPORTE · DITRA · INVÍAS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500">DATOS GEMELO DIGITAL EN TIEMPO REAL</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">
            {clock.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })},{' '}
            {clock.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' })}
          </span>
        </div>
      </footer>
    </div>
  );
}
