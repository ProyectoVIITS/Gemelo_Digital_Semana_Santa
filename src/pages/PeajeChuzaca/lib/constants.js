export const CHUZACA = {
  name: 'Peaje Chusacá',
  route: 'Autopista Sur',
  km: 'KM 14+000',
  department: 'Cundinamarca',
  municipality: 'Soacha',
  coordinates: {
    lat: 4.53841,
    lng: -74.27191,
    altitude: 2552,
    dms: '4°32\'18"N  74°16\'19"W',
  },
  operator: 'INVÍAS',
  concession: 'Administración Directa',
  lanes: 4,
  speedLimit: 80,
};

export const SPEED_THRESHOLDS = { normal: 70, warning: 90, critical: 110 };
export const QUEUE_THRESHOLDS = { normal: 3, warning: 6, critical: 10 };

export const MAPS = {
  streetView: `https://www.google.com/maps/embed?pb=!4v1710610000000!6m8!1m7!1sCAoSLEFGMVFpcE1CVjVJazlmQWJ5d1diTnRfZjUyNGpGODRCbXhfb3BXNG!2m2!1d4.53841!2d-74.27191!3f210!4f0!5f0.7820865974627469`,
  satellite: `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1500!2d-74.27191!3d4.53841!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e1!3m2!1ses!2sco`,
  osm: `https://www.openstreetmap.org/export/embed.html?bbox=-74.282,-74.262,4.530,4.547&layer=mapnik&marker=4.53841,-74.27191`,
};

export const LANE_CONFIG = [
  { id: 1, label: 'C1', type: 'Efectivo',  status: 'active', speed: 65, queue: 2, transactionsToday: 847,  lastVehicle: 'C1' },
  { id: 2, label: 'C2', type: 'FacilPass', status: 'active', speed: 82, queue: 0, transactionsToday: 1243, lastVehicle: 'C2' },
  { id: 3, label: 'C3', type: 'FacilPass', status: 'active', speed: 78, queue: 1, transactionsToday: 1102, lastVehicle: 'C1' },
  { id: 4, label: 'C4', type: 'Efectivo',  status: 'closed', speed: 0,  queue: 0, transactionsToday: 0,    lastVehicle: null },
];

export const VEHICLE_CATEGORIES = {
  C1: { name: 'Automóvil',       color: '#38bdf8', width: 22, height: 10, speedFactor: 1.0  },
  C2: { name: 'Bus',             color: '#f97316', width: 36, height: 12, speedFactor: 0.75 },
  C3: { name: 'Camión 2 ejes',   color: '#a78bfa', width: 40, height: 13, speedFactor: 0.6  },
  C4: { name: 'Camión 3+ ejes',  color: '#94a3b8', width: 48, height: 14, speedFactor: 0.5  },
  C5: { name: 'Camión pesado',    color: '#fbbf24', width: 56, height: 15, speedFactor: 0.4  },
};

export const CATEGORY_WEIGHTS = { C1: 0.60, C2: 0.15, C3: 0.15, C4: 0.05, C5: 0.05 };

export const ALERT_SOURCES = ['CCTV', 'CONTEO', 'LOOP', 'SISTEMA'];
