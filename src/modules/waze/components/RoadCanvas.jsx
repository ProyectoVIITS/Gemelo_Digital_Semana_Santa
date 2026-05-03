/**
 * RoadCanvas v3 — Vehículos SUMO de alta fidelidad sobre geometría real
 *
 * Cambios v3 sobre v2:
 *   - Render de vehículos detallado (chasis, techo, parabrisas, luces, glow)
 *   - Color estable por id (no flickea entre frames)
 *   - Animación 60 fps con interpolación lineal entre snapshots SUMO (cada 0.5s)
 *   - Polilínea Waze como "asfalto" generoso (38 px) con borde oscuro y
 *     halo rojo cuando jamLevel >= 3 || jamRatio > 2.
 *   - SIN líneas de carriles inventadas: la disposición paralela emerge de
 *     las lat/lon reales que SUMO entrega por vehículo.
 *   - Anti-loop tras 4404: relookup con delay de 5s (caps ~0.2 iter/seg).
 *   - HUD lee de refs → cero re-renders por frame de simulación.
 */
import React, { useRef, useEffect, useState, useMemo } from 'react';

// ── Constantes ───────────────────────────────────────────────────────
const WS_RECONNECT_BASE = 1000;
const WS_RECONNECT_MAX = 30000;
const FIRST_FRAME_TIMEOUT = 5000;
const MAX_VEHICLES_RENDER = 200;
const PADDING_RATIO = 0.075;
const LOOKUP_BACKOFF_BASE = 1000;
const LOOKUP_BACKOFF_MAX = 30000;
const LOOKUP_REFRESH_MS = 60000;
const FRAME_PERIOD_MS = 500;
const RELOOKUP_AFTER_4404_MS = 5000;

// Vehículo con detalle: chasis coloreado por tipo + techo, parabrisas,
// luces y glow. Dimensiones bumpeadas +30% sobre la versión previa.
const TYPE_SPEC = {
  car:   { len: 27, wid: 12, color: '#3b82f6' }, // azul
  truck: { len: 42, wid: 9,  color: '#ef4444' }, // rojo
  moto:  { len: 12, wid: 7,  color: '#10b981' }, // verde
  bus:   { len: 46, wid: 10, color: '#f97316' }, // naranja
};

// Densidad visual: solo renderizamos una fracción del count SUMO. La cola
// luce más legible con menos slots y deja respirar la geometría.
const DENSITY_FACTOR = 0.10;        // car/truck/bus en el atasco
const MOTO_DENSITY_FACTOR = 0.30;   // motos en el lindero
const MOTO_LATERAL_PX = 20;         // offset perpendicular al eje de la vía (px)
const MOTO_SPEED_MULT = 1.5;        // motos van 1.5× más rápido que la cola

// ── Helpers puros ────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  // Camino corto entre 0..360 (maneja wrap 359°→0°)
  const diff = ((((b - a) % 360) + 540) % 360) - 180;
  return a + diff * t;
}

