/**
 * VIITS NEXUS — useLogisticsData
 * Hook agregador para los 7 corredores logísticos estratégicos
 * (Resolución Mintransporte 20223040002435/2022).
 *
 * Consume el `trafficStore` (datos vivos Google + Waze + TomTom fusionados por
 * tollId) y enriquece cada corredor logístico con IRT por segmento usando la
 * fórmula oficial DITRA `computeIRT` (src/data/nexusCorridors.js).
 *
 * Firma:
 *   useLogisticsData(corridorId?)
 *     - corridorId: 'L1'..'L7' (case-insensitive). Si se pasa, devuelve el
 *       corredor enriquecido con todos sus segmentos. Si se omite, devuelve los
 *       7 corredores con su IRT promedio agregado.
 *
 * Devuelve:
 *   {
 *     corridor:  LogisticsCorridor enriquecido  // sólo cuando hay corridorId
 *     corridors: LogisticsCorridor[]            // sólo sin corridorId
 *     isConnected: boolean,
 *     hasData: boolean,
 *     timestamp: number
 *   }
 *
 * Degrada gracefully:
 *   - Sin LOGISTICS_CORRIDORS (data file ausente) → devuelve listas vacías.
 *   - Sin trafficData → segmentos con irt=0, irtLevel='NORMAL', hasData=false.
 *   - corridorId inexistente → corridor: null.
 *
 * Patrón: UN SOLO selector de Zustand (no N hooks por peaje). El recálculo
 * ocurre cuando `trafficData` cambia en el store, no en un setInterval propio.
 */

import { useMemo } from 'react';
import { useTrafficStore } from '../../../store/trafficStore';
import {
  computeIRT,
  getIRTLevel,
  ALL_TOLL_STATIONS,
} from '../../../data/nexusCorridors';
import {
  LOGISTICS_CORRIDORS,
  getLogisticsCorridorById,
} from '../data/logisticsCorridors';

// ─── Helpers de derivación (espejo honesto de useTollData) ──────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Deriva el IRT de un peaje desde los datos reales del store.
 * Misma lógica que useTollData.deriveTollIRT — sin números mágicos por peaje.
 * Sin datos = IRT bajo (12) honesto, no inventado.
 */
function deriveTollIRT(realTraffic) {
  if (!realTraffic) return 12;
  const cr = realTraffic.congestionRatio;
  const wl = realTraffic.wazeJamLevel || 0;
  let irt = (cr != null ? cr : 0) * 80;
  if (wl) irt = Math.max(irt, wl * 15);
  if (realTraffic.hasRoadClosure) irt = Math.max(irt, 90);
  else if (realTraffic.hasMajorIncident) irt = Math.max(irt, 75);
  return clamp(Math.round(irt), 0, 100);
}

/**
 * Flujo (veh/h) por modelo Greenshields, con override de carriles desde
 * boothConfig.salida (no el hardcode lanes=2 de useTollData).
 */
function estimateFlow(speedKmh, congestionRatio, lanes) {
  const K_JAM = 120;
  const K_FREE = 15;
  const cr = congestionRatio != null ? congestionRatio : 0;
  const kPerLane = cr < 0.2 ? K_FREE : K_JAM * cr;
  return Math.round(kPerLane * (speedKmh || 0) * (lanes || 2));
}

/**
 * Resuelve un peaje por id contra el inventario NEXUS (ALL_TOLL_STATIONS).
 * Devuelve null si el id es inválido.
 */
function resolveToll(tollId) {
  return ALL_TOLL_STATIONS.find(t => t.id === tollId) || null;
}

/**
 * Construye el agregado por peaje desde trafficData + inventario NEXUS.
 */
