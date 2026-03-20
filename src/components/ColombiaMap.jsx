import React, { useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { getNivelAlerta, calcularTiempoViaje, calcularVelocidadPromedio } from '../utils/irtEngine';

/* ─── Inject dark leaflet CSS ─── */
const CSS_ID = 'viits-leaflet-ss';
function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .leaflet-container.viits-ss { background: #0a0f1e !important; }
    .leaflet-control-zoom a { background: #0f172a !important; color: #94a3b8 !important; border-color: #1e293b !important; }
    .leaflet-control-zoom a:hover { background: #1e293b !important; }
    .leaflet-control-attribution { display: none !important; }
    .viits-ss-tip {
      background: rgba(10, 15, 30, 0.92) !important;
      border: 1px solid #334155 !important;
      color: #e2e8f0 !important;
      font-family: 'JetBrains Mono', 'Space Mono', monospace !important;
      font-size: 10px !important;
      padding: 6px 10px !important;
      border-radius: 6px !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
    }
    .viits-ss-tip::before { border-bottom-color: #334155 !important; }
  `;
  document.head.appendChild(s);
}

function FitBounds({ corridors }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const pts = corridors.flatMap(c => c.peajes.map(p => [p.lat, p.lng]));
    if (pts.length > 0) {
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 7 });
      fitted.current = true;
    }
  }, [map, corridors]);
  return null;
}

export default function ColombiaMap({ corridors, irtValues, selectedCorridor, onSelectCorridor, corridorMetrics }) {
  useEffect(() => { injectCSS(); }, []);

  const lines = useMemo(() =>
    corridors.map(c => ({
      id: c.id,
      color: c.color,
      positions: c.peajes.map(p => [p.lat, p.lng]),
    }))
  , [corridors]);

  const allTolls = useMemo(() =>
    corridors.flatMap(c =>
      c.peajes.map(p => ({ ...p, corridorId: c.id, corridorColor: c.color, corridorName: c.name }))
    )
  , [corridors]);

  return (
    <div style={{ height: 500 }}>
      <MapContainer
        center={[5.5, -74.5]} zoom={6}
        zoomControl={true} scrollWheelZoom={true}
        dragging={true} doubleClickZoom={true}
        className="viits-ss"
        style={{ height: '100%', width: '100%' }}
      >
        <FitBounds corridors={corridors} />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" maxZoom={18} />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" maxZoom={18} opacity={0.4} />

        {/* Corridor polylines */}
        {lines.map(cl => {
          const irt = irtValues[cl.id] || 0;
          const w = irt > 75 ? 5 : irt > 50 ? 4 : 3;
          const sel = selectedCorridor === cl.id;
          return (
            <React.Fragment key={cl.id}>
              <Polyline positions={cl.positions}
                pathOptions={{ color: cl.color, weight: w + 6, opacity: sel ? 0.2 : 0.08, lineCap: 'round', lineJoin: 'round' }}
                eventHandlers={{ click: () => onSelectCorridor(cl.id) }} />
              <Polyline positions={cl.positions}
                pathOptions={{ color: cl.color, weight: sel ? w + 1 : w, opacity: sel ? 1 : 0.8, lineCap: 'round', lineJoin: 'round' }}
                eventHandlers={{ click: () => onSelectCorridor(cl.id) }} />
            </React.Fragment>
          );
        })}

        {/* Toll markers */}
        {allTolls.map(t => {
          const irt = irtValues[t.corridorId] || 0;
          const tl = getNivelAlerta(irt);
          const isCrit = t.critico;
          const r = isCrit ? 7 : 5;
          const m = corridorMetrics?.[t.corridorId];
          const vel = m ? Math.round(calcularVelocidadPromedio(80, irt)) : null;

          return (
            <CircleMarker key={t.id} center={[t.lat, t.lng]} radius={r}
              pathOptions={{
                color: irt > 75 ? tl.color : t.corridorColor,
                fillColor: irt > 75 ? tl.color : t.corridorColor,
                fillOpacity: 0.8, weight: isCrit ? 2 : 1, opacity: 1,
              }}
              eventHandlers={{ click: () => onSelectCorridor(t.corridorId) }}
            >
              <Tooltip direction="top" offset={[0, -8]} className="viits-ss-tip">
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{t.nombre} {isCrit ? '★' : ''}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>{t.km} · {t.corridorName}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                    <span style={{ color: tl.color, fontWeight: 'bold' }}>IRT {irt}</span>
                    {vel && <span style={{ color: '#38bdf8' }}>{vel} km/h</span>}
                    {m && <span style={{ color: '#a78bfa' }}>{m.volume?.toLocaleString()} veh/h</span>}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
