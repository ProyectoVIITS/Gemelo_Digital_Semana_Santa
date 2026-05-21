/**
 * DepartmentJamsView — Panorama nacional Waze agrupado por departamento.
 *
 * Lee del store `nationalWazeJamsAll` (todos los jams Waze, sin filtro de
 * nivel) y los agrupa con `groupJamsByDepartment`. Renderiza un grid de
 * cards expandibles, una por departamento con eventos.
 *
 * Decisiones:
 *  - Sin click-to-twin (a propósito; el flujo de detalle queda en la
 *    tabla AlertaDITRA principal)
 *  - Lazy mount del MapContainer Leaflet (solo cuando la card se expande)
 *  - Mapas en tono claro con zoom/pan interactivos
 *  - Borde y badge de nivel coloreados por jamLevel máximo del departamento
 *  - Tooltip on hover sobre cada polilínea
 */
import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Tooltip as LTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { useTrafficStore } from '../store/trafficStore';
import { groupJamsByDepartment } from '../utils/departmentClassifier';

const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };

function levelColor(level) {
  if (level >= 5) return '#ef4444';
  if (level >= 4) return '#f97316';
  if (level >= 3) return '#f59e0b';
  if (level >= 2) return '#fbbf24';
  return '#22d3ee';
}

function jamBbox(jams) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const j of jams) {
    if (!j || !j.line) continue;
    for (const p of j.line) {
      if (!p || p.x == null || p.y == null) continue;
      if (p.y < minLat) minLat = p.y;
      if (p.y > maxLat) maxLat = p.y;
      if (p.x < minLon) minLon = p.x;
      if (p.x > maxLon) maxLon = p.x;
    }
  }
  if (!Number.isFinite(minLat)) return null;
  // Padding ~10% para que las polilíneas no rocen los bordes
  const dLat = (maxLat - minLat) * 0.1 || 0.01;
  const dLon = (maxLon - minLon) * 0.1 || 0.01;
  return [
    [minLat - dLat, minLon - dLon],
    [maxLat + dLat, maxLon + dLon],
  ];
}

