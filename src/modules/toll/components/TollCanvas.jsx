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
  // Semana Santa 2026
  '2026-04-02': { start: 10, end: 23 }, // Jueves Santo
  '2026-04-03': { start: 6, end: 23 },  // Viernes Santo
  '2026-04-04': { start: 6, end: 23 },  // Sábado de Gloria
  '2026-04-05': { start: 10, end: 23 }, // Domingo de Resurrección
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
  const { isRetorno } = getOperationMode();

  let weights;
  if (isRetorno && restricted) {
    // Retorno con restricción de carga
    const isRetornoPeak = hour >= 18 && hour <= 23; // 54.3% viajes 6PM-12AM
    const isRetornoMorning = hour >= 10 && hour <= 14; // Pico adelantado mañana
    if (isRetornoPeak) {
      weights = CATEGORY_WEIGHTS_RETORNO_PEAK; // Máximo buses, mínimo motos
    } else if (isRetornoMorning) {
      weights = CATEGORY_WEIGHTS_RETORNO_RESTRICTED; // Buses altos, motos moderadas
    } else {
      weights = CATEGORY_WEIGHTS_RESTRICTED; // Restricción base
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
  direction = 'salida', // 'salida' | 'retorno'
}) {
  const CANVAS_H = mode === 'mini' ? 180 : 340;
  // MAX_VEHICLES adapts to time: fewer at night to prevent visual clutter
  const _colHour = getColHour();
  const _isNight = _colHour >= 20 || _colHour <= 5;
  const MAX_VEHICLES = _isNight
    ? (mode === 'mini' ? 6 : 12)    // night: sparse, max 12 vehicles visible
    : (mode === 'mini' ? 18 : 35);  // day: normal density
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
  const dataRef = useRef({ lanes, metrics });

  useEffect(() => { dataRef.current = { lanes, metrics, direction }; }, [lanes, metrics, direction]);

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
      const vw = isMini ? cat.width * 0.65 : cat.width;
      const vh = isMini ? cat.height * 0.65 : cat.height;
      const headlightDir = v.isCounter ? -1 : 1; // counter vehicles face left

      if (cat.isMoto) {
        // Motorcycle — small oval shape on berma
        ctx.fillStyle = v.isCounter ? '#86efac' : cat.color; // counter motos slightly different green
        ctx.globalAlpha = v.isCounter ? 0.6 : 0.85;
        ctx.beginPath();
        ctx.ellipse(v.x, cy, vw / 2, vh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (v.state === 'approaching' || v.state === 'departing') {
          ctx.fillStyle = 'rgba(255, 255, 200, 0.7)';
          ctx.beginPath();
          ctx.arc(v.x + headlightDir * (vw / 2), cy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        // Regular vehicles
        ctx.fillStyle = v.isCounter ? adjustAlpha(cat.color, 0.55) : cat.color;
        ctx.beginPath();
        ctx.roundRect(v.x - vw / 2, cy - vh / 2, vw, vh, 2);
        ctx.fill();

        // Headlights — direction-aware
        if (!isMini && v.state !== 'at-booth' && v.state !== 'queued') {
          ctx.fillStyle = v.isCounter ? 'rgba(255, 200, 200, 0.5)' : 'rgba(255, 255, 200, 0.6)';
          ctx.beginPath();
          ctx.arc(v.x + headlightDir * (vw / 2 + 2), cy - 2, 1.5, 0, Math.PI * 2);
          ctx.arc(v.x + headlightDir * (vw / 2 + 2), cy + 2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Tail lights for counter vehicles (red, on right side)
        if (!isMini && v.isCounter) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
          ctx.beginPath();
          ctx.arc(v.x + vw / 2 + 1, cy - 2, 1, 0, Math.PI * 2);
          ctx.arc(v.x + vw / 2 + 1, cy + 2, 1, 0, Math.PI * 2);
          ctx.fill();
        }
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
    const { lanes: currentLanes, metrics: currentMetrics } = dataRef.current;
    const roadTop = h * ROAD_Y_START;
    const roadBot = h * ROAD_Y_END;
    const numLanes = (currentLanes || []).length || 4;
    const dt = deltaMs / 1000;
    const vehicles = vehiclesRef.current;
    const gantryX = w * GANTRY_X;
    const countLineX = w * COUNT_LINE_X;
    const isMini = mode === 'mini';

    // ── Spawn vehicles — accumulator pattern (NEVER stops) ──
    // SALIDA vehicles ONLY use salida lanes (never retorno lanes)
    const activeLanes = (currentLanes || []).filter(l => {
      if (l.status === 'closed' || !l.active) return false;
      return l.direction === 'salida' || (!l.direction); // only salida lanes
    }).map(l => l.id - 1);
    if (activeLanes.length > 0) {
      // ── Spawn rate proportional to REAL flow (per station, NOT per lane) ──
      // vehiclesHour is TOTAL for the station (all lanes combined)
      // 22:00 valley: ~30-50 veh/h → 0.008-0.014 veh/s → 1 vehicle every 70-120s
      // 08:00 peak:   ~500 veh/h  → 0.14 veh/s → 1 vehicle every 7s
      // Minimum visual: 1 vehicle every ~8s at night (keeps road alive but sparse)
      const hour = getColHour();
      const isNightTime = hour >= 20 || hour <= 5;
      const rawFlow = (currentMetrics.vehiclesHour || 60) / 3600; // per STATION total
      const minVisualFlow = isNightTime
        ? (isMini ? 0.06 : 0.12)   // night: ~1 veh every 8s (very sparse)
        : (isMini ? 0.15 : 0.25);  // day: ~1 veh every 4s minimum
      const effectiveFlow = Math.max(rawFlow, minVisualFlow); // DO NOT multiply by lanes

      // Accumulate fractional spawns to guarantee eventual spawn
      spawnAccRef.current += effectiveFlow * dt;

      while (spawnAccRef.current >= 1 && vehicles.length < MAX_VEHICLES) {
        spawnAccRef.current -= 1;
        const cat = pickCategory();
        const catDef = VEHICLE_CATEGORIES[cat];

        // ── Speed based on real flow: valley = slow approach, peak = faster ──
        const vehHour = currentMetrics.vehiclesHour || 100;
        const flowRatio = Math.min(vehHour / 600, 1); // 0 = empty, 1 = saturated
        // Valley (22h, ~40 veh/h): approach at 25-40 km/h → calm, sparse
        // Peak (8h, ~500 veh/h): approach at 35-60 km/h → dense, faster arrival
        const approachSpeedBase = 25 + flowRatio * 20; // 25-45 range
        const approachSpeedVar = 8 + flowRatio * 12;   // 8-20 variance

        if (catDef.isMoto) {
          // Motos SALIDA: berma inferior, junto al último carril — izq→der
          // En retorno: pocas motos salen (70% se rechazan → solo 30% del volumen normal)
          const { isRetorno: isRetMode } = getOperationMode();
          if (isRetMode && Math.random() < 0.70) {
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
          const laneIdx = activeLanes[Math.floor(Math.random() * activeLanes.length)];
          const spawnSpeed = (approachSpeedBase + Math.random() * approachSpeedVar) * catDef.speedFactor;
          vehicles.push({
            x: -catDef.width - Math.random() * 60,
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
      const { isRetorno: isRetornoMode } = getOperationMode();
      const numLanesNow = (currentLanes || []).length || 4;
      const c1Y = laneY(0, roadTop, roadBot, numLanesNow);
      const laneHNow = (roadBot - roadTop) / numLanesNow;

      // Volumen motos retorno: mayor cuando es operación retorno
      const motoRetornoFlow = isRetornoMode
        ? (_isNight ? 0.06 : 0.18)  // Retorno: muchas motos entrando
        : (_isNight ? 0.02 : 0.06); // Salida: pocas motos entrando

      if (!window._motoRetornoAcc) window._motoRetornoAcc = 0;
      window._motoRetornoAcc += motoRetornoFlow * dt;

      const motoRetornoCount = vehicles.filter(v => v.isMoto && v.isCounter).length;
      const MAX_MOTO_RETORNO = isRetornoMode ? (_isNight ? 3 : 6) : (_isNight ? 1 : 3);

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
      const { isRetorno: isRetornoMode, retornoScale } = getOperationMode();
      // Flujo de retorno proporcional a la escala y demanda
      // En retorno activo: flujo alto (proporcional al flujo principal)
      // En salida: flujo bajo por carriles de retorno fijos
      const mainFlow = (currentMetrics.vehiclesHour || 60) / 3600;
      const retornoRatio = isRetornoMode ? Math.max(retornoScale * 1.5, 0.25) : 0.05;
      const retornoFlow = Math.max(mainFlow * retornoRatio, isRetornoMode ? 0.12 : 0.03);
      counterAccRef.current += retornoFlow * dt;

      // Más vehículos en retorno activo
      const MAX_RETORNO_VEH = isRetornoMode
        ? (_isNight ? 4 : (isMini ? 6 : 14))
        : (_isNight ? 2 : (isMini ? 3 : 5));
      const retornoVehCount = vehicles.filter(v => v.isCounter && !v.isMoto).length;

      while (counterAccRef.current >= 1 && retornoVehCount < MAX_RETORNO_VEH) {
        counterAccRef.current -= 1;
        const nonMotoCategories = ['C1', 'C2', 'C3', 'C4', 'C5'];
        const weights = [0.50, 0.15, 0.18, 0.10, 0.07];
        let r = Math.random(), acc = 0, cat = 'C1';
        for (let i = 0; i < nonMotoCategories.length; i++) {
          acc += weights[i];
          if (r < acc) { cat = nonMotoCategories[i]; break; }
        }
        const catDef = VEHICLE_CATEGORIES[cat];
        const chosenLane = retornoLanes[Math.floor(Math.random() * retornoLanes.length)];

        // Velocidad de retorno: en pico baja (cola), en valle normal
        const retSpeed = isRetornoMode
          ? (15 + Math.random() * 25 + (1 - retornoScale) * 20) // pico: 15-40, valle: 25-60
          : (40 + Math.random() * 30); // flujo libre

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
      counterAccRef.current = Math.min(counterAccRef.current, 2);
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

    // Colombia hour for peak detection (cached per frame)
    const hour = parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }), 10);
    const isPeakHour = (hour >= 6 && hour <= 8) || (hour >= 13 && hour <= 17);

    // ── Update vehicles ──
    for (let i = vehicles.length - 1; i >= 0; i--) {
      const v = vehicles[i];
      const catDef = VEHICLE_CATEGORIES[v.category];
      if (!catDef) { vehicles.splice(i, 1); continue; }

      // Counter-flow vehicles: travel RIGHT → LEFT
      if (v.isCounter) {
        if (v.isMoto) {
          // Motos counter: flujo libre, no frenan
          v.x -= v.speed * dt;
        } else {
          // Vehículos counter: frenan al acercarse a la caseta, esperan, salen
          const distToBooth = v.x - gantryX;
          if (v.state === 'departing' && distToBooth > 0) {
            // Approaching booth from right: decelerate
            if (distToBooth < 120) {
              const brakeFactor = Math.max(distToBooth / 120, 0.08);
              v.x -= v.speed * brakeFactor * dt;
            } else {
              v.x -= v.speed * dt;
            }
            // Reached booth → wait
            if (distToBooth <= 5) {
              v.state = 'counter-booth';
              v.waitTimer = 1.5 + Math.random() * 3; // 1.5-4.5s en caseta
            }
          } else if (v.state === 'counter-booth') {
            v.waitTimer -= dt;
            if (v.waitTimer <= 0) {
              v.state = 'counter-exit';
              v.speed = 25 + Math.random() * 20;
            }
          } else {
            // counter-exit: acelerar y salir por la izquierda
            v.speed = Math.min(v.speed + 15 * dt, 80);
            v.x -= v.speed * dt;
          }
          // Anti-collision: frenado por vehículo counter delante
          for (const o of vehicles) {
            if (o === v || !o.isCounter || o.isMoto || o.lane !== v.lane) continue;
            if (o.x < v.x && (v.x - o.x) < (VEHICLE_CATEGORIES[o.category]?.width || 20) + 10) {
              v.x = o.x + (VEHICLE_CATEGORIES[o.category]?.width || 20) + 10;
              break;
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

      // ── Anti-freeze: detect stuck vehicles ──
      const prevX = v._prevX || v.x;
      if (Math.abs(v.x - prevX) < 0.3 && v.state !== 'at-booth') {
        v.stuckTimer = (v.stuckTimer || 0) + dt;
        if (v.stuckTimer > 5) { v.state = 'departing'; v.speed = 30; v.stuckTimer = 0; }
      } else {
        v.stuckTimer = 0;
      }
      v._prevX = v.x;

      const laneQueue = lane ? lane.queue : 0;
      const effectiveQueue = isPeakHour ? laneQueue : Math.min(laneQueue, 1);
      const aheadX = nearestAhead(v);
      const gapToAhead = aheadX - v.x;

      switch (v.state) {
        case 'approaching': {
          const distToBooth = boothX - v.x;

          // ── Collision prevention: brake if too close to vehicle ahead ──
          if (gapToAhead < MIN_GAP * 2.5 && gapToAhead > 0) {
            // Smooth braking: decelerate proportionally to gap
            const brakeFactor = Math.max(0, (gapToAhead - MIN_GAP) / (MIN_GAP * 1.5));
            v.speed = Math.max(5, v.speed * (0.85 + 0.15 * brakeFactor));
            v.x += v.speed * brakeFactor * dt;

            // Hard stop if about to overlap
            if (gapToAhead <= MIN_GAP) {
              v.speed = 0;
              if (effectiveQueue > 1) { v.state = 'queued'; }
            }
          } else if (distToBooth <= catDef.width / 2 + 4) {
            // Arrived at booth
            v.state = 'at-booth';
            v.speed = 0;
            const baseWait = lane?.type === 'FacilPass' ? 0.4 + Math.random() * 0.4 : 0.8 + Math.random() * 0.6;
            v.waitTimer = isPeakHour ? baseWait * 1.5 : baseWait;
          } else {
            // ── Smooth deceleration curve approaching booth ──
            const approachFactor = distToBooth < 150 ? 0.25 + 0.75 * (distToBooth / 150) : 1;
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
            // Nothing ahead — advance to booth
            v.state = 'approaching';
            v.speed = 20;
          } else if (gapToAhead > MIN_GAP + 6) {
            // Creep forward keeping safe gap
            const creepSpeed = Math.min(15, (gapToAhead - MIN_GAP) * 2);
            v.x += creepSpeed * dt;
          }
          // else: stay put, gap too small
          break;
        }
        case 'at-booth':
          v.waitTimer -= dt;
          if (v.waitTimer <= 0) {
            v.state = 'departing';
            v.speed = 25;
          }
          break;
        case 'departing':
          // Aceleración realista post-peaje: 0→60 km/h gradual, no salto a 130
          v.speed = Math.min(v.speed + 45 * dt, 70);
          v.x += v.speed * dt;
          if (v.x > w + 60) vehicles.splice(i, 1);
          break;
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

    // ── Animation loop: cap delta to prevent burst after tab-switch ──
    // When browser tab is in background, rAF is paused. On return, delta could be
    // thousands of ms → burst spawn + teleport vehicles. Cap delta to 50ms (20fps min).
    // Also use document.visibilityState to handle tab unfocus gracefully.
    function loop(timestamp) {
      // Cap delta: if tab was backgrounded, delta can be huge → clamp to 50ms
      const rawDelta = timestamp - lastTime;
      const delta = Math.min(rawDelta, 50);
      lastTime = timestamp;

      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      update(timestamp, delta);
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
