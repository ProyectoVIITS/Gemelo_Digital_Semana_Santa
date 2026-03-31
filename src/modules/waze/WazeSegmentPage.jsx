/**
 * WazeSegmentPage — Simulación visual de tramos congestionados Waze
 * Replica la estructura de TollPage pero con datos Waze TVT en tiempo real
 */
import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Shield, Wifi, AlertTriangle, Activity, Radio } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TollCanvas from '../toll/components/TollCanvas';
import useWazeSegmentData from './useWazeSegmentData';
import { getIRTLevel } from '../../data/nexusCorridors';

const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };

export default function WazeSegmentPage() {
  const { wazeId } = useParams();
  const [jam, setJam] = useState(null);
  const [allJams, setAllJams] = useState([]);
  const [clock, setClock] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch Waze TVT y encontrar el jam por ID
  useEffect(() => {
    async function fetchJam() {
      try {
        const IS_PROD = window.location.hostname !== 'localhost';
        const url = IS_PROD ? '/api/waze-tvt' : 'https://www.waze.com/row-partnerhub-api/feeds-tvt/?id=1761151881648';
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        const jams = (json.irregularities || []).filter(j => j.jamLevel >= 2);
        setAllJams(jams);

        const found = jams.find(j => String(j.id) === String(wazeId));
        setJam(found || jams[0] || null);
        setLoading(false);
      } catch (e) {
        setLoading(false);
      }
    }
    fetchJam();
    const id = setInterval(fetchJam, 180000); // refresh cada 3 min
    return () => clearInterval(id);
  }, [wazeId]);

  const data = useWazeSegmentData(jam);

  if (loading) {
    return (
      <div className="min-h-screen bg-viits-bg flex items-center justify-center">
        <div className="text-center">
          <Radio className="w-8 h-8 text-purple-400 animate-pulse mx-auto mb-3" />
          <div className="text-sm text-slate-400 font-mono">Conectando con Waze...</div>
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
            style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}>
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-wide text-purple-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {jam.name || `Tramo Waze #${wazeId}`}
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
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">WAZE LIVE</span>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="text-[9px] text-slate-600 px-4 py-1" style={{ backgroundColor: 'rgba(6, 17, 30, 0.5)' }}>
        <Link to="/monitor" className="hover:text-slate-400">Monitor Global</Link>
        <span className="mx-1">/</span>
        <span className="text-purple-400">Waze — {jam.name}</span>
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

            {/* Google Maps */}
            <div className="rounded-lg border overflow-hidden" style={CARD}>
              <iframe
                title="Waze Segment Map"
                width="100%"
                height="280"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://www.google.com/maps/embed/v1/view?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&center=${mapLat},${mapLng}&zoom=13&maptype=roadmap`}
              />
            </div>

            {/* Speed History Chart */}
            <div className="rounded-lg border p-3" style={CARD}>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Velocidad — Tiempo Real Waze</div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.speedHistory}>
                    <defs>
                      <linearGradient id="wazeSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" />
                    <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 8, fontFamily: 'JetBrains Mono' }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 8, fontFamily: 'JetBrains Mono' }} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d1a2e', border: '1px solid #1a2d4a', borderRadius: 6, fontSize: 10 }} />
                    <Area type="monotone" dataKey="avgSpeed" stroke="#a855f7" fill="url(#wazeSpeedGrad)" strokeWidth={2} name="Velocidad" />
                    <Area type="monotone" dataKey="limit" stroke="#334155" strokeDasharray="4 4" fill="none" strokeWidth={1} name="Límite" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right: TollCanvas + Lanes + Alerts */}
          <div className="col-span-12 xl:col-span-7 space-y-3">
            {/* TollCanvas — Simulación visual del tramo */}
            <div className="rounded-lg border overflow-hidden" style={CARD}>
              <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: '#1a2d4a' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">Simulación del Tramo</span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-purple-500/15 text-purple-400">DATOS WAZE</span>
                </div>
                <span className="text-[10px] font-mono text-slate-600">{data.lanes.length} carriles simulados</span>
              </div>
              <TollCanvas
                mode="full"
                stationName={jam.name || 'Tramo Waze'}
                corridorColor="#a855f7"
                lanes={data.lanes}
                metrics={data.metrics}
                showHeader={false}
                showMetrics={false}
                direction="salida"
              />
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
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Alertas Waze</div>
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
          <span className="text-purple-400">WAZE</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">DITRA · INVÍAS · MinTransporte</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500">DATOS WAZE EN TIEMPO REAL</span>
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