function buildTollAggregate(tollId, trafficData) {
  const toll = resolveToll(tollId);
  if (!toll) return null;

  const realTraffic = trafficData?.[tollId] || null;
  const irt = deriveTollIRT(realTraffic);
  const speedLimit = toll.speedLimit || 80;
  const lanesSalida = toll.boothConfig?.salida || 2;

  const speed = clamp(
    Math.round(realTraffic?.currentSpeed ?? (70 - irt * 0.4)),
    5,
    speedLimit,
  );
  const cr = realTraffic?.congestionRatio ?? 0;
  const flow = estimateFlow(speed, cr, lanesSalida);
  const queue = Math.round(cr * 10);
  const occupancy = clamp(Math.round(10 + cr * 80), 0, 100);

  return {
    tollId,
    name: toll.name,
    sector: toll.sector,
    km: toll.km,
    department: toll.department,
    concesionario: toll.type,
    corridorId: toll.corridorId,
    speedLimit,
    lanes: lanesSalida,
    irt,
    irtLevel: getIRTLevel(irt),
    speed,
    flow,
    queue,
    occupancy,
    hasData: realTraffic != null,
  };
}

/**
 * Enriquecimiento por segmento.
 *  - Si el segmento referencia peajes, IRT = computeIRT(velocidad ponderada,
 *    flujo medio por peaje, cola, segment.speedLimit).
 *  - Si no, fallback honesto al 60% del IRT promedio del corredor.
 */
function enrichSegment(segment, tollAggregatesById, corridorAvgIRT) {
  const fromNodeId = segment.fromNodeId;
  const toNodeId = segment.toNodeId;
  // fromName / toName se resuelven en enrichCorridor (necesita acceso a nodes)
  const tollRefs = segment.tollRefs || [];
  const tolls = tollRefs
    .map(id => tollAggregatesById[id])
    .filter(Boolean);

  const N = tolls.length;
  const Ndata = tolls.filter(t => t.hasData).length;
  const speedLimit = segment.speedLimit || 80;

  let irt;
  let avgSpeed;
  let flow;
  let queue;

  if (N === 0) {
    // Tramo sin peaje monitoreado: asumir mejor flujo que el peaje promedio.
    irt = Math.round((corridorAvgIRT || 0) * 0.6);
    avgSpeed = Math.round(speedLimit * (1 - (irt / 100) * 0.6));
    flow = 0;
    queue = 0;
  } else {
    const weightSum = tolls.reduce((s, t) => s + (t.flow || 0), 0) || 1;
    avgSpeed = Math.round(
      tolls.reduce((s, t) => s + t.speed * (t.flow || 1), 0) / weightSum,
    );
    flow = tolls.reduce((s, t) => s + t.flow, 0);
    queue = tolls.reduce((s, t) => s + t.queue, 0);
    // computeIRT espera flujo POR carril/peaje; normalizamos por N para que
    // el divisor 600 de la fórmula DITRA no se infle al sumar peajes.
    irt = computeIRT(avgSpeed, flow / Math.max(N, 1), queue, speedLimit);
  }

  const level = getIRTLevel(irt);

  return {
    id: segment.id,
    fromNodeId,
    toNodeId,
    label: segment.label,
    km: segment.distanceKm,
    distanceKm: segment.distanceKm,
    speedLimit,
    departments: segment.departments || [],
    polyline: segment.polyline || [],
    tollRefs,
    // Campos pedidos por el diseño:
    irt,
    irtLevel: level.label,
    level,
    color: level.color,
    avgSpeed,
    flow,
    queue,
    tollsConsidered: N,
    tollsWithData: Ndata,
  };
}

/**
 * Enriquece un corredor logístico completo. Devuelve el corredor original
 * extendido con segmentos enriquecidos y un `kpi` agregado.
 */
