/**
 * VIITS NEXUS — Logística · Mapa Heatmap por Tramo
 * Resolución Mintransporte 20223040002435/2022 — 7 corredores logísticos (L1..L7)
 *
 * Render: una <Polyline> por par consecutivo de waypoints (segmento) con color
 * individual según IRT del segmento (verde→amarillo→naranja→rojo→bordo de
 * IRT_THRESHOLDS). Etiquetas mínimas en origen/destino y nodos críticos.
 * Click sobre cualquier segmento o nodo dispara onCorridorClick(id).
 *
 * Reusa CORRIDOR_COLORS/IRT_THRESHOLDS/getIRTLevel de nexusCorridors (NO redefine).
 * Reutiliza basemap CartoCDN dark_nolabels + dark_only_labels (idéntico a ColombiaMap.jsx).
 */
import React, { useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { IRT_THRESHOLDS, getIRTLevel } from '../../../data/nexusCorridors';
import useOsrmBatch from '../hooks/useOsrmBatch';

/* ─── Inject NEXUS-style dark Leaflet CSS (idéntico al patrón Chuzacá/Monitor) ─── */
const CSS_ID = 'viits-logistics-leaflet';
function injectCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .leaflet-container.viits-logistics { background: #06111e !important; }
    .leaflet-container.viits-logistics .leaflet-control-zoom a {
      background: #0d1a2e !important;
      color: #94a3b8 !important;
      border-color: #1a2d4a !important;
    }
    .leaflet-container.viits-logistics .leaflet-control-zoom a:hover {
      background: #1a2d4a !important;
      color: #e2e8f0 !important;
    }
    .leaflet-container.viits-logistics .leaflet-control-attribution { display: none !important; }
    .viits-logistics-tip {
      background: rgba(6, 17, 30, 0.92) !important;
      border: 1px solid #1a2d4a !important;
      color: #e2e8f0 !important;
      font-family: 'JetBrains Mono', 'Space Mono', monospace !important;
      font-size: 10px !important;
      padding: 6px 10px !important;
      border-radius: 6px !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.55) !important;
      white-space: nowrap !important;
    }
    .viits-logistics-tip::before { border-bottom-color: #1a2d4a !important; }
    .viits-logistics-node-label {
      background: rgba(6, 17, 30, 0.88) !important;
      border: 1px solid #1a2d4a !important;
      color: #cbd5e1 !important;
      font-family: 'JetBrains Mono', monospace !important;
      font-size: 9px !important;
      letter-spacing: 0.05em !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      box-shadow: 0 2px 10px rgba(0,0,0,0.5) !important;
    }
    .viits-logistics-node-label::before { border-bottom-color: #1a2d4a !important; }
  `;
  document.head.appendChild(s);
}

/* ─── FitBounds: encuadra al conjunto activo (todos los corredores o el seleccionado) ─── */
function FitBounds({ bounds, selectedKey }) {
  const map = useMap();
  const lastKey = useRef(null);
  useEffect(() => {
    if (!bounds || bounds.length < 2) return;
    if (lastKey.current === selectedKey) return;
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
    lastKey.current = selectedKey;
  }, [map, bounds, selectedKey]);
  return null;
}

/* ─── Helpers ─── */
function segmentColor(snapshotSeg) {
  if (snapshotSeg?.color) return snapshotSeg.color;
  if (typeof snapshotSeg?.irt === 'number') return getIRTLevel(snapshotSeg.irt).color;
  return IRT_THRESHOLDS.normal.color;
}

function segmentIRT(snapshotSeg) {
  return typeof snapshotSeg?.irt === 'number' ? snapshotSeg.irt : null;
}

function segmentWeight(irt) {
  if (irt == null) return 4;
  if (irt > 75) return 6;
  if (irt > 50) return 5;
  return 4;
}

/* ─── Main component ─── */
export default function LogisticsHeatmapMap({
  corridors = [],
  snapshotsByCorridor = {},
  selectedCorridorId = null,
  onCorridorClick,
  onSelectCorridor,        // alias soportado (mismo callback semántico)
  height = '520px',
}) {
  useEffect(() => { injectCSS(); }, []);

  const handleSelect = onCorridorClick || onSelectCorridor || (() => {});

  /* Aplanar todos los segmentos del conjunto para el batch OSRM.
     Usamos id compuesto "corridorId/segmentId" para evitar colisiones (todos los
     segmentos arrancan con LX-SXX que es único, pero garantizamos). */
  const flatSegments = useMemo(() => {
    const out = [];
    corridors.forEach((corridor) => {
      (corridor.segments || []).forEach((segment) => {
        if (Array.isArray(segment.polyline) && segment.polyline.length >= 2) {
          out.push({ id: `${corridor.id}/${segment.id}`, polyline: segment.polyline });
        }
      });
    });
    return out;
  }, [corridors]);

  /* OSRM batch: rellena geometryMap incrementalmente.
     Hasta que llegue la geometría real, cada polilínea cae al fallback de
     segment.polyline (línea recta entre waypoints). */
  const { geometryMap } = useOsrmBatch(flatSegments);

  /* Build per-corridor render data — UNA Polyline por par consecutivo de waypoints. */
  const renderCorridors = useMemo(() => {
    return corridors.map(corridor => {
      const snap = snapshotsByCorridor[corridor.id];
      const segs = (corridor.segments || []).map(segment => {
        const snapSeg = snap?.segments?.[segment.id];
        const realGeom = geometryMap[`${corridor.id}/${segment.id}`];
        const polyline = Array.isArray(realGeom) && realGeom.length >= 2
          ? realGeom
          : (Array.isArray(segment.polyline) && segment.polyline.length >= 2 ? segment.polyline : null);
        return {
          id: segment.id,
          label: segment.label || `${segment.fromNodeId} → ${segment.toNodeId}`,
          polyline,
          irt: segmentIRT(snapSeg),
          color: segmentColor(snapSeg),
          avgSpeed: snapSeg?.avgSpeed ?? null,
          tollsConsidered: snapSeg?.tollsConsidered ?? 0,
          level: snapSeg?.level ?? (snapSeg?.irt != null ? getIRTLevel(snapSeg.irt) : null),
        };
      }).filter(s => s.polyline);

      // Nodes for labels & click affordances
      const nodes = (corridor.nodes || []).map(n => ({
        id: n.id,
        name: n.name,
        kind: n.kind,
        lat: n.lat,
        lng: n.lng,
      }));

      return {
        id: corridor.id,
        code: corridor.code,
        name: corridor.name,
        shortName: corridor.shortName,
        color: corridor.color,
        segments: segs,
        nodes,
        kpi: snap?.corridorKPI ?? null,
      };
    });
  }, [corridors, snapshotsByCorridor, geometryMap]);

  /* Bounds: si hay seleccionado, encuadra a ese; si no, al conjunto. */
  const { bounds, boundsKey } = useMemo(() => {
    const selected = selectedCorridorId
      ? renderCorridors.find(c => c.id === selectedCorridorId)
      : null;
    const source = selected ? [selected] : renderCorridors;
    const pts = [];
    source.forEach(c => {
      c.segments.forEach(s => s.polyline.forEach(p => pts.push(p)));
      c.nodes.forEach(n => pts.push([n.lat, n.lng]));
    });
    return {
      bounds: pts.length >= 2 ? pts : null,
      boundsKey: selectedCorridorId || '__all__',
    };
  }, [renderCorridors, selectedCorridorId]);

  /* Etiquetas mínimas: origen, destino y hasta 2-3 nodos críticos por corredor.
     Si hay un corredor seleccionado, mostramos sólo sus nodos para no saturar. */
  const visibleNodesByCorridor = useMemo(() => {
    const result = {};
    renderCorridors.forEach(c => {
      const all = c.nodes;
      if (all.length === 0) { result[c.id] = []; return; }
      const origin = all.find(n => n.kind === 'origin') || all[0];
      const destination =
        all.find(n => n.kind === 'border') ||
        all.find(n => n.kind === 'port') ||
        all[all.length - 1];
      const criticalKinds = new Set(['port', 'border', 'hub']);
      const criticals = all.filter(n =>
        n.id !== origin.id && n.id !== destination.id && criticalKinds.has(n.kind)
      ).slice(0, 2);
      const set = new Map();
      [origin, destination, ...criticals].forEach(n => { if (n) set.set(n.id, n); });
      result[c.id] = Array.from(set.values());
    });
    return result;
  }, [renderCorridors]);

  return (
    <div style={{ height, width: '100%' }}>
      <MapContainer
        center={[4.6, -74.1]}
        zoom={6}
        preferCanvas
        zoomControl
        scrollWheelZoom
        doubleClickZoom
        dragging
        className="viits-logistics"
        style={{ height: '100%', width: '100%' }}
      >
        <FitBounds bounds={bounds} selectedKey={boundsKey} />

        {/* Basemap idéntico a ColombiaMap.jsx / Monitor */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          maxZoom={18}
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          maxZoom={18}
          opacity={0.45}
        />

        {/* ─── Polylines por SEGMENTO (heatmap por tramo) ─── */}
        {renderCorridors.map(corridor => {
          const dimmed = selectedCorridorId && selectedCorridorId !== corridor.id;
          const baseOpacity = dimmed ? 0.20 : 0.95;
          const haloOpacity = dimmed ? 0.05 : 0.15;

          return (
            <React.Fragment key={corridor.id}>
              {corridor.segments.map(seg => {
                const w = segmentWeight(seg.irt);
                const irtTxt = seg.irt != null ? seg.irt : '—';
                const levelLabel = seg.level?.label || '—';
                const spdTxt = seg.avgSpeed != null ? `${Math.round(seg.avgSpeed)} km/h` : 's/d';
                const tollsTxt = `${seg.tollsConsidered} peaje${seg.tollsConsidered === 1 ? '' : 's'}`;

                return (
                  <React.Fragment key={seg.id}>
                    {/* Halo */}
                    <Polyline
                      positions={seg.polyline}
                      pathOptions={{
                        color: seg.color,
                        weight: w + 5,
                        opacity: haloOpacity,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                      eventHandlers={{ click: () => handleSelect(corridor.id) }}
                    />
                    {/* Línea principal coloreada por IRT del tramo */}
                    <Polyline
                      positions={seg.polyline}
                      pathOptions={{
                        color: seg.color,
                        weight: w,
                        opacity: baseOpacity,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                      eventHandlers={{ click: () => handleSelect(corridor.id) }}
                    >
                      <Tooltip direction="top" offset={[0, -4]} className="viits-logistics-tip" sticky>
                        <div>
                          <div style={{ fontWeight: 'bold', color: corridor.color, marginBottom: 2 }}>
                            {corridor.code ? `${corridor.code} · ` : ''}{seg.label}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ color: seg.color, fontWeight: 'bold' }}>
                              IRT {irtTxt}
                            </span>
                            <span style={{ color: '#94a3b8' }}>{levelLabel}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 2, color: '#cbd5e1' }}>
                            <span>{spdTxt}</span>
                            <span style={{ color: '#64748b' }}>·</span>
                            <span style={{ color: '#a78bfa' }}>{tollsTxt}</span>
                          </div>
                        </div>
                      </Tooltip>
                    </Polyline>
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* ─── Nodos mínimos: origen, destino y 2-3 nodos críticos (port/border/hub) ─── */}
        {renderCorridors.map(corridor => {
          const dimmed = selectedCorridorId && selectedCorridorId !== corridor.id;
          const nodes = visibleNodesByCorridor[corridor.id] || [];
          return (
            <React.Fragment key={`nodes-${corridor.id}`}>
              {nodes.map(n => {
                const isHub = n.kind === 'port' || n.kind === 'border' || n.kind === 'hub';
                const radius = isHub ? 5 : 4;
                return (
                  <CircleMarker
                    key={n.id}
                    center={[n.lat, n.lng]}
                    radius={radius}
                    pathOptions={{
                      color: '#0a0f1e',
                      weight: 1.5,
                      fillColor: corridor.color,
                      fillOpacity: dimmed ? 0.35 : 0.95,
                      opacity: dimmed ? 0.4 : 1,
                    }}
                    eventHandlers={{ click: () => handleSelect(corridor.id) }}
                  >
                    <Tooltip
                      direction="top"
                      offset={[0, -6]}
                      className="viits-logistics-node-label"
                      permanent={!dimmed && isHub}
                    >
                      <span style={{ color: corridor.color, fontWeight: 'bold' }}>
                        {n.name}
                      </span>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
