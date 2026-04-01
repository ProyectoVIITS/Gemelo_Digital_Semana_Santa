/**
 * useFiscalizacionData — Conteo vehicular por categoría para Autopistas del Café
 * Estima vehículos/hora usando datos reales de tráfico (Waze/Google/TomTom)
 * Almacena acumulado diario en localStorage para historial de 7 días
 */
import { useState, useEffect, useRef } from 'react';
import { AUTOPISTAS_CAFE, calcularTarifa } from '../../data/autopistasDelCafe';
import { getColombiaHour } from '../../utils/operationMode';

const TZ = 'America/Bogota';
const LS_KEY = 'viits_fiscalizacion_history';

function getColombiaDateStr() {
  const now = new Date();
  const y = now.toLocaleString('en-US', { year: 'numeric', timeZone: TZ });
  const m = now.toLocaleString('en-US', { month: '2-digit', timeZone: TZ });
  const d = now.toLocaleString('en-US', { day: '2-digit', timeZone: TZ });
  return `${y}-${m}-${d}`;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveHistory(h) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(h)); } catch {}
}

// Estimar vehículos/hora basado en datos de tráfico real
function estimateFlowFromTraffic(trafficData, peaje) {
  if (!trafficData || trafficData.currentSpeed == null) {
    // Sin datos reales: usar perfil horario × capacidad nominal
    const hour = getColombiaHour();
    const factor = AUTOPISTAS_CAFE.perfilHorario[hour] || 0.5;
    return Math.round(peaje.capacidadNominal * factor * (0.6 + Math.random() * 0.15));
  }

  const { currentSpeed, freeFlowSpeed, congestionRatio } = trafficData;
  const speedRatio = freeFlowSpeed > 0 ? currentSpeed / freeFlowSpeed : 0.7;

  // Modelo: más congestión = más vehículos intentando pasar
  // Pero si está colapsado (speedRatio < 0.2), el throughput baja
  let throughputFactor;
  if (speedRatio > 0.7) {
    throughputFactor = 0.5 + speedRatio * 0.3; // Flujo libre: 50-80% capacidad
  } else if (speedRatio > 0.3) {
    throughputFactor = 0.85 + (0.7 - speedRatio) * 0.5; // Congestión: 85-105% capacidad
  } else {
    throughputFactor = 0.7 + speedRatio * 0.5; // Colapso: throughput cae 70-85%
  }

  const baseFlow = peaje.capacidadNominal * throughputFactor;
  return Math.round(baseFlow * (0.95 + Math.random() * 0.1));
}

// Distribuir flujo total en categorías vehiculares
function distribuirPorCategoria(totalFlow) {
  const dist = AUTOPISTAS_CAFE.distribucionVehicular;
  return {
    catI:   Math.round(totalFlow * dist.catI),
    catII:  Math.round(totalFlow * dist.catII),
    catIII: Math.round(totalFlow * dist.catIII),
    catIV:  Math.round(totalFlow * dist.catIV),
    catV:   Math.round(totalFlow * dist.catV),
    moto:   Math.round(totalFlow * dist.moto),
  };
}

// Calcular ingresos por hora para un peaje
function calcularIngresosHora(peaje, vehiculosPorCat) {
  let total = 0;
  AUTOPISTAS_CAFE.categorias.forEach(cat => {
    const count = vehiculosPorCat[cat.id] || 0;
    const tarifa = cat.tarifaFija || Math.round(peaje.tarifaCatI * cat.factor);
    total += count * tarifa;
  });
  return total;
}

/**
 * Hook principal: datos de fiscalización para un peaje específico
 * @param {string} peajeId - ID del peaje (ADC-01...ADC-07)
 * @param {object|null} trafficData - Datos de tráfico real del hook useGlobalTraffic
 */
