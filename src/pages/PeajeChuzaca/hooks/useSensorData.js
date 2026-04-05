import { useState, useEffect, useCallback, useRef } from 'react';
import { LANE_CONFIG, CATEGORY_WEIGHTS } from '../lib/constants';
import { randomBetween, generatePlate, clamp } from '../lib/utils';
import { getOperationMode } from '../../../utils/operationMode';

function pickCategory() {
  const r = Math.random();
  let cumulative = 0;
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    cumulative += weight;
    if (r <= cumulative) return cat;
  }
  return 'C1';
}

function generateInitialSpeedHistory() {
  const now = new Date();
  const points = [];
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 5 * 60 * 1000);
    const hour = t.getHours();
    const minuteOfDay = hour * 60 + t.getMinutes();
    let base;
    if (minuteOfDay < 360) base = randomBetween(55, 65);
    else if (minuteOfDay < 420) base = randomBetween(40, 52);
    else if (minuteOfDay < 480) base = randomBetween(48, 58);
    else if (minuteOfDay < 720) base = randomBetween(62, 78);
    else if (minuteOfDay < 840) base = randomBetween(55, 65);
    else base = randomBetween(65, 80);
    points.push({
      time: t.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }),
      avgSpeed: Math.round(base + randomBetween(-3, 3)),
      limit: 80,
      violations: Math.floor(randomBetween(0, base > 75 ? 4 : 1)),
    });
  }
  return points;
}

export default function useSensorData() {
  const [state, setState] = useState(() => ({
    lanes: LANE_CONFIG.map(l => ({ ...l })),
    flow: {
      vehiclesTotal: 1847,
      vehiclesHour: 312,
      avgSpeed: 67,
      occupancy: 42,
      queueLength: 3,
      peakHour: '07:30',
      timestamp: new Date(),
    },
    counting: {
      totalCount: 1847,
      lastHourCount: 312,
      byCategory: { C1: 1108, C2: 277, heavy: 462 },
      lastPlate: generatePlate(),
      lastCategory: 'C1',
      lastSpeed: 72,
    },
    speedHistory: generateInitialSpeedHistory(),
  }));

  const tickRef = useRef(0);

  const tick = useCallback(() => {
    setState(prev => {
      tickRef.current += 1;
      const t = tickRef.current;

      const opMode = getOperationMode();
      const isRetorno = opMode.isRetorno;

      // Update lanes
      const lanes = prev.lanes.map(lane => {
        if (lane.status === 'closed') {
          // 0.5% chance to reopen
          if (Math.random() < 0.005) {
            return { ...lane, status: 'active', speed: isRetorno ? randomBetween(5, 15) : randomBetween(50, 70), queue: isRetorno ? 10 : 0 };
          }
          return { ...lane };
        }

        // Speed variation — correlated with time
        const speedDelta = randomBetween(-8, 8);
        const baseMinSpeed = isRetorno ? 5 : 25;
        const baseMaxSpeed = isRetorno ? 20 : 105;
        let newSpeed = clamp(Math.round(lane.speed + speedDelta), baseMinSpeed, baseMaxSpeed);
        
        // Forzar la baja de velocidad gradualmente si acaba de cambiar de modo
        if (isRetorno && newSpeed > 30) newSpeed -= 5; 

        // Queue inversely correlated with speed, pero forzada en Retorno
        const queuePressure = isRetorno ? randomBetween(0, 3) : (newSpeed < 50 ? 3 : newSpeed < 65 ? 1 : -1);
        const minQueue = isRetorno ? Math.floor(randomBetween(5, 12)) : 0;
        const maxQueue = isRetorno ? 35 : 15;
        const newQueue = clamp(lane.queue + Math.round(queuePressure + randomBetween(-1, 1)), minQueue, maxQueue);

        // Transactions increment
        const txInc = lane.type === 'FacilPass' ? Math.floor(randomBetween(2, 6)) : Math.floor(randomBetween(1, 3));

        // 2% incident chance
        let newStatus = lane.status;
        if (lane.status === 'incident' && Math.random() < 0.15) {
          newStatus = 'active';
        } else if (lane.status === 'active' && Math.random() < 0.02) {
          newStatus = 'incident';
        }

        return {
          ...lane,
          speed: newSpeed,
          queue: newQueue,
          transactionsToday: lane.transactionsToday + txInc,
          lastVehicle: pickCategory(),
          status: newStatus,
        };
      });

      // Flow metrics
      const activeLanes = lanes.filter(l => l.status !== 'closed');
      const avgSpeed = activeLanes.length > 0
        ? Math.round(activeLanes.reduce((s, l) => s + l.speed, 0) / activeLanes.length)
        : 0;
      const totalQueue = lanes.reduce((s, l) => s + l.queue, 0);
      
      const hourFlow = isRetorno ? Math.round(randomBetween(1200, 2400)) : Math.round(randomBetween(180, 520));
      const totalInc = isRetorno ? Math.floor(randomBetween(15, 30)) : Math.floor(randomBetween(3, 8));
      const occupancy = isRetorno ? clamp(Math.round(85 + randomBetween(-3, 10)), 80, 99) : clamp(Math.round(40 + (100 - avgSpeed) * 0.6 + randomBetween(-5, 5)), 15, 95);

      const flow = {
        vehiclesTotal: prev.flow.vehiclesTotal + totalInc,
        vehiclesHour: hourFlow,
        avgSpeed,
        occupancy,
        queueLength: totalQueue,
        peakHour: prev.flow.peakHour,
        timestamp: new Date(),
      };

      // PTZ camera counting data
      const counting = { ...prev.counting };
      counting.totalCount = prev.counting.totalCount + totalInc;
      counting.lastHourCount = hourFlow;
      // Update category breakdown
      const c1Inc = Math.floor(totalInc * 0.60);
      const c2Inc = Math.floor(totalInc * 0.15);
      const heavyInc = totalInc - c1Inc - c2Inc;
      counting.byCategory = {
        C1: prev.counting.byCategory.C1 + c1Inc,
        C2: prev.counting.byCategory.C2 + c2Inc,
        heavy: prev.counting.byCategory.heavy + heavyInc,
      };
      if (Math.random() < 0.2) {
        counting.lastPlate = generatePlate();
        counting.lastCategory = pickCategory();
        counting.lastSpeed = Math.round(randomBetween(45, 95));
      }

      // Speed history — add one point every ~3 ticks (roughly 5min in real-time mapping)
      let speedHistory = [...prev.speedHistory];
      if (t % 3 === 0) {
        const now = new Date();
        speedHistory.push({
          time: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }),
          avgSpeed,
          limit: 80,
          violations: avgSpeed > 80 ? Math.floor(randomBetween(1, 5)) : 0,
        });
        if (speedHistory.length > 24) speedHistory = speedHistory.slice(-24);
      }

      return { lanes, flow, counting, speedHistory };
    });
  }, []);

  useEffect(() => {
    const id = setInterval(tick, 1800);
    return () => clearInterval(id);
  }, [tick]);

  return state;
}
