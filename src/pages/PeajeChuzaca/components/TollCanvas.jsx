import React, { useRef, useEffect, useCallback } from 'react';
import { VEHICLE_CATEGORIES, CATEGORY_WEIGHTS } from '../lib/constants';

const CANVAS_H = 340;
const ROAD_Y_START = 0.22;
const ROAD_Y_END = 0.82;
const COUNT_LINE_X = 0.28;
const GANTRY_X = 0.52;
const BOOTH_W = 32;
const BOOTH_H = 18;
const MAX_VEHICLES = 35;

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

export default function TollCanvas({ sensorData }) {
  const canvasRef = useRef(null);
  const vehiclesRef = useRef([]);
  const animRef = useRef(null);
  const sizeRef = useRef({ w: 800, h: CANVAS_H });
  const flashRef = useRef([]);

  const { lanes, flow } = sensorData;

  // Stable ref to latest sensor data for animation loop
  const dataRef = useRef({ lanes, flow });
  useEffect(() => { dataRef.current = { lanes, flow }; }, [lanes, flow]);

  const draw = useCallback((ctx, timestamp) => {
    const { w, h } = sizeRef.current;
    const { lanes: currentLanes, flow: currentFlow } = dataRef.current;
    const roadTop = h * ROAD_Y_START;
    const roadBot = h * ROAD_Y_END;
    const laneH = (roadBot - roadTop) / 4;

    // === Background ===
    ctx.fillStyle = '#070d1a';
    ctx.fillRect(0, 0, w, h);

    // Grid dots
    ctx.fillStyle = '#0a1628';
    for (let x = 0; x < w; x += 24) {
      for (let y = 0; y < h; y += 24) {
        const scale = 0.6 + 0.4 * (y / h);
        ctx.beginPath();
        ctx.arc(x, y, 1 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // === Road surface ===
    ctx.fillStyle = '#1a2035';
    ctx.fillRect(0, roadTop, w, roadBot - roadTop);

    // Bermas
    ctx.fillStyle = '#141c2b';
    ctx.fillRect(0, roadTop - 6, w, 6);
    ctx.fillRect(0, roadBot, w, 6);

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

    // Speed markings on road
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = '18px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < 4; i++) {
      const y = laneY(i, roadTop, roadBot);
      ctx.fillText('80', w * 0.12, y + 6);
    }

    // === Línea de Conteo Vehicular ===
    const countLineX = w * COUNT_LINE_X;
    const countPulse = 0.3 + 0.5 * Math.abs(Math.sin(timestamp * 0.003));
    ctx.strokeStyle = `rgba(14, 165, 233, ${countPulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(countLineX, roadTop);
    ctx.lineTo(countLineX, roadBot);
    ctx.stroke();
    ctx.setLineDash([]);

    // Count line label
    ctx.fillStyle = 'rgba(14, 165, 233, 0.6)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LÍNEA DE CONTEO', countLineX, roadTop - 10);

    // Detection flashes when vehicle crosses
    flashRef.current = flashRef.current.filter(f => timestamp - f.time < 200);
    flashRef.current.forEach(f => {
      ctx.strokeStyle = `rgba(14, 165, 233, ${1 - (timestamp - f.time) / 200})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(countLineX - 10, f.y);
      ctx.lineTo(countLineX + 10, f.y);
      ctx.stroke();
    });

    // === Toll Gantry ===
    const gantryX = w * GANTRY_X;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gantryX, roadTop - 16);
    ctx.lineTo(gantryX, roadBot + 16);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Gantry horizontal beam
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(gantryX - 2, roadTop - 20, 4, 6);
    ctx.fillRect(gantryX - 2, roadBot + 14, 4, 6);

    // Sensor icons on gantry
    const iconY = roadTop - 30;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    // PTZ Camera
    ctx.fillRect(gantryX - 20, iconY, 8, 6);
    ctx.fillText('PTZ', gantryX - 16, iconY - 3);
    // Antenna
    ctx.beginPath();
    ctx.moveTo(gantryX, iconY + 6);
    ctx.lineTo(gantryX - 3, iconY);
    ctx.lineTo(gantryX + 3, iconY);
    ctx.fill();
    ctx.fillText('RF', gantryX, iconY - 3);
    // CCTV
    ctx.beginPath();
    ctx.arc(gantryX + 16, iconY + 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('CCTV', gantryX + 16, iconY - 3);

    // === Toll Booths ===
    for (let i = 0; i < 4; i++) {
      const lane = currentLanes[i];
      const y = laneY(i, roadTop, roadBot) - BOOTH_H / 2;
      const x = gantryX - BOOTH_W / 2;

      let fillColor, borderColor;
      if (lane.status === 'closed') {
        fillColor = 'rgba(100, 100, 100, 0.1)';
        borderColor = '#ef4444';
      } else if (lane.status === 'incident') {
        const pulse = 0.5 + 0.5 * Math.sin(timestamp * 0.005);
        fillColor = `rgba(249, 115, 22, ${0.1 + pulse * 0.1})`;
        borderColor = `rgba(249, 115, 22, ${0.5 + pulse * 0.5})`;
      } else {
        fillColor = 'rgba(14, 165, 233, 0.12)';
        borderColor = '#38bdf8';
      }

      // Booth body
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, BOOTH_W, BOOTH_H, 4);
      ctx.fill();
      ctx.stroke();

      // Lane label
      ctx.fillStyle = lane.status === 'closed' ? '#64748b' : '#e2e8f0';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(lane.label, gantryX, y + BOOTH_H / 2 + 3);

      // Gate bar
      if (lane.status !== 'closed') {
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

      // Payment type label (below booth)
      ctx.fillStyle = '#475569';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lane.type, gantryX, y + BOOTH_H + 10);
    }

    // === Vehicles ===
    const vehicles = vehiclesRef.current;
    for (const v of vehicles) {
      const cat = VEHICLE_CATEGORIES[v.category];
      const cy = laneY(v.lane, roadTop, roadBot);

      // Vehicle body
      ctx.fillStyle = cat.color;
      ctx.beginPath();
      ctx.roundRect(v.x - cat.width / 2, cy - cat.height / 2, cat.width, cat.height, 3);
      ctx.fill();

      // Headlights when moving
      if (v.state !== 'at-booth' && v.state !== 'queued') {
        ctx.fillStyle = 'rgba(255, 255, 200, 0.6)';
        ctx.beginPath();
        ctx.arc(v.x + cat.width / 2 + 2, cy - 2, 1.5, 0, Math.PI * 2);
        ctx.arc(v.x + cat.width / 2 + 2, cy + 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

    }

    // === HUD Overlays per lane ===
    for (let i = 0; i < 4; i++) {
      const lane = currentLanes[i];
      if (lane.status === 'closed') continue;
      const cy = laneY(i, roadTop, roadBot);
      const hudX = gantryX + 50;
      const hudY = cy - 14;

      ctx.fillStyle = 'rgba(4, 10, 20, 0.75)';
      ctx.fillRect(hudX, hudY, 72, 24);
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(hudX, hudY, 72, 24);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${lane.speed} km/h`, hudX + 4, hudY + 10);
      ctx.fillStyle = lane.queue > 5 ? '#ef4444' : '#475569';
      ctx.fillText(`Cola: ${lane.queue}`, hudX + 4, hudY + 20);
    }

    // === Occupancy Bar ===
    const barY = h - 22;
    const barW = w - 40;
    const barH = 10;
    ctx.fillStyle = '#0d1a2e';
    ctx.fillRect(20, barY, barW, barH);

    const occW = barW * (currentFlow.occupancy / 100);
    const grad = ctx.createLinearGradient(20, 0, 20 + barW, 0);
    grad.addColorStop(0, '#22c55e');
    grad.addColorStop(0.6, '#f59e0b');
    grad.addColorStop(1, '#ef4444');
    ctx.fillStyle = grad;
    ctx.fillRect(20, barY, occW, barH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${currentFlow.occupancy}%`, w - 22, barY + 9);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.fillText('OCUPACIÓN', 22, barY - 3);
  }, []);

  const update = useCallback((timestamp, deltaMs) => {
    const { w, h } = sizeRef.current;
    const { lanes: currentLanes, flow: currentFlow } = dataRef.current;
    const roadTop = h * ROAD_Y_START;
    const roadBot = h * ROAD_Y_END;
    const dt = deltaMs / 1000;
    const vehicles = vehiclesRef.current;
    const gantryX = w * GANTRY_X;
    const countLineX = w * COUNT_LINE_X;

    // Spawn vehicles
    const activeLanes = currentLanes.filter(l => l.status !== 'closed').map(l => l.id - 1);
    if (activeLanes.length > 0) {
      const spawnRate = (currentFlow.vehiclesHour / 3600) * dt * activeLanes.length * 0.8;
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

    // Update each vehicle
    for (let i = vehicles.length - 1; i >= 0; i--) {
      const v = vehicles[i];
      const catDef = VEHICLE_CATEGORIES[v.category];
      const lane = currentLanes[v.lane];
      const boothX = gantryX - BOOTH_W / 2;

      switch (v.state) {
        case 'approaching': {
          // Check if need to queue
          const ahead = vehicles.filter(
            o => o.lane === v.lane && o.x > v.x && o.x < boothX && o !== v
          );
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
            // Decelerate as approaching booth
            const dist = boothX - v.x;
            const factor = dist < 100 ? 0.3 + 0.7 * (dist / 100) : 1;
            v.x += v.speed * factor * dt;
          }

          // Count line flash
          if (!v.passedCount && v.x >= countLineX) {
            v.passedCount = true;
            flashRef.current.push({ y: laneY(v.lane, roadTop, roadBot), time: performance.now() });
          }
          break;
        }
        case 'queued': {
          // Check if front of queue can proceed
          const aheadQ = vehicles.filter(
            o => o.lane === v.lane && o.x > v.x && o !== v
          );
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
        case 'at-booth': {
          v.waitTimer -= dt;
          if (v.waitTimer <= 0) {
            v.state = 'departing';
            v.speed = 20;
          }
          break;
        }
        case 'departing': {
          v.speed = Math.min(v.speed + 60 * dt, 120);
          v.x += v.speed * dt;
          if (v.x > w + 60) {
            vehicles.splice(i, 1);
          }
          break;
        }
        default:
          break;
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let lastTime = performance.now();

    // Resize handler
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
  }, [draw, update]);

  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: '#070d1a', borderColor: '#1a2d4a' }}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: '#1a2d4a' }}>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Gemelo Digital — Vista Cenital</span>
        <span className="text-[10px] font-mono text-cyan-400">{lanes.filter(l => l.status !== 'closed').length}/4 carriles activos</span>
      </div>
      <div style={{ height: CANVAS_H }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: CANVAS_H }} />
      </div>
    </div>
  );
}
