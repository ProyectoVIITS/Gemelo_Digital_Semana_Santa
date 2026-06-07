/**
 * LogisticsTollTable — Tabla agregada de peajes para un corredor logístico.
 *
 * Componente PRESENTACIONAL. No lee del store, no hace fetch, no calcula IRT.
 * El padre (LogisticsCorridorDetailPage) le pasa la lista ya resuelta de peajes
 * con datos vivos del trafficStore + metadata estática de ALL_TOLL_STATIONS
 * (resolveTollDetails) ya mezclada.
 *
 * Encabezado VIITS NEXUS — coherente con TollPage / TollStationCard:
 *   - Card oscura rgba(13,26,46,0.6) borde #1a2d4a
 *   - text-[9px] tracking-widest uppercase en headers
 *   - JetBrains Mono inline
 *   - Badges de IRT con backgroundColor = level.color + '22' y color = level.color
 *
 * Props:
 *   tolls        : Array<TollRow>  — filas ya agregadas (ver shape abajo). Si null/undefined -> skeleton.
 *   corridorId   : string          — id de corredor NEXUS para el Link /monitor/:corridorId/:tollId.
 *                                     Puede ser por fila si el row trae nexusCorridorId; si no, usa éste.
 *   onTollClick? : (toll) => void  — handler opcional (analytics, selección, etc.). El Link nativo
 *                                     siempre se renderiza por accesibilidad.
 *   highRiskIds? : string[]        — ids HIGH_RISK_TOLLS para marcar con ⚠. Default [].
 *   title?       : string          — override del header. Default 'Peajes monitoreados'.
 *
 * TollRow shape esperado (= LogisticsCorridorSnapshot.tolls[tollId] mezclado con metadata):
 *   {
 *     tollId, name, sector, km, department, concesionario,
 *     nexusCorridorId?,                 // 'C1'..'C7' — si no viene, se infiere del prefijo de tollId
 *     irt,                              // 0..100 (o null/undefined si S/D)
 *     level,                            // {label,color} (o null si S/D)
 *     avgSpeed,                         // km/h
 *     vehiclesHour,                     // flujo veh/h
 *     occupancy,                        // 0..100
 *     queueLength,                      // veh
 *     activeBooths, totalBooths,
 *     hasData                           // bool — false -> fila gris 'S/D'
 *   }
 */

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };
const MONO = { fontFamily: '"JetBrains Mono", monospace' };

// Grid columns — alineadas entre header y filas.
//  ID | Nombre | Sector | KM | Concesionario | Depto | IRT | Vel | Flujo | Ocup | Cola | Casetas | →
const GRID_COLS =
  'grid-cols-[80px_minmax(140px,1.4fr)_minmax(140px,1.4fr)_70px_minmax(110px,1fr)_minmax(100px,0.9fr)_80px_70px_80px_70px_60px_80px_28px]';

const HEADERS = [
  { key: 'tollId',       label: 'ID',            sortable: true,  align: 'left'   },
  { key: 'name',         label: 'Nombre',        sortable: true,  align: 'left'   },
  { key: 'sector',       label: 'Sector',        sortable: false, align: 'left'   },
  { key: 'km',           label: 'KM',            sortable: false, align: 'left'   },
  { key: 'concesionario',label: 'Concesionario', sortable: false, align: 'left'   },
  { key: 'department',   label: 'Depto',         sortable: false, align: 'left'   },
  { key: 'irt',          label: 'Estado · IRT',  sortable: true,  align: 'center' },
  { key: 'avgSpeed',     label: 'Vel km/h',      sortable: true,  align: 'right'  },
  { key: 'vehiclesHour', label: 'Flujo v/h',     sortable: true,  align: 'right'  },
  { key: 'occupancy',    label: 'Ocup %',        sortable: true,  align: 'right'  },
  { key: 'queueLength',  label: 'Cola',          sortable: true,  align: 'right'  },
  { key: 'booths',       label: 'Casetas',       sortable: false, align: 'center' },
  { key: 'link',         label: '',              sortable: false, align: 'center' },
];

function inferNexusCorridorId(tollId, fallback) {
  // 'C1-07' -> 'C1'
  if (!tollId || typeof tollId !== 'string') return fallback || '';
  const idx = tollId.indexOf('-');
  return idx > 0 ? tollId.slice(0, idx) : (fallback || '');
}

function alignClass(align) {
  if (align === 'right') return 'text-right justify-end';
  if (align === 'center') return 'text-center justify-center';
  return 'text-left justify-start';
}

