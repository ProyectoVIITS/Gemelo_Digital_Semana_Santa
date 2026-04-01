/**
 * FiscalizacionTollPage — Detalle de peaje individual con TollCanvas + conteo
 * Autopistas del Café · CONFIDENCIAL
 */
import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Eye, DollarSign, Car, Gauge } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TollCanvas from '../toll/components/TollCanvas';
import { AUTOPISTAS_CAFE, getPeajeADC, calcularTarifa } from '../../data/autopistasDelCafe';
import { useFiscalizacionPeaje } from './useFiscalizacionData';
import { useGlobalTraffic } from '../../hooks/useTrafficAPI';
import { getIRTLevel } from '../../data/nexusCorridors';
import CongestionForecast from '../../components/shared/CongestionForecast';
import { getOperationMode } from '../../utils/operationMode';

const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };

function formatCOP(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString('es-CO')}`;
}

export default function FiscalizacionTollPage() {
  const { tollId } = useParams();
  const [clock, setClock] = useState(new Date());

  const peaje = getPeajeADC(tollId?.toUpperCase());
  const { traffic } = useGlobalTraffic(peaje?.id || '');
  const fiscData = useFiscalizacionPeaje(peaje?.id || '', traffic);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!peaje) {
    return (
      <div className="min-h-screen bg-viits-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-slate-300 mb-2">Peaje no encontrado</div>
          <Link to="/fiscalizacion" className="text-sm text-purple-400 hover:underline">← Volver a Fiscalización</Link>
        </div>
      </div>
    );
  }

  // Build lanes for TollCanvas
  const totalBooths = peaje.booths?.total || 4;
  const lanes = Array.from({ length: totalBooths }, (_, i) => {
    const isRetorno = i < (peaje.booths?.retorno || 1);
    const variation = ((i * 7 + 3) % 5) - 2;
    const baseSpeed = 25 + variation + (traffic?.currentSpeed ? traffic.currentSpeed * 0.4 : 0);
    return {
      id: i + 1,
      label: `C${i + 1}`,
      type: i < Math.ceil(totalBooths * 0.25) ? 'FacilPass' : 'Efectivo',
      status: 'active',
      active: true,
      speed: Math.max(10, Math.round(baseSpeed)),
      queue: Math.round(Math.max(0, (fiscData.flow / peaje.capacidadNominal - 0.5) * 8 + variation)),
      direction: isRetorno ? 'retorno' : 'salida',
    };
  });

  const metrics = {
    vehiclesTotal: fiscData.acumuladoHoy || 0,
    vehiclesHour: fiscData.flow || 0,
    avgSpeed: traffic?.currentSpeed ? Math.round(traffic.currentSpeed * 0.4) : 25,
    occupancy: traffic?.congestionRatio ? Math.round(traffic.congestionRatio * 100) : Math.round((fiscData.flow / peaje.capacidadNominal) * 80),
    irt: traffic?.congestionRatio ? Math.round(traffic.congestionRatio * 100) : 40,
    queueLength: lanes.reduce((s, l) => s + l.queue, 0),
    timestamp: new Date(),
  };

  // Speed history from perfil horario
  const now = new Date();
  const speedHistory = AUTOPISTAS_CAFE.perfilHorario.map((factor, h) => ({
    time: `${String(h).padStart(2, '0')}:00`,
    avgSpeed: Math.round(peaje.speedLimit * (1 - factor * 0.4)),
    limit: peaje.speedLimit,
  }));

  const level = getIRTLevel(metrics.irt);

  return (
    <div className="min-h-screen bg-viits-bg text-viits-text font-sans" style={{ paddingBottom: 36 }}>
      {/* Header */}
      <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b"
        style={{ backgroundColor: 'rgba(10, 15, 30, 0.95)', backdropFilter: 'blur(12px)', borderColor: 'rgba(139, 92, 246, 0.3)' }}>
        <div className="flex items-center gap-3">
          <Link to="/fiscalizacion" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs">
            <ArrowLeft className="w-4 h-4" />
            <span>Fiscalización</span>
          </Link>
          <div className="w-px h-6 bg-slate-700" />
          <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
            <Lock className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-wide text-purple-400" style={{ fontFamily: 'JetBrains Mono' }}>{peaje.name}</span>
            <span className="text-[10px] text-slate-500 ml-2">{peaje.km} · {peaje.dept}</span>
          </div>
          <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">CONFIDENCIAL</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm tabular-nums text-slate-300" style={{ fontFamily: 'JetBrains Mono' }}>
            {clock.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' })}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] font-mono text-purple-400">LIVE</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3">
        <div className="grid grid-cols-12 gap-3">
          {/* Left column */}
          <div className="col-span-12 xl:col-span-5 space-y-3">
            {/* IRT + KPIs */}
            <div className="rounded-lg border p-4" style={CARD}>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="font-mono text-4xl font-bold" style={{ color: level.color }}>{metrics.irt}</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">IRT</div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-sky-400">{metrics.avgSpeed} km/h</div>
                    <div className="text-[9px] text-slate-500">VELOCIDAD</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-purple-400">{fiscData.flow} veh/h</div>
                    <div className="text-[9px] text-slate-500">FLUJO</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-orange-400">{metrics.occupancy}%</div>
                    <div className="text-[9px] text-slate-500">OCUPACIÓN</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Maps */}
            <div className="rounded-lg border overflow-hidden" style={CARD}>
              <iframe title={`Mapa ${peaje.name}`} width="100%" height="250" style={{ border: 0 }} loading="lazy"
                src={`https://www.google.com/maps/embed/v1/view?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&center=${peaje.lat},${peaje.lng}&zoom=14&maptype=roadmap`} />
            </div>

            {/* Conteo por categoría + Ingresos */}
            <div className="rounded-lg border p-3" style={CARD}>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Conteo por Categoría — Tiempo Real</div>
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="text-slate-500 border-b" style={{ borderColor: '#1a2d4a' }}>
                    <th className="text-left py-1 px-1">Cat</th>
                    <th className="text-left py-1 px-1">Tipo</th>
                    <th className="text-right py-1 px-1">Veh/h</th>
                    <th className="text-right py-1 px-1">Tarifa</th>
                    <th className="text-right py-1 px-1">Ingreso/h</th>
                  </tr>
                </thead>
                <tbody>
                  {AUTOPISTAS_CAFE.categorias.map(cat => {
                    const count = fiscData.porCategoria?.[cat.id] || 0;
                    const tarifa = calcularTarifa(peaje, cat.id);
                    return (
                      <tr key={cat.id} className="border-b" style={{ borderColor: '#1a2d4a20' }}>
                        <td className="py-1 px-1 font-bold" style={{ color: cat.color }}>{cat.code}</td>
                        <td className="py-1 px-1 text-slate-400">{cat.name}</td>
                        <td className="py-1 px-1 text-right text-slate-300">{count}</td>
                        <td className="py-1 px-1 text-right text-slate-500">${tarifa.toLocaleString('es-CO')}</td>
                        <td className="py-1 px-1 text-right text-green-400">{formatCOP(count * tarifa)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t font-bold" style={{ borderColor: '#8b5cf640' }}>
                    <td colSpan={2} className="py-1.5 px-1 text-purple-300">TOTAL</td>
                    <td className="py-1.5 px-1 text-right text-sky-400">{fiscData.flow}</td>
                    <td className="py-1.5 px-1"></td>
                    <td className="py-1.5 px-1 text-right text-green-400">{formatCOP(fiscData.ingresoHora)}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="py-1 px-1 text-[9px] text-slate-500">ACUMULADO HOY</td>
                    <td className="py-1 px-1 text-right text-slate-300 font-bold">{fiscData.acumuladoHoy?.toLocaleString('es-CO')}</td>
                    <td className="py-1 px-1"></td>
                    <td className="py-1 px-1 text-right text-green-400 font-bold">{formatCOP(fiscData.ingresoHoy || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Proyección de congestión */}
            <CongestionForecast currentIrt={metrics.irt} accentColor="#8b5cf6" />
          </div>

          {/* Right column */}
          <div className="col-span-12 xl:col-span-7 space-y-3">
            {/* TollCanvas */}
            <TollCanvas
              mode="full"
              stationName={peaje.name}
              corridorColor="#8b5cf6"
              lanes={lanes}
              metrics={metrics}
              showHeader={true}
              showMetrics={false}
              direction={getOperationMode().mode}
              realTraffic={traffic}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="rounded-lg border p-3 text-center" style={CARD}>
                <div className="font-mono text-xl font-bold text-purple-400">{fiscData.acumuladoHoy?.toLocaleString('es-CO')}</div>
                <div className="text-[9px] text-slate-500 uppercase">Vehículos Hoy</div>
              </div>
              <div className="rounded-lg border p-3 text-center" style={CARD}>
                <div className="font-mono text-xl font-bold text-green-400">{formatCOP(fiscData.ingresoHoy || 0)}</div>
                <div className="text-[9px] text-slate-500 uppercase">Ingresos Hoy</div>
              </div>
              <div className="rounded-lg border p-3 text-center" style={CARD}>
                <div className="font-mono text-xl font-bold text-sky-400">${peaje.tarifaCatI?.toLocaleString('es-CO')}</div>
                <div className="text-[9px] text-slate-500 uppercase">Tarifa Cat I</div>
              </div>
              <div className="rounded-lg border p-3 text-center" style={CARD}>
                <div className="font-mono text-xl font-bold text-orange-400">{totalBooths}</div>
                <div className="text-[9px] text-slate-500 uppercase">Casetas</div>
              </div>
            </div>

            {/* Speed Chart */}
            <div className="rounded-lg border p-3" style={CARD}>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Velocidad — Perfil 24h</div>
              <div style={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={speedHistory}>
                    <defs>
                      <linearGradient id="fiscSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" />
                    <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 8, fontFamily: 'JetBrains Mono' }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 8 }} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d1a2e', border: '1px solid #1a2d4a', borderRadius: 6, fontSize: 10 }} />
                    <Area type="monotone" dataKey="avgSpeed" stroke="#8b5cf6" fill="url(#fiscSpeedGrad)" strokeWidth={2} name="Velocidad" />
                    <Area type="monotone" dataKey="limit" stroke="#334155" strokeDasharray="4 4" fill="none" strokeWidth={1} name="Límite" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Info peaje */}
            <div className="rounded-lg border p-3" style={CARD}>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Información del Peaje</div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div><span className="text-slate-500">Ruta:</span> <span className="text-slate-300">{peaje.ruta}</span></div>
                <div><span className="text-slate-500">Municipio:</span> <span className="text-slate-300">{peaje.municipio}</span></div>
                <div><span className="text-slate-500">Departamento:</span> <span className="text-slate-300">{peaje.dept}</span></div>
                <div><span className="text-slate-500">Casetas:</span> <span className="text-slate-300">{peaje.booths?.total} ({peaje.booths?.salida}S / {peaje.booths?.retorno}R)</span></div>
                <div><span className="text-slate-500">Capacidad:</span> <span className="text-slate-300">{peaje.capacidadNominal} veh/h</span></div>
                <div><span className="text-slate-500">Vel. Límite:</span> <span className="text-slate-300">{peaje.speedLimit} km/h</span></div>
                <div colSpan={2}><span className="text-slate-500">Obs:</span> <span className="text-slate-400">{peaje.observaciones}</span></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-8 flex items-center justify-between px-4 border-t text-[9px] font-mono z-30"
        style={{ backgroundColor: 'rgba(10, 15, 30, 0.95)', borderColor: '#1a2d4a' }}>
        <div className="flex items-center gap-2">
          <Lock className="w-3 h-3 text-red-400" />
          <span className="text-red-400">CONFIDENCIAL</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">{AUTOPISTAS_CAFE.name} · {peaje.name} · {peaje.km}</span>
        </div>
        <span className="text-slate-400">
          {clock.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })},{' '}
          {clock.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' })}
        </span>
      </footer>
    </div>
  );
}
