const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const INPUT_FILE  = path.join(__dirname, '../data/incidentes_ditra.xlsx');
const OUTPUT_FILE = path.join(__dirname, '../src/data/hotspots_processed.json');

const CORRIDOR_BUFFER_KM = 2.0;

const CORRIDOR_BOUNDS = {
  C1: { latMin: 4.70, latMax: 6.60, lngMin: -75.70, lngMax: -74.10 },
  C2: { latMin: 2.10, latMax: 4.85, lngMin: -77.00, lngMax: -75.80 },
  C3: { latMin: 4.15, latMax: 4.75, lngMin: -74.95, lngMax: -74.20 },
  C4: { latMin: 4.28, latMax: 4.55, lngMin: -75.65, lngMax: -75.00 },
  C5: { latMin: 3.95, latMax: 4.75, lngMin: -74.10, lngMax: -73.40 },
  C6: { latMin: 4.70, latMax: 5.75, lngMin: -74.10, lngMax: -73.20 },
  C7: { latMin: 10.55, latMax: 11.35, lngMin: -75.00, lngMax: -74.00 },
};

const COLS = {
  ID:          'Hechos_HECHOS_ID',
  MUNICIPIO:   'Hechos_MUNICIPIO_HECHO',
  BARRIO:      'Hechos_BARRIOS_HECHO',
  CLASE:       'Hechos_SIEVI_CLASE_ACCIDENTE',
  ZONA:        'Hechos_ZONA',
  CUADRANTE:   'Hechos_CUADRANTE_VIAL',
  DIA_SEMANA:  'Calend_DIa_SeMaNa',
  MES:         'Calend_MES',
  MES_NUM:     'Calend_MES_numero',
  RUTA:        'Hechos_RUTA_HECHO',
  FECHA:       'Calend_FECHA_HECHO',
  HORA:        'Hechos_INTERVALOS_HORA',
  HIPOTESIS:   'HIPOTESIS_HECHOS_ACCI',
  GENERO:      'Person_GENERO',
  EDAD:        'Person_EDAD',
  GRUPO_EDAD:  'GRUPO_EDAD',
  EVENTO:      'EVENTO',
  PARTICIPANTE:'TIPO_PARTICIPANTE',
  VEHICULO:    'CLASE_VEHICULO',
  SERVICIO:    'TIPO_SERVICIO',
  LATITUD:     'LATITUD',
  LONGITUD:    'LONGITUD',
};

// Handle the year column with encoding issue
const COLS_YEAR = 'Calend_AÑO';
const COLS_YEAR_ALT = 'Calend_A\u00d1O';

const PESO_SEVERIDAD = {
  'MUERTO':     10,
  'LESIONADO':   5,
  'ACCIDENTADO': 2,
  'SOLO DAÑOS':  1,
};

const FACTOR_HORA = {
  '00:00 - 05:59': 1.80,
  '06:00 - 11:59': 1.10,
  '12:00 - 17:59': 1.00,
  '18:00 - 23:59': 1.40,
};

const FACTOR_VEHICULO = {
  'MOTOCICLETA': 1.50,
  'CAMION':      1.30,
  'BUS':         1.20,
  'AUTOMOVIL':   1.00,
};

const FACTOR_SEMANA_SANTA = 1.45;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2
            + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180)
            * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function assignCorridor(lat, lng) {
  const hits = [];
  for (const [id, bounds] of Object.entries(CORRIDOR_BOUNDS)) {
    if (lat >= bounds.latMin && lat <= bounds.latMax &&
        lng >= bounds.lngMin && lng <= bounds.lngMax) {
      hits.push(id);
    }
  }
  return hits.length > 0 ? hits[0] : null;
}

function calcIRA(row) {
  const evento = (row[COLS.EVENTO] || '').toUpperCase().trim();
  const severidad  = PESO_SEVERIDAD[evento] ?? 1;
  const horaFactor = FACTOR_HORA[row[COLS.HORA]] ?? 1.0;
  const vehiculo = (row[COLS.VEHICULO] || '').toUpperCase().trim();
  const vehFactor  = FACTOR_VEHICULO[vehiculo] ?? 1.0;
  const mesNum     = parseInt(row[COLS.MES_NUM]) || 0;
  const esFestivo  = mesNum === 3 || mesNum === 4;
  const ssFactor   = esFestivo ? FACTOR_SEMANA_SANTA : 1.0;
  return severidad * horaFactor * vehFactor * ssFactor;
}

