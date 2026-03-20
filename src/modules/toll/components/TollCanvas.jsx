/**
 * TollCanvas — Parameterized Canvas for any toll station
 * Modes: 'full' (340px, all details) | 'mini' (180px, compact)
 * Adapted from Peaje Chuzacá TollCanvas
 */
import React, { useRef, useEffect, useCallback } from 'react';

const VEHICLE_CATEGORIES = {
  C1: { name: 'Automóvil',     color: '#38bdf8', width: 22, height: 10, speedFactor: 1.0 },
  C2: { name: 'Bus',           color: '#f97316', width: 36, height: 12, speedFactor: 0.75 },
  C3: { name: 'Camión 2 ejes', color: '#a78bfa', width: 40, height: 13, speedFactor: 0.6 },
  C4: { name: 'Camión 3+ ejes',color: '#94a3b8', width: 48, height: 14, speedFactor: 0.5 },
  C5: { name: 'Camión pesado',  color: '#fbbf24', width: 56, height: 15, speedFactor: 0.4 },
};
const CATEGORY_WEIGHTS = { C1: 0.60, C2: 0.15, C3: 0.15, C4: 0.05, C5: 0.05 };

function pickCategory() {
  const r = Math.random();
  let c = 0;
  for (const [cat, w] of Object.entries(CATEGORY_WEIGHTS)) {
    c += w;
    if (r <= c) return cat;
  }
  return 'C1';
}

function laneY(laneIdx, roadTop, roadBot) {
  const laneH = (roadBot - roadTop) / 4;
  return roadTop + laneH * laneIdx + laneH * 0.5;
}

