const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('Iniciando procesamiento del dataset titánico de DITRA (50MB)...');
const inputPath = path.resolve(__dirname, '../../data/incidentes_ditra.xlsx');
const outputPath = path.resolve(__dirname, '../../public/data/accidentes_ditra_3d_clean.json');

try {
  const workbook = xlsx.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const data = xlsx.utils.sheet_to_json(worksheet, { defval: null });
  let counter = 0;
  
  // Establecer barrera de 3 meses en el pasado
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  console.log(`Filtro estricto temporal activado: Aceptando accidentes después del ${threeMonthsAgo.toISOString()}`);
  
  // Buscar qué columna tiene la fecha
  let fechaColumnName = null;
  if(data.length > 0) {
      fechaColumnName = Object.keys(data[0]).find(k => k.toUpperCase().includes('FECH'));
      console.log(`Columna de Fecha Detectada: ${fechaColumnName || 'NINGUNA'}`);
  }

  const processed = data.map(row => {
    counter++;
    if (counter % 10000 === 0) console.log(`⏳ Procesados ${counter} de ${data.length} registros...`);
    
    // Mapeo flexible de columnas comunes en bases DITRA/INVÍAS
    const lat = parseFloat(row.LATITUD || row.Latitud || row.LAT || row.latitud || 0);
    const lng = parseFloat(row.LONGITUD || row.Longitud || row.LON || row.longitud || row.lng || 0);
    
    let severidad = String(row.GRAVEDAD || row.Gravedad || row.SEVERIDAD || 'SOLO DAÑOS').toUpperCase();
    let claseVehiculo = String(row.CLASE_VEHICULO || row.CLASE || row.VEHICULO || row.Vehiculo || 'Automovil').toUpperCase();
    let hora = row.HORA || row.Hora || row.hora || '12:00:00';
    let muertos = parseInt(row.MUERTOS || row.FALLECIDOS || row.Fallecidos || 0) || 0;
    let lesionados = parseInt(row.LESIONADOS || row.Lesionados || 0) || 0;
    
    // Extraer hora (0-23)
    let horaNum = 12;
    if (typeof hora === 'string') {
        const match = hora.match(/\d+/);
        if(match) horaNum = parseInt(match[0]);
    } else if (typeof hora === 'number') {
        horaNum = Math.floor(hora * 24) % 24;
    }
    
    // Normalizar Clase de Vehículo / Afectado
    let vClass = 'AUTO';
    if (claseVehiculo.includes('MOTO')) vClass = 'MOTO';
    else if (claseVehiculo.includes('PEATON') || claseVehiculo.includes('PEATÓN')) vClass = 'PEATON';
    else if (claseVehiculo.includes('BUS') || claseVehiculo.includes('MICRO')) vClass = 'BUS';
    else if (claseVehiculo.includes('CAMION') || claseVehiculo.includes('TRACTO')) vClass = 'CAMION';
    
    // Peso (altura de la torre) basado en fatalidad
    let weight = 1; // Solo daños
    if (severidad.includes('MUERTO') || severidad.includes('FATAL') || muertos > 0) weight = 5;
    else if (severidad.includes('HERIDO') || lesionados > 0) weight = 3;
    
    return {
      lat: Number(lat.toFixed(4)),
      lng: Number(lng.toFixed(4)),
      vehiculo: vClass,
      weight,
      horaNum,
      muertos,
      lesionados,
      rawFecha: fechaColumnName ? row[fechaColumnName] : null
    };
  }).filter(d => {
    // Filtrar geométricamente
    if (isNaN(d.lat) || isNaN(d.lng) || d.lat === 0 || d.lat <= -5 || d.lat >= 14 || d.lng <= -82 || d.lng >= -66) return false;
    
    // Filtro Temporal de 3 Meses
    if (d.rawFecha) {
      let fDate;
      if (typeof d.rawFecha === 'number') {
         // Excel Serial Date -> JS Date
         fDate = new Date(Math.round((d.rawFecha - 25569)*86400*1000));
      } else {
         fDate = new Date(d.rawFecha);
      }
      // Validar si la fecha está dentro de los 3 meses
      if (isNaN(fDate.getTime())) return true; // Si falló el pareo, la dejamos pasar para no perder todo
      if (fDate < threeMonthsAgo) return false;
    }
    
    return true;
  });

  console.log(`✅ Procesamiento completado. Generados ${processed.length} puntos válidos.`);
  
  if (!fs.existsSync(path.dirname(outputPath))) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(processed));
  console.log('✅ Dataset de Inteligencia 3D exportado a:', outputPath);

} catch (err) {
  console.error('❌ Error crítico en ingesta (DITRA 50MB):');
  console.error(err);
  process.exit(1);
}
