/**
 * VIITS — 7 Escenarios Precargados · DITRA
 * Fuente: Análisis histórico SS 2019-2025 · MinTransporte · INVÍAS
 */

export const SCENARIOS = [
  {
    id: 'exodo-inicio',
    name: 'Inicio Éxodo — Vie 28 Mar',
    description: 'Primer día éxodo · 70% casetas salida · Restricción carga 3PM',
    icon: '🚗',
    config: {
      selectedDay: 0,
      selectedHour: 16,
      rainByRegion: { andina: 0, pacifica: 0, orinoquia: 0, caribe: 0 },
      restriccionPesados: true,
      carrilReversible: false,
    },
  },
  {
    id: 'base-2025',
    name: 'Base Histórico 2025',
    description: 'Viernes Santo · 11am · Sin lluvia · Sin medidas',
    icon: '📊',
    config: {
      selectedDay: 6,
      selectedHour: 11,
      rainByRegion: { andina: 0, pacifica: 0, orinoquia: 0, caribe: 0 },
      restriccionPesados: false,
      carrilReversible: false,
    },
  },
  {
    id: 'peor-caso',
    name: 'Peor Caso: Lluvia + Vie Santo',
    description: 'Máximo volumen + lluvia intensa todas las regiones',
    icon: '⛈️',
    config: {
      selectedDay: 6,
      selectedHour: 12,
      rainByRegion: { andina: 2, pacifica: 2, orinoquia: 2, caribe: 2 },
      restriccionPesados: false,
      carrilReversible: false,
    },
  },
  {
    id: 'medidas-activas',
    name: 'Medidas Operativas Activas',
    description: 'Carril reversible + restricción pesados en C3/C5/C6',
    icon: '🛡️',
    config: {
      selectedDay: 6,
      selectedHour: 11,
      rainByRegion: { andina: 1, pacifica: 0, orinoquia: 0, caribe: 0 },
      restriccionPesados: true,
      carrilReversible: true,
    },
  },
  {
    id: 'retorno',
    name: 'Domingo Resurrección — Retorno',
    description: 'Flujos invertidos: regreso masivo a Bogotá',
    icon: '🔄',
    config: {
      selectedDay: 8,
      selectedHour: 16,
      rainByRegion: { andina: 0, pacifica: 0, orinoquia: 0, caribe: 0 },
      restriccionPesados: false,
      carrilReversible: false,
    },
  },
  {
    id: 'tunel-linea',
    name: 'Colapso Túnel La Línea (C4)',
    description: 'C4 al límite — cola estimada >3h',
    icon: '🚧',
    config: {
      selectedDay: 6,
      selectedHour: 10,
      rainByRegion: { andina: 1, pacifica: 0, orinoquia: 0, caribe: 0 },
      restriccionPesados: false,
      carrilReversible: false,
    },
  },
  {
    id: 'caribe-pico',
    name: 'Pico Turismo Caribe (C7)',
    description: 'Tasajera saturado — turismo masivo Santa Marta',
    icon: '🏖️',
    config: {
      selectedDay: 6,
      selectedHour: 14,
      rainByRegion: { andina: 0, pacifica: 0, orinoquia: 0, caribe: 0 },
      restriccionPesados: false,
      carrilReversible: false,
    },
  },
  {
    id: 'medellin-pico',
    name: 'Pico Med–Bog Sábado (C1)',
    description: 'Retorno desde Medellín — Honda congestionado',
    icon: '🔴',
    config: {
      selectedDay: 7,
      selectedHour: 9,
      rainByRegion: { andina: 0, pacifica: 0, orinoquia: 0, caribe: 0 },
      restriccionPesados: false,
      carrilReversible: false,
    },
  },
];

export const TICKER_MESSAGES = [
  '🔴 OPERACIÓN ÉXODO ACTIVA — 70% casetas habilitadas para salida · 30% retorno · MinTransporte',
  '🚛 RESTRICCIÓN CARGA ≥3.4t — Hoy 28 Mar: 3PM-10PM rutas Cundinamarca · Res. MinTransporte',
  '📊 MinTransporte proyecta 4,007,213 pasajeros en 336,175 vehículos desde terminales habilitadas',
  '⚠ Vía al Llano (C5): Se esperan 55,000 vehículos el Viernes Santo — récord histórico proyectado',
  '🌧 IDEAM pronostica lluvias en Cundinamarca y Orinoquía del 31 Mar al 2 Abr — incremento 50% precipitación',
  '✅ Tercer carril Bogotá–Girardot operativo: 130 km habilitados reducen tiempo de 6h a 2h',
  '📈 15 millones de viajeros estimados: 10M carretera + 1.8M aéreos — Semana Santa 2026',
  '🚛 Excepciones restricción: aves, leche, carne, frutas, verduras, gasolina, ACPM, GLP — Res. 761/2013',
  '🔴 ANSV: 4,600 policías desplegados en Cundinamarca (500 tránsito) · 34,000 uniformados nacionales',
  '🛣️ Pico y placa regional Plan Retorno: domingo 12M-8PM en 9 accesos a Bogotá',
  '⚠ Túnel La Línea (C4): Capacidad limitada 900 veh/h — colas de hasta 3h en Viernes Santo',
  '🏖️ Costa Caribe: alta demanda turística hacia Cartagena, Santa Marta y Palomino',
  '🔴 Honda (C1 KM280): Punto de colapso histórico — tiempo espera hasta 4h en Semana Santa',
  '⚠ Peaje Chusacá (C3 KM14): 42,000 veh/día proyectados — congestionamiento severo 7-11am',
  '📊 7 corredores monitoreados · 33 peajes INVÍAS · Modelo IRT v1.0 DITRA · Éxodo SS 2026',
];
