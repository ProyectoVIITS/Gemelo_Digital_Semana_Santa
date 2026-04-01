/**
 * FiscalizacionPage — Dashboard privado de Fiscalización de Peajes
 * Autopistas del Café · Contrato 113/1997 INVÍAS
 * CONFIDENCIAL — Solo MinTransporte / DITRA
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip } from 'react-leaflet';
import { ArrowLeft, Shield, Lock, Eye, DollarSign, Car, TrendingUp, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AUTOPISTAS_CAFE } from '../../data/autopistasDelCafe';
import { useFiscalizacionGlobal } from './useFiscalizacionData';
import { getColombiaHour } from '../../utils/operationMode';

const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };
const ADC = AUTOPISTAS_CAFE;

function formatCOP(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString('es-CO')}`;
}

export default function FiscalizacionPage() {
  const [clock, setClock] = useState(new Date());
  const fiscData = useFiscalizacionGlobal(); // Self-contained, no external deps

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hour = getColombiaHour();

  // Datos para gráfica de flujo por hora
  const hourlyData = ADC.perfilHorario.map((factor, h) => {
    const avgCapacity = ADC.peajes.reduce((s, p) => s + p.capacidadNominal, 0) / ADC.peajes.length;
    const est = Math.round(avgCapacity * factor * 0.7);
    return {
      hora: `${String(h).padStart(2, '0')}`,
      flujo: est,
      isCurrent: h === hour,
      isPast: h < hour,
      color: h === hour ? '#8b5cf6' : h < hour ? '#6366f1' : '#1e293b',
    };
  });

  return (
    <div className="min-h-screen bg-viits-bg text-viits-text font-sans" style={{ paddingBottom: 36 }}>
      {/* Header CONFIDENCIAL */}
      <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b"
        style={{ backgroundColor: 'rgba(10, 15, 30, 0.95)', backdropFilter: 'blur(12px)', borderColor: 'rgba(139, 92, 246, 0.3)' }}>
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
            <Lock className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-wide text-purple-400" style={{ fontFamily: 'JetBrains Mono' }}>
              FISCALIZACIÓN DE PEAJES
            </span>
            <span className="text-[9px] text-slate-500 ml-2">Autopistas del Café · {ADC.contrato}</span>
          </div>
          <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 animate-pulse">
            CONFIDENCIAL
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[9px] text-purple-300 font-mono">MINTRANSPORTE</span>
          </div>
          <span className="text-sm tabular-nums text-slate-300" style={{ fontFamily: 'JetBrains Mono' }}>
            {clock.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' })}
          </span>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3">
        {/* Info concesión */}
        <div className="rounded-lg border p-3 mb-3" style={{ ...CARD, borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-purple-300">{ADC.name}</div>
              <div className="text-[9px] text-slate-500">{ADC.concesionario} · {ADC.accionistas}</div>
              <div className="text-[9px] text-slate-500">{ADC.contrato} · {ADC.kmTotales} km · Vence: {ADC.vencimiento}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-slate-500">Calificación ANI</div>
              <div className="font-mono text-lg font-bold text-purple-400">{ADC.calificacion}/5.0</div>
            </div>
          </div>
        </div>

        {/* KPIs Globales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          <div className="rounded-lg border p-3 text-center" style={CARD}>
            <Car className="w-4 h-4 text-purple-400 mx-auto mb-1" />
            <div className="font-mono text-xl font-bold text-purple-400">{fiscData.totalVehiculos.toLocaleString('es-CO')}</div>
            <div className="text-[9px] text-slate-500 uppercase">Vehículos Hoy (7 peajes)</div>
          </div>
          <div className="rounded-lg border p-3 text-center" style={CARD}>
            <DollarSign className="w-4 h-4 text-green-400 mx-auto mb-1" />
            <div className="font-mono text-xl font-bold text-green-400">{formatCOP(fiscData.totalIngresos)}</div>
            <div className="text-[9px] text-slate-500 uppercase">Ingresos Estimados Hoy</div>
          </div>
          <div className="rounded-lg border p-3 text-center" style={CARD}>
            <TrendingUp className="w-4 h-4 text-sky-400 mx-auto mb-1" />
            <div className="font-mono text-xl font-bold text-sky-400">
              {fiscData.peajes.length > 0 ? Math.round(fiscData.peajes.reduce((s, p) => s + p.flow, 0)).toLocaleString('es-CO') : '0'}
            </div>
            <div className="text-[9px] text-slate-500 uppercase">Flujo Actual (veh/h)</div>
          </div>
          <div className="rounded-lg border p-3 text-center" style={CARD}>
            <BarChart2 className="w-4 h-4 text-orange-400 mx-auto mb-1" />
            <div className="font-mono text-xl font-bold text-orange-400">{ADC.peajes.length}</div>
            <div className="text-[9px] text-slate-500 uppercase">Peajes Fiscalizados</div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3">
          {/* Left: Map + Chart */}
          <div className="col-span-12 xl:col-span-5 space-y-3">
            {/* Mapa Leaflet */}
            <div className="rounded-lg border overflow-hidden" style={CARD}>
              <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: '#1a2d4a' }}>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Mapa — Autopistas del Café</span>
                <span className="text-[10px] font-mono text-slate-600">{ADC.kmTotales} km · {ADC.peajes.length} peajes</span>
              </div>
              <div style={{ height: 350 }}>
                <MapContainer center={[4.85, -75.65]} zoom={9} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" />
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" opacity={0.45} />
                  {fiscData.peajes.map(p => {
                    const flowRatio = p.flow / (p.capacidadNominal || 1400);
                    const color = flowRatio > 0.8 ? '#ef4444' : flowRatio > 0.5 ? '#f59e0b' : '#22c55e';
                    return (
                      <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={8}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2 }}
                        eventHandlers={{ click: () => { window.location.href = `/fiscalizacion/${p.id.toLowerCase()}`; } }}>
                        <LTooltip className="viits-toll-label" direction="top" offset={[0, -10]}>
                          <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                          <div style={{ fontSize: 9, color: '#94a3b8' }}>{p.dept} · {p.km}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                            <span style={{ color: '#8b5cf6' }}>🚗 {p.flow} veh/h</span>
                            <span style={{ color: '#22c55e' }}>{formatCOP(p.ingresoHora)}/h</span>
                          </div>
                        </LTooltip>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
              </div>
            </div>

            {/* Perfil horario */}
            <div className="rounded-lg border p-3" style={CARD}>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Perfil de Flujo — 24 Horas (Promedio 7 peajes)</div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} barSize={12}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" />
                    <XAxis dataKey="hora" tick={{ fill: '#475569', fontSize: 8, fontFamily: 'JetBrains Mono' }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 8 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d1a2e', border: '1px solid #1a2d4a', borderRadius: 6, fontSize: 10 }} />
                    <Bar dataKey="flujo" name="Veh/hora" radius={[2, 2, 0, 0]}>
                      {hourlyData.map((e, i) => (
                        <Cell key={i} fill={e.color} stroke={e.isCurrent ? '#fff' : 'none'} strokeWidth={e.isCurrent ? 2 : 0} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right: Table + History */}
          <div className="col-span-12 xl:col-span-7 space-y-3">
            {/* Tabla de 7 peajes */}
            <div className="rounded-lg border p-3" style={CARD}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Peajes — Conteo en Tiempo Real</span>
                <span className="text-[10px] font-mono text-slate-600">Click para ver detalle</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="text-slate-500 border-b" style={{ borderColor: '#1a2d4a' }}>
                      <th className="text-left py-1.5 px-2">#</th>
                      <th className="text-left py-1.5 px-2">Peaje</th>
                      <th className="text-left py-1.5 px-2">Ubicación</th>
                      <th className="text-right py-1.5 px-2">Tarifa CI</th>
                      <th className="text-right py-1.5 px-2">Flujo/h</th>
                      <th className="text-right py-1.5 px-2">Acum. Hoy</th>
                      <th className="text-right py-1.5 px-2">Ingresos Hoy</th>
                      <th className="text-center py-1.5 px-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiscData.peajes.map((p, i) => {
                      const flowRatio = p.flow / (p.capacidadNominal || 1400);
                      const statusColor = flowRatio > 0.8 ? '#ef4444' : flowRatio > 0.5 ? '#f59e0b' : '#22c55e';
                      const statusLabel = flowRatio > 0.8 ? 'ALTO' : flowRatio > 0.5 ? 'MODERADO' : 'FLUIDO';
                      return (
                        <tr key={p.id} className="border-b hover:bg-slate-800/30 cursor-pointer transition-colors"
                          style={{ borderColor: '#1a2d4a20' }}
                          onClick={() => { window.location.href = `/fiscalizacion/${p.id.toLowerCase()}`; }}>
                          <td className="py-2 px-2 text-slate-600">{i + 1}</td>
                          <td className="py-2 px-2 text-purple-300 font-bold">{p.name}</td>
                          <td className="py-2 px-2 text-slate-400">{p.dept}</td>
                          <td className="py-2 px-2 text-right text-slate-300">${p.tarifaCatI?.toLocaleString('es-CO')}</td>
                          <td className="py-2 px-2 text-right text-sky-400">{p.flow?.toLocaleString('es-CO')}</td>
                          <td className="py-2 px-2 text-right text-slate-300">{p.acumuladoHoy?.toLocaleString('es-CO')}</td>
                          <td className="py-2 px-2 text-right text-green-400">{formatCOP(p.ingresoHoy || 0)}</td>
                          <td className="py-2 px-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{
                              backgroundColor: `${statusColor}15`, color: statusColor,
                            }}>{statusLabel}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-bold" style={{ borderColor: '#8b5cf640' }}>
                      <td colSpan={4} className="py-2 px-2 text-purple-300">TOTAL 7 PEAJES</td>
                      <td className="py-2 px-2 text-right text-sky-400">
                        {fiscData.peajes.reduce((s, p) => s + (p.flow || 0), 0).toLocaleString('es-CO')}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-200">
                        {fiscData.totalVehiculos.toLocaleString('es-CO')}
                      </td>
                      <td className="py-2 px-2 text-right text-green-400">{formatCOP(fiscData.totalIngresos)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Distribución por categoría */}
            <div className="rounded-lg border p-3" style={CARD}>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Distribución Vehicular — Eje Cafetero</div>
              <div className="grid grid-cols-6 gap-2">
                {ADC.categorias.map(cat => (
                  <div key={cat.id} className="text-center rounded border p-2" style={{ borderColor: `${cat.color}30` }}>
                    <div className="font-mono text-sm font-bold" style={{ color: cat.color }}>
                      {Math.round((ADC.distribucionVehicular[cat.id] || 0) * 100)}%
                    </div>
                    <div className="text-[8px] text-slate-500 truncate">{cat.code}</div>
                    <div className="text-[7px] text-slate-600 truncate">{cat.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial 7 días */}
            {fiscData.history.length > 0 && (
              <div className="rounded-lg border p-3" style={CARD}>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Historial — Últimos 7 Días</div>
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="text-slate-500 border-b" style={{ borderColor: '#1a2d4a' }}>
                      <th className="text-left py-1 px-2">Fecha</th>
                      <th className="text-right py-1 px-2">Vehículos</th>
                      <th className="text-right py-1 px-2">Ingresos Est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiscData.history.map(d => (
                      <tr key={d.date} className="border-b" style={{ borderColor: '#1a2d4a20' }}>
                        <td className="py-1.5 px-2 text-slate-300">{d.date}</td>
                        <td className="py-1.5 px-2 text-right text-sky-400">{d.vehiculos.toLocaleString('es-CO')}</td>
                        <td className="py-1.5 px-2 text-right text-green-400">{formatCOP(d.ingresos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 h-8 flex items-center justify-between px-4 border-t text-[9px] font-mono z-30"
        style={{ backgroundColor: 'rgba(10, 15, 30, 0.95)', borderColor: '#1a2d4a' }}>
        <div className="flex items-center gap-2">
          <Lock className="w-3 h-3 text-red-400" />
          <span className="text-red-400">CONFIDENCIAL</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">DITRA · INVÍAS · MinTransporte</span>
        </div>
        <div className="text-slate-400">
          {clock.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })},{' '}
          {clock.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' })}
          <span className="text-slate-600 ml-2">· VIITS-NEXUS v2.0</span>
        </div>
      </footer>
    </div>
  );
}