export default function TollCanvas({
  mode = 'full',
  stationName = 'Peaje',
  corridorColor = '#38bdf8',
  lanes = [],
  metrics = {},
  showHeader = true,
  showMetrics = true,
}) {
  const CANVAS_H = mode === 'mini' ? 180 : 340;
  const MAX_VEHICLES = mode === 'mini' ? 18 : 35;
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

  useEffect(() => { dataRef.current = { lanes, metrics }; }, [lanes, metrics]);

  const draw = useCallback((ctx, timestamp) => {
    const { w, h } = sizeRef.current;
    const { lanes: currentLanes, metrics: currentMetrics } = dataRef.current;
    const roadTop = h * ROAD_Y_START;
    const roadBot = h * ROAD_Y_END;
    const laneH = (roadBot - roadTop) / 4;
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
    ctx.fillRect(0, roadBot, w, isMini ? 3 : 6);

    // Lane dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.setLineDash([16, 12]);
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
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
      for (let i = 0; i < 4; i++) {
        ctx.fillText('80', w * 0.12, laneY(i, roadTop, roadBot) + 6);
      }
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

    // Toll Booths
    for (let i = 0; i < 4; i++) {
      const lane = currentLanes[i];
      if (!lane) continue;
      const y = laneY(i, roadTop, roadBot) - BOOTH_H / 2;
      const x = gantryX - BOOTH_W / 2;
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
      ctx.roundRect(x, y, BOOTH_W, BOOTH_H, isMini ? 2 : 4);
      ctx.fill();
      ctx.stroke();

      // Lane label
      ctx.fillStyle = isClosed ? '#64748b' : '#e2e8f0';
      ctx.font = `bold ${isMini ? '8' : '10'}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(lane.label, gantryX, y + BOOTH_H / 2 + (isMini ? 2 : 3));

      // Gate bar (full mode)
      if (!isClosed && !isMini) {
        const gateOpen = lane.queue <= 1;
        const gateAngle = gateOpen ? -Math.PI / 3 : 0;
        const gateStartX = x + BOOTH_W + 2;
        const gateStartY = y + BOOTH_H / 2;
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

    // Vehicles
    const vehicles = vehiclesRef.current;
    for (const v of vehicles) {
      const cat = VEHICLE_CATEGORIES[v.category];
      const cy = laneY(v.lane, roadTop, roadBot);
      const vw = isMini ? cat.width * 0.65 : cat.width;
      const vh = isMini ? cat.height * 0.65 : cat.height;

      ctx.fillStyle = cat.color;
      ctx.beginPath();
      ctx.roundRect(v.x - vw / 2, cy - vh / 2, vw, vh, 2);
      ctx.fill();

      if (!isMini && v.state !== 'at-booth' && v.state !== 'queued') {
        ctx.fillStyle = 'rgba(255, 255, 200, 0.6)';
        ctx.beginPath();
        ctx.arc(v.x + vw / 2 + 2, cy - 2, 1.5, 0, Math.PI * 2);
        ctx.arc(v.x + vw / 2 + 2, cy + 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // HUD Overlays
    if (!isMini) {
      for (let i = 0; i < 4; i++) {
        const lane = currentLanes[i];
        if (!lane || lane.status === 'closed' || !lane.active) continue;
        const cy = laneY(i, roadTop, roadBot);
        const hudX = gantryX + 50;
        const hudY = cy - 14;

        ctx.fillStyle = 'rgba(4, 10, 20, 0.75)';
        ctx.fillRect(hudX, hudY, 72, 24);
        ctx.strokeStyle = `rgba(${cRgb}, 0.3)`;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(hudX, hudY, 72, 24);

        ctx.fillStyle = corridorColor;
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${lane.speed} km/h`, hudX + 4, hudY + 10);
        ctx.fillStyle = lane.queue > 5 ? '#ef4444' : '#475569';
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

  const update = useCallback((timestamp, deltaMs) => {
    const { w, h } = sizeRef.current;
    const { lanes: currentLanes, metrics: currentMetrics } = dataRef.current;
    const roadTop = h * ROAD_Y_START;
    const roadBot = h * ROAD_Y_END;
    const dt = deltaMs / 1000;
    const vehicles = vehiclesRef.current;
    const gantryX = w * GANTRY_X;
    const countLineX = w * COUNT_LINE_X;
    const isMini = mode === 'mini';

    // Spawn vehicles
    const activeLanes = (currentLanes || []).filter(l => l.status !== 'closed' && l.active).map(l => l.id - 1);
    if (activeLanes.length > 0) {
      const flowRate = (currentMetrics.vehiclesHour || 300) / 3600;
      const spawnRate = flowRate * dt * activeLanes.length * (isMini ? 0.5 : 0.8);
      if (Math.random() < spawnRate && vehicles.length < MAX_VEHICLES) {
        const laneIdx = activeLanes[Math.floor(Math.random() * activeLanes.length)];
        const cat = pickCategory();
        const catDef = VEHICLE_CATEGORIES[cat];
        vehicles.push({
          x: -catDef.width,
          lane: laneIdx,
          category: cat,
          speed: (40 + Math.random() * 40) * catDef.speedFactor,
          state: 'approaching',
          waitTimer: 0,
          passedCount: false,
        });
      }
    }

    // Update vehicles
    for (let i = vehicles.length - 1; i >= 0; i--) {
      const v = vehicles[i];
      const catDef = VEHICLE_CATEGORIES[v.category];
      const lane = currentLanes?.[v.lane];
      const boothX = gantryX - BOOTH_W / 2;

      switch (v.state) {
        case 'approaching': {
          const ahead = vehicles.filter(o => o.lane === v.lane && o.x > v.x && o.x < boothX && o !== v);
          const stopX = ahead.length > 0
            ? Math.min(...ahead.map(o => o.x)) - catDef.width - 6
            : boothX - catDef.width / 2 - 4;

          if (v.x + catDef.width / 2 >= stopX && lane && lane.queue > 1) {
            v.state = 'queued';
            v.speed = 0;
          } else if (v.x + catDef.width / 2 >= boothX - 4) {
            v.state = 'at-booth';
            v.speed = 0;
            v.waitTimer = lane?.type === 'FacilPass' ? 0.6 + Math.random() * 0.6 : 1.2 + Math.random() * 1.0;
          } else {
            const dist = boothX - v.x;
            const factor = dist < 100 ? 0.3 + 0.7 * (dist / 100) : 1;
            v.x += v.speed * factor * dt;
          }

          if (!v.passedCount && v.x >= countLineX) {
            v.passedCount = true;
            flashRef.current.push({ y: laneY(v.lane, roadTop, roadBot), time: performance.now() });
          }
          break;
        }
        case 'queued': {
          const aheadQ = vehicles.filter(o => o.lane === v.lane && o.x > v.x && o !== v);
          if (aheadQ.length === 0) {
            v.state = 'approaching';
            v.speed = 20;
          } else {
            const nearest = Math.min(...aheadQ.map(o => o.x));
            if (nearest - v.x > catDef.width + 10) {
              v.x += 15 * dt;
            }
          }
          break;
        }
        case 'at-booth':
          v.waitTimer -= dt;
          if (v.waitTimer <= 0) {
            v.state = 'departing';
            v.speed = 20;
          }
          break;
        case 'departing':
          v.speed = Math.min(v.speed + 60 * dt, 120);
          v.x += v.speed * dt;
          if (v.x > w + 60) vehicles.splice(i, 1);
          break;
        default:
          break;
      }
    }
  }, [mode, BOOTH_W, MAX_VEHICLES]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let lastTime = performance.now();

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = CANVAS_H * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${CANVAS_H}px`;
        ctx.scale(dpr, dpr);
        sizeRef.current = { w: rect.width, h: CANVAS_H };
      }
    });
    observer.observe(canvas.parentElement);

    function loop(timestamp) {
      const delta = Math.min(timestamp - lastTime, 50);
      lastTime = timestamp;

      ctx.save();
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      update(timestamp, delta);
      draw(ctx, timestamp);
      ctx.restore();

      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
  }, [draw, update, CANVAS_H]);

  const activeLanes = (lanes || []).filter(l => l.status !== 'closed' && l.active).length;

  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: '#070d1a', borderColor: '#1a2d4a' }}>
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: '#1a2d4a' }}>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Gemelo Digital — Vista Cenital
          </span>
          <span className="text-[10px] font-mono" style={{ color: corridorColor }}>
            {activeLanes}/4 carriles activos
          </span>
        </div>
      )}
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
