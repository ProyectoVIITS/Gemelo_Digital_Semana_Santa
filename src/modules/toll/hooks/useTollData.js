import { useState, useEffect, useRef } from 'react';
import { HIGH_RISK_TOLLS, ALL_TOLL_STATIONS } from '../../../data/nexusCorridors';
import { getOperationMode, getColombiaHour, getActiveBooths } from '../../../utils/operationMode';

// ─── Lookup booth config from toll station data ───
function getBoothConfig(stationId) {
  const toll = ALL_TOLL_STATIONS.find(t => t.id === stationId);
  return toll?.boothConfig || { total: 4, salida: 3, retorno: 1 };
}

// ─── Base IRT por peaje — SALIDA (tráfico alejándose de Bogotá) ───
const BASE_IRT = {
  'C1-07': 58, 'C1-08': 45,
  'C2-03': 42,
  'C3-01': 55, 'C3-02': 60,
  'C4-02': 52, 'C4-03': 52,
  'C5-02': 58,
  'C6-02': 48,
  'C7-03': 38,
};

// ─── Base IRT por peaje — RETORNO (tráfico hacia Bogotá) ───
// Los peajes cercanos a Bogotá se congestionan; los lejanos fluyen mejor
const BASE_IRT_RETORNO = {
  'C1-07': 48, 'C1-08': 62,    // Siberia: entrada occidental a Bogotá
  'C2-03': 42,
  'C3-01': 82, 'C3-02': 72,    // Chuzacá + Chinauta: embudos críticos → Bogotá
  'C3-03': 45, 'C3-04': 40,    // Pubenza + Flandes: inicio retorno, fluido
  'C4-02': 48, 'C4-03': 50,
  'C5-01': 72, 'C5-02': 68,    // Naranjal + Cáqueza: entrada Llanos → Bogotá
  'C6-01': 68, 'C6-02': 55,    // Albarracín + Tuta: entrada Boyacá → Bogotá
  'C7-03': 38,
};

// ─── Perfil horario SALIDA (Semana Santa — fin de semana largo) ───
const HOURLY_FLOW_PROFILE_SALIDA = [
//  0     1     2     3     4     5     6     7     8     9    10    11
  0.12, 0.08, 0.06, 0.05, 0.08, 0.20, 0.55, 0.82, 0.92, 0.95, 0.90, 0.85,
// 12    13    14    15    16    17    18    19    20    21    22    23
  0.88, 0.85, 0.82, 0.88, 0.92, 0.95, 0.90, 0.75, 0.50, 0.32, 0.22, 0.15,
];

// ─── Perfil horario RETORNO (lunes festivo — regreso a ciudades) ───
// Patrón real: madrugada tranquila, acumulación desde 10am, pico masivo 1pm-5pm
// Fuente: patrones INVÍAS Operación Retorno festivos Colombia
const HOURLY_FLOW_PROFILE_RETORNO = [
//  0     1     2     3     4     5     6     7     8     9    10    11
  0.06, 0.05, 0.04, 0.04, 0.06, 0.10, 0.20, 0.35, 0.50, 0.65, 0.78, 0.85,
// 12    13    14    15    16    17    18    19    20    21    22    23
  0.90, 0.95, 0.98, 1.00, 0.95, 0.88, 0.75, 0.58, 0.38, 0.22, 0.12, 0.08,
];

// Multiplicadores Semana Santa
const SS_MULTIPLIER_SALIDA = 1.45;
const SS_MULTIPLIER_RETORNO = 1.50; // Retorno más concentrado en pocas horas
const SS_MULTIPLIER_EXODO = 1.65;   // Éxodo normal: flujo elevado
const SS_MULTIPLIER_EXODO_PLENO = 1.85; // Éxodo pleno (Jueves Santo): máxima presión

// IRT boost por hora para éxodo pleno — confirmado foto campo Chinauta 9:03 AM COLAPSO
// Pico AM extendido 6-11AM (no solo 7-9), pico PM 13-18PM
const EXODO_PLENO_IRT_BOOST = {
  5: 1.15, 6: 1.40, 7: 1.60, 8: 1.60, 9: 1.55, 10: 1.45, 11: 1.35,
  12: 1.20, 13: 1.35, 14: 1.55, 15: 1.60, 16: 1.55, 17: 1.40, 18: 1.25,
  19: 1.10, 20: 1.0, 21: 1.0, 22: 1.0, 23: 1.0,
};

