/**
 * VIITS-NEXUS · Módulo Logística · LogisticsSegmentDetailPage
 * ───────────────────────────────────────────────────────────────
 * Página de detalle de un segmento de un corredor logístico.
 * Ruta: /logistics/:corridorId/:segmentId
 *
 * Layout:
 *   ┌─ Header: nombre corredor · label segmento · IRT badge · vel/km
 *   ├─ Mapa (izq, 50%): zoom al polyline del segmento + marcadores
 *   └─ Canvas cinemático (der, 50%): RoadCanvas con simulación de
 *      tráfico parametrizada por IRT del segmento.
 *
 * Simulación:
 *   - IRT bajo  → jamLevel 0-1, vehículos pocos, velocidad alta (flujo libre)
 *   - IRT medio → jamLevel 2-3, densidad creciente
 *   - IRT alto  → jamLevel 4-5, cola pesada, motos serpenteando
 *
 * RoadCanvas espera polyline en formato [{x: lng, y: lat}, ...] — se
 * convierte aquí desde el formato [[lat, lng], ...] del data file.
 */
import React, { useMemo } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { ArrowLeft, MapPin, Gauge, TrendingUp, Crosshair } from 'lucide-react';
import useLogisticsData from './hooks/useLogisticsData';
import useOsrmGeometry from './hooks/useOsrmGeometry';
import { getLogisticsCorridorById, getIRTLevel } from './data/logisticsCorridors';
import MicropointCanvas from './components/MicropointCanvas';
import 'leaflet/dist/leaflet.css';

const MONO = { fontFamily: '"JetBrains Mono", monospace' };
const CARD = { backgroundColor: 'rgba(13, 26, 46, 0.6)', borderColor: '#1a2d4a' };

// ── Helpers ──────────────────────────────────────────────────────────

// Valor de IRT por defecto cuando no hay datos en vivo: asumimos flujo libre.
// Justificación: las redes ITS de carga operan baseline ~5/100 hasta que un
// evento (incidente, peaje, paso urbano) ingese señal contraria.
const BASELINE_IRT = 5;

/**
 * Mapea IRT (0..100) a jamLevel (0..5) que entiende RoadCanvas.
 * Sigue los umbrales IRT_THRESHOLDS: normal/moderado/congestionado/crítico/cerrado.
 * Sin datos → jamLevel 0 (flujo libre), no medio.
 */
function irtToJamLevel(irt) {
  if (irt == null || Number.isNaN(irt)) return 0;
  if (irt <= 10) return 0;
  if (irt <= 30) return 1;
  if (irt <= 50) return 2;
  if (irt <= 70) return 3;
  if (irt <= 85) return 4;
  return 5;
}

/**
 * Velocidad simulada en km/h. Usa avgSpeed del snapshot si existe;
 * si no, deriva del IRT con la regla speed = speedLimit · (1 − irt/100 · 0.7).
 * Sin IRT → asume baseline 5 → ~96% del límite (flujo libre).
 */
function deriveSpeed(snapshot, segment) {
  if (snapshot?.avgSpeed && snapshot.avgSpeed > 0) return snapshot.avgSpeed;
  const limit = segment?.speedLimit || 80;
  const irt = snapshot?.irt ?? BASELINE_IRT;
  return Math.max(5, limit * (1 - (irt / 100) * 0.7));
}

/**
 * jamRatio = severidad relativa al baseline normal.
 * 0.5 = mejor que normal, 1 = normal, 2-3 = severo. Sin datos = 0.5.
 */
function deriveJamRatio(irt) {
  if (irt == null) return 0.5;
  if (irt <= 20) return 0.5;
  if (irt <= 40) return 1;
  if (irt <= 60) return 1.5;
  if (irt <= 80) return 2;
  return 3;
}

/**
 * Flujo estimado en veh/h cuando no hay data del store. Greenshields
 * simplificado: density (veh/km) · speed (km/h). Para flujo libre con
 * jamLevel 0 (5 veh/km) y 75 km/h ≈ 375 veh/h por carril.
 */
function estimateFlow(jamLevel, speed) {
  const density = { 0: 5, 1: 12, 2: 25, 3: 45, 4: 80, 5: 120 }[jamLevel] ?? 12;
  return Math.round(density * speed * 2); // 2 carriles aprox.
}

/**
 * Convierte polyline [[lat, lng], ...] del data file a [{x: lng, y: lat}, ...]
 * que es lo que espera RoadCanvas (su sistema asume x=lng, y=lat).
 */
