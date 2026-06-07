/**
 * VIITS-NEXUS · Módulo Logística · MicropointCanvas
 * ─────────────────────────────────────────────────
 * Representación funcional del flujo vehicular en un micropunto.
 * Calzada limpia horizontal con 0–1 vehículo visible a la vez.
 * La vía vacía es PARTE de la representación: en flujo libre las
 * vías reales están vacías la mayor parte del tiempo, con vehículos
 * pasando rápido cada pocos segundos.
 *
 * Calibración:
 *  - PX_PER_KMH define la velocidad visual proporcional a km/h reales.
 *    A 80 km/h en un canvas de ~540 px, un vehículo cruza en ~4.5 s.
 *  - El delay entre vehículos depende de IRT:
 *      flujo libre  (irt < 15)  → 3.5–6.5 s
 *      moderado     (irt < 40)  → 1.8–3.5 s
 *      congestionado (irt < 70) → 0.8–1.8 s
 *      crítico      (irt >= 70) → 0.3–0.9 s
 *  - Distribución de tipo: 70% auto, 20% camión, 10% moto.
 */
import React, { useEffect, useMemo, useRef } from 'react';

// Calibración visual
const PX_PER_KMH = 1.55;          // 80 km/h ≈ 124 px/s → cruza 540 px en 4.4 s
const ROAD_HEIGHT_RATIO = 0.55;   // altura de la calzada respecto al canvas
const VEHICLE_MARGIN_PX = 80;     // entra y sale fuera del canvas
const SHOULDER_PX = 6;

const TYPE_SPEC = {
  car:   { len: 30, wid: 12, color: '#3b82f6' },
  truck: { len: 46, wid: 12, color: '#ef4444' },
  moto:  { len: 14, wid: 6,  color: '#10b981' },
};

function pickVehicleType() {
  const r = Math.random();
  if (r < 0.70) return 'car';
  if (r < 0.90) return 'truck';
  return 'moto';
}

/**
 * Devuelve un delay aleatorio (segundos) entre vehículos según IRT.
 */
function nextDelaySec(irt) {
  const i = irt ?? 5;
  if (i < 15) return 3.5 + Math.random() * 3.0;   // 3.5–6.5 s — flujo libre
  if (i < 40) return 1.8 + Math.random() * 1.7;   // 1.8–3.5 s — moderado
  if (i < 70) return 0.8 + Math.random() * 1.0;   // 0.8–1.8 s — congestionado
  return 0.3 + Math.random() * 0.6;               // 0.3–0.9 s — crítico
}

/**
 * Velocidad visual en px/s en función de km/h reales. Si IRT alto,
 * reduce la velocidad para reflejar congestión visual.
 */
function visualSpeedPxS(speedKmh, irt) {
  const base = (speedKmh || 70) * PX_PER_KMH;
  if (irt == null || irt < 60) return base;
  // En congestión, los vehículos visualmente avanzan más despacio
  // proporcional al IRT.
  const slowdown = Math.min(0.6, (irt - 60) / 100);
  return base * (1 - slowdown);
}

// ── Dibujo de calzada limpia y horizontal ────────────────────────────

function drawRoad(ctx, w, h) {
  const roadH = h * ROAD_HEIGHT_RATIO;
  const yTop = (h - roadH) / 2;
  const yBot = yTop + roadH;

  // Asfalto principal
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, yTop, w, roadH);

  // Bordes (líneas blancas tenues)
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, yTop + SHOULDER_PX);
  ctx.lineTo(w, yTop + SHOULDER_PX);
  ctx.moveTo(0, yBot - SHOULDER_PX);
  ctx.lineTo(w, yBot - SHOULDER_PX);
  ctx.stroke();

  // Línea central discontinua amarilla
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  ctx.moveTo(0, (yTop + yBot) / 2);
  ctx.lineTo(w, (yTop + yBot) / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  return { yTop, yBot, yCenter: (yTop + yBot) / 2, roadH };
}

function drawVehicle(ctx, x, y, type) {
  const spec = TYPE_SPEC[type] || TYPE_SPEC.car;
  const len = spec.len;
  const wid = spec.wid;

  // Sombra
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.roundRect(x - len / 2 + 2, y - wid / 2 + 3, len, wid, 2);
  ctx.fill();

  // Chasis
  ctx.fillStyle = spec.color;
  ctx.beginPath();
  ctx.roundRect(x - len / 2, y - wid / 2, len, wid, 2);
  ctx.fill();

  // Techo (oscurecido)
  if (type !== 'moto') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.roundRect(x - len * 0.20, y - wid * 0.4, len * 0.45, wid * 0.8, 1);
    ctx.fill();

    // Parabrisas frontal
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(x + len * 0.18, y - wid * 0.35, len * 0.08, wid * 0.7);
  }

  // Faros delanteros (amarillos)
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(x + len / 2 - 1.5, y - wid * 0.4, 1.5, wid * 0.2);
  ctx.fillRect(x + len / 2 - 1.5, y + wid * 0.2, 1.5, wid * 0.2);
}

// ── Componente ──────────────────────────────────────────────────────

export default function MicropointCanvas({ speed = 77, irt = 5 }) {
  const canvasRef = useRef(null);
  const parentSizeRef = useRef({ w: 0, h: 0 });
  const lastTimeRef = useRef(0);

  // Estado: máximo 1 vehículo activo. El resto del tiempo la vía está vacía.
  const stateRef = useRef({
    active: null,        // { type, x, lane: 'main' | 'moto' } o null
    delay: 1.0,          // segundos hasta el próximo spawn
  });

  const speedRef = useRef(speed);
  const irtRef = useRef(irt);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { irtRef.current = irt; }, [irt]);

  // ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas && canvas.parentElement;
    if (!parent) return undefined;
    parentSizeRef.current = { w: parent.clientWidth, h: parent.clientHeight };
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        parentSizeRef.current = { w: e.contentRect.width, h: e.contentRect.height };
      }
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // RAF
  useEffect(() => {
    let rafId = null;

    const draw = (timestamp) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      const { w, h } = parentSizeRef.current;
      if (w < 20 || h < 20) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(w * dpr);
      const targetH = Math.round(h * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);

      // Fondo
      ctx.fillStyle = '#0a0e17';
      ctx.fillRect(0, 0, w, h);

      // Calzada
      const road = drawRoad(ctx, w, h);

      // Delta de tiempo
      const last = lastTimeRef.current || timestamp;
      const dt = Math.min(0.08, (timestamp - last) / 1000);
      lastTimeRef.current = timestamp;

      const state = stateRef.current;
      const vSpeed = visualSpeedPxS(speedRef.current, irtRef.current);

      if (state.active) {
        state.active.x += vSpeed * dt;
        if (state.active.x > w + VEHICLE_MARGIN_PX) {
          state.active = null;
          state.delay = nextDelaySec(irtRef.current);
        } else {
          // Posición Y según el carril
          const y = state.active.lane === 'moto'
            ? road.yCenter - road.roadH * 0.28        // moto va por el borde superior
            : road.yCenter + road.roadH * 0.18;       // autos por carril principal
          drawVehicle(ctx, state.active.x, y, state.active.type);
        }
      } else {
        state.delay -= dt;
        if (state.delay <= 0) {
          const type = pickVehicleType();
          state.active = {
            type,
            x: -VEHICLE_MARGIN_PX,
            lane: type === 'moto' ? 'moto' : 'main',
          };
        }
      }

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
