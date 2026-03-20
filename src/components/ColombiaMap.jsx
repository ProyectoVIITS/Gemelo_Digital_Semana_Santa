import React, { useMemo, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getNivelAlerta } from '../utils/irtEngine';
import BlockageMarkers from './BlockageMarkers';

const CITIES = [
  { name: 'Bogotá D.C.', coords: [4.711, -74.072], isCapital: true },
  { name: 'Medellín', coords: [6.251, -75.563], isCapital: false },
  { name: 'Girardot', coords: [4.302, -74.804], isCapital: false },
  { name: 'Villavicencio', coords: [4.142, -73.626], isCapital: false },
  { name: 'Santa Marta', coords: [11.241, -74.199], isCapital: false },
  { name: 'Barranquilla', coords: [10.964, -74.781], isCapital: false },
  { name: 'Cartagena', coords: [10.391, -75.514], isCapital: false },
];

const MAP_CENTER = [7.0, -74.5];
const MAP_ZOOM = 6;

/**
 * Vehicle Flow Simulation using native Leaflet circle markers.
 * Uses L.circleMarker for guaranteed visibility on the map.
 * Vehicles slow down near blockage points.
 */
function VehicleFlowSimulation({ corridor, irt, volume, velocidad }) {
  const map = useMap();
  const markersRef = useRef([]);
  const vehiclesRef = useRef([]);
  const animRef = useRef(null);

  // Build route from salida point onward (not from Bogotá)
  const { routePositions, blockageZones } = useMemo(() => {
    const fullPath = [corridor.geoStart, ...corridor.geoWaypoints, corridor.geoEnd];

    // Find the "salida" blockage point — vehicles start from there
    const salidaBp = corridor.blockagePoints?.find(bp => bp.type === 'salida');
    let startIdx = 0;

    if (salidaBp) {
      // Find which segment the salida is closest to
      let minDist = Infinity;
      fullPath.forEach((p, i) => {
        const d = Math.sqrt(Math.pow(p[0] - salidaBp.coords[0], 2) + Math.pow(p[1] - salidaBp.coords[1], 2));
        if (d < minDist) { minDist = d; startIdx = i; }
      });
      // Route starts from salida coords, then continues along the rest
      const routePositions = [salidaBp.coords, ...fullPath.slice(startIdx + 1)];

      // Calculate blockage zones relative to this trimmed route
      const zones = (corridor.blockagePoints || [])
        .filter(bp => bp.type !== 'salida') // Exclude salida itself
        .map(bp => {
          let minD = Infinity;
          let segI = 0;
          routePositions.forEach((p, i) => {
            const d = Math.sqrt(Math.pow(p[0] - bp.coords[0], 2) + Math.pow(p[1] - bp.coords[1], 2));
            if (d < minD) { minD = d; segI = i; }
          });
          return { ...bp, segmentProgress: segI / (routePositions.length - 1) };
        });

      return { routePositions, blockageZones: zones };
    }

    // No salida found — use full path
    const zones = (corridor.blockagePoints || []).map(bp => {
      let minD = Infinity;
      let segI = 0;
      fullPath.forEach((p, i) => {
        const d = Math.sqrt(Math.pow(p[0] - bp.coords[0], 2) + Math.pow(p[1] - bp.coords[1], 2));
        if (d < minD) { minD = d; segI = i; }
      });
      return { ...bp, segmentProgress: segI / (fullPath.length - 1) };
    });

    return { routePositions: fullPath, blockageZones: zones };
  }, [corridor]);

  useEffect(() => {
    const alerta = getNivelAlerta(irt);
    // Speed proportional to actual velocity — dramatic difference between free flow and congestion
    const freeFlow = corridor.freeFlowSpeedKmh || 80;
    const speedRatio = Math.max(0.03, (velocidad || freeFlow) / freeFlow);
    // Amplify the difference: square the ratio so congestion is VERY slow
    const baseSpeed = Math.pow(speedRatio, 1.5) * 1.0;
    const vehicleCount = Math.min(Math.max(Math.floor(volume / 150), 8), 30);

    // Initialize vehicles — only travel forward (0→1), respawn at 0
    vehiclesRef.current = Array.from({ length: vehicleCount }, (_, i) => ({
      progress: i / vehicleCount,
    }));

    // Create Leaflet circle markers for each vehicle
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = vehiclesRef.current.map(() => {
      const glow = L.circleMarker([0, 0], {
        radius: 6,
        color: 'transparent',
        weight: 0,
        fillColor: '#00ffff',
        fillOpacity: 0.3,
        pane: 'markerPane',
      }).addTo(map);
      const marker = L.circleMarker([0, 0], {
        radius: 3,
        color: '#00e5ff',
        weight: 1.5,
        fillColor: '#ffffff',
        fillOpacity: 1,
        opacity: 1,
        pane: 'markerPane',
      }).addTo(map);
      return { marker, glow };
    });

    function getSpeedAtProgress(p) {
      let speed = baseSpeed;
      for (const bz of blockageZones) {
        const dist = Math.abs(p - bz.segmentProgress);
        if (dist < 0.15) {
          const proximity = 1 - (dist / 0.15);
          // Much stronger slowdown near blockage: nearly stop at high IRT
          const reduction = bz.capacityReduction * proximity * Math.min(irt / 60, 1.5);
          speed *= Math.max(0.02, 1 - reduction);
        }
      }
      // Global IRT slowdown on top of blockage zones
      if (irt > 70) {
        speed *= Math.max(0.15, 1 - (irt - 70) / 100);
      }
      return speed;
    }

    function getPointAtProgress(t) {
      const total = routePositions.length - 1;
      const idx = t * total;
      const i = Math.min(Math.floor(idx), total - 1);
      const frac = idx - i;
      const a = routePositions[i];
      const b = routePositions[Math.min(i + 1, routePositions.length - 1)];
      return L.latLng(a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac);
    }

    function animate() {
      const vehicles = vehiclesRef.current;
      const markers = markersRef.current;

      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        const segSpeed = getSpeedAtProgress(v.progress);
        v.progress += segSpeed * 0.0015;
        // Respawn at start when reaching the end
        if (v.progress >= 1) v.progress = 0;

        const ll = getPointAtProgress(v.progress);
        markers[i].marker.setLatLng(ll);
        markers[i].glow.setLatLng(ll);

        const isCongested = segSpeed < baseSpeed * 0.4;
        if (isCongested) {
          markers[i].marker.setStyle({
            radius: 4,
            fillColor: '#ff4444',
            color: '#ff0000',
            weight: 1.5,
            fillOpacity: 1,
          });
          markers[i].glow.setStyle({
            radius: 8,
            fillColor: '#ff0000',
            fillOpacity: 0.45,
          });
        } else {
          markers[i].marker.setStyle({
            radius: 3,
            fillColor: '#ffffff',
            color: '#00e5ff',
            weight: 1.5,
            fillOpacity: 1,
          });
          markers[i].glow.setStyle({
            radius: 6,
            fillColor: '#00ffff',
            fillOpacity: 0.3,
          });
        }
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      markersRef.current.forEach(m => {
        map.removeLayer(m.marker);
        map.removeLayer(m.glow);
      });
      markersRef.current = [];
    };
  }, [map, routePositions, irt, volume, velocidad, blockageZones, corridor.freeFlowSpeedKmh]);

  return null;
}

