/**
 * Departamentos de Colombia: centroide + bbox aproximado.
 *
 * Usado por src/utils/departmentClassifier.js para asignar cada jam Waze
 * a un departamento por proximidad geográfica (nearest-centroid).
 *
 * Fuente de centroides: aproximaciones derivadas del DIVIPOLA / DANE.
 * Bbox usado solo para detección rápida de Bogotá D.C. (enclave dentro
 * de Cundinamarca, donde nearest-centroid sería ambiguo).
 *
 * Nota: precisión adecuada para clasificación de jams a nivel
 * departamento (granularidad gruesa). Para casos border (vías
 * intermunicipales que cruzan límites departamentales) la asignación
 * puede ir a uno u otro lado, lo cual es aceptable para el uso
 * "panorama por entidad territorial".
 */

export const COLOMBIA_DEPARTMENTS = [
  { code: '05', name: 'Antioquia',          centroid: { lat:  6.80, lon: -75.50 } },
  { code: '08', name: 'Atlántico',          centroid: { lat: 10.70, lon: -74.85 } },
  { code: '11', name: 'Bogotá D.C.',        centroid: { lat:  4.65, lon: -74.10 } },
  { code: '13', name: 'Bolívar',            centroid: { lat:  9.00, lon: -74.40 } },
  { code: '15', name: 'Boyacá',             centroid: { lat:  5.45, lon: -73.00 } },
  { code: '17', name: 'Caldas',             centroid: { lat:  5.30, lon: -75.50 } },
  { code: '18', name: 'Caquetá',            centroid: { lat:  1.30, lon: -74.50 } },
  { code: '19', name: 'Cauca',              centroid: { lat:  2.50, lon: -76.80 } },
  { code: '20', name: 'Cesar',              centroid: { lat:  9.50, lon: -73.50 } },
  { code: '23', name: 'Córdoba',            centroid: { lat:  8.50, lon: -75.85 } },
  { code: '25', name: 'Cundinamarca',       centroid: { lat:  4.95, lon: -74.30 } },
  { code: '27', name: 'Chocó',              centroid: { lat:  6.00, lon: -77.00 } },
  { code: '41', name: 'Huila',              centroid: { lat:  2.95, lon: -75.50 } },
  { code: '44', name: 'La Guajira',         centroid: { lat: 11.50, lon: -72.30 } },
  { code: '47', name: 'Magdalena',          centroid: { lat: 10.30, lon: -74.30 } },
  { code: '50', name: 'Meta',               centroid: { lat:  3.50, lon: -73.00 } },
  { code: '52', name: 'Nariño',             centroid: { lat:  1.30, lon: -77.30 } },
  { code: '54', name: 'Norte de Santander', centroid: { lat:  8.00, lon: -72.95 } },
  { code: '63', name: 'Quindío',            centroid: { lat:  4.50, lon: -75.70 } },
  { code: '66', name: 'Risaralda',          centroid: { lat:  5.30, lon: -75.95 } },
  { code: '68', name: 'Santander',          centroid: { lat:  6.65, lon: -73.30 } },
  { code: '70', name: 'Sucre',              centroid: { lat:  9.30, lon: -75.30 } },
  { code: '73', name: 'Tolima',             centroid: { lat:  4.10, lon: -75.20 } },
  { code: '76', name: 'Valle del Cauca',    centroid: { lat:  3.85, lon: -76.50 } },
  { code: '81', name: 'Arauca',             centroid: { lat:  6.50, lon: -71.00 } },
  { code: '85', name: 'Casanare',           centroid: { lat:  5.30, lon: -71.50 } },
  { code: '86', name: 'Putumayo',           centroid: { lat:  0.50, lon: -76.00 } },
  { code: '88', name: 'San Andrés',         centroid: { lat: 12.55, lon: -81.71 } },
  { code: '91', name: 'Amazonas',           centroid: { lat: -1.50, lon: -71.50 } },
  { code: '94', name: 'Guainía',            centroid: { lat:  2.60, lon: -68.80 } },
  { code: '95', name: 'Guaviare',           centroid: { lat:  2.20, lon: -72.30 } },
  { code: '97', name: 'Vaupés',             centroid: { lat:  0.85, lon: -70.80 } },
  { code: '99', name: 'Vichada',            centroid: { lat:  4.50, lon: -69.80 } },
];

// Bogotá D.C. es enclave dentro de Cundinamarca → bbox especial para que
// el nearest-centroid no clasifique mal jams urbanos de Bogotá.
export const BOGOTA_DC_BBOX = {
  minLat:  4.45,
  maxLat:  4.85,
  minLon: -74.25,
  maxLon: -73.95,
};
