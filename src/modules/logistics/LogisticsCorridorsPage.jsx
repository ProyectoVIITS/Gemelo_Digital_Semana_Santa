/**
 * VIITS NEXUS — Corredores Logísticos Estratégicos (índice)
 * Resolución Mintransporte 20223040002435 / 2022 — 7 corredores (L1..L7)
 *
 * Página índice (ruta /logistics). Layout:
 *   ┌─ Header NEXUS sticky (h-14) — back link a "/"
 *   ├─ Breadcrumb (Inicio / Corredores Logísticos)
 *   ├─ Hero: título + referencia normativa breve
 *   ├─ KPI grid agregado (km totales, peajes monitoreados, segmentos críticos)
 *   ├─ Main grid 60/40:
 *   │     izq → <LogisticsHeatmapMap corridors snapshotsByCorridor onCorridorClick>
 *   │     der → <LogisticsCongestionTable mode="index" ... onRowClick>
 *   └─ Footer fixed (h-8)
 *
 * Reutiliza:
 *   - useLogisticsData()  (sin args → enriquece los 7 corredores)
 *   - LogisticsHeatmapMap (heatmap por tramo, basemap CartoCDN dark)
 *   - LogisticsCongestionTable mode="index"
 *
 * Patrón visual: idéntico a CorridorPage / Monitor (CARD, MONO, paleta hex
 * #06111e / #090f1c / #0d1a2e / #1a2d4a / #475569).
 *
 * Tras escribir, el archivo se LEE y reporta líneas y resumen.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Truck, Wifi, WifiOff, MapPin, AlertTriangle, Activity, Gauge, Route,
} from 'lucide-react';

import useLogisticsData from './hooks/useLogisticsData';
import LogisticsHeatmapMap from './components/LogisticsHeatmapMap';
import LogisticsCongestionTable from './components/LogisticsCongestionTable';
import { getIRTLevel } from '../../data/nexusCorridors';

/* ─── Constantes de estilo NEXUS (idénticas a CorridorPage / Monitor) ─── */
const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };
const HEADER_BG = {
  backgroundColor: 'rgba(10, 15, 30, 0.85)',
  backdropFilter: 'blur(12px)',
  borderColor: 'rgba(14, 165, 233, 0.2)',
};
const MONO = { fontFamily: '"JetBrains Mono", "Space Mono", monospace' };

/* ─── Header NEXUS ─────────────────────────────────────────── */
function LogisticsIndexHeader({ globalKpi, isConnected, clock }) {
  const irt = globalKpi?.maxIrt ?? 0;
  const level = getIRTLevel(irt);

  return (
    <header
      className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b"
      style={HEADER_BG}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Link
          to="/"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs"
          style={MONO}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Volver</span>
        </Link>

        <div className="w-px h-6 bg-slate-700" />

        <div
          className="w-8 h-8 rounded flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}
        >
          <Truck className="w-4 h-4 text-white" />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-sm font-bold tracking-wide"
            style={{ color: '#0ea5e9', ...MONO }}
          >
            VIITS NEXUS
          </span>
          <span className="text-[10px] text-slate-500 hidden lg:inline">
            · Corredores Logísticos
          </span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Corredores</span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: '#38bdf8', ...MONO }}
          >
            {globalKpi?.totalCorridors ?? 0}/7
          </span>
        </div>
        <div className="w-px h-4 bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Peajes</span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: '#a78bfa', ...MONO }}
          >
            {globalKpi?.totalTolls ?? 0}
          </span>
        </div>
        <div className="w-px h-4 bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">IRT Máx</span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: level.color, ...MONO }}
            title={level.label}
          >
            {irt}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span
          className="text-sm tabular-nums text-slate-300 hidden sm:inline"
          style={MONO}
        >
          {clock.toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'America/Bogota',
          })}
        </span>
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-mono text-green-400 uppercase tracking-wider hidden sm:inline">
                LIVE
              </span>
              <Wifi className="w-3 h-3 text-green-400 ml-1" />
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-slate-500" />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider hidden sm:inline">
                OFFLINE
              </span>
              <WifiOff className="w-3 h-3 text-slate-500 ml-1" />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ─── KPI Tile (mismo patrón que CorridorPage) ─────────────── */