function toCanvasPolyline(polyline) {
  if (!Array.isArray(polyline)) return [];
  return polyline
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .map(([lat, lng]) => ({ x: lng, y: lat }));
}

/**
 * Elige 3 micropuntos representativos del segmento (no peajes, no cabeceras).
 * Cada micropunto es una ventana del 8% del trazado, centrada en 30%, 50% y 70%
 * — disjuntos entre sí y lejos de los extremos del segmento.
 *
 * Cada micropunto lleva:
 *   - id        ('P1' | 'P2' | 'P3')
 *   - label     ('Tramo norte' | 'Tramo central' | 'Tramo sur')
 *   - center    [lat, lng]
 *   - polyline  [[lat, lng], ...] (rebanada del trazado detallado)
 */
function pickMicropoints(detailedGeometry, fallbackPolyline) {
  const source = (detailedGeometry && detailedGeometry.length > 16)
    ? detailedGeometry
    : fallbackPolyline;
  if (!Array.isArray(source) || source.length < 4) return [];
  const n = source.length;

  const windows = [
    { id: 'P1', label: 'Tramo norte',   centerPct: 0.30 },
    { id: 'P2', label: 'Tramo central', centerPct: 0.50 },
    { id: 'P3', label: 'Tramo sur',     centerPct: 0.70 },
  ];
  const halfWindow = 0.045; // ±4.5% del trazado por micropunto

  return windows
    .map(({ id, label, centerPct }) => {
      if (n >= 16) {
        const startIdx = Math.max(0, Math.floor(n * (centerPct - halfWindow)));
        const endIdx = Math.min(n - 1, Math.floor(n * (centerPct + halfWindow)));
        if (endIdx - startIdx < 2) return null;
        const slice = source.slice(startIdx, endIdx + 1);
        const center = slice[Math.floor(slice.length / 2)];
        return { id, label, center, polyline: slice };
      }
      // Fallback (sin geometría OSRM): sintetizar mini-curva alrededor del centerPct
      const idx = Math.min(n - 1, Math.max(0, Math.floor(n * centerPct)));
      const [lat, lng] = source[idx];
      const span = 0.025;
      const synthetic = [];
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const offsetLat = Math.sin(t * Math.PI - Math.PI / 2) * span * 0.35;
        const offsetLng = (t - 0.5) * span * 1.2;
        synthetic.push([lat + offsetLat, lng + offsetLng]);
      }
      return { id, label, center: [lat, lng], polyline: synthetic };
    })
    .filter(Boolean);
}

/**
 * Calcula bounds [[minLat, minLng], [maxLat, maxLng]] para FitBounds.
 */
function polylineBounds(polyline) {
  if (!Array.isArray(polyline) || polyline.length < 2) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lat, lng] of polyline) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  if (!Number.isFinite(minLat)) return null;
  // Margen para que no quede pegado al borde
  const padLat = Math.max((maxLat - minLat) * 0.15, 0.05);
  const padLng = Math.max((maxLng - minLng) * 0.15, 0.05);
  return [[minLat - padLat, minLng - padLng], [maxLat + padLat, maxLng + padLng]];
}

function FitBoundsToPolyline({ polyline }) {
  const map = useMap();
  React.useEffect(() => {
    const b = polylineBounds(polyline);
    if (b) map.fitBounds(b, { padding: [20, 20] });
  }, [map, polyline]);
  return null;
}

// ── Componente principal ─────────────────────────────────────────────