function enrichCorridor(corridor, trafficData) {
  if (!corridor) return null;

  // 1) Agregados por peaje (una sola vez por corredor).
  const tollIds = Array.from(
    new Set(
      (corridor.segments || []).flatMap(s => s.tollRefs || []),
    ),
  );
  const tollAggregatesById = {};
  tollIds.forEach(id => {
    const agg = buildTollAggregate(id, trafficData);
    if (agg) tollAggregatesById[id] = agg;
  });

  // 2) IRT promedio "preliminar" del corredor (para alimentar segmentos sin
  //    peaje). Promedio simple sobre peajes con o sin datos — honesto cuando
  //    el corredor entero está vacío (0).
  const tollIRTs = Object.values(tollAggregatesById).map(t => t.irt);
  const preliminaryAvgIRT = tollIRTs.length
    ? tollIRTs.reduce((s, v) => s + v, 0) / tollIRTs.length
    : 0;

  // 3) Resolver nombres de nodos para fromName / toName.
  const nodeById = {};
  (corridor.nodes || []).forEach(n => { nodeById[n.id] = n; });

  // 4) Segmentos enriquecidos.
  const segments = (corridor.segments || []).map(seg => {
    const enriched = enrichSegment(seg, tollAggregatesById, preliminaryAvgIRT);
    const from = nodeById[seg.fromNodeId];
    const to = nodeById[seg.toNodeId];
    return {
      ...enriched,
      fromName: from?.name || seg.fromNodeId,
      toName: to?.name || seg.toNodeId,
    };
  });

  // 5) KPI del corredor — ponderado por distancia (no media plana).
  const kmSum = segments.reduce((s, x) => s + (x.distanceKm || 0), 0) || 1;
  const corridorIRT = Math.round(
    segments.reduce((s, x) => s + x.irt * (x.distanceKm || 0), 0) / kmSum,
  );
  const flowSum = segments.reduce((s, x) => s + (x.flow || 0), 0);
  const corridorAvgSpeed = flowSum > 0
    ? Math.round(
        segments.reduce((s, x) => s + x.avgSpeed * (x.flow || 0), 0) / flowSum,
      )
    : Math.round(
        segments.reduce((s, x) => s + x.avgSpeed, 0) / (segments.length || 1),
      );
  const criticalSegments = segments.filter(
    s => s.level && (s.level.label === 'CRÍTICO' || s.level.label === 'CERRADO'),
  ).length;
  const totalQueue = Object.values(tollAggregatesById).reduce(
    (s, t) => s + (t.queue || 0), 0,
  );
  const tollsTotal = tollIds.length;
  const tollsWithData = Object.values(tollAggregatesById)
    .filter(t => t.hasData).length;

  const kpi = {
    irt: corridorIRT,
    level: getIRTLevel(corridorIRT),
    avgSpeed: corridorAvgSpeed,
    totalFlow: flowSum,
    totalQueue,
    criticalSegments,
    tollsTotal,
    tollsWithData,
  };

  return {
    ...corridor,
    segments,
    kpi,
    // Alias planos pedidos en la firma para consumidores que sólo necesitan
    // un IRT promedio por corredor en la vista índice.
    irt: corridorIRT,
    irtLevel: kpi.level.label,
    color: kpi.level.color,
  };
}

// ─── Hook público ──────────────────────────────────────────────────────
export default function useLogisticsData(corridorId) {
  // Suscripciones mínimas al store (un selector cada una para evitar
  // re-render innecesario por cambios no relacionados).
  const trafficData = useTrafficStore(s => s.trafficData);
  const isConnected = useTrafficStore(s => s.isConnected);

  const result = useMemo(() => {
    const hasData = trafficData && Object.keys(trafficData).length > 0;

    if (corridorId) {
      const normalizedId = String(corridorId).toUpperCase();
      const base = getLogisticsCorridorById(normalizedId)
        || LOGISTICS_CORRIDORS.find(c => c.id === normalizedId)
        || null;
      return {
        corridor: enrichCorridor(base, trafficData),
        corridors: null,
        isConnected,
        hasData,
        timestamp: Date.now(),
      };
    }

    return {
      corridor: null,
      corridors: LOGISTICS_CORRIDORS.map(c => enrichCorridor(c, trafficData)),
      isConnected,
      hasData,
      timestamp: Date.now(),
    };
  }, [corridorId, trafficData, isConnected]);

  return result;
}