function clusterHotspots(incidents, radiusKm = 0.5) {
  const clusters = [];
  const assigned = new Set();
  const sorted = [...incidents].sort((a, b) => b.ira - a.ira);

  for (const inc of sorted) {
    if (assigned.has(inc.id)) continue;

    const members = sorted.filter(other => {
      if (assigned.has(other.id)) return false;
      return haversine(inc.lat, inc.lng, other.lat, other.lng) <= radiusKm;
    });

    if (members.length >= 2) {
      members.forEach(m => assigned.add(m.id));

      const totalIRA  = members.reduce((s, m) => s + m.ira, 0);
      const centLat   = members.reduce((s, m) => s + m.lat * m.ira, 0) / totalIRA;
      const centLng   = members.reduce((s, m) => s + m.lng * m.ira, 0) / totalIRA;

      const hipFreq  = {};
      members.forEach(m => { if (m.hipotesis) hipFreq[m.hipotesis] = (hipFreq[m.hipotesis] || 0) + 1; });
      const hipPrincipal = Object.entries(hipFreq).sort((a,b) => b[1]-a[1])[0]?.[0] ?? 'SIN DATOS';

      const vehFreq = {};
      members.forEach(m => { if (m.vehiculo) vehFreq[m.vehiculo] = (vehFreq[m.vehiculo] || 0) + 1; });
      const vehPrincipal = Object.entries(vehFreq).sort((a,b) => b[1]-a[1])[0]?.[0] ?? 'SIN DATOS';

      const horaFreq = {};
      members.forEach(m => { if (m.hora) horaFreq[m.hora] = (horaFreq[m.hora] || 0) + 1; });
      const horaCritica = Object.entries(horaFreq).sort((a,b) => b[1]-a[1])[0]?.[0] ?? 'SIN DATOS';

      const hasMuertos    = members.some(m => (m.evento || '').toUpperCase() === 'MUERTO');
      const hasLesionados = members.some(m => (m.evento || '').toUpperCase() === 'LESIONADO');
      const severidadMax  = hasMuertos ? 'FATAL' : hasLesionados ? 'GRAVE' : 'LEVE';
      const iraCluster    = Math.min(100, Math.round(totalIRA / members.length * 10));

      clusters.push({
        id:              `HS-${clusters.length + 1}`,
        corridorId:      members[0].corridorId,
        lat:             parseFloat(centLat.toFixed(6)),
        lng:             parseFloat(centLng.toFixed(6)),
        totalIncidentes: members.length,
        iraScore:        iraCluster,
        severidadMax,
        hipotesisPrincipal: hipPrincipal,
        vehiculoPrincipal:  vehPrincipal,
        horaCritica,
        muertos:    members.filter(m => (m.evento || '').toUpperCase() === 'MUERTO').length,
        lesionados: members.filter(m => (m.evento || '').toUpperCase() === 'LESIONADO').length,
        meses: [...new Set(members.map(m => m.mes))].filter(Boolean),
        años:  [...new Set(members.map(m => m.año))].filter(Boolean).sort(),
        factorSemSanta: parseFloat(
          (members.filter(m => [3, 4].includes(parseInt(m.mesNum))).length / members.length * 100).toFixed(1)
        ),
        radioMetros: Math.round(radiusKm * 1000),
      });
    }
  }
  return clusters;
}