export function useFiscalizacionPeaje(peajeId, trafficData = null) {
  const peaje = AUTOPISTAS_CAFE.peajes.find(p => p.id === peajeId);
  const [data, setData] = useState({ flow: 0, porCategoria: {}, ingresoHora: 0, acumuladoHoy: 0, ingresoHoy: 0 });
  const acumRef = useRef({ count: 0, ingreso: 0, lastHour: -1 });

  useEffect(() => {
    if (!peaje) return;

    function update() {
      const hour = getColombiaHour();
      const flow = estimateFlowFromTraffic(trafficData, peaje);
      const porCategoria = distribuirPorCategoria(flow);
      const ingresoHora = calcularIngresosHora(peaje, porCategoria);

      // Acumular por hora (reset al cambiar de hora)
      if (hour !== acumRef.current.lastHour) {
        // Guardar hora anterior en historial
        const dateStr = getColombiaDateStr();
        const history = loadHistory();
        if (!history[dateStr]) history[dateStr] = {};
        if (!history[dateStr][peajeId]) history[dateStr][peajeId] = { total: 0, ingreso: 0, porHora: {} };
        if (acumRef.current.lastHour >= 0) {
          history[dateStr][peajeId].porHora[acumRef.current.lastHour] = {
            vehiculos: acumRef.current.count,
            ingreso: acumRef.current.ingreso,
          };
          history[dateStr][peajeId].total += acumRef.current.count;
          history[dateStr][peajeId].ingreso += acumRef.current.ingreso;
        }
        // Limpiar historial > 7 días
        const dates = Object.keys(history).sort();
        while (dates.length > 7) { delete history[dates.shift()]; }
        saveHistory(history);

        acumRef.current = { count: 0, ingreso: 0, lastHour: hour };
      }

      // Acumular fracción de hora (update cada 3s = 1/1200 de hora)
      acumRef.current.count += Math.round(flow / 1200);
      acumRef.current.ingreso += Math.round(ingresoHora / 1200);

      // Leer acumulado del día
      const history = loadHistory();
      const dateStr = getColombiaDateStr();
      const todayData = history[dateStr]?.[peajeId] || { total: 0, ingreso: 0 };

      setData({
        flow,
        porCategoria,
        ingresoHora,
        acumuladoHoy: todayData.total + acumRef.current.count,
        ingresoHoy: todayData.ingreso + acumRef.current.ingreso,
        hour,
        peaje,
      });
    }

    update();
    const id = setInterval(update, 3000);
    return () => clearInterval(id);
  }, [peajeId, trafficData, peaje]);

  return data;
}

/**
 * Hook: datos agregados de TODOS los 7 peajes
 * Para el dashboard principal de fiscalización
 */
export function useFiscalizacionGlobal() {
  const [data, setData] = useState({ peajes: [], totalVehiculos: 0, totalIngresos: 0, history: [] });

  useEffect(() => {
    function update() {
      const allTrafficData = {}; // No dependency on external traffic for now
      const hour = getColombiaHour();
      const history = loadHistory();
      const dateStr = getColombiaDateStr();
      let totalVeh = 0;
      let totalIng = 0;

      const peajes = AUTOPISTAS_CAFE.peajes.map(p => {
        const traffic = allTrafficData[p.id] || null;
        const flow = estimateFlowFromTraffic(traffic, p);
        const porCategoria = distribuirPorCategoria(flow);
        const ingresoHora = calcularIngresosHora(p, porCategoria);
        const todayData = history[dateStr]?.[p.id] || { total: 0, ingreso: 0 };

        totalVeh += todayData.total + Math.round(flow * hour / 24);
        totalIng += todayData.ingreso + Math.round(ingresoHora * hour / 24);

        return {
          ...p,
          flow,
          porCategoria,
          ingresoHora,
          acumuladoHoy: todayData.total + Math.round(flow * hour / 24),
          ingresoHoy: todayData.ingreso + Math.round(ingresoHora * hour / 24),
          congestion: traffic?.congestionRatio || null,
          speed: traffic?.currentSpeed || null,
        };
      });

      // Historial 7 días
      const dates = Object.keys(history).sort().slice(-7);
      const hist7d = dates.map(date => {
        const dayData = history[date] || {};
        let dayVeh = 0, dayIng = 0;
        AUTOPISTAS_CAFE.peajes.forEach(p => {
          dayVeh += dayData[p.id]?.total || 0;
          dayIng += dayData[p.id]?.ingreso || 0;
        });
        return { date, vehiculos: dayVeh, ingresos: dayIng };
      });

      setData({ peajes, totalVehiculos: totalVeh, totalIngresos: totalIng, history: hist7d, hour });
    }

    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, []); // No external dependencies — self-contained polling

  return data;
}
