import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DeckGL from '@deck.gl/react';
import { HexagonLayer, HeatmapLayer } from '@deck.gl/aggregation-layers';
import { IconLayer, ScatterplotLayer } from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import { ArrowLeft, Clock, ShieldAlert, Navigation, Radio, Play, Pause } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

// Fallback data en caso de que el procesador excel siga corriendo
import fallbackData from '../../data/hotspots_processed.json';

const ICON_MAPPING = {
  MOTO: { x: 0, y: 0, width: 128, height: 128, mask: true },
  PEATON: { x: 128, y: 0, width: 128, height: 128, mask: true },
  AUTO: { x: 256, y: 0, width: 128, height: 128, mask: true },
  CAMION: { x: 384, y: 0, width: 128, height: 128, mask: true }
};

// SVG Atlas (iconos minimalistas neón)
const ICON_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDUxMiAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNjQiIGN5PSI2NCIgcj0iNDAiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iOCIvPjxwYXRoIGQ9Ik0xOTIgMjRMMTkyIDEwNE0xNjIgNjRMMjIyIDY0IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjgiLz48cmVjdCB4PSIzMjAiIHk9IjI0IiB3aWR0aD0iNjQiIGhlaWdodD0iODAiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iOCIvPjxwYXRoIGQ9Ik00NDggMjRMLTQ0OCAxMDQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iOCIvPjwvc3ZnPg==';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const INITIAL_VIEW_STATE = {
  longitude: -74.08,
  latitude: 4.60,
  zoom: 6,
  pitch: 45,
  bearing: -20
};

const VEHICLE_LABELS = {
  MOTO: 'MOTOCICLETA',
  PEATON: 'PEATÓN',
  AUTO: 'AUTOMÓVIL',
  BUS: 'BUS',
  CAMION: 'CAMIÓN',
  BICICLETA: 'BICICLETA'
};

const VEHICLE_EMOJIS = {
  MOTO: '🏍️',
  PEATON: '🚶‍♂️',
  AUTO: '🚗',
  BUS: '🚌',
  CAMION: '🚛',
  BICICLETA: '🚴'
};


const colorRange = [
  [10, 20, 40],
  [210, 150, 40],
  [230, 80, 20],
  [250, 40, 20],
  [255, 0, 0]
];