function getHourlyFactor() {
  const hour = getColombiaHour();
  const { isRetorno } = getOperationMode();
  const profile = isRetorno ? HOURLY_FLOW_PROFILE_RETORNO : HOURLY_FLOW_PROFILE_SALIDA;
  return profile[hour] || 0.5;
}

function getActiveProfile() {
  const opMode = getOperationMode();
  const { isRetorno } = opMode;
  const isExodo = opMode.isExodo || false;
  const isPleno = opMode.exodoLevel === 'pleno';
  return {
    flowProfile: isRetorno ? HOURLY_FLOW_PROFILE_RETORNO : HOURLY_FLOW_PROFILE_SALIDA,
    ssMultiplier: isPleno ? SS_MULTIPLIER_EXODO_PLENO : isExodo ? SS_MULTIPLIER_EXODO : isRetorno ? SS_MULTIPLIER_RETORNO : SS_MULTIPLIER_SALIDA,
    baseIrtMap: isRetorno ? BASE_IRT_RETORNO : BASE_IRT,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rnd = (range) => (Math.random() - 0.5) * range;

function generateAlertMessage(irt, isRetorno) {
  // Solo mensajes que reflejan situaciones REALES en horas pico
  const criticalMsgs = isRetorno
    ? [
        'Cola retorno > 10 veh en caseta principal',
        'Velocidad media < 25 km/h sentido Bogotá',
        'Congestión severa — casetas retorno al 95%',
        'Vehículo detenido en calzada — carril parcialmente bloqueado',
        '⚠ MANIFESTACIÓN PÚBLICA EN SOACHA — represamiento post-peaje',
        'Represamiento Soacha: cola de 3 km sentido Bogotá post-peaje',
      ]
    : [
        'Cola > 8 vehículos en caseta de efectivo',
        'Velocidad promedio < 20 km/h — congestión alta',
        'Incidente menor reportado por CCTV en zona de aproximación',
        'Vehículo pesado detenido en caseta — revisión de carga',
      ];

  const warningMsgs = isRetorno
    ? [
        `Cola moderada retorno: ${3 + Math.round(Math.random() * 4)} vehículos`,
        'Casetas retorno operando al 85% de capacidad',
        `Vehículo categoría C5 en revisión — ${Math.round(30 + Math.random() * 8)}t detectadas`,
      ]
    : [
        `Cola en formación: ${3 + Math.round(Math.random() * 3)} vehículos en caseta efectivo`,
        `Vehículo sobrepeso detectado: ${(30 + Math.random() * 14).toFixed(1)}t (límite: 32t)`,
        'Casetas operando al 80% de capacidad — monitoreo activo',
      ];

  const msgs = irt > 70 ? criticalMsgs : warningMsgs;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function buildSnapshot(irt, stationId, realTraffic = null) {
  const { isRetorno } = getOperationMode();
  const { flowProfile, ssMultiplier } = getActiveProfile();
  const hourFactor = getHourlyFactor();
  const hour = getColombiaHour();

  // ─── Velocidad realista en zona de peaje ───
  // En peaje la velocidad máxima es ~40 km/h (FacilPass) o ~25 km/h (efectivo)
  // En horas pico se reduce aún más por congestión
  // hourFactor: 0.04-0.06 (madrugada) → 0.95 (pico)
  const isValley = hourFactor < 0.25;
  const peakSpeedReduction = hourFactor * 12;

  // ── OVERRIDE CON DATOS REALES (Google Routes API) ──
  // Si hay tráfico real, usamos esa velocidad directamente
  // ── Velocidad: dato REAL de API cuando disponible ──
  let speed;
  if (realTraffic && realTraffic.currentSpeed != null) {
    // Velocidad directa de Google/TomTom/Waze — SIN reducción
    // Es la velocidad real del segmento vial, no una estimación
    speed = clamp(Math.round(realTraffic.currentSpeed + rnd(2)), 5, 120);
  } else {
    // Sin datos reales: estimar por hora y IRT
    const baseSpeed = isValley
      ? clamp(Math.round(60 - irt * 0.2 + rnd(5)), 30, 80)
      : clamp(Math.round(50 - irt * 0.25 - peakSpeedReduction + rnd(5)), 15, 70);
    speed = baseSpeed;
  }

  // ─── Flujo vehicular proporcional a hora ───
  // Valle nocturno (22h): ~40-80 veh/h, no 200+
  // Pico Semana Santa: hasta 600+ veh/h
  const baseFlow = isValley
    ? 20 + hourFactor * 250    // madrugada: 20-80 veh/h
    : 80 + hourFactor * 480;   // día: 80-560 veh/h
  const flow = clamp(Math.round(baseFlow * ssMultiplier + irt * 0.8 + rnd(15)), 15, 680);
  // Ocupación proporcional al estado real del retorno
  // Retorno gridlock (IRT>85): 88-98% — vía saturada como foto campo
  // Retorno alto (IRT>65): 70-88% — congestión fuerte
  // Retorno moderado: escala normal con boost
  // ── Ocupación: override con datos reales si disponibles ──
  // ─── Ocupación basada en modo y datos reales ───
  const opSnap = getOperationMode();
  const isExodoPleno = opSnap.exodoLevel === 'pleno';
  const isPeakNow = (hour >= 7 && hour <= 9) || (hour >= 14 && hour <= 16);

  let occup;
  // Multiplicador agresivo para colapsar las variables en la noche/madrugada.
  // Si no hay tráfico real medible y son las 2AM, el hourFactor es ~0.05.
  const timeContextMultiplier = isValley ? (hourFactor * 4) : 1; // De noche corta dramáticamente la congestión
  
  if (realTraffic && realTraffic.congestionRatio != null) {
    occup = clamp(Math.round(10 + realTraffic.congestionRatio * 88 + (Math.random()*4 - 2)), 5, 98);
  } else if (isRetorno && (irt * timeContextMultiplier) > 85) {
    occup = clamp(Math.round(88 + ((irt * timeContextMultiplier) - 85) * 0.8 + (Math.random()*2 - 1)), 88, 98);
  } else if (isRetorno && (irt * timeContextMultiplier) > 65) {
    occup = clamp(Math.round(70 + ((irt * timeContextMultiplier) - 65) * 0.9 + (Math.random()*2 - 1)), 70, 90);
  } else if (isRetorno && (irt * timeContextMultiplier) > 40) {
    occup = clamp(Math.round(40 + ((irt * timeContextMultiplier) - 40) * 1.1 + (Math.random()*3 - 1.5)), 40, 72);
  } else {
    occup = clamp(Math.round(irt * 0.45 * timeContextMultiplier + hourFactor * 30 + 5 + (Math.random()*4 - 2)), 3, 95);
  }
  const c4closed = (irt * timeContextMultiplier) > 82;

  // ── FLUJO / HORA REALISTA CINEMÁTICO (Q = K * V) ──
  // Si tenemos ocupación y velocidad realista (de API Google o estimada),
  // el flujo debe respetar el diagrama fundamental del tráfico.
  const densityK = occup * 1.6; // veh / km
  let cinematiqFlow = Math.round(densityK * speed);
  
  // En horas súper valle (ej. 1AM, 2AM), el flow debe ser hiper bajo, no solo bajo por densidad.
  if (hourFactor < 0.1) {
     cinematiqFlow *= hourFactor * 5; // Aún más castigo en la madrugada
  }
  
  // Limites realistas para la infraestructura colombiana
  const maxCapacity = 2400; // Máximo teórico por hora Colombia
  cinematiqFlow = clamp(cinematiqFlow, 6, maxCapacity);

  // ── Acumulador de Vehículos Hoy ──
  // Este no se inicializará aquí sino de forma monótona en el Hook, 
  // pero calculamos el baseline baseFlow solo para la primera carga.
  const baselineFlowAprox = flowProfile.slice(0, hour + 1).reduce((s, f) => s + f * 560, 0) * ssMultiplier;

  // ─── Colas: patrón por modo de operación ───
  const opModeSnap = getOperationMode();
  const isBidirectionalSnap = opModeSnap.isBidirectional || false;
  let queueFactor;

  if (isRetorno) {
    // RETORNO PURO (festivos)
    const isGridlock = hour >= 17 && hour <= 20;
    const isPeakReturn = hour >= 13 && hour <= 16;
    const isBuildUp = hour >= 10 && hour <= 12;
    const isLateEvening = hour >= 21 && hour <= 22;
    queueFactor = isGridlock ? 1.0
      : isPeakReturn ? 0.90
      : isBuildUp ? 0.65
      : isLateEvening ? 0.35
      : 0.0;
  } else if (opModeSnap.exodoLevel === 'pleno') {
    // ÉXODO PLENO (Jueves Santo): 98% congestión en picos 7-9AM y 14-16PM
    const isPeakAM = hour >= 7 && hour <= 9;
    const isPeakPM = hour >= 14 && hour <= 16;
    const isCriticalPeak = isPeakAM || isPeakPM;
    queueFactor = isCriticalPeak ? 1.0
      : (hour >= 5 && hour <= 6) ? 0.75
      : (hour >= 10 && hour <= 13) ? 0.55
      : (hour >= 17 && hour <= 18) ? 0.75
      : (hour >= 19 && hour <= 21) ? 0.40
      : 0.10;
  } else if (opModeSnap.isExodo) {
    // ÉXODO NORMAL/ALTO: colas moderadas-altas en horas pico
    const isPeakAM = hour >= 5 && hour <= 10;
    const isPeakPM = hour >= 14 && hour <= 18;
    const isPeak = isPeakAM || isPeakPM;
    queueFactor = isPeak ? 0.85
      : (hour >= 11 && hour <= 13) ? 0.45
      : (hour >= 19 && hour <= 21) ? 0.35
      : 0.10;
  } else if (isBidirectionalSnap) {
    // BIDIRECCIONAL (días laborales): colas moderadas en horas pico
    const isPeakAM = hour >= 6 && hour <= 9;
    const isPeakPM = hour >= 16 && hour <= 19;
    queueFactor = isPeakAM ? 0.55
      : isPeakPM ? 0.50
      : (hour >= 10 && hour <= 15) ? 0.25
      : 0.0;
  } else {
    // SALIDA PURA: picos 6-8am y 3-5pm
    const isPeakAM = hour >= 6 && hour <= 8;
    const isPeakPM = hour >= 15 && hour <= 17;
    const isPeak = isPeakAM || isPeakPM;
    queueFactor = isPeak ? 1.0
      : (hour >= 9 && hour <= 14) ? 0.45
      : (hour >= 18 && hour <= 20) ? 0.35
      : 0.0;
  }

  // ─── Generar N carriles dinámicos basados en boothConfig real ───
  // Layout físico: C1 y C2 son SIEMPRE casetas de retorno (entrada a Bogotá)
  // C3 en adelante son casetas de salida (salida de Bogotá)
  // getActiveBooths() calcula progresivamente cuántas casetas habilitar
  const booth = getBoothConfig(stationId);
  const totalLaneCount = booth.total;
  const { retornoActivas, salidaActivas } = getActiveBooths(booth);

  const lanes = [];
  let retornoUsed = 0;
  let extraRetornoUsed = 0;
  const extrasNeeded = Math.max(0, retornoActivas - booth.retorno);

  for (let i = 0; i < totalLaneCount; i++) {
    const isRetornoBooth = i < booth.retorno; // C1, C2... son casetas de retorno físicas

    let finalActive;
    let laneDirection;

    const opMode = getOperationMode();
    const isBidirectional = opMode.isBidirectional || false;

    if (isRetorno) {
      // RETORNO PURO: casetas retorno físicas + extras progresivos
      if (isRetornoBooth) {
        finalActive = retornoUsed < retornoActivas;
        laneDirection = 'retorno';
        retornoUsed++;
      } else if (extraRetornoUsed < extrasNeeded) {
        finalActive = true;
        laneDirection = 'retorno-extra';
        extraRetornoUsed++;
      } else {
        finalActive = true;
        laneDirection = 'salida';
      }
    } else if (opMode.isExodo) {
      // ÉXODO: 70% casetas salida, 30% retorno — todas activas
      finalActive = true;
      if (retornoUsed < retornoActivas) {
        laneDirection = 'retorno';
        retornoUsed++;
      } else {
        laneDirection = 'salida';
      }
    } else if (isBidirectional) {
      // BIDIRECCIONAL: TODAS las casetas activas, 60% salida / 40% retorno
      finalActive = true;
      if (retornoUsed < retornoActivas) {
        laneDirection = 'retorno';
        retornoUsed++;
      } else {
        laneDirection = 'salida';
      }
    } else {
      // SALIDA PURA (festivos de salida): TODAS activas para salida
      finalActive = true;
      laneDirection = 'salida';
    }

    const activeLaneIndex = finalActive ? lanes.filter(l => l.active).length : -1;
    const isFacilPass = finalActive && activeLaneIndex < Math.ceil(booth.total * 0.25);
    const isRetLane = laneDirection === 'retorno' || laneDirection === 'retorno-extra';

    // Velocidad y cola realistas según dirección del carril
    // Retorno: velocidades más bajas por congestión de entrada, colas más largas en pico
    // Salida: velocidades normales de peaje
    // Variación pequeña por carril (+/- 2) para no ser idénticos pero sin saltos aleatorios
    const laneVariation = ((i * 7 + 3) % 5) - 2; // determinístico por carril: -2, -1, 0, 1, 2
    let laneSpeed, laneQueue;

    if (!finalActive) {
      laneSpeed = 0;
      laneQueue = 0;
    } else if (isRetLane) {
      // Carriles RETORNO: velocidad basada en dato real, colas proporcionales a congestión
      const realCong = realTraffic?.congestionRatio || 0;
      let retBaseSpeed;
      if (realCong > 0.8) {
        retBaseSpeed = clamp(Math.round(5 + laneVariation), 3, 10);
      } else if (realCong > 0.5) {
        retBaseSpeed = clamp(Math.round(speed * 0.6 + laneVariation), 8, 25);
      } else {
        retBaseSpeed = clamp(Math.round(speed * 0.85 + (isFacilPass ? 5 : -2) + laneVariation), 15, 60);
      }
      const retQueue = clamp(Math.round(realCong * 12 * queueFactor + laneVariation * 0.5), 0, 18);
      laneSpeed = retBaseSpeed;
      laneQueue = retQueue;
    } else {
      // Carriles SALIDA: velocidad directa de API + variación por carril
      const realCong = realTraffic?.congestionRatio || 0;
      laneSpeed = clamp(Math.round(speed + (isFacilPass ? 8 : -2) + laneVariation), 10, 80);
      laneQueue = clamp(Math.round(realCong * 8 * queueFactor + laneVariation * 0.3), 0, 10);
    }

    lanes.push({
      id: i + 1,
      label: `C${i + 1}`,
      type: isFacilPass ? 'FacilPass' : 'Efectivo',
      status: finalActive ? 'active' : 'closed',
      active: finalActive,
      speed: laneSpeed,
      queue: laneQueue,
      direction: laneDirection,
    });
  }

  const metrics = {
    vehiclesTotalBaseline: baselineFlowAprox, // Usado para inicializar el contador mono-tónico
    vehiclesHour: cinematiqFlow,
    avgSpeed: speed,
    occupancy: occup,
    irt: Math.round(irt),
    queueLength: lanes.reduce((s, l) => s + l.queue, 0),
    timestamp: new Date(),
  };

  const now = new Date();
  // Speed history basada en velocidad real actual como referencia
  const speedHistory = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now.getTime() - (23 - i) * 5 * 60 * 1000);
    const pastHour = t.getHours();
    const hf = flowProfile[pastHour] || 0.5;
    // Usar velocidad real como base, variar por perfil horario
    const baseHistSpeed = speed || 40;
    const s = clamp(Math.round(baseHistSpeed * (0.8 + (1 - hf) * 0.4) + rnd(5)), 10, 110);
    return {
      time: t.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }),
      avgSpeed: s,
      limit: 80,
      violations: s > 80 ? Math.round(Math.random() * 4) : 0,
    };
  });

  return { lanes, metrics, speedHistory, alerts: [] };
}