/* ─── IRT Badge ─── */
function IRTBadge({ irt, level }) {
  if (irt === null || irt === undefined || !level) {
    return <span className="text-[10px] text-slate-600" style={MONO}>S/D</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tabular-nums"
      style={{
        backgroundColor: level.color + '22',
        color: level.color,
        ...MONO,
      }}
      title={level.label}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: level.color }} />
      {irt}
    </span>
  );
}

/* ─── Skeleton row ─── */
function SkeletonRow({ i }) {
  return (
    <div
      className={`grid ${GRID_COLS} gap-2 px-3 py-2 border-b items-center animate-pulse`}
      style={{ borderColor: '#1a2d4a55', animationDelay: `${i * 60}ms` }}
    >
      {HEADERS.map((h, idx) => (
        <div key={idx} className={`flex ${alignClass(h.align)}`}>
          <div
            className="h-3 rounded"
            style={{
              width: h.key === 'name' || h.key === 'sector' || h.key === 'concesionario' ? '80%' : '60%',
              backgroundColor: '#1a2d4a',
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ─── Header Cell ─── */
function HeaderCell({ h, sortKey, sortDir, onSort }) {
  const active = sortKey === h.key;
  const clickable = h.sortable;
  const Icon = active ? (sortDir === 'desc' ? ChevronDown : ChevronUp) : null;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={clickable ? () => onSort(h.key) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSort(h.key);
              }
            }
          : undefined
      }
      className={`flex items-center gap-1 text-[9px] tracking-widest uppercase select-none ${alignClass(h.align)} ${
        clickable ? 'cursor-pointer hover:text-slate-200' : ''
      }`}
      style={{ color: active ? '#38bdf8' : '#475569', ...MONO }}
    >
      <span>{h.label}</span>
      {Icon && <Icon className="w-3 h-3" />}
    </div>
  );
}

/* ─── Toll Row ─── */
function TollRow({ row, corridorId, isHighRisk, onTollClick }) {
  const nexusId = row.nexusCorridorId || inferNexusCorridorId(row.tollId, corridorId);
  const tollSlug = (row.tollId || '').toLowerCase();
  const linkTo = nexusId && tollSlug ? `/monitor/${nexusId}/${tollSlug}` : null;
  const noData = !row.hasData;

  const speedColor =
    !row.hasData || row.avgSpeed === null || row.avgSpeed === undefined
      ? '#64748b'
      : row.avgSpeed < 30
      ? '#ef4444'
      : row.avgSpeed < 50
      ? '#f59e0b'
      : '#22c55e';

  const occColor =
    !row.hasData || row.occupancy === null || row.occupancy === undefined
      ? '#64748b'
      : row.occupancy > 80
      ? '#ef4444'
      : row.occupancy > 60
      ? '#f59e0b'
      : '#22c55e';

  const queueColor =
    !row.hasData || !row.queueLength
      ? '#64748b'
      : row.queueLength > 8
      ? '#ef4444'
      : row.queueLength > 4
      ? '#f59e0b'
      : '#94a3b8';

  const cellBase = 'text-[11px] truncate';
  const opacity = noData ? 0.5 : 1;

  const content = (
    <div
      className={`grid ${GRID_COLS} gap-2 px-3 py-2 border-b items-center hover:bg-[#0d1a2e] transition-colors`}
      style={{ borderColor: '#1a2d4a55', opacity, ...MONO }}
      onClick={onTollClick ? () => onTollClick(row) : undefined}
    >
      {/* ID */}
      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-300 truncate">
        {isHighRisk && (
          <AlertTriangle
            className="w-3 h-3 flex-shrink-0"
            style={{ color: '#ef4444' }}
            aria-label="Peaje de alto riesgo"
          />
        )}
        <span className="truncate">{row.tollId}</span>
      </div>

      {/* Nombre */}
      <div className={`${cellBase} text-slate-200 font-semibold`} title={row.name}>
        {row.name || '—'}
      </div>

      {/* Sector */}
      <div className={`${cellBase} text-slate-400`} title={row.sector}>
        {row.sector || '—'}
      </div>

      {/* KM */}
      <div className={`${cellBase} text-slate-400`}>{row.km || '—'}</div>

      {/* Concesionario */}
      <div className={`${cellBase} text-slate-400`} title={row.concesionario}>
        {row.concesionario || '—'}
      </div>

      {/* Depto */}
      <div className={`${cellBase} text-slate-500`} title={row.department}>
        {row.department || '—'}
      </div>

      {/* IRT badge */}
      <div className="flex items-center justify-center">
        <IRTBadge irt={noData ? null : row.irt} level={noData ? null : row.level} />
      </div>

      {/* Velocidad */}
      <div className="text-right tabular-nums text-[11px]" style={{ color: speedColor }}>
        {noData || row.avgSpeed === null || row.avgSpeed === undefined ? 'S/D' : Math.round(row.avgSpeed)}
      </div>

      {/* Flujo */}
      <div className="text-right tabular-nums text-[11px] text-slate-300">
        {noData || row.vehiclesHour === null || row.vehiclesHour === undefined
          ? 'S/D'
          : Math.round(row.vehiclesHour).toLocaleString('es-CO')}
      </div>

      {/* Ocupación */}
      <div className="text-right tabular-nums text-[11px]" style={{ color: occColor }}>
        {noData || row.occupancy === null || row.occupancy === undefined ? 'S/D' : `${Math.round(row.occupancy)}%`}
      </div>

      {/* Cola */}
      <div className="text-right tabular-nums text-[11px]" style={{ color: queueColor }}>
        {noData || row.queueLength === null || row.queueLength === undefined ? 'S/D' : row.queueLength}
      </div>

      {/* Casetas N/M */}
      <div className="text-center tabular-nums text-[11px] text-slate-400">
        {row.activeBooths !== undefined && row.totalBooths !== undefined
          ? `${row.activeBooths}/${row.totalBooths}`
          : '—'}
      </div>

      {/* Link arrow */}
      <div className="flex items-center justify-center">
        {linkTo ? (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        ) : (
          <span className="text-slate-700">—</span>
        )}
      </div>
    </div>
  );

  if (!linkTo) {
    return <div role="row">{content}</div>;
  }

  return (
    <Link
      to={linkTo}
      role="row"
      className="block cursor-pointer"
      aria-label={`Ver detalle del peaje ${row.name || row.tollId}`}
    >
      {content}
    </Link>
  );
}

/* ─── Main ─── */
export default function LogisticsTollTable({
  tolls,
  corridorId,
  onTollClick,
  highRiskIds = [],
  title = 'Peajes monitoreados',
}) {
  const [sortKey, setSortKey] = useState('irt');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!Array.isArray(tolls)) return null;
    const arr = [...tolls];
    arr.sort((a, b) => {
      // Filas sin data al final, siempre.
      if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb);
      }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
    return arr;
  }, [tolls, sortKey, sortDir]);

  const highRiskSet = useMemo(() => new Set(highRiskIds || []), [highRiskIds]);

  // Skeleton state.
  const isLoading = !Array.isArray(tolls);

  return (
    <section
      className="rounded-lg border overflow-hidden"
      style={CARD}
      aria-label="Tabla de peajes del corredor logístico"
    >
      {/* Header banda */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: '#1a2d4a' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-slate-500" style={MONO}>
            {title}
          </span>
          {!isLoading && (
            <span className="text-[10px] text-slate-600 tabular-nums" style={MONO}>
              · {sortedRows.length} peaje{sortedRows.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <span className="text-[9px] text-slate-600 uppercase tracking-wider hidden md:inline" style={MONO}>
          Tiempo real · VIITS-NEXUS
        </span>
      </div>

      {/* Header columnas */}
      <div
        className={`grid ${GRID_COLS} gap-2 px-3 py-2 border-b bg-[#090f1c]`}
        style={{ borderColor: '#1a2d4a' }}
        role="row"
      >
        {HEADERS.map((h) => (
          <HeaderCell key={h.key} h={h} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        ))}
      </div>

      {/* Body */}
      <div
        className="overflow-x-auto"
        style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}
        role="rowgroup"
      >
        {isLoading && (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonRow key={i} i={i} />
            ))}
          </>
        )}

        {!isLoading && sortedRows.length === 0 && (
          <div className="px-3 py-8 text-center text-slate-600 text-xs" style={MONO}>
            Sin peajes monitoreados en este corredor
          </div>
        )}

        {!isLoading &&
          sortedRows.map((row) => (
            <TollRow
              key={row.tollId}
              row={row}
              corridorId={corridorId}
              isHighRisk={highRiskSet.has(row.tollId)}
              onTollClick={onTollClick}
            />
          ))}
      </div>
    </section>
  );
}
