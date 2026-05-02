/**
 * RoadCanvas v3 — Gemelo digital con vehículos SUMO reales sobre geometría OSM
 *
 * Cambios v3 sobre v2:
 *   - Hash ya NO se calcula localmente. Se resuelve via /api/sumo/find?name=X
 *     que consulta el calibrador de la VM. Esto evita el mismatch entre el
 *     hash local (calculado de la polilínea Waze que el frontend ve ahora)
 *     y el hash real del pool SUMO (calculado en otro tick de polling).
 *   - Refresh periódico cada 60s (alineado con cache 30s del backend).
 *   - Cierre 4404 → relookup inmediato + transición de phase.
 */
import React, { useRef, useEffect, useState, useMemo } from 'react';

const WS_RECONNECT_BASE = 1000;
const WS_RECONNECT_MAX = 30000;
const FIRST_FRAME_TIMEOUT = 5000;
const MAX_VEHICLES_RENDER = 500;
const PADDING_RATIO = 0.075;
const LOOKUP_BACKOFF_BASE = 1000;
const LOOKUP_BACKOFF_MAX = 30000;
const LOOKUP_REFRESH_MS = 60000;

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
  const lastFrameRef = useRef(null);
  const jamHashIdRef = useRef(null);

  // phase: idle | looking-up | not-available | connecting | connected | reconnecting | unavailable
  const [phase, setPhase] = useState('idle');
  const [jamHashId, setJamHashId] = useState(null);
  const [lookupVersion, setLookupVersion] = useState(0);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [step, setStep] = useState(0);
  const [renderTick, setRenderTick] = useState(0);
  const [waitingFirstFrame, setWaitingFirstFrame] = useState(true);

  useEffect(() => {
    jamHashIdRef.current = jamHashId;
  }, [jamHashId]);

  const hasPolyline = Array.isArray(polyline) && polyline.length > 1;
  const canLookup = !!(jamName && jamName.trim());

  // ── 1) Lookup del hash desde el backend (con refresh periódico) ──
  useEffect(() => {
    if (!canLookup) {
      setPhase('idle');
      setJamHashId(null);
      setVehicleCount(0);
      setStep(0);
      lastFrameRef.current = null;
      return undefined;
    }

    let cancelled = false;

    // Si aún no tenemos hash, mostrar 'looking-up' como estado visible.
    // Si ya tenemos hash (refresh periódico), no tocamos phase.
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
          lastFrameRef.current = null;
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
          lastFrameRef.current = null;
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

  // ── 2) WebSocket lifecycle ──────────────────────────────────────────
  useEffect(() => {
    if (!jamHashId) return undefined;

    let cancelled = false;
    setPhase('connecting');
    setWaitingFirstFrame(true);
    lastFrameRef.current = null;
    setVehicleCount(0);
    setStep(0);
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

      ws.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.type === 'sumo_frame' && msg.data) {
            lastFrameRef.current = msg.data;
            setVehicleCount(msg.data.vehicleCount || 0);
            setStep(msg.data.step || 0);
            setWaitingFirstFrame(false);
            setRenderTick((c) => c + 1);
            if (firstFrameTimerRef.current) {
              clearTimeout(firstFrameTimerRef.current);
              firstFrameTimerRef.current = null;
            }
          }
        } catch (_) {
          /* mensaje no-JSON: ignorar */
        }
      };

      ws.onclose = (ev) => {
        if (cancelled) return;
        wsRef.current = null;
        if (ev.code === 4404) {
          // Instancia desapareció (eviction LRU, housekeeping, hash cambiado).
          // Marcar phase y disparar relookup inmediato.
          setPhase('unavailable');
          setJamHashId(null);
          lastFrameRef.current = null;
          if (firstFrameTimerRef.current) {
            clearTimeout(firstFrameTimerRef.current);
            firstFrameTimerRef.current = null;
          }
          setLookupVersion((v) => v + 1);
          return;
        }
        scheduleReconnect();
      };

      ws.onerror = () => {
        /* el handler de close gestiona el reintento */
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
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (_) { /* noop */ }
        wsRef.current = null;
      }
    };
  }, [jamHashId]);

  // ── 3) ResizeObserver: triggea redraw en cambio de tamaño del parent ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas && canvas.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setRenderTick((c) => c + 1));
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // bbox precomputado de la polilínea
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

  // ── 4) Drawing ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const w = parent.clientWidth > 10 ? parent.clientWidth : 800;
    const h = parent.clientHeight > 10 ? parent.clientHeight : 260;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    // Fondo
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, w, h);

    if (bbox) {
      const padX = w * PADDING_RATIO;
      const padY = h * PADDING_RATIO;
      const lonRange = bbox.maxLon - bbox.minLon || 0.0001;
      const latRange = bbox.maxLat - bbox.minLat || 0.0001;
      const scaleX = (w - 2 * padX) / lonRange;
      const scaleY = (h - 2 * padY) / latRange;
      const scale = Math.min(scaleX, scaleY);
      const drawnW = lonRange * scale;
      const drawnH = latRange * scale;
      const offsetX = (w - drawnW) / 2;
      const offsetY = (h - drawnH) / 2;

      const project = (lon, lat) => ({
        px: (lon - bbox.minLon) * scale + offsetX,
        py: h - ((lat - bbox.minLat) * scale + offsetY),
      });

      // Polilínea Waze como asfalto
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < polyline.length; i++) {
        const p = polyline[i];
        if (p == null || p.x == null || p.y == null) continue;
        const { px, py } = project(p.x, p.y);
        if (!started) { ctx.moveTo(px, py); started = true; }
        else { ctx.lineTo(px, py); }
      }
      if (started) ctx.stroke();

      // Vehículos SUMO del último frame
      const frame = lastFrameRef.current;
      if (frame && Array.isArray(frame.vehicles)) {
        const vehicles = frame.vehicles.length > MAX_VEHICLES_RENDER
          ? frame.vehicles.slice(0, MAX_VEHICLES_RENDER)
          : frame.vehicles;

        for (const v of vehicles) {
          if (v == null || v.lon == null || v.lat == null) continue;
          const { px, py } = project(v.lon, v.lat);
          const speed = typeof v.speed === 'number' ? v.speed : 0;
          let color;
          if (speed < 5) color = '#ef4444';
          else if (speed < 20) color = '#f59e0b';
          else color = '#10b981';

          let len, wid;
          switch (v.type) {
            case 'moto':  len = 6;  wid = 6;   break;
            case 'truck': len = 16; wid = 6;   break;
            case 'bus':   len = 18; wid = 6;   break;
            case 'car':
            default:      len = 12; wid = 5;   break;
          }
          len *= vehicleScale;
          wid *= vehicleScale;

          // SUMO angle: 0=N, 90=E (CW). Canvas Y crece hacia abajo.
          // canvasRot = (sumoAngle - 90) * π / 180 → angle=0 (N) apunta arriba.
          const angleRad = (((v.angle == null ? 0 : v.angle) - 90) * Math.PI) / 180;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(angleRad);
          ctx.fillStyle = color;
          ctx.fillRect(-len / 2, -wid / 2, len, wid);
          ctx.restore();
        }
      }
    }

    // ── HUD overlay ──
    ctx.fillStyle = '#14b8a6';
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('SINCRONIZANDO GEMELO DIGITAL', 12, 18);

    const isSevere = jamLevel >= 3 || jamRatio > 2;
    ctx.fillStyle = isSevere ? '#ef4444' : '#f59e0b';
    const speedText = `${Math.round(jamSpeed)} KM/H`;
    const ratioText = `${jamRatio}x DELAY`;
    const topRight = `⚡ VELOCIDAD VÍA: ${speedText}  |  🕒 EXCESO: ${ratioText}`;
    ctx.fillText(topRight, w - 240, 18);

    // Bottom-left: contador
    ctx.fillStyle = '#64748b';
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText(`${vehicleCount} vehículos · paso ${step}`, 12, h - 12);

    // Bottom-right: estado del WebSocket
    let statusEmoji = '⚪';
    let statusText = 'sin vía';
    switch (phase) {
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
    if (canLookup || phase !== 'idle') {
      const statusLabel = `${statusEmoji} ${statusText}`;
      const m = ctx.measureText(statusLabel);
      ctx.fillText(statusLabel, w - m.width - 12, h - 12);
    }

    ctx.restore();
  }, [
    renderTick, polyline, bbox, vehicleScale,
    jamLevel, jamSpeed, jamRatio,
    phase, vehicleCount, step, canLookup,
  ]);

  // ── Mensaje overlay HTML ──
  let fallbackMessage = null;
  if (!canLookup || !hasPolyline) {
    fallbackMessage = 'Sin geometría disponible';
  } else if (phase === 'not-available' || phase === 'unavailable') {
    fallbackMessage = 'Gemelo digital no disponible para esta vía';
  } else if (!lastFrameRef.current && !waitingFirstFrame && phase !== 'looking-up') {
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