function updateHistory(prev, irt, realSpeed) {
  // Usar velocidad real si disponible, sino estimar
  const speed = realSpeed || clamp(Math.round(70 - irt * 0.35 + rnd(8)), 15, 110);
  const now = new Date();
  const point = {
    time: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }),
    avgSpeed: speed,
    limit: 80,
    violations: speed > 80 ? Math.round(Math.random() * 4) : 0,
  };
  return [...prev.slice(-23), point];
}

/**
 * @param {string} stationId
 * @param {string} corridorId
 * @param {object|null} realTraffic - Datos de Google Routes API { currentSpeed, freeFlowSpeed, congestionRatio }
 *   Si se provee, overridea velocidad y congestión en la simulación
 */
export default function useTollData(stationId, corridorId, realTraffic = null) {
  const { baseIrtMap } = getActiveProfile();
  const opModeInit = getOperationMode();
  const rawBaseIRT = baseIrtMap[stationId] ?? 40;
  // Boost IRT para éxodo pleno en picos (7-9AM, 14-16PM)
  const hourInit = getColombiaHour();
  const boostFactor = opModeInit.exodoLevel === 'pleno' ? (EXODO_PLENO_IRT_BOOST[hourInit] || 1.0) : 1.0;
  const baseIRT = clamp(Math.round(rawBaseIRT * boostFactor), 5, 95);
  const isHighRisk = HIGH_RISK_TOLLS.includes(stationId);
  const { isRetorno } = opModeInit;

  const [data, setData] = useState(() => buildSnapshot(baseIRT, stationId, realTraffic));
  const alertIdRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const hour = getColombiaHour();
      const opMode = getOperationMode();
      const bf = opMode.exodoLevel === 'pleno' ? (EXODO_PLENO_IRT_BOOST[hour] || 1.0) : 1.0;
      const boostedBase = clamp(Math.round(rawBaseIRT * bf), 5, 95);
      const jitter = (Math.random() - 0.48) * 8;
      const irt = clamp(boostedBase + jitter, 5, 95);

      setData(prev => {
        const newAlerts = [];
        const hour = getColombiaHour();
        const isPeakAM = hour >= 6 && hour <= 9;
        const isPeakPM = hour >= 14 && hour <= 18;
        const isPeak = isPeakAM || isPeakPM;

        // Solo generar alertas en horas pico y cuando hay congestión real (IRT > 45)
        if (isPeak && irt > 45) {
          const alertProb = irt > 70 ? (isHighRisk ? 0.04 : 0.02) : (isHighRisk ? 0.015 : 0.008);
          if (Math.random() < alertProb) {
            newAlerts.push({
              id: `t-${(++alertIdRef.current) % 100000}-${Date.now().toString(36)}`,
              severity: irt > 70 ? 'critical' : 'warning',
              message: generateAlertMessage(irt, isRetorno),
              timestamp: new Date(),
              resolved: false,
              source: Math.random() > 0.5 ? 'CCTV' : 'CONTEO',
            });
          }
        }

        const snapshot = buildSnapshot(irt, stationId, realTraffic);
        
        let initialTotal = prev.metrics?.vehiclesTotal;
        // Iniciar de forma limpia en el primer render
        if (!initialTotal) {
           initialTotal = Math.round(snapshot.metrics.vehiclesTotalBaseline);
        }

        // Incremento cinemático microscópico real: 
        // Si el flujo es X veh/h, en 1.8 segundos pasarán Y veh.
        const secondsPassed = 1.8;
        const incrementalVehicles = (snapshot.metrics.vehiclesHour / 3600) * secondsPassed;
        
        // Sumar al total histórico, evitamos rnd que hace saltar el número
        const newTotal = initialTotal + incrementalVehicles;
        snapshot.metrics.vehiclesTotal = newTotal;

        return {
          ...snapshot,
          metrics: {
             ...snapshot.metrics,
             // Mostramos al usuario redondeado, pero guardamos flotante para precisión
             vehiclesTotalDisplay: Math.floor(newTotal),
             vehiclesTotal: newTotal 
          },
          speedHistory: updateHistory(prev.speedHistory, irt, realTraffic?.currentSpeed),
          alerts: [...newAlerts, ...prev.alerts].slice(0, 8),
        };
      });
    }, 1800);

    return () => clearInterval(id);
  }, [baseIRT, stationId, isHighRisk, isRetorno, realTraffic]); // eslint-disable-line

  return data;
}