function KpiTile({ label, value, unit, color, Icon, hint }) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ ...CARD, borderColor: `${color}25` }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[9px] text-[#475569] tracking-widest uppercase"
          style={MONO}
        >
          {label}
        </span>
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color }} />}
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color, ...MONO }}>
        {value}
        {unit && (
          <span className="text-xs text-slate-500 ml-1 font-normal">{unit}</span>
        )}
      </div>
      {hint && (
        <div className="text-[9px] text-slate-600 mt-0.5" style={MONO}>
          {hint}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN — LogisticsCorridorsPage
   ═══════════════════════════════════════════════════════════════ */
export default function LogisticsCorridorsPage() {
  const navigate = useNavigate();
  const { corridors, isConnected, hasData } = useLogisticsData();

  const safeCorridors = useMemo(() => corridors || [], [corridors]);

  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ─── snapshotsByCorridor para el mapa + tabla índice ────── */
  // El hook ya enriquece cada corredor con segments[].irt/color y .kpi.
  // El mapa y la tabla esperan un objeto plano {corridorId: {segments:{segId:{...}}, corridorKPI}}.
  const snapshotsByCorridor = useMemo(() => {
    const out = {};
    safeCorridors.forEach((c) => {
      if (!c) return;
      const segMap = {};
      (c.segments || []).forEach((s) => {
        segMap[s.id] = {
          irt: s.irt,
          level: s.level,
          color: s.color,
          avgSpeed: s.avgSpeed,
          flow: s.flow,
          queue: s.queue,
          tollsConsidered: s.tollsConsidered,
          tollsWithData: s.tollsWithData,
        };
      });
      out[c.id] = {
        corridorId: c.id,
        segments: segMap,
        corridorKPI: c.kpi || null,
      };
    });
    return out;
  }, [safeCorridors]);

  /* ─── KPI agregado país ──────────────────────────────────── */
  const globalKpi = useMemo(() => {
    if (safeCorridors.length === 0) {
      return {
        totalCorridors: 0,
        totalKm: 0,
        totalTolls: 0,
        tollsWithData: 0,
        criticalSegments: 0,
        avgIRT: 0,
        maxIrt: 0,
        totalFlow: 0,
      };
    }
    const totalKm = safeCorridors.reduce(
      (s, c) => s + (c.totalDistanceKm || 0), 0,
    );
    const totalTolls = safeCorridors.reduce(
      (s, c) => s + (c.kpi?.tollsTotal || 0), 0,
    );
    const tollsWithData = safeCorridors.reduce(
      (s, c) => s + (c.kpi?.tollsWithData || 0), 0,
    );
    const criticalSegments = safeCorridors.reduce(
      (s, c) => s + (c.kpi?.criticalSegments || 0), 0,
    );
    const totalFlow = safeCorridors.reduce(
      (s, c) => s + (c.kpi?.totalFlow || 0), 0,
    );
    // IRT promedio ponderado por km de corredor (honesto).
    const irtNum = safeCorridors.reduce(
      (s, c) => s + ((c.kpi?.irt || 0) * (c.totalDistanceKm || 0)), 0,
    );
    const avgIRT = totalKm > 0 ? Math.round(irtNum / totalKm) : 0;
    const maxIrt = safeCorridors.reduce(
      (m, c) => Math.max(m, c.kpi?.irt || 0), 0,
    );
    return {
      totalCorridors: safeCorridors.length,
      totalKm,
      totalTolls,
      tollsWithData,
      criticalSegments,
      avgIRT,
      maxIrt,
      totalFlow,
    };
  }, [safeCorridors]);

  const avgLevel = getIRTLevel(globalKpi.avgIRT);

  /* ─── Navegación al detalle ──────────────────────────────── */
  const goToCorridor = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/logistics/${id}`);
    },
    [navigate],
  );

  const handleMapSelect = useCallback(
    (id) => goToCorridor(id),
    [goToCorridor],
  );

  const handleRowClick = useCallback(
    (corridor) => goToCorridor(corridor?.id),
    [goToCorridor],
  );

  return (
    <div
      className="flex flex-col min-h-screen bg-[#06111e] text-slate-200"
      style={{ ...MONO, paddingBottom: 36 }}
    >
      <LogisticsIndexHeader
        globalKpi={globalKpi}
        isConnected={isConnected}
        clock={clock}
      />

      {/* Breadcrumb */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b bg-[#090f1c] text-[9px]"
        style={{ borderColor: '#1a2d4a', color: '#475569' }}
      >
        <Link to="/" className="hover:text-[#38bdf8] transition-colors">
          Inicio
        </Link>
        <span>/</span>
        <span style={{ color: '#0ea5e9' }}>Corredores Logísticos</span>
        {!hasData && (
          <span
            className="ml-auto text-amber-500 uppercase tracking-widest"
            style={MONO}
          >
            · Sin tráfico en vivo
          </span>
        )}
      </div>

      <main className="max-w-[1600px] mx-auto w-full px-3 py-3 flex-1">
        {/* ── HERO ─────────────────────────────────────────── */}
        <section
          className="rounded-lg border p-4 mb-4"
          style={{
            ...CARD,
            background:
              'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(99,102,241,0.04))',
          }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div
                className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-slate-500 mb-1"
                style={MONO}
              >
                <Route className="w-3 h-3" />
                <span>Resolución Mintransporte 20223040002435 / 2022</span>
              </div>
              <h1
                className="text-xl md:text-2xl font-bold text-white leading-tight"
                style={MONO}
              >
                CORREDORES LOGÍSTICOS ESTRATÉGICOS
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                Los 7 corredores nacionales declarados como ejes estratégicos
                del comercio exterior, fronteras y abastecimiento interior.
                Monitoreo en tiempo real del Índice de Rendimiento del Tráfico
                (IRT) por tramo a partir de peajes de la red NEXUS.
              </p>
            </div>

            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded border"
              style={{
                borderColor: `${avgLevel.color}44`,
                backgroundColor: `${avgLevel.color}11`,
              }}
            >
              <span
                className="text-[9px] uppercase tracking-widest text-slate-500"
                style={MONO}
              >
                IRT País
              </span>
              <span
                className="text-lg font-bold tabular-nums"
                style={{ color: avgLevel.color, ...MONO }}
              >
                {globalKpi.avgIRT}
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: avgLevel.color, ...MONO }}
              >
                {avgLevel.label}
              </span>
            </div>
          </div>
        </section>

        {/* ── KPI Grid ────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <KpiTile
            label="Km totales"
            value={globalKpi.totalKm.toLocaleString('es-CO')}
            unit="km"
            color="#38bdf8"
            Icon={Route}
            hint="Red logística total"
          />
          <KpiTile
            label="Peajes monitoreados"
            value={`${globalKpi.tollsWithData}/${globalKpi.totalTolls}`}
            color={globalKpi.tollsWithData > 0 ? '#22c55e' : '#64748b'}
            Icon={MapPin}
            hint="Con datos en vivo"
          />
          <KpiTile
            label="Segmentos críticos"
            value={String(globalKpi.criticalSegments)}
            color={globalKpi.criticalSegments > 0 ? '#ef4444' : '#22c55e'}
            Icon={AlertTriangle}
            hint="IRT > 75"
          />
          <KpiTile
            label="Flujo total"
            value={globalKpi.totalFlow.toLocaleString('es-CO')}
            unit="veh/h"
            color="#a78bfa"
            Icon={Truck}
            hint="Suma de los 7 ejes"
          />
          <KpiTile
            label="IRT Máximo"
            value={String(globalKpi.maxIrt)}
            color={getIRTLevel(globalKpi.maxIrt).color}
            Icon={Activity}
            hint={getIRTLevel(globalKpi.maxIrt).label}
          />
        </div>

        {/* ── Main grid 60/40: Mapa | Tabla ──────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {/* Mapa (~60%) */}
          <div className="xl:col-span-3 rounded-lg border overflow-hidden" style={CARD}>
            <div
              className="flex items-center justify-between px-3 py-2 border-b"
              style={{ borderColor: '#1a2d4a' }}
            >
              <span
                className="text-[10px] uppercase tracking-widest text-slate-500"
                style={MONO}
              >
                Heatmap nacional · IRT por tramo
              </span>
              <span className="text-[9px] text-slate-600" style={MONO}>
                {safeCorridors.length} corredores ·{' '}
                {globalKpi.totalKm.toLocaleString('es-CO')} km
              </span>
            </div>
            <LogisticsHeatmapMap
              corridors={safeCorridors}
              snapshotsByCorridor={snapshotsByCorridor}
              onCorridorClick={handleMapSelect}
              onSelectCorridor={handleMapSelect}
              height="620px"
            />
            {/* Leyenda IRT mini */}
            <div
              className="flex items-center gap-3 flex-wrap px-3 py-2 border-t text-[9px]"
              style={{ borderColor: '#1a2d4a', color: '#64748b', ...MONO }}
            >
              <span className="uppercase tracking-widest">Leyenda IRT:</span>
              {[
                { label: 'NORMAL', color: '#22c55e' },
                { label: 'MODERADO', color: '#eab308' },
                { label: 'CONGEST.', color: '#f59e0b' },
                { label: 'CRÍTICO', color: '#ef4444' },
                { label: 'CERRADO', color: '#7f1d1d' },
              ].map((l) => (
                <span
                  key={l.label}
                  className="inline-flex items-center gap-1.5"
                >
                  <span
                    className="inline-block w-3 h-1 rounded-sm"
                    style={{ backgroundColor: l.color }}
                  />
                  <span style={{ color: l.color }}>{l.label}</span>
                </span>
              ))}
              <span className="ml-auto text-slate-600">
                Click sobre un corredor → detalle
              </span>
            </div>
          </div>

          {/* Tabla resumen (~40%) */}
          <div className="xl:col-span-2 flex flex-col">
            <LogisticsCongestionTable
              mode="index"
              corridors={safeCorridors}
              snapshotsByCorridor={snapshotsByCorridor}
              onRowClick={handleRowClick}
            />

            {/* Tarjeta auxiliar: naturaleza estratégica */}
            <div
              className="mt-3 rounded-lg border p-3"
              style={CARD}
            >
              <div
                className="text-[10px] uppercase tracking-widest text-slate-500 mb-2"
                style={MONO}
              >
                Naturaleza de los 7 corredores
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {safeCorridors.length === 0 && (
                  <div className="text-[10px] text-slate-600" style={MONO}>
                    Cargando inventario logístico…
                  </div>
                )}
                {safeCorridors.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => goToCorridor(c.id)}
                    className="flex items-center justify-between gap-2 px-2 py-1 rounded text-left hover:bg-[#0f1d35] transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.color || '#475569' }}
                      />
                      <span
                        className="text-[10px] font-bold tabular-nums"
                        style={{ color: c.color || '#94a3b8', ...MONO }}
                      >
                        {c.code || c.id}
                      </span>
                      <span
                        className="text-[10px] text-slate-300 truncate"
                        title={c.name}
                      >
                        {c.shortName || c.name}
                      </span>
                    </span>
                    <span
                      className="text-[9px] text-slate-500 truncate hidden md:inline"
                      style={MONO}
                      title={c.nature || c.description}
                    >
                      {c.nature || c.description || '—'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer NEXUS */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-40 h-8 flex items-center justify-between px-4 text-[9px]"
        style={{
          backgroundColor: '#040a14',
          borderTop: '1px solid #1a2d4a',
          color: '#475569',
          ...MONO,
        }}
      >
        <span>DITRA · INVÍAS · Logística estratégica</span>
        <span>
          7 corredores · {globalKpi.totalKm.toLocaleString('es-CO')} km ·{' '}
          {hasData ? 'DATOS EN VIVO' : 'SIN DATOS'}
        </span>
        <span>
          {clock.toLocaleString('es-CO', { hour12: false })} · VIITS-NEXUS v2.0
        </span>
      </footer>
    </div>
  );
}
