/**
 * Hook: useAccidentData
 * Provee acceso a los hotspots de accidentabilidad procesados
 * desde la base DITRA/INVÍAS 2023-2025
 */
import { useMemo } from 'react';
import { getNivelRiesgo } from '../data/accidentUtils';

// Import será dinámico — si el JSON no existe aún, devuelve datos vacíos
let hotspotsRaw = null;
try {
  hotspotsRaw = require('../data/hotspots_processed.json');
} catch (e) {
  console.warn('⚠ hotspots_processed.json no encontrado. Ejecutar: python scripts/processIncidents.py');
  hotspotsRaw = {
    generado: null,
    totalRegistros: 0,
    totalCorredores: 0,
    totalHotspots: 0,
    resumenPorCorredor: {},
    hotspots: [],
  };
}

export function useAccidentData() {
  return useMemo(() => {
    const data = hotspotsRaw;

    return {
      // Todos los hotspots
      hotspots: data.hotspots || [],

      // Raw data
      data,

      // Hotspots por corredor
      getHotspotsByCorridor: (corridorId) =>
        (data.hotspots || []).filter(h => h.corridorId === corridorId),

      // Estadísticas por corredor
      getCorridorStats: (corridorId) =>
        data.resumenPorCorredor?.[corridorId] || null,

      // Top N hotspots más peligrosos de un corredor
      getTopHotspots: (corridorId, n = 5) =>
        (data.hotspots || [])
          .filter(h => h.corridorId === corridorId)
          .sort((a, b) => b.iraScore - a.iraScore)
          .slice(0, n),

      // Solo hotspots críticos y fatales
      getCriticalHotspots: (corridorId) =>
        (data.hotspots || [])
          .filter(h => h.iraScore >= 60 && (!corridorId || h.corridorId === corridorId))
          .sort((a, b) => b.iraScore - a.iraScore),

      // Hotspots con alto factor Semana Santa (> 40%)
      getSemSantaHotspots: (corridorId) =>
        (data.hotspots || [])
          .filter(h => h.factorSemSanta > 40 && (!corridorId || h.corridorId === corridorId))
          .sort((a, b) => b.factorSemSanta - a.factorSemSanta),

      // Totales globales
      totalIncidentes: Object.values(data.resumenPorCorredor || {})
        .reduce((s, c) => s + (c.totalIncidentes || 0), 0),
      totalMuertos: Object.values(data.resumenPorCorredor || {})
        .reduce((s, c) => s + (c.muertos || 0), 0),
      totalLesionados: Object.values(data.resumenPorCorredor || {})
        .reduce((s, c) => s + (c.lesionados || 0), 0),
      totalHotspots: (data.hotspots || []).length,
      hotspotsZonaNegra: (data.hotspots || []).filter(h => h.iraScore >= 80).length,

      // Flag: datos disponibles
      hasData: (data.hotspots || []).length > 0,
    };
  }, []);
}
