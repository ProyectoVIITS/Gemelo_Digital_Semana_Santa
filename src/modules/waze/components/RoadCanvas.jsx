/**
 * RoadCanvas — Visualización de congestión por vía sobre polilínea Waze.
 *
 * Render rico con cola sintetizada que avanza como cinturón sobre la
 * geometría real reportada por Waze (jam.line[]). Sin dependencias
 * externas: ni WebSocket, ni APIs en tiempo real. Toda la animación se
 * deriva de los props (jamLevel, jamSpeed, jamRatio, polyline, jamName).
 *
 * Decisiones de diseño:
 *  - Cantidad de vehículos derivada de jamLevel × kilómetros de la
 *    polilínea (densidad realista escalada por DENSITY_FACTOR para
 *    legibilidad visual).
 *  - Velocidad visual = jamSpeed × VISUAL_AMP (motion visible incluso
 *    a 5–10 km/h reales que serían sub-pixel sin amplificación).
 *  - Tipos: 80% car / 13% truck / 7% bus en la cola. Motos van aparte
 *    por el lindero (perpendicular offset, 2.5× más rápidas — bypass
 *    realista de motocicletas en atasco).
 *  - Detalle por vehículo: chasis coloreado + techo + parabrisas + luces
 *    + glow. Stop lights brillan si avg < 15 km/h (congestión).
 *  - Halo rojo de severidad cuando jamLevel ≥ 3 || jamRatio > 2.
 */
import React, { useRef, useEffect, useMemo, useState } from 'react';

const PADDING_RATIO = 0.075;
const VISUAL_AMP = 4;
const MAX_VEHICLES_RENDER = 200;

// Densidad estimada de vehículos por km según nivel Waze (escala 0–5).
const VEHICLES_PER_KM_BY_LEVEL = {
  0: 5,
  1: 12,
  2: 25,
  3: 45,
  4: 80,
  5: 120,
};
const DENSITY_FACTOR = 0.10;       // 10% del estimado renderiza (legibilidad)
const MOTO_RATIO = 0.20;           // 20% del flujo Colombia son motos
const MOTO_DENSITY_FACTOR = 0.10;  // mostrar pocas motos (no se atascan)
const MOTO_SPEED_MULT = 2.5;       // motos 2.5× más rápidas que la cola
const MOTO_LATERAL_PX = 20;        // offset perpendicular al eje (lindero)

// Vehículos con detalle: chasis coloreado por tipo + techo, parabrisas,
// luces y glow.
const TYPE_SPEC = {
  car:   { len: 27, wid: 12, color: '#3b82f6' }, // azul
  truck: { len: 42, wid: 9,  color: '#ef4444' }, // rojo
  moto:  { len: 12, wid: 7,  color: '#10b981' }, // verde
  bus:   { len: 46, wid: 10, color: '#f97316' }, // naranja
};

// ── Helpers puros ────────────────────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function polylineLengthKm(polyline) {
  if (!polyline || polyline.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];
    if (!p1 || !p2 || p1.x == null || p1.y == null || p2.x == null || p2.y == null) continue;
    total += haversineKm(p1.y, p1.x, p2.y, p2.x);
  }
  return total;
}

// Dado un arc-length (distancia desde el inicio de la polilínea en
// pixel-space), devuelve el (px, py) y la dirección normalizada local.
function arcToPoint(arc, segs, totalLen) {
  if (!segs || segs.length === 0) return { px: 0, py: 0, dirNx: 1, dirNy: 0 };
  if (arc <= 0) {
    const s = segs[0];
    return { px: s.ax, py: s.ay, dirNx: s.dirNx, dirNy: s.dirNy };
  }
  if (arc >= totalLen) {
    const s = segs[segs.length - 1];
    return { px: s.ax + s.dx, py: s.ay + s.dy, dirNx: s.dirNx, dirNy: s.dirNy };
  }
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (arc <= s.cumPrev + s.len) {
      const localT = (arc - s.cumPrev) / s.len;
      return {
        px: s.ax + localT * s.dx,
        py: s.ay + localT * s.dy,
        dirNx: s.dirNx,
        dirNy: s.dirNy,
      };
    }
  }
  const s = segs[segs.length - 1];
  return { px: s.ax + s.dx, py: s.ay + s.dy, dirNx: s.dirNx, dirNy: s.dirNy };
}

