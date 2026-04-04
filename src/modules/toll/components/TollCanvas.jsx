/**
 * TollCanvas — Parameterized Canvas for any toll station
 * Modes: 'full' (340px, all details) | 'mini' (180px, compact)
 * Adapted from Peaje Chuzacá TollCanvas
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { getOperationMode } from '../../../utils/operationMode';

const VEHICLE_CATEGORIES = {
  M:  { name: 'Motocicleta',    color: '#4ade80', width: 12, height: 6,  speedFactor: 1.3, isMoto: true },
  C1: { name: 'Automóvil',     color: '#38bdf8', width: 22, height: 10, speedFactor: 1.0 },
  C2: { name: 'Bus',           color: '#f97316', width: 36, height: 12, speedFactor: 0.75 },
  C3: { name: 'Camión 2 ejes', color: '#a78bfa', width: 40, height: 13, speedFactor: 0.6 },
  C4: { name: 'Camión 3+ ejes',color: '#94a3b8', width: 48, height: 14, speedFactor: 0.5 },
  C5: { name: 'Camión pesado',  color: '#fbbf24', width: 56, height: 15, speedFactor: 0.4 },
};

// Distribución realista para carreteras nacionales de Colombia
// Fuente: INVÍAS/DITRA conteos volumétricos 2024-2025
const CATEGORY_WEIGHTS_DAY   = { M: 0.28, C1: 0.42, C2: 0.08, C3: 0.13, C4: 0.06, C5: 0.03 };
const CATEGORY_WEIGHTS_NIGHT = { M: 0.06, C1: 0.48, C2: 0.05, C3: 0.22, C4: 0.12, C5: 0.07 };

// ─── ÉXODO SEMANA SANTA: Vehículos particulares y buses dominan ───
// MinTransporte: 4M pasajeros, 336K vehículos desde terminales
// Muchos buses intermunicipales + particulares, pocos camiones
const CATEGORY_WEIGHTS_EXODO_DAY   = { M: 0.22, C1: 0.48, C2: 0.22, C3: 0.05, C4: 0.02, C5: 0.01 };
const CATEGORY_WEIGHTS_EXODO_NIGHT = { M: 0.08, C1: 0.52, C2: 0.18, C3: 0.12, C4: 0.06, C5: 0.04 };
// Éxodo pico AM (5-10h): salida masiva, buses máximos
const CATEGORY_WEIGHTS_EXODO_PEAK  = { M: 0.18, C1: 0.46, C2: 0.28, C3: 0.05, C4: 0.02, C5: 0.01 };
// ÉXODO PLENO pico (Jueves Santo 7-9AM, 14-16PM): máxima presión, 38% buses
const CATEGORY_WEIGHTS_EXODO_PLENO = { M: 0.16, C1: 0.42, C2: 0.38, C3: 0.03, C4: 0.01, C5: 0.00 };

// ─── RESTRICCIÓN DE CARGA PESADA ───
// Resolución MinTransporte: festivos y puentes, vehículos ≥3.4 ton restringidos
// 23 marzo 2026 (San José): 10:00 AM - 11:00 PM en corredor Chía-Mosquera-La Mesa-Girardot
// Semana Santa 2026: aplica misma restricción
// C3 (camión 2 ejes), C4 (camión 3+ ejes), C5 (camión pesado) NO circulan
// Excepciones: grúas de asistencia y transporte de leche (no modelados)
const CARGO_RESTRICTION_CALENDAR = {
  '2026-03-20': { start: 10, end: 23 }, // Viernes puente San José
  '2026-03-21': { start: 6, end: 23 },  // Sábado puente
  '2026-03-22': { start: 6, end: 23 },  // Domingo puente
  '2026-03-23': { start: 10, end: 23 }, // Lunes festivo San José
  // Semana Santa 2026 — Resolución MinTransporte
  // Restricción: vehículos ≥3.4 ton (C3/C4/C5) prohibidos en horarios especificados
  '2026-03-28': { start: 15, end: 22 }, // Viernes inicio éxodo — rutas Cundinamarca
  '2026-03-29': { start: 6, end: 15 },  // Sábado — red vial nacional
  '2026-04-01': { start: 12, end: 23 }, // Miércoles Santo — corredores éxodo
  '2026-04-02': { start: 6, end: 15 },  // Jueves Santo — red vial nacional
  '2026-04-04': { start: 14, end: 23 }, // Sábado de Gloria — corredor único
  '2026-04-05': { start: 10, end: 23 }, // Domingo Resurrección — red vial nacional
};

function getColHour() {
  return parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }), 10);
}

function getColDate() {
  const now = new Date();
  const y = now.toLocaleString('en-US', { year: 'numeric', timeZone: 'America/Bogota' });
  const m = now.toLocaleString('en-US', { month: '2-digit', timeZone: 'America/Bogota' });
  const d = now.toLocaleString('en-US', { day: '2-digit', timeZone: 'America/Bogota' });
  return `${y}-${m}-${d}`;
}

function isCargoRestricted() {
  const dateStr = getColDate();
  const restriction = CARGO_RESTRICTION_CALENDAR[dateStr];
  if (!restriction) return false;
  const hour = getColHour();
  return hour >= restriction.start && hour <= restriction.end;
}

// ─── DISTRIBUCIONES SEGÚN CONTEXTO ───
// RESTRICCIÓN DE CARGA: C3/C4/C5 en CERO ABSOLUTO (≥3.4 ton prohibidos)
// Resolución MinTransporte: ni un solo camión de carga durante restricción
const CATEGORY_WEIGHTS_RESTRICTED = { M: 0.32, C1: 0.56, C2: 0.12, C3: 0, C4: 0, C5: 0 };

// RETORNO + RESTRICCIÓN (23/mar pico mañana 10-14h): buses intermunicipales altos
// Terminal Bogotá: 184K viajeros, ~4000 despachos
const CATEGORY_WEIGHTS_RETORNO_RESTRICTED = { M: 0.30, C1: 0.48, C2: 0.22, C3: 0, C4: 0, C5: 0 };

// RETORNO + RESTRICCIÓN (6PM-12AM): 54.3% del flujo concentrado
// Máximo buses, motos bajan por oscuridad, CERO carga
const CATEGORY_WEIGHTS_RETORNO_PEAK = { M: 0.15, C1: 0.57, C2: 0.28, C3: 0, C4: 0, C5: 0 };

function pickCategory() {
  const hour = getColHour();
  const isNight = hour >= 22 || hour <= 5;
  const restricted = isCargoRestricted();
  const opMode = getOperationMode();
  const { isRetorno } = opMode;
  const isExodo = opMode.isExodo || false;

  let weights;
  if (isRetorno && restricted) {
    // Retorno con restricción de carga
    const isRetornoPeak = hour >= 18 && hour <= 23;
    const isRetornoMorning = hour >= 10 && hour <= 14;
    if (isRetornoPeak) {
      weights = CATEGORY_WEIGHTS_RETORNO_PEAK;
    } else if (isRetornoMorning) {
      weights = CATEGORY_WEIGHTS_RETORNO_RESTRICTED;
    } else {
      weights = CATEGORY_WEIGHTS_RESTRICTED;
    }
  } else if (isExodo && restricted) {
    // ÉXODO + restricción carga: CERO camiones, máximo buses y particulares
    const isPleno = opMode.exodoLevel === 'pleno';
    const isPeakAM = hour >= 7 && hour <= 9;
    const isPeakPM = hour >= 14 && hour <= 16;
    if (isPleno && (isPeakAM || isPeakPM)) {
      weights = CATEGORY_WEIGHTS_EXODO_PLENO;  // 38% buses en éxodo pleno
    } else {
      weights = CATEGORY_WEIGHTS_RESTRICTED;
    }
  } else if (isExodo) {
    // ÉXODO sin restricción
    const isPleno = opMode.exodoLevel === 'pleno';
    const isPeakAM = hour >= 7 && hour <= 9;
    const isPeakPM = hour >= 14 && hour <= 16;
    const isPeakBroad = (hour >= 5 && hour <= 10) || (hour >= 14 && hour <= 18);
    if (isPleno && (isPeakAM || isPeakPM)) {
      weights = CATEGORY_WEIGHTS_EXODO_PLENO;  // 38% buses pico pleno
    } else if (isPeakBroad) {
      weights = CATEGORY_WEIGHTS_EXODO_PEAK;
    } else if (isNight) {
      weights = CATEGORY_WEIGHTS_EXODO_NIGHT;
    } else {
      weights = CATEGORY_WEIGHTS_EXODO_DAY;
    }
  } else if (restricted) {
    weights = CATEGORY_WEIGHTS_RESTRICTED;
  } else if (isNight) {
    weights = CATEGORY_WEIGHTS_NIGHT;
  } else {
    weights = CATEGORY_WEIGHTS_DAY;
  }

  const r = Math.random();
  let c = 0;
  for (const [cat, w] of Object.entries(weights)) {
    c += w;
    if (r <= c) return cat;
  }
  return 'C1';
}

function laneY(laneIdx, roadTop, roadBot, totalLanes = 4) {
  const laneH = (roadBot - roadTop) / totalLanes;
  return roadTop + laneH * laneIdx + laneH * 0.5;
}

// Helper: make a hex color semi-transparent for counter-flow vehicles
function adjustAlpha(hexColor, alpha) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function TollCanvas({
  mode = 'full',
  stationName = 'Peaje',
  corridorColor = '#38bdf8',
  lanes = [],
  metrics = {},
  showHeader = true,
  showMetrics = true,
  direction = 'salida',
  realTraffic = null, // Google Routes API data { currentSpeed, congestionRatio }
}) {
  const CANVAS_H = mode === 'mini' ? 180 : 340;
  // MAX_VEHICLES: adapts to time and éxodo level
  const _colHour = getColHour();
  const _isNight = _colHour >= 20 || _colHour <= 5;
  const _opModeInit = getOperationMode();
  const _isExodo = _opModeInit.isExodo || false;
  const _isPleno = _opModeInit.exodoLevel === 'pleno';
  // Picos basados en hora — NO forzar colapso, dejar que APIs reales determinen
  const _isPeakNow = (_colHour >= 6 && _colHour <= 10) || (_colHour >= 13 && _colHour <= 18);
  const MAX_VEHICLES = _isNight
    ? (mode === 'mini' ? 8 : 15)
    : (_isPleno && _isPeakNow)
    ? (mode === 'mini' ? 50 : 160)  // ÉXODO PLENO: 160 vehículos — colapso total como foto Chinauta
    : (_isExodo && _isPeakNow)
    ? (mode === 'mini' ? 40 : 110)  // ÉXODO ALTO: 110 vehículos
    : (mode === 'mini' ? 25 : 55);
  const ROAD_Y_START = 0.22;
  const ROAD_Y_END = 0.82;
  const COUNT_LINE_X = 0.28;
  const GANTRY_X = 0.52;
  const BOOTH_W = mode === 'mini' ? 22 : 32;
  const BOOTH_H = mode === 'mini' ? 12 : 18;

  const canvasRef = useRef(null);
  const vehiclesRef = useRef([]);
  const animRef = useRef(null);
  const sizeRef = useRef({ w: 800, h: CANVAS_H });
  const flashRef = useRef([]);
  const dataRef = useRef({ lanes, metrics, direction, realTraffic });

  useEffect(() => { dataRef.current = { lanes, metrics, direction, realTraffic }; }, [lanes, metrics, direction, realTraffic]);

  const draw = useCallback((ctx, timestamp) => {
    const { w, h } = sizeRef.current;
    const { lanes: currentLanes, metrics: currentMetrics } = dataRef.current;
    const roadTop = h * ROAD_Y_START;
    const roadBot = h * ROAD_Y_END;
    const numLanes = (currentLanes || []).length || 4;
    const laneH = (roadBot - roadTop) / numLanes;
    const isMini = mode === 'mini';

    // Background
    ctx.fillStyle = '#070d1a';
    ctx.fillRect(0, 0, w, h);

    // Grid dots
    const gridStep = isMini ? 30 : 24;
    ctx.fillStyle = '#0a1628';
    for (let x = 0; x < w; x += gridStep) {
      for (let y = 0; y < h; y += gridStep) {
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Road surface
    ctx.fillStyle = '#1a2035';
    ctx.fillRect(0, roadTop, w, roadBot - roadTop);

    // Bermas
    ctx.fillStyle = '#141c2b';
    ctx.fillRect(0, roadTop - (isMini ? 3 : 6), w, isMini ? 3 : 6);
    ctx.fillRect(0, roadBot, w, isMini ? 3 : 6); // lower berma (motos)

    // Lane dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.setLineDash([16, 12]);
    ctx.lineWidth = 1;
    for (let i = 1; i < numLanes; i++) {
      const y = roadTop + laneH * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Speed markings
    if (!isMini) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.font = '18px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      for (let i = 0; i < numLanes; i++) {
        ctx.fillText('80', w * 0.12, laneY(i, roadTop, roadBot, numLanes) + 6);
      }
    }

    // Direction indicator — shows both directions with lane counts
    if (!isMini) {
      const retLanes = (currentLanes || []).filter(l => l.active && (l.direction === 'retorno' || l.direction === 'retorno-extra'));
      const salLanes = (currentLanes || []).filter(l => l.active && l.direction === 'salida');

      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.globalAlpha = 0.75;
      // Salida label (left → right flow)
      ctx.fillStyle = salLanes.length > retLanes.length ? '#22c55e' : 'rgba(34,197,94,0.45)';
      ctx.textAlign = 'left';
      ctx.fillText(`→ SALIDA (${salLanes.length})`, 12, roadTop - 22);
      // Retorno label (right → left flow)
      ctx.fillStyle = retLanes.length > 0 ? (retLanes.length >= salLanes.length ? '#f59e0b' : 'rgba(245,158,11,0.6)') : 'rgba(245,158,11,0.25)';
      ctx.textAlign = 'right';
      ctx.fillText(`← RETORNO (${retLanes.length})`, w - 12, roadTop - 22);
      ctx.globalAlpha = 1;
    }

    // Count line
    const countLineX = w * COUNT_LINE_X;
    const countPulse = 0.3 + 0.5 * Math.abs(Math.sin(timestamp * 0.003));
    ctx.strokeStyle = `rgba(14, 165, 233, ${countPulse})`;
    ctx.lineWidth = isMini ? 1.5 : 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(countLineX, roadTop);
    ctx.lineTo(countLineX, roadBot);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!isMini) {
      ctx.fillStyle = 'rgba(14, 165, 233, 0.6)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LÍNEA DE CONTEO', countLineX, roadTop - 10);
    }

    // Count line flashes
    flashRef.current = flashRef.current.filter(f => timestamp - f.time < 200);
    flashRef.current.forEach(f => {
      ctx.strokeStyle = `rgba(14, 165, 233, ${1 - (timestamp - f.time) / 200})`;
      ctx.lineWidth = isMini ? 2 : 4;
      ctx.beginPath();
      ctx.moveTo(countLineX - 8, f.y);
      ctx.lineTo(countLineX + 8, f.y);
      ctx.stroke();
    });

    // Toll Gantry
    const gantryX = w * GANTRY_X;
    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r}, ${g}, ${b}`;
    };
    const cRgb = hexToRgb(corridorColor);

    ctx.shadowColor = corridorColor;
    ctx.shadowBlur = isMini ? 6 : 12;
    ctx.strokeStyle = corridorColor;
    ctx.lineWidth = isMini ? 2.5 : 4;
    ctx.beginPath();
    ctx.moveTo(gantryX, roadTop - (isMini ? 8 : 16));
    ctx.lineTo(gantryX, roadBot + (isMini ? 8 : 16));
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Gantry caps
    ctx.fillStyle = corridorColor;
    ctx.fillRect(gantryX - 2, roadTop - (isMini ? 10 : 20), 4, isMini ? 3 : 6);
    ctx.fillRect(gantryX - 2, roadBot + (isMini ? 6 : 14), 4, isMini ? 3 : 6);

    // Sensor icons (full mode only)
    if (!isMini) {
      const iconY = roadTop - 30;
      ctx.fillStyle = `rgba(${cRgb}, 0.5)`;
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillRect(gantryX - 20, iconY, 8, 6);
      ctx.fillText('PTZ', gantryX - 16, iconY - 3);
      ctx.beginPath();
      ctx.moveTo(gantryX, iconY + 6);
      ctx.lineTo(gantryX - 3, iconY);
      ctx.lineTo(gantryX + 3, iconY);
      ctx.fill();
      ctx.fillText('RF', gantryX, iconY - 3);
      ctx.beginPath();
      ctx.arc(gantryX + 16, iconY + 3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText('CCTV', gantryX + 16, iconY - 3);
    }

    // Toll Booths — dynamic size based on lane count
    const dynBoothH = numLanes > 6 ? (isMini ? 8 : Math.min(14, laneH * 0.6)) : BOOTH_H;
    const dynBoothW = numLanes > 6 ? (isMini ? 16 : Math.min(26, BOOTH_W)) : BOOTH_W;
    for (let i = 0; i < numLanes; i++) {
      const lane = currentLanes[i];
      if (!lane) continue;
      const y = laneY(i, roadTop, roadBot, numLanes) - dynBoothH / 2;
      const x = gantryX - dynBoothW / 2;
      const isClosed = lane.status === 'closed' || !lane.active;

      let fillColor, borderColor;
      if (isClosed) {
        fillColor = 'rgba(100, 100, 100, 0.1)';
        borderColor = '#ef4444';
      } else {
        fillColor = `rgba(${cRgb}, 0.12)`;
        borderColor = corridorColor;
      }

      ctx.fillStyle = fillColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, dynBoothW, dynBoothH, isMini ? 2 : (numLanes > 6 ? 2 : 4));
      ctx.fill();
      ctx.stroke();

      // Lane label
      ctx.fillStyle = isClosed ? '#64748b' : '#e2e8f0';
      const labelSize = numLanes > 8 ? '7' : numLanes > 6 ? '8' : (isMini ? '8' : '10');
      ctx.font = `bold ${labelSize}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(lane.label, gantryX, y + dynBoothH / 2 + (isMini ? 2 : 3));

      // Gate bar (full mode, skip for dense layouts)
      if (!isClosed && !isMini && numLanes <= 8) {
        const gateOpen = lane.queue <= 1;
        const gateAngle = gateOpen ? -Math.PI / 3 : 0;
        const gateStartX = x + dynBoothW + 2;
        const gateStartY = y + dynBoothH / 2;
        ctx.save();
        ctx.translate(gateStartX, gateStartY);
        ctx.rotate(gateAngle);
        ctx.strokeStyle = gateOpen ? '#22c55e' : '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(20, 0);
        ctx.stroke();
        ctx.restore();
      }

      // Payment type (full mode)
      if (!isMini) {
        ctx.fillStyle = '#475569';
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(lane.type, gantryX, y + BOOTH_H + 10);
      }
    }

    // ── Separador visual entre sentidos de circulación (doble línea amarilla continua) ──
    // Aplica siempre que haya carriles de retorno — visible en mini y full
    if (currentLanes && currentLanes.length > 0) {
      let lastRetornoIdx = -1;
      for (let i = 0; i < currentLanes.length; i++) {
        if (currentLanes[i].direction === 'retorno' || currentLanes[i].direction === 'retorno-extra') {
          lastRetornoIdx = i;
        }
      }
      if (lastRetornoIdx >= 0 && lastRetornoIdx < currentLanes.length - 1) {
        const dividerY = roadTop + laneH * (lastRetornoIdx + 1);
        const gap = isMini ? 1 : 2.5; // separación entre las dos líneas
        const lw = isMini ? 1 : 2;
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.lineWidth = lw;
        ctx.setLineDash([]);
        // Línea superior
        ctx.beginPath();
        ctx.moveTo(0, dividerY - gap);
        ctx.lineTo(w, dividerY - gap);
        ctx.stroke();
        // Línea inferior
        ctx.beginPath();
        ctx.moveTo(0, dividerY + gap);
        ctx.lineTo(w, dividerY + gap);
        ctx.stroke();
      }
    }

    // Vehicles
    const vehicles = vehiclesRef.current;
    for (const v of vehicles) {
      const cat = VEHICLE_CATEGORIES[v.category];
      if (!cat) continue;
      const cy = v.isMoto ? v.motoY : laneY(v.lane, roadTop, roadBot, numLanes);
      
      const pxLength = isMini ? cat.width * 0.65 : cat.width;
      const pxWidth  = isMini ? cat.height * 0.65 : cat.height;
      const isRetorno = v.isCounter;

      // Saber si está frenando
      const isBraking = v.state === 'queued' || (v.state === 'approaching' && v.speed < 20) || v.state === 'at-booth';
      const headlightDir = isRetorno ? -1 : 1; 

      if (cat.isMoto) {
        // Moto Premium
        ctx.save();
        ctx.translate(v.x, cy);
        
        ctx.fillStyle = isRetorno ? '#86efac' : cat.color; 
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        // Cuerpo moto
        ctx.roundRect(-pxLength/2, -pxWidth/2, pxLength, pxWidth, 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Casco piloto (circulo centrado)
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, 0, pxWidth * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Linterna motos
        ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
        ctx.fillRect(headlightDir * (pxLength/2), -1, headlightDir * 2, 2);

        ctx.restore();
      } else {
        // High fidelity Top-Down Vehicle
        ctx.save();
        ctx.translate(v.x, cy);
        
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = isMini ? 2 : 4;
        ctx.shadowOffsetY = 2;

        const baseColor = isRetorno ? adjustAlpha(cat.color, 0.65) : cat.color;

        // Chasis (Cuerpo)
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        // Nota: TollCanvas usa centro (0,0) por mi traslación
        ctx.roundRect(-pxLength/2, -pxWidth/2, pxLength, pxWidth, Math.max(1, pxWidth * 0.15));
        ctx.fill();

        // Reiniciar sombras
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Techo (Color Base + Oscurecido 15%)
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.roundRect(-pxLength*0.1, -pxWidth*0.4, pxLength*0.4, pxWidth*0.8, 1);
        ctx.fill();

        // Dirección de vidrios dependiendo si va Der->Izq (Retorno) o Izq->Der (Salida)
        const frontX = isRetorno ? -pxLength*0.45 : pxLength*0.15;
        const backX  = isRetorno ? pxLength*0.15  : -pxLength*0.45;

        // Parabrisas Frontal
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; 
        ctx.beginPath();
        ctx.roundRect(frontX, -pxWidth*0.35, pxLength*0.15, pxWidth*0.7, 1);
        ctx.fill();
        
        // Parabrisas Trasero
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.beginPath();
        ctx.roundRect(backX, -pxWidth*0.35, pxLength*0.15, pxWidth*0.7, 1);
        ctx.fill();

        // ── LUCES DE FRENADO (Tail Lights) ──
        // En vehículos regulares, stop lights están atrás.
        const tailX = isRetorno ? (pxLength/2 - 2) : (-pxLength/2);
        const tailColor = isBraking ? '#ef4444' : 'rgba(127, 29, 29, 0.5)';
        
        ctx.fillStyle = tailColor;
        if (isBraking) {
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = isMini ? 3 : 6;
        }
        ctx.fillRect(tailX, -pxWidth*0.45, 2, pxWidth*0.2);
        ctx.fillRect(tailX, pxWidth*0.25, 2, pxWidth*0.2);
        ctx.shadowBlur = 0;

        // ── FAROS (HeadLights) ──
        if (!isMini && v.state !== 'queued') {
          const headX = isRetorno ? (-pxLength/2) : (pxLength/2 - 2);
          ctx.fillStyle = isRetorno ? 'rgba(255, 200, 200, 0.5)' : '#fef08a';
          ctx.fillRect(headX, -pxWidth*0.45, 2, pxWidth*0.2);
          ctx.fillRect(headX, pxWidth*0.25, 2, pxWidth*0.2);

          // Glow antiniebla
          const glowDir = isRetorno ? -1 : 1;
          const lightGlow = ctx.createLinearGradient(headX, 0, headX + (12 * glowDir), 0);
          lightGlow.addColorStop(0, isRetorno ? 'rgba(255, 200, 200, 0.15)' : 'rgba(254, 240, 138, 0.15)');
          lightGlow.addColorStop(1, 'transparent');
          ctx.fillStyle = lightGlow;
          ctx.fillRect(isRetorno ? headX - 12 : headX + 2, -pxWidth*0.5, 12, pxWidth);
        }

        ctx.restore();
      }
    }

    // HUD Overlays — posición según dirección del carril
    if (!isMini) {
      for (let i = 0; i < numLanes; i++) {
        const lane = currentLanes[i];
        if (!lane || lane.status === 'closed' || !lane.active) continue;
        const cy = laneY(i, roadTop, roadBot, numLanes);
        const isRetornoLane = lane.direction === 'retorno' || lane.direction === 'retorno-extra';

        // Retorno: HUD a la izquierda de la caseta | Salida: HUD a la derecha
        const hudW = 72;
        const hudX = isRetornoLane ? (gantryX - 50 - hudW) : (gantryX + 50);
        const hudY = cy - 14;

        ctx.fillStyle = 'rgba(4, 10, 20, 0.75)';
        ctx.fillRect(hudX, hudY, hudW, 24);
        ctx.strokeStyle = isRetornoLane ? 'rgba(250, 204, 21, 0.3)' : `rgba(${cRgb}, 0.3)`;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(hudX, hudY, hudW, 24);

        ctx.fillStyle = isRetornoLane ? '#facc15' : corridorColor;
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${lane.speed} km/h`, hudX + 4, hudY + 10);
        ctx.fillStyle = lane.queue > 5 ? '#ef4444' : '#64748b';
        ctx.fillText(`Cola: ${lane.queue}`, hudX + 4, hudY + 20);
      }
    }

    // Occupancy Bar
    const occupancy = currentMetrics.occupancy || 0;
    const barY = h - (isMini ? 14 : 22);
    const barW = w - 40;
    const barH = isMini ? 6 : 10;
    ctx.fillStyle = '#0d1a2e';
    ctx.fillRect(20, barY, barW, barH);

    const occW = barW * (occupancy / 100);
    const grad = ctx.createLinearGradient(20, 0, 20 + barW, 0);
    grad.addColorStop(0, '#22c55e');
    grad.addColorStop(0.6, '#f59e0b');
    grad.addColorStop(1, '#ef4444');
    ctx.fillStyle = grad;
    ctx.fillRect(20, barY, occW, barH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = `${isMini ? '7' : '9'}px JetBrains Mono, monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(`${occupancy}%`, w - 22, barY + (isMini ? 5 : 9));
    if (!isMini) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.fillText('OCUPACIÓN', 22, barY - 3);
    }
  }, [mode, corridorColor, CANVAS_H, BOOTH_W, BOOTH_H, MAX_VEHICLES]);

  /* ── Spawn accumulators: main flow + counter flow ── */
  const spawnAccRef = useRef(0);
  const counterAccRef = useRef(0);

  const update = useCallback((timestamp, deltaMs) => {
    const { w, h } = sizeRef.current;
    const { lanes: currentLanes, metrics: currentMetrics, realTraffic: rtCurrent } = dataRef.current;
    const roadTop = h * ROAD_Y_START;
    const roadBot = h * ROAD_Y_END;
    const numLanes = (currentLanes || []).length || 4;
    const dt = deltaMs / 1000;
    const vehicles = vehiclesRef.current;

    // ── LANE DIRECTION VALIDATION ──
    // Purge vehicles in wrong lanes when booth config changes dynamically
    const salidaLaneSet = new Set((currentLanes || []).filter(l => l.active && l.direction === 'salida').map(l => l.id - 1));
    const retornoLaneSet = new Set((currentLanes || []).filter(l => l.active && (l.direction === 'retorno' || l.direction === 'retorno-extra')).map(l => l.id - 1));
    for (let vi = vehicles.length - 1; vi >= 0; vi--) {
      const v = vehicles[vi];
      if (v.isMoto) continue; // Motos go on berma, not lanes
      if (v.isCounter && !retornoLaneSet.has(v.lane)) {
        vehicles.splice(vi, 1); // Counter vehicle in non-retorno lane → remove
      } else if (!v.isCounter && !salidaLaneSet.has(v.lane)) {
        vehicles.splice(vi, 1); // Salida vehicle in non-salida lane → remove
      }
    }
    const gantryX = w * GANTRY_X;
    const countLineX = w * COUNT_LINE_X;
    const isMini = mode === 'mini';

    // ── FRAME CACHE: calculate once, reuse everywhere ──
    const _hour = getColHour();
    const _opMode = getOperationMode();
    const _isRetorno = _opMode.isRetorno;
    const _retScale = _opMode.retornoScale || 0;
    const _isNight = _hour >= 20 || _hour <= 5;
    const _isGridlock = _isRetorno && _retScale >= 0.75 && _hour >= 13 && _hour <= 20;
    // ── REAL TRAFFIC from Google Routes API ──
    const _rt = rtCurrent;
    const _hasRealTraffic = !!(_rt && _rt.currentSpeed != null);

    const _isPlenoFrame = _opMode.exodoLevel === 'pleno';
    const _isPeakFrame = (_hour >= 6 && _hour <= 10) || (_hour >= 13 && _hour <= 18);
    // Congestión real de las APIs (0 = fluido, 1 = parado)
    const _realCongestion = _hasRealTraffic ? (_rt.congestionRatio || 0) : 0;
    // Colapso solo cuando APIs reales confirman congestión alta
    const _isPlenoColapso = _isPlenoFrame && _isPeakFrame && _realCongestion > 0.5;
    // Factor de velocidad real: si Google dice 6 km/h vs 45 libre = 0.13 → vehículos MUY lentos
    const _realSpeedFactor = _hasRealTraffic
      ? Math.max(0.05, _rt.currentSpeed / Math.max(_rt.freeFlowSpeed || 60, 1))
      : 1.0;
    // Override gridlock: si datos reales muestran congestión > 60%, forzar gridlock visual
    const _realGridlock = _hasRealTraffic && _rt.congestionRatio > 0.6;
    const effectiveGridlock = _isGridlock || _realGridlock || _isPlenoColapso;

    // ── Spawn vehicles — accumulator pattern (NEVER stops) ──
    const activeLanes = (currentLanes || []).filter(l => {
      if (l.status === 'closed' || !l.active) return false;
      return l.direction === 'salida' || (!l.direction);
    }).map(l => l.id - 1);
    if (activeLanes.length > 0) {
      const rawFlow = (currentMetrics.vehiclesHour || 60) / 3600;
      const gridlockSalida = _isGridlock;
      // ── Spawn rate basado en datos reales ──
      let effectiveFlow;
      if (_isPlenoColapso) {
        effectiveFlow = isMini ? 1.5 : 4.0;
      } else if (_realCongestion > 0.6) {
        // APIs dicen congestión alta → spawn elevado
        effectiveFlow = isMini ? 0.8 : 2.0;
      } else if (_realCongestion > 0.3) {
        // APIs dicen moderado
        effectiveFlow = isMini ? 0.4 : 0.8;
      } else {
        // APIs dicen fluido o sin datos → flujo normal suave
        const minVisualFlow = gridlockSalida
          ? (isMini ? 0.04 : 0.08)
          : _isNight
          ? (isMini ? 0.06 : 0.10)
          : (isMini ? 0.12 : 0.25);
        effectiveFlow = Math.max(rawFlow, minVisualFlow);
      }

      // Accumulate fractional spawns to guarantee eventual spawn
      spawnAccRef.current += effectiveFlow * dt;

      while (spawnAccRef.current >= 1 && vehicles.length < MAX_VEHICLES) {
        spawnAccRef.current -= 1;
        const cat = pickCategory();
        const catDef = VEHICLE_CATEGORIES[cat];

        // ── Speed: use REAL traffic data if available ──
        const vehHour = currentMetrics.vehiclesHour || 100;
        const flowRatio = Math.min(vehHour / 600, 1);
        let approachSpeedBase, approachSpeedVar;
        if (_isPlenoColapso) {
          approachSpeedBase = 12 + flowRatio * 8;
          approachSpeedVar = 4 + flowRatio * 4;
        } else if (_realCongestion > 0.6) {
          approachSpeedBase = 18 + flowRatio * 10;
          approachSpeedVar = 5 + flowRatio * 5;
        } else {
          // Fluido: approach a velocidad normal
          approachSpeedBase = 30 + flowRatio * 25;
          approachSpeedVar = 8 + flowRatio * 12;
        }
        if (_hasRealTraffic) {
          approachSpeedBase = approachSpeedBase * _realSpeedFactor;
          approachSpeedVar = approachSpeedVar * _realSpeedFactor;
        }

        if (catDef.isMoto) {
          // Motos SALIDA: berma inferior, junto al último carril — izq→der
          // En retorno: pocas motos salen (70% se rechazan → solo 30% del volumen normal)
          if (_isRetorno && Math.random() < 0.70) {
            // Skip this moto — en retorno pocas motos salen
          } else {
            const motoY = roadBot + (isMini ? 4 : 8) + Math.random() * (isMini ? 3 : 5);
            const motoSpeed = (30 + flowRatio * 30 + Math.random() * 20) * catDef.speedFactor;
            vehicles.push({
              x: -catDef.width - Math.random() * 40,
              lane: -1,
              category: cat,
              speed: motoSpeed,
              state: 'departing',
              waitTimer: 0,
              passedCount: false,
              isMoto: true,
              motoY,
              stuckTimer: 0,
            });
          }
        } else {
          // Round-robin lanes para distribución uniforme
          if (!window._salidaRR) window._salidaRR = 0;
          const laneIdx = activeLanes[window._salidaRR % activeLanes.length];
          window._salidaRR++;

          // Verificar que no haya vehículo en la zona de spawn del mismo carril
          const spawnZoneClear = !vehicles.some(ov =>
            !ov.isMoto && !ov.isCounter && ov.lane === laneIdx && ov.x < catDef.width * 2 + 20
          );
          if (!spawnZoneClear) { spawnAccRef.current += 0.5; break; } // Retry next frame

          const spawnSpeed = (approachSpeedBase + Math.random() * approachSpeedVar) * catDef.speedFactor;
          vehicles.push({
            x: -catDef.width - 10 - Math.random() * 30,
            lane: laneIdx,
            category: cat,
            speed: spawnSpeed,
            state: 'approaching',
            waitTimer: 0,
            passedCount: false,
            isMoto: false,
            stuckTimer: 0,
          });
        }
      }
      // Cap accumulator to prevent burst-spawning after tab-switch
      spawnAccRef.current = Math.min(spawnAccRef.current, 2);
    }

    // ── Spawn MOTOS RETORNO (siempre activas, berma superior junto a C1, der→izq) ──
    // En operación retorno: mayor volumen entrando. En salida: menor volumen entrando.
    {
      const numLanesNow = (currentLanes || []).length || 4;
      const c1Y = laneY(0, roadTop, roadBot, numLanesNow);
      const laneHNow = (roadBot - roadTop) / numLanesNow;
      const motoRetornoFlow = _isGridlock
        ? 0.35
        : _isRetorno
        ? (_isNight ? 0.06 : 0.22)
        : (_isNight ? 0.02 : 0.06);

      if (!window._motoRetornoAcc) window._motoRetornoAcc = 0;
      window._motoRetornoAcc += motoRetornoFlow * dt;

      const motoRetornoCount = vehicles.filter(v => v.isMoto && v.isCounter).length;
      const MAX_MOTO_RETORNO = _isGridlock ? 10 : _isRetorno ? (_isNight ? 3 : 7) : (_isNight ? 1 : 3);

      while (window._motoRetornoAcc >= 1 && motoRetornoCount < MAX_MOTO_RETORNO) {
        window._motoRetornoAcc -= 1;
        const catDef = VEHICLE_CATEGORIES.M;
        const motoY = c1Y - laneHNow * 0.5 - (isMini ? 2 : 4) - Math.random() * (isMini ? 2 : 3);
        vehicles.push({
          x: w + catDef.width + Math.random() * 80,
          lane: 0,
          category: 'M',
          speed: 35 + Math.random() * 30,
          state: 'departing',
          waitTimer: 0,
          passedCount: false,
          isMoto: true,
          isCounter: true,
          motoY,
          stuckTimer: 0,
        });
        if (vehicles.filter(v => v.isMoto && v.isCounter).length >= MAX_MOTO_RETORNO) break;
      }
      window._motoRetornoAcc = Math.min(window._motoRetornoAcc, 1.5);
    }

    // ── Spawn RETORNO VEHICLES (vehículos entrando por carriles C1/C2, der→izq) ──
    // Estos son el flujo REAL de retorno — vehículos que regresan a Bogotá
    const retornoLanes = (currentLanes || []).filter(l => {
      if (!l.active) return false;
      return l.direction === 'retorno' || l.direction === 'retorno-extra';
    }).map(l => l.id - 1);

    if (retornoLanes.length > 0) {
      const gridlockActive = _isGridlock;

      // Flujo de retorno: en gridlock, spawn MASIVO para saturar la vía
      const retornoFlow = gridlockActive
        ? 1.5 + retornoLanes.length * 0.2  // GRIDLOCK: ~3.1 veh/s para 8 carriles → satura en 10s
        : _isRetorno
        ? Math.max(0.3, _retScale * 0.6)
        : 0.04;  // Salida: mínimo
      counterAccRef.current += retornoFlow * dt;

      // Vehículos máximos: gridlock = 5 por carril retorno (vía SATURADA como foto campo)
      const MAX_RETORNO_VEH = gridlockActive
        ? (isMini ? 20 : retornoLanes.length * 5)  // 8 carriles × 5 = 40 vehículos
        : _isRetorno
        ? (_isNight ? 4 : (isMini ? 8 : 18))
        : (_isNight ? 2 : (isMini ? 3 : 5));
      const retornoVehCount = vehicles.filter(v => v.isCounter && !v.isMoto).length;

      // Round-robin para distribuir uniformemente en TODOS los carriles retorno
      if (!window._retornoRR) window._retornoRR = 0;

      while (counterAccRef.current >= 1 && retornoVehCount < MAX_RETORNO_VEH) {
        counterAccRef.current -= 1;
        // Usar pickCategory() que respeta restricción de carga
        let cat = pickCategory();
        // Si pickCategory devuelve moto, re-pick como C1 (motos van por berma, no por carril)
        if (VEHICLE_CATEGORIES[cat]?.isMoto) cat = 'C1';
        const catDef = VEHICLE_CATEGORIES[cat];
        // Round-robin: cada vehículo al siguiente carril, garantiza todos llenos
        const chosenLane = retornoLanes[window._retornoRR % retornoLanes.length];
        window._retornoRR++;

        // Velocidad de retorno en px/s (NO km/h)
        // Gridlock: lento pero visible (15-30 px/s ≈ avanza, frena en caseta)
        // Normal: 40-70 px/s
        // Velocidad retorno: si hay datos reales, usarlos
        let retSpeed;
        if (_hasRealTraffic && _rt.congestionRatio > 0.5) {
          // Datos reales de Google: mapear velocidad real a px/s
          // 6 km/h real → ~8-12 px/s (gridlock visual)
          retSpeed = Math.max(6, _rt.currentSpeed * 1.5) + Math.random() * 8;
        } else if (effectiveGridlock) {
          retSpeed = 15 + Math.random() * 15;
        } else if (_isRetorno && _retScale >= 0.60 && _hour >= 13 && _hour <= 20) {
          retSpeed = 25 + Math.random() * 20;
        } else if (_isRetorno) {
          retSpeed = 35 + Math.random() * 25;
        } else {
          retSpeed = 45 + Math.random() * 30;
        }

        vehicles.push({
          x: w + catDef.width + Math.random() * 100,
          lane: chosenLane,
          category: cat,
          speed: retSpeed,
          state: 'departing', // counter vehicles: der→izq, processed by isCounter block
          waitTimer: 0,
          passedCount: false,
          isMoto: false,
          isCounter: true,
          stuckTimer: 0,
        });
        if (vehicles.filter(v => v.isCounter && !v.isMoto).length >= MAX_RETORNO_VEH) break;
      }
      counterAccRef.current = Math.min(counterAccRef.current, 3);

      // ── GRIDLOCK REFILL: garantizar mínimo 5 vehículos por carril retorno ──
      if (gridlockActive) {
        const MIN_PER_LANE = 5;
        for (const rl of retornoLanes) {
          const inLane = vehicles.filter(v => v.isCounter && !v.isMoto && v.lane === rl).length;
          if (inLane < MIN_PER_LANE && vehicles.length < MAX_RETORNO_VEH + 20) {
            const needed = MIN_PER_LANE - inLane;
            for (let fi = 0; fi < needed; fi++) {
              let fcat = pickCategory();
              if (VEHICLE_CATEGORIES[fcat]?.isMoto) fcat = 'C1';
              // Más buses en retorno (C2 = bus intermunicipal)
              if (Math.random() < 0.25) fcat = 'C2';
              const fcatDef = VEHICLE_CATEGORIES[fcat];
              vehicles.push({
                x: w + fcatDef.width + 20 + fi * 60 + Math.random() * 30,
                lane: rl,
                category: fcat,
                speed: 18 + Math.random() * 15, // 18-33 px/s — lento pero avanza
                state: 'departing',
                waitTimer: 0,
                passedCount: false,
                isMoto: false,
                isCounter: true,
                stuckTimer: 0,
              });
            }
          }
        }
      }
    }

    // ── Helper: find nearest vehicle ahead in same lane ──
    function nearestAhead(v) {
      let minX = Infinity;
      for (const o of vehicles) {
        if (o === v || o.isMoto || o.lane !== v.lane) continue;
        if (o.x > v.x && o.x < minX) minX = o.x;
      }
      return minX;
    }

    // Reuse frame cache for vehicle updates
    const isPeakHour = (_hour >= 6 && _hour <= 8) || (_hour >= 13 && _hour <= 17);
    const counterWait = effectiveGridlock ? 8 : 3;
    const counterExitSpd = effectiveGridlock ? 12 : 30;
    const counterMaxSpd = effectiveGridlock ? 35 : 70;

    // ── Update vehicles ──
    for (let i = vehicles.length - 1; i >= 0; i--) {
      const v = vehicles[i];
      const catDef = VEHICLE_CATEGORIES[v.category];
      if (!catDef) { vehicles.splice(i, 1); continue; }

      // Counter-flow vehicles: travel RIGHT → LEFT
      if (v.isCounter) {
        if (v.isMoto) {
          v.x -= v.speed * dt;
        } else {
          const distToBooth = v.x - gantryX;

          // Simple anti-collision: find nearest counter vehicle to the LEFT in same lane
          let nearestLeft = -999;
          let nearestW = 20;
          for (const o of vehicles) {
            if (o === v || !o.isCounter || o.isMoto || o.lane !== v.lane) continue;
            if (o.x < v.x && o.x > nearestLeft) { nearestLeft = o.x; nearestW = VEHICLE_CATEGORIES[o.category]?.width || 20; }
          }
          const gapToNext = v.x - nearestLeft - nearestW;
          const MIN_GAP_C = catDef.width + 6;

          if (v.state === 'departing' && distToBooth > 0) {
            // Don't move if too close to vehicle ahead
            if (gapToNext > MIN_GAP_C) {
              const brake = distToBooth < 150 ? Math.max(distToBooth / 150, 0.08) : 1;
              v.x -= v.speed * brake * dt;
            }
            if (distToBooth <= 4) {
              v.state = 'counter-booth';
              v.waitTimer = counterWait + Math.random() * counterWait;
            }
          } else if (v.state === 'counter-booth') {
            v.waitTimer -= dt;
            if (v.waitTimer <= 0) {
              v.state = 'counter-exit';
              v.speed = counterExitSpd + Math.random() * 10;
            }
          } else {
            // counter-exit
            if (gapToNext > MIN_GAP_C) {
              v.speed = Math.min(v.speed + 8 * dt, counterMaxSpd);
              v.x -= v.speed * dt;
            }
          }
        }
        if (v.x < -80) vehicles.splice(i, 1);
        continue;
      }

      // Motos (main direction) travel straight through on the berma — no collision
      if (v.isMoto) {
        v.x += v.speed * dt;
        if (v.x > w + 60) vehicles.splice(i, 1);
        continue;
      }

      const lane = currentLanes?.[v.lane];
      const boothX = gantryX - BOOTH_W / 2;
      const MIN_GAP = catDef.width + 8; // minimum gap between vehicles (solid, no overlap)

      // ── Anti-freeze inestable ELIMINADO — Provocaba saltos bruscos cada 8s en flujo denso ──

      const laneQueue = lane ? lane.queue : 0;
      const effectiveQueue = isPeakHour ? laneQueue : Math.min(laneQueue, 1);
      const aheadX = nearestAhead(v);
      const gapToAhead = aheadX - v.x;

      switch (v.state) {
        case 'approaching': {
          const distToBooth = boothX - v.x;

          // ── HARD STOP: nunca sobrepasar al vehículo de adelante ──
          if (gapToAhead <= MIN_GAP && gapToAhead > 0) {
            v.speed = 0;
            v.x = aheadX - MIN_GAP; // Snap a posición segura
            v.state = 'queued';
            break;
          }

          // ── Collision prevention: freno suave cuando se acerca ──
          if (gapToAhead < MIN_GAP * 3 && gapToAhead > MIN_GAP) {
            const brakeFactor = (gapToAhead - MIN_GAP) / (MIN_GAP * 2);
            v.speed = Math.max(3, v.speed * brakeFactor);
            v.x += v.speed * dt;
            break;
          }

          if (distToBooth <= catDef.width / 2 + 4) {
            // Arrived at booth
            v.state = 'at-booth';
            v.speed = 0;
            // Tiempo de espera en caseta:
            // Éxodo pico: 6-12s efectivo, 2-4s FacilPass (pago lento → cola se forma)
            // Normal pico: 2-4s efectivo, 0.8-1.5s FacilPass
            // Valle: 0.5-1s
            // Booth wait basado en congestión REAL de las APIs
            let baseWait;
            if (_isPlenoColapso) {
              baseWait = lane?.type === 'FacilPass' ? 3 + Math.random() * 3 : 10 + Math.random() * 8;
            } else if (_realCongestion > 0.6) {
              baseWait = lane?.type === 'FacilPass' ? 1.5 + Math.random() * 1.5 : 4 + Math.random() * 4;
            } else if (_realCongestion > 0.3) {
              baseWait = lane?.type === 'FacilPass' ? 0.8 + Math.random() * 0.7 : 2 + Math.random() * 1.5;
            } else {
              // Fluido: paso rápido por caseta
              baseWait = lane?.type === 'FacilPass' ? 0.3 + Math.random() * 0.3 : 0.6 + Math.random() * 0.5;
            }
            v.waitTimer = baseWait;
          } else {
            // ── Smooth deceleration curve approaching booth ──
            // Distancia de frenado basada en congestión real
            const brakeDistance = _isPlenoColapso ? 400 : _realCongestion > 0.6 ? 250 : 150;
            const minApproachFactor = _isPlenoColapso ? 0.06 : _realCongestion > 0.6 ? 0.12 : 0.25;
            const approachFactor = distToBooth < brakeDistance ? minApproachFactor + (1 - minApproachFactor) * (distToBooth / brakeDistance) : 1;
            v.x += v.speed * approachFactor * dt;
          }

          if (!v.passedCount && v.x >= countLineX) {
            v.passedCount = true;
            flashRef.current.push({ y: laneY(v.lane, roadTop, roadBot, numLanes), time: performance.now() });
          }
          break;
        }
        case 'queued': {
          if (aheadX === Infinity) {
            // Nada adelante — avanzar a la caseta
            v.state = 'approaching';
            v.speed = 15;
          } else if (gapToAhead > MIN_GAP + 0.5) {
            // Avance sedoso sin saltos de 4 pixeles:
            const creepSpeed = Math.max(2, Math.min(18, (gapToAhead - MIN_GAP) * 2.5));
            v.x += creepSpeed * dt;
          }
          // Si Gap <= MIN_GAP+0.5: mantenerse estable para evitar micro-rebotes
          break;
        }
        case 'at-booth':
          v.waitTimer -= dt;
          if (v.waitTimer <= 0) {
            v.state = 'departing';
            // Velocidad salida caseta basada en congestión real
            if (_isPlenoColapso) {
              v.speed = 8;  // Represamiento
            } else if (_realCongestion > 0.6) {
              v.speed = 15;
            } else if (_realCongestion > 0.3) {
              v.speed = 25;
            } else {
              v.speed = 40; // Fluido: salida rápida
            }
          }
          break;
        case 'departing': {
          const postBoothDist = v.x - gantryX;
          // Represamiento solo cuando APIs confirman congestión real
          const _hasRepresamiento = _isGridlock || _isPlenoColapso || (_realCongestion > 0.6);

          if (_hasRepresamiento && postBoothDist > 10 && !v.isCounter) {
            // ── REPRESAMIENTO POST-PEAJE ──
            // Éxodo pleno: cola de 200+ metros después de la caseta (foto Chinauta)
            const stopZone = _isPlenoColapso
              ? gantryX + 200 + (v.lane % 4) * 40  // Pleno: cola más larga, escalonar 4 carriles
              : gantryX + 120 + (v.lane % 3) * 30;

            let nextAheadX = Infinity;
            for (const o of vehicles) {
              if (o === v || o.isCounter || o.isMoto || o.lane !== v.lane) continue;
              if (o.x > v.x && o.x < nextAheadX) nextAheadX = o.x;
            }
            const postGap = nextAheadX - v.x;

            if (postGap <= MIN_GAP * 1.05) {
              // Taponamiento severo, stop firme sin tocar al de enfrente
              v.speed = 0;
              v.x = nextAheadX - (MIN_GAP * 1.05); // Snap microscópico y blindado para no penetrar
            } else if (postGap > MIN_GAP * 1.05 && v.x >= stopZone) {
              // Avance de arrastre tipo acordeón real en cola post-peaje
              const accordionSpeed = Math.min(10, Math.max(1, (postGap - MIN_GAP) * 2));
              v.speed = accordionSpeed;
              v.x += v.speed * dt;
            } else {
              const distToStop = Math.max(0, stopZone - v.x);
              const brakeFactor = Math.min(distToStop / 80, 1);
              const maxSpeed = _isPlenoColapso ? 6 + brakeFactor * 6 : 8 + brakeFactor * 12;
              v.speed = Math.min(v.speed + 3 * dt, maxSpeed); // acelera o mantiene suave
              v.x += v.speed * dt;
            }
          } else {
            const maxDepart = _isPlenoColapso ? 25 : 70;
            const accel = _isPlenoColapso ? 15 : 45;
            v.speed = Math.min(v.speed + accel * dt, maxDepart);
            v.x += v.speed * dt;
          }
          if (v.x > w + (_hasRepresamiento ? 300 : 60)) vehicles.splice(i, 1);
          break;
        }
        default:
          v.state = 'departing';
          v.speed = 40;
          break;
      }
    }
  }, [mode, BOOTH_W, MAX_VEHICLES]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let lastTime = performance.now();

    // ── ResizeObserver: setTransform (not scale) to avoid accumulation ──
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        if (rect.width < 1) continue; // Skip zero-width
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = CANVAS_H * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${CANVAS_H}px`;
        // Use setTransform (absolute) instead of scale (relative) to avoid accumulation
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        sizeRef.current = { w: rect.width, h: CANVAS_H };
      }
    });
    observer.observe(canvas.parentElement);

    // ── Animation fixed timestep para hiper-suavidad y eliminación de stutter ──
    let accumulator = 0;
    const fixedDt = 1000 / 60; // 16.66ms per logic tick
    
    function loop(timestamp) {
      if (!lastTime) lastTime = timestamp;
      
      let rawDelta = timestamp - lastTime;
      // Cap gigantic deltas from backgrounding (max approx 6 frames)
      if (rawDelta > 100) rawDelta = 100;
      lastTime = timestamp;
      
      accumulator += rawDelta;
      
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Perform physics updates in perfectly stable sub-steps
      let steps = 0;
      while (accumulator >= fixedDt && steps < 10) {
        update(timestamp, fixedDt);
        accumulator -= fixedDt;
        steps++;
      }
      
      // Draw exclusively once using exact mathematically updated positions
      draw(ctx, timestamp);
      ctx.restore();

      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);

    // ── Visibility change: reset lastTime when tab becomes visible again ──
    // This prevents a giant delta spike that would burst-spawn vehicles
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [draw, update, CANVAS_H]);

  const activeLanes = (lanes || []).filter(l => l.status !== 'closed' && l.active).length;

  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: '#070d1a', borderColor: '#1a2d4a' }}>
      {showHeader && (() => {
        const { isRetorno } = getOperationMode();
        const retornoLanes = (lanes || []).filter(l => l.active && (l.direction === 'retorno' || l.direction === 'retorno-extra')).length;
        const salidaLanesCount = activeLanes - retornoLanes;
        return (
          <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: '#1a2d4a' }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                Gemelo Digital — Vista Cenital
              </span>
              {isRetorno && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c', border: '1px solid rgba(251, 146, 60, 0.3)' }}>
                  ← RETORNO · {retornoLanes} casetas
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono" style={{ color: corridorColor }}>
              {activeLanes}/{(lanes || []).length || 4} casetas activas
            </span>
          </div>
        );
      })()}
      <div style={{ height: CANVAS_H }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: CANVAS_H }} />
      </div>
      {showMetrics && mode === 'mini' && (
        <div className="flex items-center justify-between px-2 py-1 border-t text-[8px] font-mono" style={{ borderColor: '#1a2d4a22' }}>
          <span style={{ color: corridorColor }}>⚡ {metrics.avgSpeed || 0} km/h</span>
          <span className="text-slate-500">↑ {metrics.vehiclesHour || 0} veh/h</span>
          <span className={metrics.queueLength > 5 ? 'text-red-400' : 'text-slate-500'}>Cola: {metrics.queueLength || 0}</span>
        </div>
      )}
    </div>
  );
}
