/**
 * VIITS NEXUS — Logística · Detalle de Corredor (L1..L7)
 * Resolución Mintransporte 20223040002435/2022
 *
 * Página de detalle. Lee :corridorId via useParams. Llama useLogisticsData(corridorId).
 * Si el corredor no existe → redirige a /logistics.
 *
 * Layout:
 *   ┌─ Header NEXUS (sticky h-14) — back link a /logistics
 *   ├─ Breadcrumb (/ › Logística › {shortName})
 *   ├─ Main (max-w-[1600px])
 *   │   ├─ KPI grid (IRT, vel media, flujo, peajes c/ datos, segmentos críticos)
 *   │   ├─ Mapa heatmap (zoom al corredor vía selectedCorridorId)
 *   │   ├─ Dos columnas:
 *   │   │     izq  → <LogisticsCongestionTable segments={...} snapshot/>
 *   │   │     der  → <LogisticsTollTable tolls corridorId/>
 *   │   └─ Footer informativo (depto, puertos, fronteras)
 *   └─ Footer fixed (h-8)
 *
 * Reutiliza:
 *   - useLogisticsData (hook agregador del módulo, computa snapshot del corredor)
 *   - LogisticsHeatmapMap, LogisticsCongestionTable, LogisticsTollTable
 *   - LoadingScreen, IRT_THRESHOLDS, getIRTLevel
 *   - HIGH_RISK_TOLLS (marcado ⚠ en tabla de peajes)
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft, Truck, Wifi, WifiOff, MapPin, AlertTriangle, Anchor, Flag, Activity, Gauge,
} from 'lucide-react';

import useLogisticsData from './hooks/useLogisticsData';
import LogisticsHeatmapMap from './components/LogisticsHeatmapMap';
import LogisticsCongestionTable from './components/LogisticsCongestionTable';
import LogisticsTollTable from './components/LogisticsTollTable';
import LoadingScreen from '../../components/shared/LoadingScreen';
import {
  getIRTLevel,
  HIGH_RISK_TOLLS,
  ALL_TOLL_STATIONS,
} from '../../data/nexusCorridors';

const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };
const MONO = { fontFamily: '"JetBrains Mono", monospace' };

/* ─── Helpers locales ────────────────────────────────────────── */

function inferNexusCorridorId(tollId, fallback) {
  if (!tollId || typeof tollId !== 'string') return fallback || '';
  const idx = tollId.indexOf('-');
  return idx > 0 ? tollId.slice(0, idx) : (fallback || '');
}

function resolveTollMeta(tollId) {
  return ALL_TOLL_STATIONS.find((t) => t.id === tollId) || null;
}

/* ─── Header NEXUS ───────────────────────────────────────────── */

