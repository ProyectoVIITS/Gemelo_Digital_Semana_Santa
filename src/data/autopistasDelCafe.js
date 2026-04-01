/**
 * Autopistas del Café — Datos de Fiscalización
 * Concesión 113/1997 INVÍAS · 256 km · Vence febrero 2027
 * Concesionario: Autopistas del Café S.A. (Odinsa 62% + Megaproyectos 22%)
 *
 * CONFIDENCIAL — Módulo exclusivo MinTransporte / DITRA
 */

export const AUTOPISTAS_CAFE = {
  id: 'ADC',
  name: 'Autopistas del Café',
  shortName: 'ADC',
  concesionario: 'Autopistas del Café S.A.',
  accionistas: 'Odinsa (62%) · Megaproyectos S.A. (22%) · Otros (16%)',
  contrato: 'Contrato de Concesión No. 113 de 1997',
  entidadContratante: 'Instituto Nacional de Vías — INVÍAS',
  vencimiento: '2027-02',
  kmTotales: 256,
  calificacion: 4.6,
  color: '#8b5cf6',
  departamentos: ['Caldas', 'Risaralda', 'Quindío', 'Valle del Cauca'],
  ciudadesPrincipales: ['Manizales', 'Pereira', 'Armenia', 'Chinchiná', 'Santa Rosa de Cabal'],

  peajes: [
    {
      id: 'ADC-01', name: 'PAVAS',
      lat: 5.0483, lng: -75.4855,
      dept: 'Caldas', municipio: 'Manizales',
      ruta: 'Chinchiná — Manizales', km: 'KM 18',
      tarifaCatI: 16200,
      booths: { total: 4, salida: 3, retorno: 1 },
      speedLimit: 60,
      capacidadNominal: 1400, // veh/h (4 booths × 350)
      observaciones: 'Acceso principal Manizales desde Chinchiná',
    },
    {
      id: 'ADC-02', name: 'SAN BERNARDO',
      lat: 5.0355, lng: -75.5121,
      dept: 'Caldas', municipio: 'Manizales',
      ruta: 'Chinchiná — Manizales', km: 'KM 24',
      tarifaCatI: 16200,
      booths: { total: 4, salida: 3, retorno: 1 },
      speedLimit: 60,
      capacidadNominal: 1400,
      observaciones: 'Zona montañosa, curvas pronunciadas',
    },
    {
      id: 'ADC-03', name: 'SANTÁGUEDA',
      lat: 5.0713, lng: -75.5977,
      dept: 'Caldas', municipio: 'Palestina',
      ruta: 'La Ye — La Trinidad', km: 'KM 35',
      tarifaCatI: 16200,
      booths: { total: 6, salida: 4, retorno: 2 },
      speedLimit: 80,
      capacidadNominal: 2100,
      observaciones: 'Intersección con vía a La Dorada. Alto tráfico turístico',
    },
    {
      id: 'ADC-04', name: 'TARAPACÁ I',
      lat: 4.9846, lng: -75.6328,
      dept: 'Caldas', municipio: 'Chinchiná',
      ruta: 'Pereira — Jazmín', km: 'KM 48',
      tarifaCatI: 17800,
      booths: { total: 4, salida: 3, retorno: 1 },
      speedLimit: 80,
      capacidadNominal: 1400,
      observaciones: 'Corredor principal Pereira-Manizales sentido norte',
    },
    {
      id: 'ADC-05', name: 'TARAPACÁ II',
      lat: 4.8923, lng: -75.6261,
      dept: 'Risaralda', municipio: 'Santa Rosa de Cabal',
      ruta: 'Pereira — Jazmín', km: 'KM 58',
      tarifaCatI: 17800,
      booths: { total: 4, salida: 3, retorno: 1 },
      speedLimit: 80,
      capacidadNominal: 1400,
      observaciones: 'Acceso desde Pereira hacia Manizales',
    },
    {
      id: 'ADC-06', name: 'CIRCASIA',
      lat: 4.6189, lng: -75.6371,
      dept: 'Quindío', municipio: 'Filandia / Circasia',
      ruta: 'Armenia — Río Barbas', km: 'KM 78',
      tarifaCatI: 21200,
      booths: { total: 6, salida: 4, retorno: 2 },
      speedLimit: 80,
      capacidadNominal: 2100,
      observaciones: 'Uno de los peajes más caros de Colombia. Alto tráfico turístico Quindío',
    },
    {
      id: 'ADC-07', name: 'COROZAL',
      lat: 4.4080, lng: -75.8999,
      dept: 'Valle del Cauca', municipio: 'La Victoria',
      ruta: 'La Paila — Calarcá', km: 'KM 95',
      tarifaCatI: 16200,
      booths: { total: 4, salida: 3, retorno: 1 },
      speedLimit: 80,
      capacidadNominal: 1400,
      observaciones: 'Conexión con Panamericana. Tráfico mixto turístico + carga',
    },
  ],

  // Tarifas por categoría vehicular (ANI 2026)
  // Factor se multiplica × tarifaCatI del peaje
  categorias: [
    { id: 'catI',   name: 'Automóvil / Campero',     code: 'C1', factor: 1.0,  color: '#38bdf8' },
    { id: 'catII',  name: 'Bus / Camión 2 ejes',     code: 'C2', factor: 1.8,  color: '#f97316' },
    { id: 'catIII', name: 'Camión 3 ejes',           code: 'C3', factor: 2.5,  color: '#a78bfa' },
    { id: 'catIV',  name: 'Camión 4 ejes',           code: 'C4', factor: 3.2,  color: '#94a3b8' },
    { id: 'catV',   name: 'Camión 5+ ejes',          code: 'C5', factor: 3.8,  color: '#fbbf24' },
    { id: 'moto',   name: 'Motocicleta',             code: 'M',  tarifaFija: 4300, color: '#4ade80' },
  ],

  // Distribución vehicular típica para el Eje Cafetero
  // Fuente: INVÍAS conteos volumétricos 2024-2025 corredor Armenia-Manizales
  distribucionVehicular: {
    catI:   0.62,  // 62% automóviles
    catII:  0.15,  // 15% buses y camiones 2 ejes
    catIII: 0.10,  // 10% camiones 3 ejes
    catIV:  0.07,  //  7% camiones 4 ejes
    catV:   0.03,  //  3% camiones 5+ ejes
    moto:   0.03,  //  3% motocicletas
  },

  // Perfil horario de flujo (fracción del pico)
  // Fuente: patrones TPD INVÍAS 2024 — carreteras interurbanas Eje Cafetero
  perfilHorario: [
  //  0     1     2     3     4     5     6     7     8     9    10    11
    0.06, 0.04, 0.03, 0.03, 0.05, 0.12, 0.35, 0.65, 0.82, 0.90, 0.85, 0.78,
  // 12    13    14    15    16    17    18    19    20    21    22    23
    0.72, 0.75, 0.80, 0.88, 0.95, 1.00, 0.85, 0.58, 0.32, 0.18, 0.12, 0.08,
  ],
};

// Helper: obtener peaje por ID
export function getPeajeADC(id) {
  return AUTOPISTAS_CAFE.peajes.find(p => p.id === id);
}

// Helper: calcular tarifa por categoría para un peaje
export function calcularTarifa(peaje, categoriaId) {
  const cat = AUTOPISTAS_CAFE.categorias.find(c => c.id === categoriaId);
  if (!cat) return 0;
  if (cat.tarifaFija) return cat.tarifaFija;
  return Math.round(peaje.tarifaCatI * cat.factor);
}

// Helper: calcular ingresos estimados
export function calcularIngresos(peaje, vehiculosPorCategoria) {
  let total = 0;
  AUTOPISTAS_CAFE.categorias.forEach(cat => {
    const count = vehiculosPorCategoria[cat.id] || 0;
    const tarifa = cat.tarifaFija || Math.round(peaje.tarifaCatI * cat.factor);
    total += count * tarifa;
  });
  return total;
}