function vehicleSpec(type) {
  return TYPE_SPEC[type] || TYPE_SPEC.car;
}

function drawVehicle(ctx, x, y, angleRad, type, scale, isBraking) {
  const spec = vehicleSpec(type);
  const len = spec.len * scale;
  const wid = spec.wid * scale;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);

  // Sombra perimetral (volumetría top-down)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;

  // Chasis con color por tipo
  ctx.fillStyle = spec.color;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -wid / 2, len, wid, 2);
  ctx.fill();

  // Reset sombra para detalles internos
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Techo (50% del largo, oscuro para volumen 3D)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.roundRect(-len * 0.25, -wid * 0.4, len * 0.5, wid * 0.8, 1);
  ctx.fill();

  // Parabrisas frontal
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  ctx.roundRect(len * 0.18, -wid * 0.35, len * 0.1, wid * 0.7, 1);
  ctx.fill();

  // Parabrisas trasero
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.beginPath();
  ctx.roundRect(-len * 0.27, -wid * 0.35, len * 0.08, wid * 0.7, 1);
  ctx.fill();

  // Stop lights (brillan si congestionado)
  if (isBraking) {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ef4444';
  } else {
    ctx.fillStyle = '#7f1d1d';
  }
  ctx.fillRect(-len / 2, -wid * 0.45, 2, wid * 0.2);
  ctx.fillRect(-len / 2, wid * 0.25, 2, wid * 0.2);

  // Headlights amarillos
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(len / 2 - 2, -wid * 0.45, 2, wid * 0.2);
  ctx.fillRect(len / 2 - 2, wid * 0.25, 2, wid * 0.2);

  // Glow tenue de las luces delanteras
  const glow = ctx.createLinearGradient(len / 2, 0, len / 2 + 12, 0);
  glow.addColorStop(0, 'rgba(254, 240, 138, 0.15)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(len / 2, -wid / 2, 12, wid);

  ctx.restore();
}

function pickNonMotoType() {
  // Distribución renormalizada (sin motos): 80% car / 13% truck / 7% bus
  const r = Math.random();
  if (r < 0.80) return 'car';
  if (r < 0.93) return 'truck';
  return 'bus';
}