function FitBoundsOnSelect({ corridors, selectedCorridor }) {
  const map = useMap();
  useEffect(() => {
    if (selectedCorridor) {
      const c = corridors.find(c => c.id === selectedCorridor);
      if (c) {
        const allPts = [c.geoStart, ...c.geoWaypoints, c.geoEnd];
        if (c.blockagePoints) {
          c.blockagePoints.forEach(bp => allPts.push(bp.coords));
        }
        map.fitBounds(allPts, { padding: [50, 50], maxZoom: 10, animate: true });
      }
    } else {
      map.setView(MAP_CENTER, MAP_ZOOM, { animate: true });
    }
  }, [selectedCorridor, corridors, map]);
  return null;
}

function CorridorLayer({ corridor, irt, isSelected, onSelect }) {
  const alerta = getNivelAlerta(irt);
  const color = alerta.color;
  const positions = [corridor.geoStart, ...corridor.geoWaypoints, corridor.geoEnd];

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{
          color, weight: isSelected ? 10 : 6, opacity: 0.25,
          lineCap: 'round', lineJoin: 'round',
        }}
        eventHandlers={{ click: () => onSelect(corridor.id) }}
      />
      <Polyline
        positions={positions}
        pathOptions={{
          color, weight: isSelected ? 5 : 3, opacity: 0.9,
          lineCap: 'round', lineJoin: 'round',
        }}
        eventHandlers={{ click: () => onSelect(corridor.id) }}
      />
      {corridor.geoCriticalPoints.map((cp) => (
        <CircleMarker
          key={cp.name}
          center={cp.coords}
          radius={irt > 65 ? 6 : 4}
          pathOptions={{
            color: '#0a0f1e', weight: 1.5,
            fillColor: color, fillOpacity: irt > 65 ? 0.9 : 0.7,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} className="viits-tooltip" permanent={isSelected}>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>{cp.name}</span>
            <br />
            <span style={{ fontSize: '10px', color }}>IRT {Math.round(irt)}</span>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

export default function ColombiaMap({ corridors, irtValues, selectedCorridor, onSelectCorridor, corridorMetrics }) {
  const legend = useMemo(() => [
    { label: 'Flujo Normal', range: '0-40', color: '#10b981' },
    { label: 'Precaución', range: '41-65', color: '#f59e0b' },
    { label: 'Congestión', range: '66-80', color: '#f97316' },
    { label: 'Crítico', range: '81-90', color: '#ef4444' },
    { label: 'COLAPSO', range: '91+', color: '#7f1d1d' },
  ], []);

  const blockageLegend = useMemo(() => [
    { label: 'Peaje', symbol: 'P', color: '#f59e0b' },
    { label: 'Congestión vía', symbol: '!', color: '#f97316' },
    { label: 'Salida urbana', symbol: 'S', color: '#ef4444' },
    { label: 'Túnel', symbol: 'T', color: '#8b5cf6' },
  ], []);

  const selectedCorridorObj = selectedCorridor ? corridors.find(c => c.id === selectedCorridor) : null;
  const selectedMetrics = selectedCorridor && corridorMetrics ? corridorMetrics[selectedCorridor] : null;
  const selectedVolume = selectedMetrics?.volume || 0;

  return (
    <div className="relative w-full" style={{ height: '520px' }}>
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%', background: '#0a0f1e' }}
        minZoom={5}
        maxZoom={13}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OSM &copy; CARTO'
        />

        <FitBoundsOnSelect corridors={corridors} selectedCorridor={selectedCorridor} />

        {corridors.map(corridor => (
          <CorridorLayer
            key={corridor.id}
            corridor={corridor}
            irt={irtValues[corridor.id] || 0}
            isSelected={selectedCorridor === corridor.id}
            onSelect={(id) => onSelectCorridor(id === selectedCorridor ? null : id)}
          />
        ))}

        {/* Vehicle flow simulation for selected corridor */}
        {selectedCorridorObj && selectedMetrics && (
          <VehicleFlowSimulation
            corridor={selectedCorridorObj}
            irt={irtValues[selectedCorridor] || 0}
            volume={selectedVolume}
            velocidad={selectedMetrics.velocidad}
          />
        )}

        {/* Blockage markers for selected corridor */}
        {selectedCorridorObj && (
          <BlockageMarkers
            corridor={selectedCorridorObj}
            irt={irtValues[selectedCorridor] || 0}
          />
        )}

        {CITIES.map(city => (
          <CircleMarker
            key={city.name}
            center={city.coords}
            radius={city.isCapital ? 7 : 4}
            pathOptions={{
              color: city.isCapital ? '#f59e0b' : '#64748b',
              weight: 2,
              fillColor: city.isCapital ? '#f59e0b' : '#334155',
              fillOpacity: city.isCapital ? 0.9 : 0.7,
            }}
          >
            <Tooltip direction="right" offset={[10, 0]} permanent className="viits-city-tooltip">
              <span style={{
                fontSize: city.isCapital ? '12px' : '10px',
                fontWeight: city.isCapital ? 700 : 500,
                color: city.isCapital ? '#f59e0b' : '#94a3b8',
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              }}>
                {city.name}
              </span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* IRT Legend */}
      <div className="absolute bottom-3 left-3 bg-viits-card/90 border border-viits-border rounded-lg p-2.5 backdrop-blur-sm z-[500]">
        <div className="text-[10px] text-slate-400 font-semibold mb-1.5 tracking-wider">
          IRT — ÍNDICE DE RIESGO
        </div>
        {legend.map(item => (
          <div key={item.range} className="flex items-center gap-1.5 text-[9px] py-0.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-slate-500 font-mono">{item.range}</span>
            <span className="text-slate-300">{item.label}</span>
          </div>
        ))}
        {selectedCorridor && (
          <>
            <div className="border-t border-viits-border mt-1.5 pt-1.5">
              <div className="text-[10px] text-slate-400 font-semibold mb-1 tracking-wider">PUNTOS DE BLOQUEO</div>
            </div>
            {blockageLegend.map(item => (
              <div key={item.symbol} className="flex items-center gap-1.5 text-[9px] py-0.5">
                <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ backgroundColor: item.color }}>
                  {item.symbol}
                </div>
                <span className="text-slate-300">{item.label}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Corridor selector */}
      <div className="absolute top-3 right-3 bg-viits-card/90 border border-viits-border rounded-lg p-2.5 backdrop-blur-sm z-[500]">
        <div className="text-[10px] text-slate-400 font-semibold mb-1.5 tracking-wider">CORREDORES</div>
        {corridors.map(c => {
          const irt = irtValues[c.id] || 0;
          const alerta = getNivelAlerta(irt);
          const isActive = selectedCorridor === c.id;
          return (
            <div
              key={c.id}
              className={`flex items-center gap-2 py-0.5 cursor-pointer rounded px-1 transition-colors ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
              onClick={() => onSelectCorridor(c.id === selectedCorridor ? null : c.id)}
            >
              <div className="w-3 h-1 rounded-full" style={{ backgroundColor: alerta.color }} />
              <span className="text-[10px] text-slate-300">{c.name}</span>
              <span className="text-[10px] font-mono ml-auto" style={{ color: alerta.color }}>
                {Math.round(irt)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Vehicle count indicator when corridor selected */}
      {selectedCorridor && selectedMetrics && (
        <div className="absolute top-3 left-3 bg-viits-card/90 border border-viits-border rounded-lg px-3 py-2 backdrop-blur-sm z-[500]">
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">Simulación Vehicular</div>
          <div className="text-sm font-mono text-white font-bold">
            {selectedVolume.toLocaleString()} <span className="text-[10px] text-slate-400">veh/h</span>
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">
            <span className="font-mono" style={{ color: getNivelAlerta(selectedMetrics.irt).color }}>
              {Math.round(selectedMetrics.velocidad)} km/h
            </span>
            <span className="text-slate-600"> / {selectedCorridorObj.freeFlowSpeedKmh} km/h normal</span>
          </div>
          <div className="text-[9px] text-slate-600">
            {Math.min(Math.max(Math.floor(selectedVolume / 150), 8), 30)} vehículos simulados
          </div>
        </div>
      )}
    </div>
  );
}