// Dado un arc-length (distancia desde el inicio de la polilínea), devuelve
// el (px, py) en canvas y la dirección normalizada del segmento local.
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

  // Techo (50% del largo, oscuro para 3D)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.roundRect(-len * 0.25, -wid * 0.4, len * 0.5, wid * 0.8, 1);
  ctx.fill();

  // Parabrisas frontal (cerca del frente, +X local)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  ctx.roundRect(len * 0.18, -wid * 0.35, len * 0.1, wid * 0.7, 1);
  ctx.fill();

  // Parabrisas trasero
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.beginPath();
  ctx.roundRect(-len * 0.27, -wid * 0.35, len * 0.08, wid * 0.7, 1);
  ctx.fill();

  // Stop lights (cola). Brillan cuando la cola está congestionada (avg<15)
  if (isBraking) {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ef4444';
  } else {
    ctx.fillStyle = '#7f1d1d';
  }
  ctx.fillRect(-len / 2, -wid * 0.45, 2, wid * 0.2);
  ctx.fillRect(-len / 2, wid * 0.25, 2, wid * 0.2);

  // Headlights amarillos (frente)
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
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectDelayRef = useRef(WS_RECONNECT_BASE);
  const firstFrameTimerRef = useRef(null);
  const lookupBackoffRef = useRef(LOOKUP_BACKOFF_BASE);
  const lookupRetryTimerRef = useRef(null);
  const lookupIntervalRef = useRef(null);
  const relookupTimerRef = useRef(null);
  const jamHashIdRef = useRef(null);

  // Snapshots SUMO para interpolación
  const prevFrameRef = useRef(null);
  const currFrameRef = useRef(null);
  const frameReceivedAtRef = useRef(0);

  // Layout y props que el RAF lee
  const parentSizeRef = useRef({ w: 0, h: 0 });
  const propsRef = useRef({ jamLevel, jamSpeed, jamRatio, vehicleScale });
  const polylineRef = useRef(polyline);
  const bboxRef = useRef(null);
  const phaseRef = useRef('idle');
  const vehicleCountRef = useRef(0);
  const stepRef = useRef(0);
  const canLookupRef = useRef(false);
  // path: Path2D del asfalto. segs: segmentos en pixels para snap-to-polyline
  // (con cumPrev/len/dirN precomputados). totalLen: arc-length total.
  const polylinePathRef = useRef({ key: null, path: null, segs: null, totalLen: 0 });
  // Cola sintetizada (Opción C): N slots distribuidos uniformemente sobre la
  // polilínea, todos avanzando como un cinturón. queueRef trackea solo
  // car/truck/bus (los que están en el atasco). Las motos van aparte por
  // el lindero, en motoQueueRef, a velocidad superior.
  const queueRef = useRef({ types: [], offset: 0 });
  const motoQueueRef = useRef({ count: 0, offset: 0 });
  const lastTickTimeRef = useRef(0);

  // State (re-renderiza JSX y fallback overlay)
  const [phase, setPhase] = useState('idle');
  const [jamHashId, setJamHashId] = useState(null);
  const [lookupVersion, setLookupVersion] = useState(0);
  const [waitingFirstFrame, setWaitingFirstFrame] = useState(true);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    jamHashIdRef.current = jamHashId;
  }, [jamHashId]);

  const hasPolyline = Array.isArray(polyline) && polyline.length > 1;
  const canLookup = !!(jamName && jamName.trim());

  const bbox = useMemo(() => {
    if (!hasPolyline) return null;
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
  }, [polyline, hasPolyline]);

  // Sync state/props → refs (RAF los lee)
  useEffect(() => {
    propsRef.current = { jamLevel, jamSpeed, jamRatio, vehicleScale };
  }, [jamLevel, jamSpeed, jamRatio, vehicleScale]);

  useEffect(() => {
    polylineRef.current = polyline;
    bboxRef.current = bbox;
    polylinePathRef.current = { key: null, path: null };
  }, [polyline, bbox]);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { canLookupRef.current = canLookup; }, [canLookup]);

  // ── 1) Lookup hash desde el backend ──────────────────────────────
  useEffect(() => {
    if (!canLookup) {
      setPhase('idle');
      setJamHashId(null);
      setHasFrame(false);
      currFrameRef.current = null;
      prevFrameRef.current = null;
      vehicleCountRef.current = 0;
      stepRef.current = 0;
      return undefined;
    }

    let cancelled = false;
    if (!jamHashIdRef.current) {
      setPhase('looking-up');
    }

    const lookup = async () => {
      if (cancelled) return;
      try {
        const url = `${window.location.origin}/api/sumo/find?name=${encodeURIComponent(jamName)}`;
        const res = await fetch(url);
        if (cancelled) return;
        if (res.status === 404) {
          setPhase('not-available');
          setJamHashId(null);
          currFrameRef.current = null;
          prevFrameRef.current = null;
          setHasFrame(false);
          lookupBackoffRef.current = LOOKUP_BACKOFF_BASE;
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data && data.found && data.hash) {
          setJamHashId((prev) => (prev === data.hash ? prev : data.hash));
          lookupBackoffRef.current = LOOKUP_BACKOFF_BASE;
        } else {
          setPhase('not-available');
          setJamHashId(null);
          currFrameRef.current = null;
          prevFrameRef.current = null;
          setHasFrame(false);
        }
      } catch (_err) {
        if (cancelled) return;
        const delay = lookupBackoffRef.current;
        lookupBackoffRef.current = Math.min(delay * 2, LOOKUP_BACKOFF_MAX);
        lookupRetryTimerRef.current = setTimeout(() => {
          lookupRetryTimerRef.current = null;
          lookup();
        }, delay);
      }
    };

    lookup();
    lookupIntervalRef.current = setInterval(() => {
      if (!cancelled) lookup();
    }, LOOKUP_REFRESH_MS);

    return () => {
      cancelled = true;
      if (lookupRetryTimerRef.current) {
        clearTimeout(lookupRetryTimerRef.current);
        lookupRetryTimerRef.current = null;
      }
      if (lookupIntervalRef.current) {
        clearInterval(lookupIntervalRef.current);
        lookupIntervalRef.current = null;
      }
    };
  }, [jamName, canLookup, lookupVersion]);

  // ── 2) WebSocket lifecycle ───────────────────────────────────────
  useEffect(() => {
    if (!jamHashId) return undefined;

    let cancelled = false;
    setPhase('connecting');
    setWaitingFirstFrame(true);
    currFrameRef.current = null;
    prevFrameRef.current = null;
    vehicleCountRef.current = 0;
    stepRef.current = 0;
    setHasFrame(false);
    reconnectDelayRef.current = WS_RECONNECT_BASE;

    const scheduleReconnect = () => {
      if (cancelled) return;
      setPhase('reconnecting');
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, WS_RECONNECT_MAX);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (cancelled) return;
      const proto = window.location.hostname === 'localhost' ? 'ws' : 'wss';
      const url = `${proto}://${window.location.host}/ws/sumo/${jamHashId}`;

      let ws;
      try {
        ws = new WebSocket(url);
      } catch (_) {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      if (firstFrameTimerRef.current) clearTimeout(firstFrameTimerRef.current);
      firstFrameTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        setWaitingFirstFrame(false);
      }, FIRST_FRAME_TIMEOUT);

      ws.onopen = () => {
        if (cancelled) return;
        setPhase('connected');
        reconnectDelayRef.current = WS_RECONNECT_BASE;
      };

      ws.onmessage = async (ev) => {
        if (cancelled) return;
        try {
          let dataStr;
          if (typeof ev.data === 'string') {
            dataStr = ev.data;
          } else if (ev.data instanceof Blob) {
            // El proxy/upstream puede enviar binario (orjson + send_bytes).
            // El navegador lo entrega como Blob por defecto.
            dataStr = await ev.data.text();
          } else if (ev.data instanceof ArrayBuffer) {
            dataStr = new TextDecoder().decode(ev.data);
          } else {
            console.warn('[RoadCanvas] WS unknown data type:', typeof ev.data);
            return;
          }
          if (cancelled) return;
          const msg = JSON.parse(dataStr);
          if (msg && msg.type === 'sumo_frame' && msg.data) {
            prevFrameRef.current = currFrameRef.current;
            currFrameRef.current = msg.data;
            frameReceivedAtRef.current = performance.now();
            vehicleCountRef.current = msg.data.vehicleCount || 0;
            stepRef.current = msg.data.step || 0;
            setWaitingFirstFrame(false);
            setHasFrame(true);
            if (firstFrameTimerRef.current) {
              clearTimeout(firstFrameTimerRef.current);
              firstFrameTimerRef.current = null;
            }
          }
        } catch (e) {
          console.warn('[RoadCanvas] WS parse error:', e && e.message);
        }
      };

      ws.onclose = (ev) => {
        if (cancelled) return;
        wsRef.current = null;
        if (ev.code === 4404) {
          setPhase('unavailable');
          setJamHashId(null);
          currFrameRef.current = null;
          prevFrameRef.current = null;
          setHasFrame(false);
          if (firstFrameTimerRef.current) {
            clearTimeout(firstFrameTimerRef.current);
            firstFrameTimerRef.current = null;
          }
          // Anti-loop: esperar 5s antes de relookup. Si backend cachea hash
          // muerto 30s, capeamos a ~0.2 iter/seg en lugar de bucle apretado.
          if (relookupTimerRef.current) clearTimeout(relookupTimerRef.current);
          relookupTimerRef.current = setTimeout(() => {
            relookupTimerRef.current = null;
            setLookupVersion((v) => v + 1);
          }, RELOOKUP_AFTER_4404_MS);
          return;
        }
        scheduleReconnect();
      };

      ws.onerror = () => {
        /* close handler gestiona el reintento */
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (firstFrameTimerRef.current) {
        clearTimeout(firstFrameTimerRef.current);
        firstFrameTimerRef.current = null;
      }
      if (relookupTimerRef.current) {
        clearTimeout(relookupTimerRef.current);
        relookupTimerRef.current = null;
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (_) { /* noop */ }
        wsRef.current = null;
      }
    };
  }, [jamHashId]);

  // ── 3) ResizeObserver: actualiza parentSizeRef ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas && canvas.parentElement;
    if (!parent) return undefined;

    parentSizeRef.current = {
      w: parent.clientWidth || 0,
      h: parent.clientHeight || 0,
    };
    polylinePathRef.current = { key: null, path: null };

    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        parentSizeRef.current = { w: e.contentRect.width, h: e.contentRect.height };
        polylinePathRef.current = { key: null, path: null };
      }
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // ── 4) RAF loop (60 fps) ─────────────────────────────────────────
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
        polylinePathRef.current = { key: null, path: null };
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

        // Escala dinámica de vehículos según px/metro reales del canvas.
        // Evita "amontonamiento" en vías largas y desaparición en vías cortas.
        // 1° lat = 111320 m. En Colombia 1° lon ≈ 111320 × cos(lat) — diferencia
        // <2.2%, aceptable usar 111320 directo. Independiente de vehicleScale.
        const pixelsPerMeter = scale / 111320;
        const targetCarPixelLength = Math.max(18, 4.5 * pixelsPerMeter); // 4.5m = car típico; piso 18px asegura detalle visible
        const dynamicVehicleScale = Math.max(0.2, Math.min(3.0, targetCarPixelLength / TYPE_SPEC.car.len));

        const project = (lon, lat) => ({
          px: (lon - bb.minLon) * scale + offsetX,
          py: h - ((lat - bb.minLat) * scale + offsetY),
        });

        // Path2D + segmentos para snap. Caché invalidado en cambios de
        // polilínea/bbox/tamaño. segs incluye cumPrev (arc-length acumulada
        // antes del segmento), len (longitud del segmento) y dirN (dirección
        // normalizada) — todo precomputado para snap eficiente.
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
          // Las colas sintetizadas se reinician con la nueva geometría.
          queueRef.current.types = [];
          queueRef.current.offset = 0;
          motoQueueRef.current.count = 0;
          motoQueueRef.current.offset = 0;
        }
        const path = polylinePathRef.current.path;
        const polySegs = polylinePathRef.current.segs;
        const polyTotalLen = polylinePathRef.current.totalLen;

        const isSevere = (props.jamLevel >= 3) || (props.jamRatio > 2);

        // Halo rojo (solo si severo) — indicador, no geografía
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

        // Asfalto principal (sin líneas internas: la geometría real de
        // los carriles no se inventa en frontend)
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 38;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke(path);

        // Vehículos: cola sintetizada en cinturón (Opción C).
        // N slots uniformemente espaciados sobre la polilínea, avanzando en
        // bloque a velocidad visual proporcional al avg Waze. N = vehicleCount
        // SUMO. Tipos por slot estables (asignados por proporción 65/20/10/5
        // que SUMO usa al inyectar). Wrap continuo: cuando un slot pasa el
        // final, reaparece al inicio (el arc se calcula con módulo).
        const curr = currFrameRef.current;
        if (curr && polySegs && polySegs.length > 0 && polyTotalLen > 0) {
          const nowMs = performance.now();
          const lastTick = lastTickTimeRef.current || nowMs;
          const dt = Math.min(0.1, (nowMs - lastTick) / 1000);
          lastTickTimeRef.current = nowMs;

          const VISUAL_AMP_C = 4;

          // Split SUMO count entre motos (van por el lindero) y resto
          // (cars/trucks/buses, en el atasco)
          let motoCountSumo = 0;
          if (Array.isArray(curr.vehicles)) {
            for (let i = 0; i < curr.vehicles.length; i++) {
              if (curr.vehicles[i] && curr.vehicles[i].type === 'moto') motoCountSumo++;
            }
          }
          const nonMotoSumo = (Array.isArray(curr.vehicles) ? curr.vehicles.length : 0) - motoCountSumo;

          const targetN = Math.min(
            MAX_VEHICLES_RENDER,
            Math.round(nonMotoSumo * DENSITY_FACTOR),
          );
          const targetMotos = Math.min(
            MAX_VEHICLES_RENDER,
            Math.round(motoCountSumo * MOTO_DENSITY_FACTOR),
          );

          // Stop lights brillan cuando la cola está congestionada (avg<15 km/h)
          const isBraking = (props.jamSpeed || 0) < 15;

          // ── Cola del atasco (car/truck/bus) ──
          const queue = queueRef.current;
          while (queue.types.length < targetN) {
            // Distribución renormalizada (sin motos): 80% car / 13% truck / 7% bus
            const r = Math.random();
            let t;
            if (r < 0.80) t = 'car';
            else if (r < 0.93) t = 'truck';
            else t = 'bus';
            queue.types.push(t);
          }
          while (queue.types.length > targetN) {
            queue.types.pop();
          }

          // Avance global de la cola
          const avgKmh = props.jamSpeed > 0 ? props.jamSpeed : 5;
          const avgMps = avgKmh / 3.6;
          const queueAdvance = avgMps * dt * VISUAL_AMP_C * pixelsPerMeter;
          queue.offset += queueAdvance;
          if (queue.offset > 1e9) queue.offset %= polyTotalLen;

          const drawScale = props.vehicleScale * dynamicVehicleScale;

          if (queue.types.length > 0) {
            const spacing = polyTotalLen / queue.types.length;
            for (let i = 0; i < queue.types.length; i++) {
              let arc = (i * spacing + queue.offset) % polyTotalLen;
              if (arc < 0) arc += polyTotalLen;
              const point = arcToPoint(arc, polySegs, polyTotalLen);
              const angleRad = Math.atan2(point.dirNy, point.dirNx);
              drawVehicle(ctx, point.px, point.py, angleRad, queue.types[i], drawScale, isBraking);
            }
          }

          // ── Motos por el lindero (no participan del atasco) ──
          motoQueueRef.current.count = targetMotos;
          // Avanzan más rápido que la cola (filtran/bypassan)
          motoQueueRef.current.offset += queueAdvance * MOTO_SPEED_MULT;
          if (motoQueueRef.current.offset > 1e9) motoQueueRef.current.offset %= polyTotalLen;

          if (motoQueueRef.current.count > 0) {
            const motoSpacing = polyTotalLen / motoQueueRef.current.count;
            for (let i = 0; i < motoQueueRef.current.count; i++) {
              let arc = (i * motoSpacing + motoQueueRef.current.offset) % polyTotalLen;
              if (arc < 0) arc += polyTotalLen;
              const point = arcToPoint(arc, polySegs, polyTotalLen);
              // Offset perpendicular hacia la derecha del heading (lindero).
              // perp_right en canvas Y-down: (-dirNy, +dirNx)
              const lateralPx = point.px + (-point.dirNy) * MOTO_LATERAL_PX;
              const lateralPy = point.py + point.dirNx * MOTO_LATERAL_PX;
              const angleRad = Math.atan2(point.dirNy, point.dirNx);
              drawVehicle(ctx, lateralPx, lateralPy, angleRad, 'moto', drawScale, false);
            }
          }
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

      // Bottom-left: contador (lee refs, sin re-render React)
      ctx.fillStyle = '#64748b';
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillText(`${vehicleCountRef.current} vehículos · paso ${stepRef.current}`, 12, h - 12);

      // Bottom-right: estado del WebSocket
      const ph = phaseRef.current;
      let statusEmoji = '⚪';
      let statusText = 'sin vía';
      switch (ph) {
        case 'connected':
          statusEmoji = '🟢'; statusText = 'SUMO live'; break;
        case 'connecting':
        case 'reconnecting':
        case 'looking-up':
          statusEmoji = '🟡'; statusText = 'conectando...'; break;
        case 'not-available':
        case 'unavailable':
          statusEmoji = '🔴'; statusText = 'no disponible'; break;
        case 'idle':
        default:
          statusEmoji = '⚪'; statusText = 'sin vía'; break;
      }
      if (canLookupRef.current || ph !== 'idle') {
        const statusLabel = `${statusEmoji} ${statusText}`;
        const m = ctx.measureText(statusLabel);
        ctx.fillText(statusLabel, w - m.width - 12, h - 12);
      }

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // ── Mensaje overlay HTML ─────────────────────────────────────────
  let fallbackMessage = null;
  if (!canLookup || !hasPolyline) {
    fallbackMessage = 'Sin geometría disponible';
  } else if (phase === 'not-available' || phase === 'unavailable') {
    fallbackMessage = 'Gemelo digital no disponible para esta vía';
  } else if (!hasFrame && !waitingFirstFrame && phase !== 'looking-up') {
    fallbackMessage = 'Esperando gemelo digital...';
  }

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
