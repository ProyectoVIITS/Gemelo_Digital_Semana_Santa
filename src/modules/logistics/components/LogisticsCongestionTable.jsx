/**
 * VIITS-NEXUS · Módulo Logística · LogisticsCongestionTable
 * ─────────────────────────────────────────────────────────────
 * Tabla de congestión para corredores logísticos Mintransporte
 * (Res. 20223040002435/2022). Dos modos de uso:
 *
 *   1) <LogisticsCongestionTable segments={[...]} />
 *      Modo detalle simple: una fila por segmento con columnas
 *      [Nodo origen, Nodo destino, Km, IRT, Estado, Tendencia].
 *
 *   2) <LogisticsCongestionTable mode="index"
 *                                corridors={LOGISTICS_CORRIDORS}
 *                                snapshotsByCorridor={...} />
 *      Modo índice: una fila por corredor (L1..L7) con KPIs
 *      agregados (IRT, vel media, flujo, segmentos críticos).
 *
 *   3) <LogisticsCongestionTable mode="detail"
 *                                segments={corridor.segments}
 *                                snapshot={snapshot} />
 *      Modo detalle enriquecido: usa el snapshot del hook
 *      useLogisticsCorridorData para obtener IRT, vel, flujo
 *      por segmento.
 *
 * Visual: replica el patrón CARD/typography de CorridorPage.
 *   - bg rgba(13,26,46,0.6), border #1a2d4a
 *   - headers text-[9px] tracking-widest uppercase
 *   - JetBrains Mono inline
 *   - IRT badge con color = level.color + '22' bg, color = level.color
 *
 * Sort: IRT desc por defecto. Click en header alterna asc/desc.
 * Sticky header dentro del scroll container.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { ChevronRight, ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import IRTBadge from '../../../components/shared/IRTBadge';
import { getIRTLevel } from '../../../data/nexusCorridors';

const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };
const MONO = { fontFamily: '"JetBrains Mono", monospace' };

/* ─── Helpers ─────────────────────────────────────────────── */

function safeLevel(irt) {
  if (irt == null || Number.isNaN(irt)) return { label: 'S/D', color: '#475569', max: 100 };
  return getIRTLevel(irt);
}

/**
 * Badge inline (no usa IRTBadge si queremos look compacto de tabla).
 * Mantiene la misma paleta que IRT_THRESHOLDS de nexusCorridors.
 */
function StatusBadge({ irt }) {
  const level = safeLevel(irt);
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase"
      style={{
        ...MONO,
        backgroundColor: level.color + '22',
        color: level.color,
        border: `1px solid ${level.color}44`,
      }}
    >
      {level.label}
    </span>
  );
}

/**
 * Mini-celda IRT con número grande coloreado.
 * Compacto para tabla. Para hero usar IRTBadge.
 */
function IRTCell({ irt }) {
  const level = safeLevel(irt);
  const display = irt == null || Number.isNaN(irt) ? '—' : Math.round(irt);
  return (
    <span className="font-bold text-base tabular-nums" style={{ ...MONO, color: level.color }}>
      {display}
    </span>
  );
}

/**
 * Indicador de tendencia. Acepta:
 *   - number (delta vs t-1)
 *   - 'up' | 'down' | 'flat'
 *   - undefined → flat
 */
function TrendCell({ trend }) {
  let dir = 'flat';
  let delta = null;

  if (typeof trend === 'number') {
    delta = trend;
    if (trend > 1.5) dir = 'up';
    else if (trend < -1.5) dir = 'down';
    else dir = 'flat';
  } else if (trend === 'up' || trend === 'down' || trend === 'flat') {
    dir = trend;
  }

  const cfg = {
    up:   { Icon: TrendingUp,   color: '#ef4444', label: '↑' },
    down: { Icon: TrendingDown, color: '#22c55e', label: '↓' },
    flat: { Icon: Minus,        color: '#64748b', label: '=' },
  }[dir];

  const { Icon, color } = cfg;

  return (
    <span className="inline-flex items-center gap-1" style={{ color, ...MONO }}>
      <Icon className="w-3.5 h-3.5" />
      {delta != null && (
        <span className="text-[10px] tabular-nums">
          {delta > 0 ? '+' : ''}{Math.round(delta)}
        </span>
      )}
    </span>
  );
}