// ── Componente ───────────────────────────────────────────────────────
export default function RoadCanvas({
  jamLevel = 3,
  jamSpeed = 10,
  jamRatio = 1,
  polyline = [],
  jamName = null,
  vehicleScale = 1.0,
}) {
  const canvasRef = useRef(null);
  const parentSizeRef = useRef({ w: 0, h: 0 });
  const propsRef = useRef({ jamLevel, jamSpeed, jamRatio, vehicleScale });
  const polylineRef = useRef(polyline);
  const bboxRef = useRef(null);
  const polylinePathRef = useRef({ key: null, path: null, segs: null, totalLen: 0 });
  // Stream continuo de vehículos (no cinturón con wrap). Cada slot tiene su
  // propio arc independiente que avanza, "muere" al cruzar el final, y se
  // respawnea con tipo nuevo al inicio. Evita la sensación de loop visible
  // que aparecía cuando un slot con tipo fijo se teletransportaba al inicio.
  const queueRef = useRef({ slots: [], spawnAcc: 0, initialized: false });
  const motoQueueRef = useRef({ slots: [], spawnAcc: 0, initialized: false });
  const lastTickTimeRef = useRef(0);

  const [hasPolyline] = useState(() => Array.isArray(polyline) && polyline.length > 1);

  // Bbox precomputado de la polilínea
  const bbox = useMemo(() => {
    if (!Array.isArray(polyline) || polyline.length < 2) return null;
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const p of polyline) {
      if (p == null || p.x == null || p.y == null) continue;
      if (p.x < minLon) minLon = p.x;
      if (p.x > maxLon) maxLon = p.x;
      if (p.y < minLat) minLat = p.y;
      if (p.y > maxLat) maxLat = p.y;
    }
    if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null;
    return { minLon, maxLon, minLat, maxLat };
  }, [polyline]);

  // Sync props/polilínea a refs (RAF los lee)
  useEffect(() => {
    propsRef.current = { jamLevel, jamSpeed, jamRatio, vehicleScale };
  }, [jamLevel, jamSpeed, jamRatio, vehicleScale]);

  useEffect(() => {
    polylineRef.current = polyline;
    bboxRef.current = bbox;
    polylinePathRef.current = { key: null, path: null, segs: null, totalLen: 0 };
    queueRef.current = { slots: [], spawnAcc: 0, initialized: false };
    motoQueueRef.current = { slots: [], spawnAcc: 0, initialized: false };
  }, [polyline, bbox]);

  // ResizeObserver: actualiza parentSizeRef
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas && canvas.parentElement;
    if (!parent) return undefined;

    parentSizeRef.current = {
      w: parent.clientWidth || 0,
      h: parent.clientHeight || 0,
    };
    polylinePathRef.current = { key: null, path: null, segs: null, totalLen: 0 };

    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        parentSizeRef.current = { w: e.contentRect.width, h: e.contentRect.height };
        polylinePathRef.current = { key: null, path: null, segs: null, totalLen: 0 };
      }
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // RAF loop principal
  useEffect(() => {
    let rafId = null;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      const { w, h } = parentSizeRef.current;
      if (w < 10 || h < 10) {
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
        polylinePathRef.current = { key: null, path: null, segs: null, totalLen: 0 };
      }

      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);

      // Fondo
      ctx.fillStyle = '#0a0e17';
      ctx.fillRect(0, 0, w, h);

      const bb = bboxRef.current;
      const pl = polylineRef.current;
      const props = propsRef.current;

      if (bb && pl && pl.length > 1) {
        const padX = w * PADDING_RATIO;
        const padY = h * PADDING_RATIO;
        const lonRange = bb.maxLon - bb.minLon || 0.0001;
        const latRange = bb.maxLat - bb.minLat || 0.0001;
        const scaleX = (w - 2 * padX) / lonRange;
        const scaleY = (h - 2 * padY) / latRange;
        const scale = Math.min(scaleX, scaleY);
        const drawnW = lonRange * scale;
        const drawnH = latRange * scale;
        const offsetX = (w - drawnW) / 2;
        const offsetY = (h - drawnH) / 2;

        const project = (lon, lat) => ({
          px: (lon - bb.minLon) * scale + offsetX,
          py: h - ((lat - bb.minLat) * scale + offsetY),
        });

        // Escala dinámica de vehículos según px/m del canvas
        const pixelsPerMeter = scale / 111320;
        const targetCarPixelLength = Math.max(18, 4.5 * pixelsPerMeter);
        const dynamicVehicleScale = Math.max(
          0.2,
          Math.min(3.0, targetCarPixelLength / TYPE_SPEC.car.len),
        );

        // Path2D + segmentos para arc-length
        const pathKey = `${pl.length}|${w}|${h}|${bb.minLon}|${bb.minLat}|${bb.maxLon}|${bb.maxLat}`;
        if (polylinePathRef.current.key !== pathKey) {
          const path = new Path2D();
          const segs = [];
          let started = false;
          let prevPt = null;
          let cumLen = 0;
          for (let i = 0; i < pl.length; i++) {
            const p = pl[i];
            if (p == null || p.x == null || p.y == null) continue;
            const proj = project(p.x, p.y);
            if (!started) { path.moveTo(proj.px, proj.py); started = true; }
            else { path.lineTo(proj.px, proj.py); }
            if (prevPt) {
              const dx = proj.px - prevPt.px;
              const dy = proj.py - prevPt.py;
              const len2 = dx * dx + dy * dy;
              if (len2 > 0.01) {
                const len = Math.sqrt(len2);
                segs.push({
                  ax: prevPt.px, ay: prevPt.py,
                  dx, dy, len2, len,
                  dirNx: dx / len, dirNy: dy / len,
                  cumPrev: cumLen,
                });
                cumLen += len;
              }
            }
            prevPt = proj;
          }
          polylinePathRef.current = { key: pathKey, path, segs, totalLen: cumLen };
          queueRef.current = { slots: [], spawnAcc: 0, initialized: false };
          motoQueueRef.current = { slots: [], spawnAcc: 0, initialized: false };
        }
        const path = polylinePathRef.current.path;
        const polySegs = polylinePathRef.current.segs;
        const polyTotalLen = polylinePathRef.current.totalLen;

        const isSevere = (props.jamLevel >= 3) || (props.jamRatio > 2);

        // Halo rojo (severo)
        if (isSevere) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.10)';
          ctx.lineWidth = 52;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke(path);
        }

        // Borde oscuro (sombra del asfalto)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 42;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke(path);

        // Asfalto principal
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 38;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke(path);

        // Estimar count total de vehículos derivado de Waze
        const lengthKm = polylineLengthKm(pl);
        const perKm = VEHICLES_PER_KM_BY_LEVEL[props.jamLevel] || VEHICLES_PER_KM_BY_LEVEL[3];
        const estimatedTotal = Math.round(lengthKm * perKm);
        const estimatedMotos = Math.round(estimatedTotal * MOTO_RATIO);
        const estimatedNonMoto = estimatedTotal - estimatedMotos;

        const targetN = Math.min(
          MAX_VEHICLES_RENDER,
          Math.round(estimatedNonMoto * DENSITY_FACTOR),
        );
        const targetMotos = Math.min(
          MAX_VEHICLES_RENDER,
          Math.round(estimatedMotos * MOTO_DENSITY_FACTOR),
        );

        // dt
        const nowMs = performance.now();
        const lastTick = lastTickTimeRef.current || nowMs;
        const dt = Math.min(0.1, (nowMs - lastTick) / 1000);
        lastTickTimeRef.current = nowMs;

        // Stop lights brillan si avg < 15 km/h
        const isBraking = (props.jamSpeed || 0) < 15;

        const avgKmh = props.jamSpeed > 0 ? props.jamSpeed : 5;
        const avgMps = avgKmh / 3.6;
        const queueAdvance = avgMps * dt * VISUAL_AMP * pixelsPerMeter;
        const drawScale = props.vehicleScale * dynamicVehicleScale;

        // ── Cola del atasco (car/truck/bus) — stream continuo ──
        // Cada slot tiene su propio arc. Avanza, muere al cruzar el final,
        // y se respawnea con tipo nuevo en arc=0. No hay "wrap" visible:
        // el slot que sale del final NO es el mismo que aparece al inicio.
        const queue = queueRef.current;

        // Primera población: distribuir targetN slots uniformemente sobre
        // la polilínea para evitar canvas vacío al cargar la página.
        if (!queue.initialized && targetN > 0 && polyTotalLen > 0) {
          queue.slots = [];
          for (let i = 0; i < targetN; i++) {
            queue.slots.push({
              arc: (i / targetN) * polyTotalLen,
              type: pickNonMotoType(),
            });
          }
          queue.initialized = true;
          queue.spawnAcc = 0;
        }

        // Advance + cull
        if (queueAdvance > 0) {
          for (const s of queue.slots) s.arc += queueAdvance;
        }
        queue.slots = queue.slots.filter((s) => s.arc < polyTotalLen);

        // Spawn rate: una entrada cada `spacing / advancePerSec` segundos.
        // Mantiene espaciado uniforme entre vehículos que entran al stream.
        if (targetN > 0 && polyTotalLen > 0 && queueAdvance > 0) {
          const spacingPx = polyTotalLen / targetN;
          const spawnIntervalSec = (spacingPx * dt) / queueAdvance;
          queue.spawnAcc += dt;
          while (queue.slots.length < targetN && queue.spawnAcc >= spawnIntervalSec) {
            queue.spawnAcc -= spawnIntervalSec;
            queue.slots.push({ arc: 0, type: pickNonMotoType() });
          }
          // Fill restante (si targetN saltó, ej. polyline cambió)
          while (queue.slots.length < targetN) {
            const idx = queue.slots.length;
            queue.slots.push({
              arc: (idx / targetN) * polyTotalLen,
              type: pickNonMotoType(),
            });
          }
        }
        // Trim si targetN bajó
        while (queue.slots.length > targetN) queue.slots.pop();

        for (const s of queue.slots) {
          const point = arcToPoint(s.arc, polySegs, polyTotalLen);
          const angleRad = Math.atan2(point.dirNy, point.dirNx);
          drawVehicle(ctx, point.px, point.py, angleRad, s.type, drawScale, isBraking);
        }

        // ── Motos por el lindero — mismo stream continuo ──
        const motoQueue = motoQueueRef.current;
        const motoAdvance = queueAdvance * MOTO_SPEED_MULT;

        if (!motoQueue.initialized && targetMotos > 0 && polyTotalLen > 0) {
          motoQueue.slots = [];
          for (let i = 0; i < targetMotos; i++) {
            motoQueue.slots.push({ arc: (i / targetMotos) * polyTotalLen });
          }
          motoQueue.initialized = true;
          motoQueue.spawnAcc = 0;
        }

        if (motoAdvance > 0) {
          for (const s of motoQueue.slots) s.arc += motoAdvance;
        }
        motoQueue.slots = motoQueue.slots.filter((s) => s.arc < polyTotalLen);

        if (targetMotos > 0 && polyTotalLen > 0 && motoAdvance > 0) {
          const motoSpacingPx = polyTotalLen / targetMotos;
          const motoSpawnIntervalSec = (motoSpacingPx * dt) / motoAdvance;
          motoQueue.spawnAcc += dt;
          while (motoQueue.slots.length < targetMotos && motoQueue.spawnAcc >= motoSpawnIntervalSec) {
            motoQueue.spawnAcc -= motoSpawnIntervalSec;
            motoQueue.slots.push({ arc: 0 });
          }
          while (motoQueue.slots.length < targetMotos) {
            const idx = motoQueue.slots.length;
            motoQueue.slots.push({ arc: (idx / targetMotos) * polyTotalLen });
          }
        }
        while (motoQueue.slots.length > targetMotos) motoQueue.slots.pop();

        for (const s of motoQueue.slots) {
          const point = arcToPoint(s.arc, polySegs, polyTotalLen);
          // Offset perpendicular hacia la derecha del heading (lindero)
          const lateralPx = point.px + (-point.dirNy) * MOTO_LATERAL_PX;
          const lateralPy = point.py + point.dirNx * MOTO_LATERAL_PX;
          const angleRad = Math.atan2(point.dirNy, point.dirNx);
          drawVehicle(ctx, lateralPx, lateralPy, angleRad, 'moto', drawScale, false);
        }
      }

      // ── HUD overlay ──
      ctx.fillStyle = '#14b8a6';
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('SINCRONIZANDO GEMELO DIGITAL', 12, 18);

      const isSevereHud = (props.jamLevel >= 3) || (props.jamRatio > 2);
      ctx.fillStyle = isSevereHud ? '#ef4444' : '#f59e0b';
      const speedText = `${Math.round(props.jamSpeed)} KM/H`;
      const ratioText = `${props.jamRatio}x DELAY`;
      ctx.fillText(`⚡ VELOCIDAD VÍA: ${speedText}  |  🕒 EXCESO: ${ratioText}`, w - 240, 18);

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Fallback overlay si no hay polilínea
  const fallbackMessage = !hasPolyline ? 'Sin geometría disponible para esta vía' : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', borderRadius: '4px' }}
      />
      {fallbackMessage && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 14, 23, 0.55)',
            color: '#94a3b8',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            letterSpacing: 0.5,
            pointerEvents: 'none',
          }}
        >
          {fallbackMessage}
        </div>
      )}
    </div>
  );
}