function CorridorDetailHeader({ corridor, kpi, isConnected, clock }) {
  const color = corridor.color || '#38bdf8';
  const irt = kpi?.irt ?? 0;
  const level = kpi?.level || getIRTLevel(irt);

  return (
    <header
      className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b"
      style={{
        backgroundColor: 'rgba(10, 15, 30, 0.85)',
        backdropFilter: 'blur(12px)',
        borderColor: `${color}33`,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Link
          to="/logistics"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs"
          style={MONO}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Corredores logísticos</span>
        </Link>

        <div className="w-px h-6 bg-slate-700" />

        <div
          className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}
        >
          <Truck className="w-4 h-4 text-white" />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-sm font-bold tracking-wide truncate"
            style={{ color, ...MONO }}
            title={corridor.name}
          >
            {corridor.code ? `${corridor.code} · ` : ''}{corridor.shortName || corridor.name}
          </span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
        <span className="font-semibold text-white truncate" title={corridor.name}>
          {corridor.name}
        </span>
        <span className="text-slate-600">·</span>
        <span style={MONO}>{corridor.totalDistanceKm} km</span>
        <span className="text-slate-600">·</span>
        <span style={MONO}>{corridor.tollRefs?.length || 0} peajes</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-widest text-slate-500" style={MONO}>
            IRT
          </span>
          <span
            className="px-2 py-0.5 rounded text-[11px] font-bold tabular-nums"
            style={{
              backgroundColor: level.color + '22',
              color: level.color,
              border: `1px solid ${level.color}44`,
              ...MONO,
            }}
            title={level.label}
          >
            {irt}
          </span>
        </div>

        <span className="text-sm tabular-nums text-slate-300 hidden sm:inline" style={MONO}>
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

/* ─── KPI Tile ───────────────────────────────────────────────── */

function KpiTile({ label, value, unit, color, Icon }) {
  return (
    <div className="rounded-lg border p-3" style={CARD}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-[#475569] tracking-widest uppercase" style={MONO}>
          {label}
        </span>
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color }} />}
      </div>
      <div
        className="text-2xl font-bold tabular-nums"
        style={{ color, ...MONO }}
      >
        {value}
        {unit && <span className="text-xs text-slate-500 ml-1 font-normal">{unit}</span>}
      </div>
    </div>
  );
}

/* ─── Construcción de filas para LogisticsTollTable ───────────── */
/**
 * Mezcla el inventario NEXUS (ALL_TOLL_STATIONS) con cualquier dato vivo
 * derivado por el hook. El hook actual no expone `snapshot.tolls`; los datos
 * por peaje se reconstruyen aquí desde los segmentos enriquecidos para que la
 * tabla los pinte. Esto se desacopla bien: si el hook evoluciona y añade
 * `snapshot.tolls`, podemos preferir esa fuente.
 */
function useTollRowsForCorridor(corridor) {
  return useMemo(() => {
    if (!corridor) return [];

    // 1) Lista única de tollIds del corredor.
    const ids = corridor.tollRefs && corridor.tollRefs.length
      ? Array.from(new Set(corridor.tollRefs))
      : Array.from(new Set(
          (corridor.segments || []).flatMap((s) => s.tollRefs || []),
        ));

    // 2) Para cada peaje, busco el primer segmento que lo referencia y
    //    extraigo el snapshot que ya viene calculado en `segment.*`.
    //    Los snapshots agregan por segmento, no por peaje, así que el peaje
    //    "hereda" las métricas del segmento al que pertenece (aproximación
    //    razonable para vista logística estratégica).
    const segByToll = {};
    (corridor.segments || []).forEach((seg) => {
      (seg.tollRefs || []).forEach((tollId) => {
        if (!segByToll[tollId]) segByToll[tollId] = seg;
      });
    });

    return ids.map((tollId) => {
      const meta = resolveTollMeta(tollId);
      const seg = segByToll[tollId] || null;
      const nexusCorridorId = inferNexusCorridorId(tollId);
      const hasData = !!(seg && seg.tollsWithData > 0);

      return {
        tollId,
        name: meta?.name || tollId,
        sector: meta?.sector || '—',
        km: meta?.km || '—',
        department: meta?.department || '—',
        concesionario: meta?.type || meta?.concesionario || '—',
        nexusCorridorId,

        irt: seg?.irt ?? null,
        level: seg?.level ?? (seg?.irt != null ? getIRTLevel(seg.irt) : null),
        avgSpeed: seg?.avgSpeed ?? null,
        vehiclesHour: seg?.flow ?? null,
        occupancy: typeof seg?.irt === 'number' ? Math.min(100, Math.round(seg.irt * 0.9)) : null,
        queueLength: seg?.queue ?? null,
        activeBooths: meta?.boothConfig?.salida ?? undefined,
        totalBooths: meta?.boothConfig
          ? (meta.boothConfig.salida || 0) + (meta.boothConfig.entrada || 0)
          : undefined,
        hasData,
      };
    });
  }, [corridor]);
}

/* ═══════════════════════════════════════════════════════════════
   ★ MAIN: LogisticsCorridorDetail
   ═══════════════════════════════════════════════════════════════ */

export default function LogisticsCorridorDetail() {
  const { corridorId } = useParams();
  const navigate = useNavigate();

  const { corridor, isConnected, hasData } = useLogisticsData(corridorId);

  const [clock, setClock] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const handleLoadComplete = useCallback(() => setLoading(false), []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Estructura para el mapa heatmap (un solo corredor seleccionado).
  const snapshotsByCorridor = useMemo(() => {
    if (!corridor) return {};
    const segMap = {};
    (corridor.segments || []).forEach((s) => {
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
    return {
      [corridor.id]: {
        corridorId: corridor.id,
        segments: segMap,
        corridorKPI: corridor.kpi || null,
      },
    };
  }, [corridor]);

  const tollRows = useTollRowsForCorridor(corridor);

  // Redirección si no existe corredor (después de leer el hook).
  if (!corridor) {
    return <Navigate to="/logistics" replace />;
  }

  if (loading) {
    return (
      <LoadingScreen
        title={corridor.shortName || corridor.name}
        subtitle={`${corridor.name} · ${corridor.totalDistanceKm} km · ${corridor.tollRefs?.length || 0} peajes`}
        color={corridor.color}
        onComplete={handleLoadComplete}
      />
    );
  }

  const kpi = corridor.kpi || {};
  const level = kpi.level || getIRTLevel(kpi.irt || 0);
  const strategic = corridor.strategic || {};

  return (
    <div
      className="flex flex-col min-h-screen bg-[#06111e] text-slate-200"
      style={{ ...MONO, paddingBottom: 36 }}
    >
      <CorridorDetailHeader
        corridor={corridor}
        kpi={kpi}
        isConnected={isConnected}
        clock={clock}
      />

      {/* Breadcrumb */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b bg-[#090f1c] text-[9px]"
        style={{ borderColor: '#1a2d4a', color: '#475569' }}
      >
        <Link to="/" className="hover:text-[#38bdf8] transition-colors">Inicio</Link>
        <span>/</span>
        <Link to="/logistics" className="hover:text-[#38bdf8] transition-colors">
          Corredores logísticos
        </Link>
        <span>/</span>
        <span style={{ color: corridor.color }}>{corridor.shortName || corridor.name}</span>
        {!hasData && (
          <span className="ml-auto text-amber-500 uppercase tracking-widest" style={MONO}>
            · Sin tráfico en vivo
          </span>
        )}
      </div>

      <main className="max-w-[1600px] mx-auto w-full px-3 py-3 flex-1">
        {/* ── KPI Grid del corredor ───────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <KpiTile
            label="IRT Corredor"
            value={String(kpi.irt ?? 0)}
            color={level.color}
            Icon={Activity}
          />
          <KpiTile
            label="Vel. media"
            value={String(kpi.avgSpeed ?? 0)}
            unit="km/h"
            color="#38bdf8"
            Icon={Gauge}
          />
          <KpiTile
            label="Flujo total"
            value={(kpi.totalFlow ?? 0).toLocaleString('es-CO')}
            unit="veh/h"
            color="#a78bfa"
            Icon={Truck}
          />
          <KpiTile
            label="Peajes con datos"
            value={`${kpi.tollsWithData ?? 0}/${kpi.tollsTotal ?? 0}`}
            color={kpi.tollsWithData > 0 ? '#22c55e' : '#64748b'}
            Icon={MapPin}
          />
          <KpiTile
            label="Segmentos críticos"
            value={String(kpi.criticalSegments ?? 0)}
            color={kpi.criticalSegments > 0 ? '#ef4444' : '#64748b'}
            Icon={AlertTriangle}
          />
        </div>

        {/* ── Mapa Heatmap (solo este corredor, zoom a bounds) ─── */}
        <div className="rounded-lg border overflow-hidden mb-4" style={CARD}>
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: '#1a2d4a' }}
          >
            <span className="text-[10px] uppercase tracking-widest text-slate-500" style={MONO}>
              Heatmap por tramo · {corridor.code || corridor.id}
            </span>
            <span className="text-[9px] text-slate-600" style={MONO}>
              {corridor.segments?.length || 0} segmentos · {corridor.totalDistanceKm} km
            </span>
          </div>
          <LogisticsHeatmapMap
            corridors={[corridor]}
            snapshotsByCorridor={snapshotsByCorridor}
            selectedCorridorId={corridor.id}
            height="460px"
          />
        </div>

        {/* ── Dos columnas: Congestión (izq) + Peajes (der) ──── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-[9px] text-[#475569] tracking-widest uppercase mb-2" style={MONO}>
              Congestión por segmento
            </div>
            <LogisticsCongestionTable
              mode="detail"
              segments={corridor.segments || []}
              snapshot={snapshotsByCorridor[corridor.id]}
              onRowClick={(seg) => navigate(`/logistics/${corridor.id}/${seg.id}`)}
            />
          </div>

          <div>
            <div className="text-[9px] text-[#475569] tracking-widest uppercase mb-2" style={MONO}>
              Peajes del corredor
            </div>
            <LogisticsTollTable
              tolls={tollRows}
              corridorId={corridor.id}
              highRiskIds={HIGH_RISK_TOLLS}
              title="Peajes monitoreados"
            />
          </div>
        </div>

        {/* ── Información estratégica ─────────────────────────── */}
        <div className="rounded-lg border p-3" style={CARD}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-500" style={MONO}>
              Información del corredor logístico
            </span>
            <span className="text-[9px] text-slate-600" style={MONO}>
              Res. {strategic.resolution || '20223040002435/2022'} · {strategic.chamber || 'Mintransporte'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <div className="text-[9px] text-slate-500 uppercase" style={MONO}>Naturaleza</div>
              <div className="text-xs text-slate-300">{corridor.nature || corridor.description || '—'}</div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase" style={MONO}>Origen · Destino</div>
              <div className="text-xs text-slate-300">
                {corridor.origin || '—'} → {corridor.destination || '—'}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase flex items-center gap-1" style={MONO}>
                <Anchor className="w-3 h-3" /> Puertos clave
              </div>
              <div className="text-xs text-slate-300">
                {strategic.keyPorts?.length ? strategic.keyPorts.join(', ') : '—'}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase flex items-center gap-1" style={MONO}>
                <Flag className="w-3 h-3" /> Fronteras
              </div>
              <div className="text-xs text-slate-300">
                {strategic.borders?.length ? strategic.borders.join(', ') : '—'}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer fijo NEXUS */}
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
          {corridor.code} · {corridor.tollRefs?.length || 0} peajes · {hasData ? 'DATOS EN VIVO' : 'SIN DATOS'}
        </span>
        <span>
          {new Date().toLocaleString('es-CO', { hour12: false })} · VIITS-NEXUS v2.0
        </span>
      </footer>
    </div>
  );
}