/**
 * Header de columna ordenable.
 */
function SortableTh({ label, sortKey, currentSort, onSort, align = 'left' }) {
  const active = currentSort.key === sortKey;
  const dir = active ? currentSort.dir : null;
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 ${justify} w-full text-[9px] tracking-widest uppercase transition-colors hover:text-slate-200`}
      style={{
        ...MONO,
        color: active ? '#38bdf8' : '#475569',
        textAlign: align,
      }}
    >
      <span>{label}</span>
      {active && (dir === 'desc'
        ? <ChevronDown className="w-3 h-3" />
        : <ChevronUp className="w-3 h-3" />)}
    </button>
  );
}

/* ─── Resolución de IRT/vel/flujo por segmento ────────────── */

/**
 * Dado un segmento + snapshot opcional, devuelve los métricos
 * usables (irt, level, avgSpeed, flow, queue, trend).
 * Si snapshot existe -> usa snapshot.segments[seg.id].
 * Si no -> intenta leer campos directos en el segmento (irt, avgSpeed...).
 */
function resolveSegmentMetrics(seg, snapshot) {
  const snap = snapshot?.segments?.[seg.id] || null;

  const irt       = snap?.irt        ?? seg.irt        ?? null;
  const avgSpeed  = snap?.avgSpeed   ?? seg.avgSpeed   ?? null;
  const flow      = snap?.flow       ?? seg.flow       ?? null;
  const queue     = snap?.queue      ?? seg.queue      ?? null;
  const trend     = snap?.trend      ?? seg.trend      ?? null;
  const level     = snap?.level      ?? safeLevel(irt);

  return { irt, avgSpeed, flow, queue, trend, level };
}

/* ═══════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════ */

export default function LogisticsCongestionTable({
  mode,
  segments,
  snapshot,
  corridors,
  snapshotsByCorridor,
  onRowClick,
  onSelectCorridor,
  className = '',
}) {
  // Auto-detección de modo:
  //   - si pasaron corridors  -> 'index'
  //   - si pasaron segments   -> 'detail'
  //   - fallback              -> 'detail'
  const resolvedMode = mode || (corridors ? 'index' : 'detail');

  const [sort, setSort] = useState({ key: 'irt', dir: 'desc' });

  const handleSort = useCallback((key) => {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' }
    );
  }, []);

  if (resolvedMode === 'index') {
    return (
      <IndexTable
        corridors={corridors || []}
        snapshotsByCorridor={snapshotsByCorridor || {}}
        sort={sort}
        onSort={handleSort}
        onRowClick={onRowClick || onSelectCorridor}
        className={className}
      />
    );
  }

  return (
    <DetailTable
      segments={segments || []}
      snapshot={snapshot}
      sort={sort}
      onSort={handleSort}
      onRowClick={onRowClick}
      className={className}
    />
  );
}

/* ─── DETAIL TABLE ────────────────────────────────────────────
   Columnas: Nodo origen | Nodo destino | Km | IRT | Estado | Tendencia
   (signature solicitada por el usuario)
   ──────────────────────────────────────────────────────────── */
function DetailTable({ segments, snapshot, sort, onSort, onRowClick, className }) {
  const rows = useMemo(() => {
    const enriched = segments.map(seg => {
      const m = resolveSegmentMetrics(seg, snapshot);
      // Resolución de nombres de nodos: aceptamos varias formas para ser
      // robustos al contrato (fromNode/toNode objetos, o just label).
      const fromName =
        seg.fromNode?.name ||
        seg.fromName ||
        (seg.label ? seg.label.split('–')[0]?.trim() : null) ||
        seg.fromNodeId ||
        '—';
      const toName =
        seg.toNode?.name ||
        seg.toName ||
        (seg.label ? seg.label.split('–')[1]?.trim() : null) ||
        seg.toNodeId ||
        '—';

      return {
        id: seg.id,
        from: fromName,
        to: toName,
        distanceKm: seg.distanceKm ?? 0,
        irt: m.irt,
        level: m.level,
        avgSpeed: m.avgSpeed,
        flow: m.flow,
        trend: m.trend,
        raw: seg,
      };
    });

    const { key, dir } = sort;
    const mult = dir === 'desc' ? -1 : 1;
    const sortable = [...enriched].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      // null/undefined al final siempre
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return av.localeCompare(bv) * mult;
      return (av - bv) * mult;
    });

    return sortable;
  }, [segments, snapshot, sort]);

  const GRID = 'grid-cols-[1.4fr_1.4fr_70px_70px_120px_90px_36px]';

  return (
    <div
      className={`rounded-lg border overflow-hidden ${className}`}
      style={CARD}
    >
      {/* Caption */}
      <div className="px-3 py-2 border-b flex items-center justify-between"
           style={{ borderColor: '#1a2d4a' }}>
        <span className="text-[10px] uppercase tracking-widest text-slate-500" style={MONO}>
          Tabla de Congestión por Segmento
        </span>
        <span className="text-[9px] font-mono text-slate-600">
          {rows.length} tramo{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-x-auto">
        {/* Sticky header */}
        <div
          className={`grid ${GRID} gap-2 px-3 py-2 sticky top-0 z-10 border-b`}
          style={{ backgroundColor: '#0a1424', borderColor: '#1a2d4a' }}
        >
          <SortableTh label="Nodo origen"  sortKey="from"       currentSort={sort} onSort={onSort} />
          <SortableTh label="Nodo destino" sortKey="to"         currentSort={sort} onSort={onSort} />
          <SortableTh label="Km"           sortKey="distanceKm" currentSort={sort} onSort={onSort} align="right" />
          <SortableTh label="IRT"          sortKey="irt"        currentSort={sort} onSort={onSort} align="right" />
          <SortableTh label="Estado"       sortKey="irt"        currentSort={sort} onSort={onSort} align="center" />
          <SortableTh label="Tendencia"    sortKey="trend"      currentSort={sort} onSort={onSort} align="center" />
          <span />
        </div>

        {/* Rows */}
        {rows.length === 0 && (
          <div className="px-3 py-8 text-center text-[10px] text-slate-600" style={MONO}>
            Sin segmentos para mostrar
          </div>
        )}

        {rows.map(r => {
          const clickable = !!onRowClick;
          return (
            <div
              key={r.id}
              className={`grid ${GRID} gap-2 px-3 py-2 border-b items-center transition-colors ${clickable ? 'cursor-pointer hover:bg-[#0f1d35]' : ''}`}
              style={{ borderColor: '#101e35' }}
              onClick={clickable ? () => onRowClick(r.raw) : undefined}
            >
              <span className="text-xs text-slate-200 truncate" title={r.from}>{r.from}</span>
              <span className="text-xs text-slate-200 truncate" title={r.to}>{r.to}</span>
              <span className="text-xs text-slate-400 text-right tabular-nums" style={MONO}>
                {Number(r.distanceKm).toLocaleString('es-CO')}
              </span>
              <span className="text-right">
                <IRTCell irt={r.irt} />
              </span>
              <span className="text-center">
                <StatusBadge irt={r.irt} />
              </span>
              <span className="text-center">
                <TrendCell trend={r.trend} />
              </span>
              <span className="text-right">
                {clickable && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── INDEX TABLE ─────────────────────────────────────────────
   Una fila por corredor logístico (L1..L7).
   Columnas: Código | Corredor | Km totales | IRT | Vel | Flujo |
             Segmentos críticos | →
   ──────────────────────────────────────────────────────────── */
function IndexTable({ corridors, snapshotsByCorridor, sort, onSort, onRowClick, className }) {
  const rows = useMemo(() => {
    const enriched = corridors.map(c => {
      const snap = snapshotsByCorridor[c.id] || null;
      const kpi = snap?.corridorKPI || {};
      return {
        id: c.id,
        code: c.code || c.id,
        name: c.shortName || c.name || c.id,
        fullName: c.name,
        color: c.color,
        totalKm: c.totalDistanceKm ?? 0,
        irt: kpi.irt ?? null,
        level: kpi.level || safeLevel(kpi.irt),
        avgSpeed: kpi.avgSpeed ?? null,
        totalFlow: kpi.totalFlow ?? null,
        criticalSegments: kpi.criticalSegments ?? 0,
        raw: c,
      };
    });

    const { key, dir } = sort;
    const mult = dir === 'desc' ? -1 : 1;
    const sortable = [...enriched].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return av.localeCompare(bv) * mult;
      return (av - bv) * mult;
    });

    return sortable;
  }, [corridors, snapshotsByCorridor, sort]);

  const GRID = 'grid-cols-[70px_1.6fr_90px_70px_90px_100px_110px_36px]';

  return (
    <div className={`rounded-lg border overflow-hidden ${className}`} style={CARD}>
      <div className="px-3 py-2 border-b flex items-center justify-between"
           style={{ borderColor: '#1a2d4a' }}>
        <span className="text-[10px] uppercase tracking-widest text-slate-500" style={MONO}>
          Corredores Logísticos · Estado actual
        </span>
        <span className="text-[9px] font-mono text-slate-600">
          {rows.length} corredor{rows.length === 1 ? '' : 'es'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div
          className={`grid ${GRID} gap-2 px-3 py-2 sticky top-0 z-10 border-b`}
          style={{ backgroundColor: '#0a1424', borderColor: '#1a2d4a' }}
        >
          <SortableTh label="Código"     sortKey="code"             currentSort={sort} onSort={onSort} />
          <SortableTh label="Corredor"   sortKey="name"             currentSort={sort} onSort={onSort} />
          <SortableTh label="Km tot."    sortKey="totalKm"          currentSort={sort} onSort={onSort} align="right" />
          <SortableTh label="IRT"        sortKey="irt"              currentSort={sort} onSort={onSort} align="right" />
          <SortableTh label="Vel km/h"   sortKey="avgSpeed"         currentSort={sort} onSort={onSort} align="right" />
          <SortableTh label="Flujo v/h"  sortKey="totalFlow"        currentSort={sort} onSort={onSort} align="right" />
          <SortableTh label="Seg. crít." sortKey="criticalSegments" currentSort={sort} onSort={onSort} align="right" />
          <span />
        </div>

        {rows.length === 0 && (
          <div className="px-3 py-8 text-center text-[10px] text-slate-600" style={MONO}>
            Sin corredores para mostrar
          </div>
        )}

        {rows.map(r => {
          const clickable = !!onRowClick;
          return (
            <div
              key={r.id}
              className={`grid ${GRID} gap-2 px-3 py-2 border-b items-center transition-colors ${clickable ? 'cursor-pointer hover:bg-[#0f1d35]' : ''}`}
              style={{ borderColor: '#101e35' }}
              onClick={clickable ? () => onRowClick(r.raw) : undefined}
            >
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color || '#475569' }} />
                <span className="text-[10px] font-bold tabular-nums" style={{ ...MONO, color: r.color || '#94a3b8' }}>
                  {r.code}
                </span>
              </span>
              <span className="text-xs text-slate-200 truncate" title={r.fullName}>
                {r.name}
              </span>
              <span className="text-xs text-slate-400 text-right tabular-nums" style={MONO}>
                {Number(r.totalKm).toLocaleString('es-CO')}
              </span>
              <span className="text-right">
                <IRTCell irt={r.irt} />
              </span>
              <span className="text-xs text-slate-300 text-right tabular-nums" style={MONO}>
                {r.avgSpeed != null ? Math.round(r.avgSpeed) : '—'}
              </span>
              <span className="text-xs text-slate-300 text-right tabular-nums" style={MONO}>
                {r.totalFlow != null ? Number(r.totalFlow).toLocaleString('es-CO') : '—'}
              </span>
              <span
                className="text-right tabular-nums text-xs font-bold"
                style={{
                  ...MONO,
                  color: r.criticalSegments > 0 ? '#ef4444' : '#64748b',
                }}
              >
                {r.criticalSegments}
              </span>
              <span className="text-right">
                {clickable && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Named exports auxiliares (testeables / reutilizables) ──*/
export { StatusBadge, IRTCell, TrendCell };
