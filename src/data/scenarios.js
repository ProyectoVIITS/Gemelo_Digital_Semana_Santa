/**
 * VIITS — Escenarios Precargados
 * 4 escenarios predefinidos para demostración ministerial
 */

export const SCENARIOS = [
  {
    id: 'base-2025',
    name: 'Base Histórico 2025',
    description: 'Datos históricos normales sin medidas especiales',
    icon: '📊',
    config: {
      selectedDay: 5,      // Viernes Santo
      selectedHour: 11,    // 11:00 AM
      rainByRegion: { andina: 0, orinoquia: 0, caribe: 0 },
      restriccionPesados: false,
      carrilReversible: false,
    },
    // IRT esperados: Girardot ~82, Llano ~88, Medellín ~65, Caribe ~70
  },
  {
    id: 'peor-caso',
    name: 'Peor Caso: Tormenta',
    description: 'Máximo volumen + lluvia intensa en todas las regiones',
    icon: '⛈️',
    config: {
      selectedDay: 5,      // Viernes Santo
      selectedHour: 12,    // 12:00 PM
      rainByRegion: { andina: 2, orinoquia: 2, caribe: 2 },
      restriccionPesados: false,
      carrilReversible: false,
    },
    // IRT esperados: Girardot ~96, Llano ~99, todos en rojo/carmesí
  },
  {
    id: 'medidas-activas',
    name: 'Medidas Operativas',
    description: 'Carril reversible + restricción de pesados activos',
    icon: '🛡️',
    config: {
      selectedDay: 5,      // Viernes Santo
      selectedHour: 11,    // 11:00 AM
      rainByRegion: { andina: 1, orinoquia: 0, caribe: 0 },
      restriccionPesados: true,
      carrilReversible: true,
    },
    // IRT esperados: Girardot ~71, Llano ~78 (mejora visible vs Escenario 1)
  },
  {
    id: 'retorno-domingo',
    name: 'Retorno Domingo',
    description: 'Regreso masivo — flujos invertidos',
    icon: '🔄',
    config: {
      selectedDay: 7,      // Domingo de Resurrección
      selectedHour: 16,    // 4:00 PM
      rainByRegion: { andina: 0, orinoquia: 0, caribe: 0 },
      restriccionPesados: false,
      carrilReversible: false,
    },
    // Flujos invertidos: Girardot→Bogotá congestionado
  },
];

// Mensajes del ticker de noticias (contextuales según escenario y datos)
export const TICKER_MESSAGES = [
  '⚠ Vía al Llano: Se esperan 55,000 vehículos el Viernes Santo — récord histórico proyectado',
  '🌧 IDEAM pronostica lluvias en Cundinamarca y Orinoquía del 31 Mar al 2 Abr — incremento 50% precipitación',
  '✅ Tercer carril Bogotá–Girardot operativo: 130 km habilitados reducen tiempo de 6h a 2h',
  '📊 Semana Santa 2025: 9.1 millones de vehículos movilizados a nivel nacional',
  '🚛 Restricción de vehículos pesados ≥3.4 ton activa en 36 rutas nacionales de 6AM a 6PM',
  '🔴 ANSV: 460 accidentes en SS 2025 (-60% vs 2024) — 34,000 uniformados en vías',
  '🛣️ Pico y placa regional Plan Retorno: domingo 12M-8PM en 9 accesos a Bogotá',
  '⚠ Km 18 Vía al Llano (Chipaque): paso regulado tipo semáforo — capacidad limitada a 300-400 veh',
  '📈 Incremento del 35% en flujo vehicular durante Semana Santa vs semana normal — SuperTransporte',
  '🏖️ Costa Caribe: alta demanda turística hacia Cartagena, Santa Marta y Palomino',
];
