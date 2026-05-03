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

// Visual minimalista: rectángulo plano coloreado por tipo, borde fino.
// El color del vehículo NO refleja velocidad (esa info va al HUD agregado).
const TYPE_SPEC = {
  car:   { len: 18, wid: 8, color: '#3b82f6' }, // azul
  truck: { len: 28, wid: 6, color: '#ef4444' }, // rojo
  moto:  { len: 8,  wid: 4, color: '#10b981' }, // verde
  bus:   { len: 30, wid: 7, color: '#f97316' }, // naranja
};

// ── Helpers puros ────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  // Camino corto entre 0..360 (maneja wrap 359°→0°)
  const diff = ((((b - a) % 360) + 540) % 360) - 180;
  return a + diff * t;
}

// Snap un punto (vpx, vpy) en pixel space a la polilínea. Devuelve la
// arc-length acumulada (distancia desde el inicio de la polilínea) y la
// dirección normalizada del segmento más cercano.
function pointToArc(vpx, vpy, segs) {
  if (!segs || segs.length === 0) return { arc: 0, dirNx: 1, dirNy: 0 };
  let bestD2 = Infinity;
  let bestArc = 0;
  let bestDirNx = segs[0].dirNx;
  let bestDirNy = segs[0].dirNy;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    let t = ((vpx - s.ax) * s.dx + (vpy - s.ay) * s.dy) / s.len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const cx = s.ax + t * s.dx;
    const cy = s.ay + t * s.dy;
    const ddx = vpx - cx;
    const ddy = vpy - cy;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestArc = s.cumPrev + t * s.len;
      bestDirNx = s.dirNx;
      bestDirNy = s.dirNy;
    }
  }
  return { arc: bestArc, dirNx: bestDirNx, dirNy: bestDirNy };
}

// Inverso: dado un arc-length, devuelve el (px, py) y la dirección local.
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

function drawVehicle(ctx, x, y, angleRad, type, scale) {
  const spec = vehicleSpec(type);
  const len = spec.len * scale;
  const wid = spec.wid * scale;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  // Cuerpo coloreado por tipo
  ctx.fillStyle = spec.color;
  ctx.fillRect(-len / 2, -wid / 2, len, wid);
  // Borde fino para legibilidad sobre asfalto oscuro
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-len / 2, -wid / 2, len, wid);
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
  // Estado visual por vehículo: arc actual, velocidad, timestamp del frame WS sincronizado.
  // Permite mostrar la cola "fluyendo" entre frames SUMO con visualAmp.
  const vehicleStateRef = useRef(new Map());
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
        const targetCarPixelLength = Math.max(12, 4.5 * pixelsPerMeter); // 4.5m = car típico; piso 12px para visibilidad clara
        const dynamicVehicleScale = Math.max(0.2, Math.min(3.0, targetCarPixelLength / 18));

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
          // Invalida los arcs cacheados de vehículos (ya no son consistentes
          // con los nuevos segmentos en pixel-space).
          vehicleStateRef.current.clear();
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

        // Vehículos: snap a la polilínea (Opción B).
        // Cada vehículo SUMO se proyecta al punto más cercano de la polilínea
        // y se orienta según la tangente local. Entre frames WS, el arc
        // avanza visualmente a velocidad SUMO × visualAmp para que la cola
        // se vea fluir incluso a 9 km/h reales (donde el movimiento sería
        // sub-pixel). Cada nuevo frame WS hace sync suave 70/30 contra la
        // posición SUMO real (evita teleport, mantiene tendencia visual).
        const curr = currFrameRef.current;
        if (curr && Array.isArray(curr.vehicles) && polySegs && polySegs.length > 0) {
          const nowMs = performance.now();
          const lastTick = lastTickTimeRef.current || nowMs;
          const dt = Math.min(0.1, (nowMs - lastTick) / 1000); // cap dt 100ms
          lastTickTimeRef.current = nowMs;

          const VISUAL_AMP = 3;
          const frameStamp = frameReceivedAtRef.current;
          const stateMap = vehicleStateRef.current;

          const vehicles = curr.vehicles.length > MAX_VEHICLES_RENDER
            ? curr.vehicles.slice(0, MAX_VEHICLES_RENDER)
            : curr.vehicles;

          const presentIds = new Set();
          for (const v of vehicles) {
            if (v == null || v.lon == null || v.lat == null) continue;
            presentIds.add(v.id);

            const proj = project(v.lon, v.lat);
            const sumoSnap = pointToArc(proj.px, proj.py, polySegs);

            let state = stateMap.get(v.id);
            if (!state) {
              // Primer avistamiento: arrancar exactamente donde SUMO lo puso
              state = {
                arc: sumoSnap.arc,
                speed: typeof v.speed === 'number' ? v.speed : 0,
                stamp: frameStamp,
              };
              stateMap.set(v.id, state);
            } else if (state.stamp !== frameStamp) {
              // Nuevo frame WS: sync suave 70% visual / 30% SUMO real
              state.arc = state.arc * 0.7 + sumoSnap.arc * 0.3;
              state.speed = typeof v.speed === 'number' ? v.speed : state.speed;
              state.stamp = frameStamp;
            }

            // Avance visual continuo (simula la cola creciendo)
            const speedMps = state.speed / 3.6;
            state.arc += speedMps * dt * VISUAL_AMP * pixelsPerMeter;
            if (state.arc > polyTotalLen) state.arc = polyTotalLen;
            else if (state.arc < 0) state.arc = 0;

            const point = arcToPoint(state.arc, polySegs, polyTotalLen);
            const angleRad = Math.atan2(point.dirNy, point.dirNx);
            drawVehicle(ctx, point.px, point.py, angleRad, v.type, props.vehicleScale * dynamicVehicleScale);
          }

          // Cleanup: drop estados de vehículos que ya no están en el frame
          for (const vid of Array.from(stateMap.keys())) {
            if (!presentIds.has(vid)) stateMap.delete(vid);
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