function DepartmentCard({ deptGroup }) {
  const [expanded, setExpanded] = useState(false);
  const { dept, jams } = deptGroup;
  const maxLevel = useMemo(
    () => jams.reduce((m, j) => Math.max(m, j.jamLevel || 0), 0),
    [jams],
  );
  const totalKm = useMemo(
    () => jams.reduce((s, j) => s + (j.length || 0) / 1000, 0),
    [jams],
  );
  const color = levelColor(maxLevel);
  const bounds = useMemo(() => (expanded ? jamBbox(jams) : null), [expanded, jams]);

  const sortedJams = useMemo(() =>
    jams.slice().sort((a, b) =>
      (b.jamLevel - a.jamLevel) || ((b.length || 0) - (a.length || 0))
    ),
    [jams],
  );

  return (
    <div
      className="rounded-lg border overflow-hidden transition-all"
      style={{
        ...CARD,
        borderColor: `${color}40`,
        boxShadow: maxLevel >= 4 ? `0 0 12px ${color}25` : 'none',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {expanded
            ? <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />
            : <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />}
          <span className="text-[11px] font-bold text-slate-200 tracking-wide truncate">
            {dept.name.toUpperCase()}
          </span>
          <span className="text-[9px] text-slate-500 font-mono">{dept.code}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[9px] text-slate-500 font-mono">{totalKm.toFixed(1)} km</span>
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold"
            style={{
              background: `${color}20`,
              color,
              border: `1px solid ${color}50`,
            }}
          >
            L{maxLevel}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-700/60 text-slate-200 min-w-[28px] text-center">
            {jams.length}
          </span>
        </div>
      </button>
      {expanded && bounds && (
        <div className="border-t" style={{ borderColor: `${color}30` }}>
          <div style={{ height: 240, width: '100%' }}>
            <MapContainer
              bounds={bounds}
              style={{ height: '100%', width: '100%', backgroundColor: '#e8eef5' }}
              attributionControl={false}
              zoomControl={true}
              scrollWheelZoom={true}
              dragging={true}
              doubleClickZoom={true}
              touchZoom={true}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
              />
              {jams.map((jam, i) => {
                if (!jam || !jam.line || !jam.line.length) return null;
                const positions = jam.line.map((p) => [p.y, p.x]);
                const c = levelColor(jam.jamLevel || 0);
                const km = ((jam.length || 0) / 1000).toFixed(1);
                const min = Math.round((jam.time || 0) / 60);
                const ratio = jam.historicTime > 0
                  ? (jam.time / jam.historicTime).toFixed(1)
                  : '?';
                return (
                  <Polyline
                    key={jam.uuid || jam.id || i}
                    positions={positions}
                    pathOptions={{ color: c, weight: 5, opacity: 0.95 }}
                  >
                    <LTooltip direction="top" sticky opacity={0.95}>
                      <div style={{ fontSize: 10, lineHeight: 1.4, maxWidth: 240 }}>
                        <div style={{ fontWeight: 'bold', color: '#0f172a' }}>
                          {jam.name || 'Tramo'}
                        </div>
                        <div style={{ color: '#1e293b', marginTop: 2 }}>
                          Nivel <b style={{ color: c }}>{jam.jamLevel}</b>
                          {' · '}{km} km{' · '}{min} min{' · '}<b>{ratio}x</b>
                        </div>
                      </div>
                    </LTooltip>
                  </Polyline>
                );
              })}
            </MapContainer>
          </div>
          {/* Lista compacta debajo del mapa */}
          <div
            className="px-3 py-2 max-h-32 overflow-y-auto space-y-1 border-t"
            style={{ borderColor: `${color}20` }}
          >
            {sortedJams.map((jam, i) => {
              const c = levelColor(jam.jamLevel || 0);
              const km = ((jam.length || 0) / 1000).toFixed(1);
              const min = Math.round((jam.time || 0) / 60);
              return (
                <div
                  key={jam.uuid || jam.id || i}
                  className="flex items-center gap-2 text-[10px]"
                >
                  <span
                    className="px-1 py-0.5 rounded font-mono font-bold flex-shrink-0"
                    style={{
                      background: `${c}20`,
                      color: c,
                      minWidth: 22,
                      textAlign: 'center',
                    }}
                  >
                    {jam.jamLevel}
                  </span>
                  <span className="text-slate-300 truncate flex-1">
                    {jam.name || 'Tramo sin nombre'}
                  </span>
                  <span className="text-slate-500 font-mono whitespace-nowrap">
                    {km}km · {min}min
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DepartmentJamsView() {
  const allJams = useTrafficStore((state) => state.nationalWazeJamsAll) || [];
  const groups = useMemo(() => groupJamsByDepartment(allJams), [allJams]);
  const totalEvents = allJams.length;

  return (
    <div
      className="rounded-2xl border p-5 mb-4"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(16px)',
        borderColor: 'rgba(20, 184, 166, 0.2)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}
        >
          <MapPin className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-white flex items-center gap-2">
            Panorama por Departamento
            <div className="px-2 py-0.5 rounded text-[8px] tracking-widest font-bold bg-teal-500/15 text-teal-300">
              TIEMPO REAL NACIONAL
            </div>
          </div>
          <div className="text-[10px] text-slate-400 tracking-wide mt-0.5 font-mono">
            {totalEvents > 0
              ? `${totalEvents} eventos en vía · ${groups.length} entidades territoriales con actividad`
              : 'Cobertura nacional en tiempo real'}
          </div>
        </div>
      </div>

      {totalEvents === 0 ? (
        <div className="text-center py-6 px-4 border border-dashed rounded-lg border-slate-700/50 bg-slate-800/20">
          <span className="text-slate-400 text-xs tracking-widest uppercase">
            ✅ Sin eventos activos a nivel nacional en este momento
          </span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {groups.map((g) => (
              <DepartmentCard key={g.dept.code} deptGroup={g} />
            ))}
          </div>
          <div
            className="mt-3 pt-2 border-t text-center"
            style={{ borderColor: 'rgba(148, 163, 184, 0.1)' }}
          >
            <div className="text-[9px] text-slate-500 tracking-widest uppercase font-mono">
              Click sobre cada departamento para ver mapa detallado · Datos sin filtro de nivel
            </div>
          </div>
        </>
      )}
    </div>
  );
}