export default function AccidentAnalyzer() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [hourFilter, setHourFilter] = useState(-1); // -1 means All
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [pulse, setPulse] = useState(0);
  const [vehicleFilter, setVehicleFilter] = useState('ALL');
  const [wazeAlerts, setWazeAlerts] = useState([]);
  const [showWaze, setShowWaze] = useState(true);
  const audioRef = useRef(null);
  const lastAccidentIds = useRef(new Set());

  // Conexión WebSocket para Tiempo Real
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Conectar al mismo host y puerto en el que corre el frontend (puerto 3000 en el server.js de produccion)
    const wsUrl = `${protocol}//${window.location.host}/api/traffic`;
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'traffic_update' && msg.wazeAccidents) {
        setWazeAlerts(msg.wazeAccidents);
        
        // Lógica de Alerta Sonora (Solo para NUEVOS accidentes)
        const currentIds = new Set(msg.wazeAccidents.map(a => a.id));
        const newAccidents = msg.wazeAccidents.filter(a => !lastAccidentIds.current.has(a.id));
        
        if (newAccidents.length > 0 && lastAccidentIds.current.size > 0) {
          if (audioRef.current) {
            audioRef.current.play().catch(e => console.log('Audio playback blocked'));
          }
        }
        lastAccidentIds.current = currentIds;
      }
    };

    return () => ws.close();
  }, []);
  
  useEffect(() => {
    // Intentar leer la base purificada histórica evadiendo caché cache-buster
    fetch('/data/accidentes_ditra_3d_clean.json?t=' + new Date().getTime())
      .then(res => res.json())
      .then(json => setData(json))
      .catch((e) => {
         console.warn("No hay datos históricos disponibles. Limpiando capa (solo Waze operando).");
         setData([]); // No más datos de broma
      });
  }, []);

  // Motor de Animación Horaria
  useEffect(() => {
    let interval;
    if (isAnimating) {
      // Inicia en la hora actual o la 0 si venimos de 'Todo el día'
      if (hourFilter === -1) setHourFilter(0);
      
      interval = setInterval(() => {
        setHourFilter(prev => {
          if (prev >= 23) return 0;
          return prev + 1;
        });
      }, 1200); // 1.2 segundos por Frame (hora)
    }
    return () => clearInterval(interval);
  }, [isAnimating, hourFilter]);

  // Motor de Palpitación Waze (Respiración 3D Continua)
  useEffect(() => {
    let frameId;
    const animatePulse = () => {
      setPulse(Math.sin(Date.now() / 400)); // Oscilación fluida (-1 a 1)
      frameId = requestAnimationFrame(animatePulse);
    };
    animatePulse();
    return () => cancelAnimationFrame(frameId);
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(d => {
      // Usar filtro ACUMULATIVO para mostrar distribución real construyéndose durante el ciclo diario (Animation Marea)
      if (hourFilter !== -1 && d.horaNum > hourFilter) return false;
      if (vehicleFilter !== 'ALL' && d.vehiculo !== vehicleFilter) return false;
      return true;
    });
  }, [data, hourFilter, vehicleFilter]);

  const layers = [
    // CAPA HISTÓRICA: Mapa de Calor Táctico DITRA (Últimos 3 Meses)
    new HeatmapLayer({
      id: 'heatmap-layer',
      data: filteredData,
      getPosition: d => [d.lng, d.lat],
      getWeight: d => d.weight || 1,
      radiusPixels: 45, // Crea nubes grandes y difuminadas orgánicas
      intensity: 1.5,
      threshold: 0.05,
      colorRange: [
        [2, 6, 23, 0],         // Fondo slate
        [8, 145, 194],         // Borde de la nube (cian oscuro)
        [6, 182, 212],         // Cyan brillante
        [234, 179, 8],         // Alerta amarilla (centro)
        [248, 113, 113]        // Fatalidad (fuego blanco-rojizo en el epicentro)
      ]
    }),

    // CAPA HISTÓRICA: Micro-Constelación (Para Perfilamiento de Accidentes)
    new ScatterplotLayer({
      id: 'ditra-tooltip-layer',
      data: filteredData,
      pickable: true,
      opacity: 0.3,
      stroked: false,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 2,
      radiusMaxPixels: 5,
      lineWidthMinPixels: 0,
      getPosition: d => [d.lng, d.lat],
      getFillColor: [6, 182, 212, 100], // Cyan transparente
      onHover: info => setHoverInfo(info.object ? info : null)
    }),

    // CAPA: Waze Hexagon Agregado (Altura por cantidad de incidentes en la misma zona)
    showWaze && new HexagonLayer({
      id: 'waze-hexagon-layer',
      data: wazeAlerts,
      pickable: true,
      extruded: true,
      radius: 2000, // Agrupa alertas que estén a 2km a la redonda
      elevationScale: showWaze ? 50 + (pulse * 15) : 50, // Efecto Palpitante (Respira entre 35 y 65)
      getPosition: d => [d.lng, d.lat],
      colorRange: [
        [153, 27, 27, 180],   // Rojo oscuro
        [220, 38, 38, 200],   // Rojo pilar
        [239, 68, 68, 255],   // Rojo brillante (muchos incidentes)
      ],
      material: {
        ambient: 0.8,
        diffuse: 0.5,
        shininess: 32,
        specularColor: [255, 0, 0]
      }
    }),

    // CAPA: Waze Live Accidents (Puntos Tácticos Limpios en el suelo)
    showWaze && new ScatterplotLayer({
      id: 'waze-layer',
      data: wazeAlerts,
      pickable: true,
      opacity: 0.9,
      stroked: true,
      filled: true,
      radiusScale: showWaze ? 1 + (pulse * 0.3) : 1, // El anillo base respira
      radiusMinPixels: 5,
      radiusMaxPixels: 20,
      lineWidthMinPixels: 2 + (pulse * 1.5), // Borde late
      getPosition: d => [d.lng, d.lat],
      getFillColor: [239, 68, 68, 220], // Rojo táctico brillante
      getLineColor: [255, 255, 255, 255], // Borde blanco (contraste)
      transitions: { 
        getElevationWeight: { type: 'spring', stiffness: 0.05, damping: 0.2, enter: d => [0] }
      }
    })
  ].filter(Boolean);

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-200 overflow-hidden font-mono selection:bg-cyan-500/30">
      {/* GLOW OVERLAY BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-20" 
           style={{ background: 'radial-gradient(circle at center, #0ea5e9, transparent 80%)' }} />

      {/* HEADER */}
      <header className="flex-shrink-0 h-14 flex items-center px-4 border-b z-40 bg-[#020617]/95" style={{ borderColor: '#1e293b' }}>
        <button onClick={() => navigate('/monitor')} className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-all text-xs mr-6 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
          <span className="tracking-widest">MONITOR NEXUS</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30">
            <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest text-[#f8fafc] uppercase leading-none mb-1">
              Inteligencia 3D Accidentabilidad
            </h1>
            <div className="text-[9px] text-[#64748b] tracking-tighter uppercase font-bold">
              Análisis Predictivo de Riesgo · DITRA · Semana Santa 2026
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Muestra de Datos</span>
            <span className="text-xs font-bold text-cyan-400 tabular-nums">
              {filteredData.length.toLocaleString('es-CO')} REGISTROS
            </span>
          </div>
        </div>
      </header>

      {/* DASHBOARD + MAPA */}
      <div className="flex-1 relative flex">
        {/* SIDEBAR TÁCTICA */}
        <aside className="w-80 bg-[#0f172a]/80 backdrop-blur-xl border-r border-[#1e293b] flex flex-col p-5 z-40 shadow-2xl overflow-y-auto">
          <h2 className="text-[10px] uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2 font-bold">
            <Navigation className="w-3 h-3 text-cyan-500" /> Parámetros de Simulación
          </h2>

          <div className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <label className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Relieve por Horario</label>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-bold border border-cyan-500/20">
                {hourFilter === -1 ? 'TODO EL DÍA' : `${hourFilter}:00 HS`}
              </span>
            </div>
            <div className="px-1">
              <input 
                type="range" 
                min="-1" 
                max="23" 
                step="1"
                value={hourFilter} 
                onChange={(e) => setHourFilter(parseInt(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer h-1 bg-slate-800 rounded-lg appearance-none" 
              />
              <div className="flex justify-between text-[8px] text-slate-600 mt-2 font-mono uppercase">
                <span>Madrugada</span>
                <span>Mediodía</span>
                <span>Noche</span>
              </div>
              <button 
                onClick={() => setIsAnimating(!isAnimating)}
                className={`mt-4 w-full flex items-center justify-center gap-2 py-2 rounded border uppercase tracking-widest text-[9px] font-bold transition-all duration-300 ${
                  isAnimating 
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)] animate-pulse'
                    : 'bg-[#0f172a] text-slate-400 border-slate-700 hover:bg-slate-800'
                }`}
              >
                {isAnimating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {isAnimating ? 'Animando...' : 'Animar Ciclo (24h)'}
              </button>
            </div>
          </div>

          <div className="mb-10">
            <label className="text-[9px] text-slate-400 mb-4 block uppercase font-black tracking-widest">Matriz de Riesgo por Actor</label>
            <div className="grid grid-cols-2 gap-2.5">
              {['ALL', 'MOTO', 'PEATON', 'AUTO', 'CAMION'].map(veh => (
                <button
                  key={veh}
                  onClick={() => setVehicleFilter(veh)}
                  className={`py-3 text-[9px] font-black rounded-lg border transition-all duration-300 transform active:scale-95 flex flex-col items-center gap-1.5 ${vehicleFilter === veh ? 'bg-gradient-to-br from-cyan-600/20 to-cyan-500/10 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_-5px_rgba(6,182,212,0.5)]' : 'bg-[#020617]/50 text-slate-500 border-slate-800/50 hover:bg-slate-800/80 hover:text-slate-300'}`}
                >
                  <span className="text-xl opacity-80">{veh === 'ALL' ? '📡' : VEHICLE_EMOJIS[veh]}</span>
                  {veh === 'ALL' ? 'GLOBAL' : veh}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mt-auto space-y-4">
            <div className={`p-3 rounded-lg border transition-all ${showWaze ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-800/30 border-slate-700/50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className={`w-3 h-3 ${showWaze ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
                  <span className={`text-[9px] font-black tracking-widest ${showWaze ? 'text-cyan-400' : 'text-slate-600'}`}>GEMELO DIGITAL - MINISTERIO DE TRANSPORTE</span>
                </div>
                <button 
                  onClick={() => setShowWaze(!showWaze)}
                  className={`w-8 h-4 rounded-full relative transition-colors ${showWaze ? 'bg-cyan-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${showWaze ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
              <p className="text-[8px] text-slate-500 mt-2 font-bold uppercase tracking-tighter">
                {wazeAlerts.length} Incidentes Activos en Tiempo Real
              </p>
            </div>

            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-[9px] font-black text-red-400 tracking-wider">PROTOCOLO DE RIESGO</span>
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed font-bold italic">
                Cualquier pilar con altura superior a los 300m (Hexagon Extruded) denota una zona negra de alta fatalidad. Priorizar patrullaje DITRA en estos puntos.
              </p>
            </div>
            
            <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" preload="auto" />
            
            <p className="text-[10px] text-slate-700 text-center uppercase tracking-tighter">
              VIITS ANALYTICS ENGINE · v2.2
            </p>
          </div>
        </aside>

        {/* 3D MAP WRAPPER */}
        <div className="flex-1 relative bg-black shadow-inner">
          <DeckGL
            initialViewState={INITIAL_VIEW_STATE}
            controller={{ doubleClickZoom: false, touchRotate: true }}
            layers={layers}
            getTooltip={({object}) => {
              if (!object) return null;
              if (object.count) { // HexagonLayer
                return {
                  html: `<div style="padding: 12px; background: rgba(15, 23, 42, 0.9); border: 1px solid #1e293b; border-radius: 8px; font-family: monospace;">
                    <div style="color: #64748b; font-size: 10px; font-weight: bold; margin-bottom: 4px;">ZONA DE RIESGO (DITRA)</div>
                    <div style="color: #f8fafc; font-size: 14px; font-weight: bold;">HISTÓRICO: ${object.count} INCIDENCIAS</div>
                    <div style="color: #ef4444; font-size: 11px; margin-top: 4px;">PRIORIDAD: ${object.count > 5 ? 'CRÍTICA' : 'ALTA'}</div>
                  </div>`,
                  style: { backgroundColor: 'transparent' }
                };
              }
              if (object.type) { // Waze Alert
                return {
                  html: `<div style="padding: 12px; background: rgba(15, 23, 42, 0.9); border: 2px solid #ef4444; border-radius: 8px; font-family: monospace;">
                    <div style="color: #ef4444; font-size: 10px; font-weight: bold; margin-bottom: 4px;">⚠️ ALERTA GEMELO DIGITAL - MINISTERIO DE TRANSPORTE</div>
                    <div style="color: #f8fafc; font-size: 14px; font-weight: bold;">${object.type}</div>
                    <div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">CALLE: ${object.street || 'No identificada'}</div>
                  </div>`,
                  style: { backgroundColor: 'transparent' }
                };
              }
              return null;
            }}
          >
            <Map mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" />
          </DeckGL>
        {/* TOOLTIP DINÁMICO HISTÓRICO */}
        {hoverInfo && hoverInfo.object && (
          <div className="absolute z-50 pointer-events-none p-3 rounded-lg border border-cyan-500/50 bg-[#0f172a]/95 backdrop-blur-md shadow-2xl shadow-cyan-500/20 text-slate-200"
               style={{ left: hoverInfo.x + 15, top: hoverInfo.y + 15 }}>
            <h3 className="text-[10px] font-black tracking-widest uppercase text-cyan-400 mb-1 border-b border-slate-700 pb-1">
              Perfil DITRA: {hoverInfo.object.vehiculo}
            </h3>
            <div className="text-[10px] grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-slate-500">HORARIO:</span>
              <span className="font-bold text-white">{hoverInfo.object.horaNum}:00 hs</span>
              <span className="text-slate-500">GRAVEDAD:</span>
              <span className="font-bold text-white text-right">{hoverInfo.object.weight > 3 ? 'CRÍTICO 🚨' : 'MODERADO'}</span>
              <span className="text-slate-500">FALLECIDOS:</span>
              <span className="font-bold text-red-400 tabular-nums">{hoverInfo.object.muertos}</span>
              <span className="text-slate-500">LESIONADOS:</span>
              <span className="font-bold text-orange-400 tabular-nums">{hoverInfo.object.lesionados}</span>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