export default function LogisticsSegmentDetailPage() {
  const { corridorId, segmentId } = useParams();
  const navigate = useNavigate();

  const corridor = getLogisticsCorridorById(corridorId);
  const { snapshot } = useLogisticsData(corridor?.id);

  const segment = useMemo(() => {
    if (!corridor || !Array.isArray(corridor.segments)) return null;
    return corridor.segments.find((s) => s.id === segmentId) || null;
  }, [corridor, segmentId]);

  if (!corridor) return <Navigate to="/logistics" replace />;
  if (!segment) return <Navigate to={`/logistics/${corridor.id}`} replace />;

  const segSnap = snapshot?.segments?.[segment.id] || {};
  const liveIrt = segSnap.irt;
  const hasLiveData = (segSnap.tollsWithData ?? 0) > 0 && liveIrt != null;
  const irt = hasLiveData ? liveIrt : BASELINE_IRT;
  const level = hasLiveData
    ? getIRTLevel(liveIrt)
    : { label: 'FLUJO LIBRE', color: '#22c55e' };
  const speed = deriveSpeed(segSnap, segment);
  const jamLevel = irtToJamLevel(hasLiveData ? liveIrt : null);
  const estimatedFlow = estimateFlow(jamLevel, speed);

  // Geometría real de la vía (OSRM público) con cache + fallback graceful.
  const { geometry: roadGeometry } = useOsrmGeometry(segment.polyline);

  // Tres micropuntos representativos del segmento (no peajes, no cabeceras).
  const micropoints = useMemo(
    () => pickMicropoints(roadGeometry, segment.polyline),
    [roadGeometry, segment.polyline],
  );

  const fromNode = corridor.nodes?.find((n) => n.id === segment.fromNodeId);
  const toNode = corridor.nodes?.find((n) => n.id === segment.toNodeId);

  return (
    <div className="min-h-screen text-slate-200" style={{ backgroundColor: '#06111e' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={{
          backgroundColor: 'rgba(6, 17, 30, 0.85)',
          borderColor: '#1a2d4a',
          height: 56,
        }}
      >
        <div className="max-w-[1600px] mx-auto h-full px-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/logistics/${corridor.id}`)}
            className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-200 transition-colors"
            style={MONO}
          >
            <ArrowLeft size={14} />
            {corridor.shortName}
          </button>
          <span className="text-[#1a2d4a]">·</span>
          <div className="flex items-center gap-2">
            <MapPin size={14} style={{ color: corridor.color }} />
            <span className="text-sm font-bold tracking-wide" style={MONO}>
              {segment.label}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-slate-500" style={MONO}>
              {segment.distanceKm} km · {segment.speedLimit || 80} km/h máx
            </span>
            <span
              className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase"
              style={{
                ...MONO,
                backgroundColor: level.color + '22',
                color: level.color,
                border: `1px solid ${level.color}44`,
              }}
            >
              {level.label}
            </span>
          </div>
        </div>
      </header>

      {/* KPI strip */}
      <div className="max-w-[1600px] mx-auto px-4 pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <KpiCell label="IRT" value={Math.round(irt)} color={level.color} />
          <KpiCell label="Velocidad" value={`${Math.round(speed)} km/h`} icon={Gauge} />
          <KpiCell
            label="Flujo"
            value={`${hasLiveData && segSnap.flow != null ? Math.round(segSnap.flow) : estimatedFlow} veh/h`}
            icon={TrendingUp}
          />
          <KpiCell
            label="Peajes en tramo"
            value={`${segment.tollRefs?.length || 0}`}
          />
        </div>
      </div>

      {/* Dos columnas: Mapa + Canvas */}
      <main className="max-w-[1600px] mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Mapa */}
          <section
            className="rounded-lg border overflow-hidden"
            style={{ ...CARD, borderColor: '#1a2d4a' }}
          >
            <div
              className="px-3 py-2 border-b text-[9px] uppercase tracking-widest text-slate-400 flex items-center gap-2"
              style={{ borderColor: '#1a2d4a', ...MONO }}
            >
              <MapPin size={11} />
              <span>Geometría real del tramo</span>
              <span className="ml-auto text-slate-500">
                {fromNode?.name || segment.fromNodeId} → {toNode?.name || segment.toNodeId}
              </span>
            </div>
            <div style={{ height: 460, backgroundColor: '#0a0e17' }}>
              <MapContainer
                center={[(roadGeometry?.[0]?.[0] || 4.6), (roadGeometry?.[0]?.[1] || -74.1)]}
                zoom={9}
                scrollWheelZoom
                preferCanvas
                style={{ height: '100%', width: '100%', backgroundColor: '#0a0e17' }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                />
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
                />
                {/* Halo del tramo */}
                <Polyline
                  positions={roadGeometry}
                  pathOptions={{
                    color: level.color,
                    weight: 10,
                    opacity: 0.18,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                {/* Tramo principal con la geometría real */}
                <Polyline
                  positions={roadGeometry}
                  pathOptions={{
                    color: level.color,
                    weight: 4,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                >
                  <Tooltip sticky>
                    {segment.label} · IRT {irt != null ? Math.round(irt) : '—'}
                  </Tooltip>
                </Polyline>
                {/* 3 micropuntos representativos resaltados sobre la vía */}
                {micropoints.map((mp) => (
                  <React.Fragment key={mp.id}>
                    <Polyline
                      positions={mp.polyline}
                      pathOptions={{
                        color: '#fde047',
                        weight: 6,
                        opacity: 0.95,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    >
                      <Tooltip sticky>{mp.label}</Tooltip>
                    </Polyline>
                    <CircleMarker
                      center={mp.center}
                      radius={8}
                      pathOptions={{
                        color: '#fde047',
                        fillColor: '#0a0e17',
                        fillOpacity: 0.95,
                        weight: 2.5,
                      }}
                    >
                      <Tooltip permanent direction="top" offset={[0, -8]}>
                        <span style={{ ...MONO, fontSize: 10 }}>{mp.id}</span>
                      </Tooltip>
                    </CircleMarker>
                  </React.Fragment>
                ))}
                {/* Marcadores en los nodos */}
                {fromNode && (
                  <CircleMarker
                    center={[fromNode.lat, fromNode.lng]}
                    radius={6}
                    pathOptions={{ color: corridor.color, fillColor: corridor.color, fillOpacity: 0.9, weight: 2 }}
                  >
                    <Tooltip>{fromNode.name}</Tooltip>
                  </CircleMarker>
                )}
                {toNode && (
                  <CircleMarker
                    center={[toNode.lat, toNode.lng]}
                    radius={6}
                    pathOptions={{ color: corridor.color, fillColor: corridor.color, fillOpacity: 0.9, weight: 2 }}
                  >
                    <Tooltip>{toNode.name}</Tooltip>
                  </CircleMarker>
                )}
                <FitBoundsToPolyline polyline={roadGeometry} />
              </MapContainer>
            </div>
          </section>

          {/* Tres micropuntos cinemáticos */}
          <section
            className="rounded-lg border overflow-hidden flex flex-col"
            style={{ ...CARD, borderColor: '#1a2d4a' }}
          >
            <div
              className="px-3 py-2 border-b text-[9px] uppercase tracking-widest text-slate-400 flex items-center gap-2"
              style={{ borderColor: '#1a2d4a', ...MONO }}
            >
              <Crosshair size={11} style={{ color: '#fde047' }} />
              <span>Micropuntos del tramo</span>
              <span className="ml-auto text-slate-500">{Math.round(speed)} km/h</span>
            </div>
            <div className="grid grid-cols-1 gap-px" style={{ backgroundColor: '#1a2d4a' }}>
              {micropoints.length > 0 ? (
                micropoints.map((mp) => (
                  <div key={mp.id} style={{ height: 146, backgroundColor: '#0a0e17', position: 'relative' }}>
                    <div
                      className="absolute top-1.5 left-2 z-10 px-1.5 py-0.5 rounded text-[8px] tracking-widest uppercase"
                      style={{
                        ...MONO,
                        backgroundColor: 'rgba(253, 224, 71, 0.12)',
                        color: '#fde047',
                        border: '1px solid rgba(253, 224, 71, 0.3)',
                      }}
                    >
                      {mp.id} · {mp.label}
                    </div>
                    <MicropointCanvas speed={speed} irt={irt} />
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center text-slate-500 text-xs" style={{ height: 460, ...MONO }}>
                  Cargando geometría del tramo…
                </div>
              )}
            </div>
            <div
              className="px-3 py-2 border-t flex items-center gap-4 text-[9px] uppercase tracking-widest text-slate-500"
              style={{ borderColor: '#1a2d4a', ...MONO }}
            >
              <LegendDot color="#3b82f6" label="Auto" />
              <LegendDot color="#ef4444" label="Camión" />
              <LegendDot color="#10b981" label="Moto" />
              <span className="ml-auto">{level.label}</span>
            </div>
          </section>
        </div>

        {/* Departamentos / referencias */}
        {Array.isArray(segment.departments) && segment.departments.length > 0 && (
          <div className="mt-4 text-[10px] uppercase tracking-widest text-slate-500" style={MONO}>
            Departamentos atravesados: {segment.departments.join(' · ')}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────

function KpiCell({ label, value, color, icon: Icon }) {
  return (
    <div
      className="rounded-lg border px-3 py-2 flex items-center gap-3"
      style={CARD}
    >
      {Icon && <Icon size={16} className="text-slate-500" />}
      <div className="flex-1 min-w-0">
        <div className="text-[8px] uppercase tracking-widest text-slate-500" style={MONO}>
          {label}
        </div>
        <div
          className="text-base font-bold tabular-nums truncate"
          style={{ ...MONO, color: color || '#e2e8f0' }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-2 h-2 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </span>
  );
}
