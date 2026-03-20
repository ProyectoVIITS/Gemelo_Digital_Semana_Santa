/**
 * VIITS — Motor de Cálculo del Índice de Riesgo de Trancón (IRT)
 * Modelo IRT v1.0 — VIITS/INVÍAS 2026
 *
 * El IRT combina 4 componentes ponderados + factores operativos:
 *   C1: Relación volumen/capacidad (40%)
 *   C2: Tasa de crecimiento horaria (25%)
 *   C3: Factor festivo histórico (20%)
 *   C4: Factor climático (15%)
 *   Ajustes: restricción pesados (-8%), carril reversible (-12%)
 */

/**
 * Calcula el Índice de Riesgo de Trancón (0-100)
 */
export function calcularIRT({
  volumenActual,
  capacidadVia,
  tasaCrecimiento = 0,
  factorFestivo = 0,
  nivelLluvia = 0,       // 0=sin lluvia, 1=moderada, 2=intensa
  restriccionPesados = false,
  carrilReversible = false,
}) {
  const factorClima = [0, 0.50, 1.00][nivelLluvia];
  const factorPesados = restriccionPesados ? -0.08 : 0;
  const factorReversible = carrilReversible ? -0.12 : 0;

  const componente1 = Math.min(volumenActual / capacidadVia, 1.8) * 0.40;
  const componente2 = Math.min(Math.max(tasaCrecimiento, 0), 0.5) * 0.25;
  const componente3 = factorFestivo * 0.20;
  const componente4 = factorClima * 0.15;

  const irt = componente1 + componente2 + componente3 + componente4
    + factorPesados + factorReversible;

  return Math.min(Math.max(Math.round(irt * 100), 0), 100);
}

/**
 * Desglose del IRT para el panel explicativo
 */
export function desglosarIRT({
  volumenActual,
  capacidadVia,
  tasaCrecimiento = 0,
  factorFestivo = 0,
  nivelLluvia = 0,
  restriccionPesados = false,
  carrilReversible = false,
}) {
  const factorClima = [0, 0.50, 1.00][nivelLluvia];
  const factorPesados = restriccionPesados ? -0.08 : 0;
  const factorReversible = carrilReversible ? -0.12 : 0;

  const ratio = volumenActual / capacidadVia;
  const c1 = Math.min(ratio, 1.5) * 0.40;
  const c2 = Math.min(Math.max(tasaCrecimiento, 0), 0.5) * 0.25;
  const c3 = factorFestivo * 0.20;
  const c4 = factorClima * 0.15;

  const raw = c1 + c2 + c3 + c4 + factorPesados + factorReversible;
  const irt = Math.min(Math.max(Math.round(raw * 100), 0), 100);

  return {
    irt,
    ratio: ratio.toFixed(2),
    componentes: {
      volumenCapacidad: { raw: ratio.toFixed(2), weighted: c1.toFixed(3), peso: '40%' },
      tasaCrecimiento: { raw: tasaCrecimiento.toFixed(2), weighted: c2.toFixed(3), peso: '25%' },
      factorFestivo: { raw: factorFestivo.toFixed(2), weighted: c3.toFixed(3), peso: '20%' },
      factorClimatico: { raw: factorClima.toFixed(2), weighted: c4.toFixed(3), peso: '15%' },
      ajustePesados: factorPesados,
      ajusteReversible: factorReversible,
    },
    total: raw.toFixed(3),
  };
}

/**
 * Calcula el tiempo de viaje estimado basado en el IRT.
 * Relación no lineal: a mayor IRT, crece exponencialmente.
 * A IRT=100, el tiempo es ~4.5× el normal.
 */
export function calcularTiempoViaje(tiempoNormalHrs, irt) {
  const multiplicador = 1 + (Math.pow(irt / 100, 2) * 3.5);
  return tiempoNormalHrs * multiplicador;
}

/**
 * Calcula la velocidad promedio estimada.
 * A IRT=100, la velocidad cae a ~15 km/h (flujo forzado).
 */
export function calcularVelocidadPromedio(velocidadLibreKmh, irt) {
  return Math.max(velocidadLibreKmh * (1 - (irt / 100) * 0.82), 15);
}

/**
 * Obtiene el nivel de alerta basado en el IRT.
 */
export function getNivelAlerta(irt) {
  if (irt <= 40) return { nivel: 'normal', label: 'Flujo Normal', color: '#10b981', bgColor: 'bg-emerald-500' };
  if (irt <= 65) return { nivel: 'precaucion', label: 'Precaución', color: '#f59e0b', bgColor: 'bg-amber-500' };
  if (irt <= 80) return { nivel: 'congestion', label: 'Congestión', color: '#f97316', bgColor: 'bg-orange-500' };
  if (irt <= 90) return { nivel: 'critico', label: 'CRÍTICO', color: '#ef4444', bgColor: 'bg-red-500' };
  return { nivel: 'colapso', label: 'COLAPSO', color: '#7f1d1d', bgColor: 'bg-red-900' };
}

/**
 * Calcula la tasa de crecimiento entre la hora actual y la anterior.
 */
export function calcularTasaCrecimiento(volumenActual, volumenAnterior) {
  if (volumenAnterior <= 0) return 0;
  return (volumenActual - volumenAnterior) / volumenAnterior;
}

/**
 * Genera el análisis "¿Cuándo salir?" para un corredor y día.
 * Retorna array de objetos con IRT y tiempo estimado por hora de salida.
 */
export function generarAnalisisSalida(corridor, dayIndex, nivelLluvia, restriccionPesados, carrilReversible, getVolumeFn) {
  const horasSalida = [5, 7, 9, 11, 14, 18, 21];
  return horasSalida.map(hour => {
    const { volume, factorFestivo } = getVolumeFn(corridor, dayIndex, hour);
    const prevData = getVolumeFn(corridor, dayIndex, Math.max(hour - 1, 0));
    const tasaCrecimiento = calcularTasaCrecimiento(volume, prevData.volume);

    const irt = calcularIRT({
      volumenActual: volume,
      capacidadVia: corridor.normalCapacityVehHr,
      tasaCrecimiento,
      factorFestivo,
      nivelLluvia,
      restriccionPesados,
      carrilReversible,
    });

    const tiempo = calcularTiempoViaje(corridor.normalTravelTimeHrs, irt);
    const alerta = getNivelAlerta(irt);

    let recomendacion = '';
    if (irt <= 35) recomendacion = 'MEJOR OPCIÓN';
    else if (irt <= 50) recomendacion = 'BUENA OPCIÓN';
    else if (irt >= 85) recomendacion = 'EVITAR';

    return { hour, irt, tiempo, alerta, recomendacion, volume };
  });
}