function processIncidents() {
  console.log('📂 Leyendo archivo Excel DITRA...');
  const wb   = XLSX.readFile(INPUT_FILE, { cellText: false, cellDates: true });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`✅ ${rows.length.toLocaleString()} registros cargados`);

  // Detect year column name
  const sampleRow = rows[0] || {};
  const yearCol = Object.keys(sampleRow).find(k => k.includes('AÑO') || k.includes('A\u00d1O') || k.includes('AÃ') || k.includes('A?O'));
  console.log(`   Columna de año detectada: "${yearCol}"`);

  const valid = rows.filter(r => {
    const lat = parseFloat(r[COLS.LATITUD]);
    const lng = parseFloat(r[COLS.LONGITUD]);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
           && lat > -5 && lat < 13 && lng > -80 && lng < -66;
  });
  console.log(`🗺️  ${valid.length.toLocaleString()} registros con coordenadas válidas`);

  const incidents = [];
  for (const row of valid) {
    const lat = parseFloat(row[COLS.LATITUD]);
    const lng = parseFloat(row[COLS.LONGITUD]);
    const corridorId = assignCorridor(lat, lng);
    if (!corridorId) continue;

    incidents.push({
      id:          row[COLS.ID],
      corridorId,
      lat, lng,
      municipio:   row[COLS.MUNICIPIO],
      zona:        row[COLS.ZONA],
      ruta:        row[COLS.RUTA],
      hipotesis:   row[COLS.HIPOTESIS],
      evento:      row[COLS.EVENTO],
      vehiculo:    row[COLS.VEHICULO],
      participante:row[COLS.PARTICIPANTE],
      hora:        row[COLS.HORA],
      diaSemana:   row[COLS.DIA_SEMANA],
      mes:         row[COLS.MES],
      mesNum:      row[COLS.MES_NUM],
      año:         yearCol ? row[yearCol] : null,
      ira:         calcIRA(row),
    });
  }

  console.log(`🛣️  ${incidents.length.toLocaleString()} incidentes asignados a los 7 corredores`);

  const NOMBRES_CORREDOR = {
    C1: 'Medellín–Honda–Bogotá', C2: 'Popayán–Cali–Cartago',
    C3: 'Bogotá–Girardot',       C4: 'Ibagué–La Línea–Cajamarca',
    C5: 'Bogotá–Villavicencio',  C6: 'Bogotá–Tunja',
    C7: 'Santa Marta–Barranquilla',
  };

  const resumenPorCorredor = {};
  for (const cid of Object.keys(CORRIDOR_BOUNDS)) {
    const cinc = incidents.filter(i => i.corridorId === cid);
    const iraTotal = cinc.reduce((s, i) => s + i.ira, 0);

    resumenPorCorredor[cid] = {
      corridorId:    cid,
      nombre:        NOMBRES_CORREDOR[cid],
      totalIncidentes: cinc.length,
      muertos:       cinc.filter(i => (i.evento || '').toUpperCase() === 'MUERTO').length,
      lesionados:    cinc.filter(i => (i.evento || '').toUpperCase() === 'LESIONADO').length,
      iraPromedio:   cinc.length > 0 ? parseFloat((iraTotal / cinc.length).toFixed(2)) : 0,
      iraTotal:      parseFloat(iraTotal.toFixed(2)),
      pctSemSanta:   cinc.length > 0
        ? parseFloat((cinc.filter(i => [3,4].includes(parseInt(i.mesNum))).length / cinc.length * 100).toFixed(1))
        : 0,
      vehiculoDominante: (() => {
        const f = {}; cinc.forEach(i => { if(i.vehiculo) f[i.vehiculo] = (f[i.vehiculo]||0)+1; });
        return Object.entries(f).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? 'N/D';
      })(),
      horaCritica: (() => {
        const f = {}; cinc.forEach(i => { if(i.hora) f[i.hora] = (f[i.hora]||0)+1; });
        return Object.entries(f).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? 'N/D';
      })(),
      hipotesisPrincipal: (() => {
        const f = {}; cinc.filter(i=>i.hipotesis).forEach(i => { f[i.hipotesis] = (f[i.hipotesis]||0)+1; });
        return Object.entries(f).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? 'SIN DATOS';
      })(),
    };
  }

  const allHotspots = [];
  for (const cid of Object.keys(CORRIDOR_BOUNDS)) {
    const cinc = incidents.filter(i => i.corridorId === cid);
    const hotspots = clusterHotspots(cinc, 0.5);
    const top15 = hotspots.sort((a, b) => b.iraScore - a.iraScore).slice(0, 15);
    allHotspots.push(...top15);
    console.log(`  ${cid} (${NOMBRES_CORREDOR[cid]}): ${cinc.length} incidentes → ${hotspots.length} hotspots → top ${top15.length}`);
  }

  const output = {
    generado:        new Date().toISOString(),
    totalRegistros:  valid.length,
    totalCorredores: Object.keys(resumenPorCorredor).length,
    totalHotspots:   allHotspots.length,
    resumenPorCorredor,
    hotspots: allHotspots,
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✅ Procesamiento completo → ${OUTPUT_FILE}`);
  console.log(`   Total hotspots generados: ${allHotspots.length}`);
  console.log(`   Tamaño del archivo: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(0)} KB`);
}

processIncidents();
