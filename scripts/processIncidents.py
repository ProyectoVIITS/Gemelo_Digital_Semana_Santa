import sys, os
sys.stdout.reconfigure(encoding='utf-8')
import pandas as pd
import numpy as np
import json
from math import radians, cos, sin, asin, sqrt

INPUT_FILE  = os.path.join(os.path.dirname(__file__), '..', 'data', 'incidentes_ditra.xlsx')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'hotspots_processed.json')

CORRIDOR_BOUNDS = {
    'C1': {'latMin': 4.70, 'latMax': 6.60, 'lngMin': -75.70, 'lngMax': -74.10},
    'C2': {'latMin': 2.10, 'latMax': 4.85, 'lngMin': -77.00, 'lngMax': -75.80},
    'C3': {'latMin': 4.15, 'latMax': 4.75, 'lngMin': -74.95, 'lngMax': -74.20},
    'C4': {'latMin': 4.28, 'latMax': 4.55, 'lngMin': -75.65, 'lngMax': -75.00},
    'C5': {'latMin': 3.95, 'latMax': 4.75, 'lngMin': -74.10, 'lngMax': -73.40},
    'C6': {'latMin': 4.70, 'latMax': 5.75, 'lngMin': -74.10, 'lngMax': -73.20},
    'C7': {'latMin': 10.55, 'latMax': 11.35, 'lngMin': -75.00, 'lngMax': -74.00},
}

NOMBRES = {
    'C1': 'Medellín–Honda–Bogotá', 'C2': 'Popayán–Cali–Cartago',
    'C3': 'Bogotá–Girardot', 'C4': 'Ibagué–La Línea–Cajamarca',
    'C5': 'Bogotá–Villavicencio', 'C6': 'Bogotá–Tunja',
    'C7': 'Santa Marta–Barranquilla',
}

PESO_SEV = {'MUERTO': 10, 'LESIONADO': 5, 'ACCIDENTADO': 2, 'SOLO DAÑOS': 1}
FACTOR_HORA = {'00:00 - 05:59': 1.80, '06:00 - 11:59': 1.10, '12:00 - 17:59': 1.00, '18:00 - 23:59': 1.40}
FACTOR_VEH = {'MOTOCICLETA': 1.50, 'CAMION': 1.30, 'BUS': 1.20, 'AUTOMOVIL': 1.00}
FACTOR_SS = 1.45

def haversine(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2-lat1, lon2-lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    return 6371 * 2 * asin(sqrt(a))

def assign_corridor(lat, lng):
    for cid, b in CORRIDOR_BOUNDS.items():
        if b['latMin'] <= lat <= b['latMax'] and b['lngMin'] <= lng <= b['lngMax']:
            return cid
    return None

def calc_ira(row):
    evento = str(row.get('EVENTO', '')).upper().strip()
    sev = PESO_SEV.get(evento, 1)
    hora = FACTOR_HORA.get(row.get('Hechos_INTERVALOS_HORA', ''), 1.0)
    veh = FACTOR_VEH.get(str(row.get('CLASE_VEHICULO', '')).upper().strip(), 1.0)
    mes_num = int(row.get('Calend_MES_numero', 0) or 0)
    ss = FACTOR_SS if mes_num in (3, 4) else 1.0
    return sev * hora * veh * ss

def mode_val(series):
    if series.empty: return 'N/D'
    filtered = series.dropna()
    if filtered.empty: return 'N/D'
    return filtered.value_counts().index[0]

def cluster_hotspots(incidents_df, radius_km=0.5):
    if incidents_df.empty:
        return []

    # Convert to records for speed
    records = incidents_df.sort_values('ira', ascending=False).to_dict('records')

    # Grid-based spatial indexing (~0.005 degrees ≈ 500m)
    grid_size = 0.005
    grid = {}
    for r in records:
        gx = int(r['lat'] / grid_size)
        gy = int(r['lng'] / grid_size)
        key = (gx, gy)
        if key not in grid:
            grid[key] = []
        grid[key].append(r)

    assigned = set()
    clusters = []

    for rec in records:
        rid = rec['id']
        if rid in assigned:
            continue

        # Check only neighboring grid cells (3x3 around point)
        gx = int(rec['lat'] / grid_size)
        gy = int(rec['lng'] / grid_size)
        neighbors = []
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                cell = grid.get((gx+dx, gy+dy), [])
                for other in cell:
                    if other['id'] in assigned:
                        continue
                    if haversine(rec['lat'], rec['lng'], other['lat'], other['lng']) <= radius_km:
                        neighbors.append(other)

        if len(neighbors) < 2:
            continue

        for m in neighbors:
            assigned.add(m['id'])

        total_ira = sum(m['ira'] for m in neighbors)
        cent_lat = sum(m['lat'] * m['ira'] for m in neighbors) / total_ira
        cent_lng = sum(m['lng'] * m['ira'] for m in neighbors) / total_ira

        # Frequency helpers
        def freq_top(key_name):
            f = {}
            for m in neighbors:
                v = m.get(key_name)
                if v and pd.notna(v):
                    f[v] = f.get(v, 0) + 1
            return sorted(f.items(), key=lambda x: -x[1])[0][0] if f else 'SIN DATOS'

        hip = freq_top('hipotesis')
        veh = freq_top('vehiculo')
        hora = freq_top('hora')

        muertos = sum(1 for m in neighbors if str(m.get('evento','')).upper().strip() == 'MUERTO')
        lesionados = sum(1 for m in neighbors if str(m.get('evento','')).upper().strip() == 'LESIONADO')
        sev_max = 'FATAL' if muertos > 0 else ('GRAVE' if lesionados > 0 else 'LEVE')
        ira_cluster = min(100, round(total_ira / len(neighbors) * 10))

        ss_count = sum(1 for m in neighbors if int(m.get('mesNum', 0) or 0) in (3, 4))
        factor_ss = round(ss_count / len(neighbors) * 100, 1)

        meses = list(set(m.get('mes') for m in neighbors if m.get('mes') and pd.notna(m.get('mes'))))
        years_raw = [m.get('año') for m in neighbors if m.get('año') and pd.notna(m.get('año'))]
        years = []
        for y in years_raw:
            try: years.append(int(y))
            except: pass
        years = sorted(set(years))

        clusters.append({
            'id': f'{rec["corridorId"]}-HS-{len(clusters)+1}',
            'corridorId': rec['corridorId'],
            'lat': round(cent_lat, 6),
            'lng': round(cent_lng, 6),
            'totalIncidentes': len(neighbors),
            'iraScore': int(ira_cluster),
            'severidadMax': sev_max,
            'hipotesisPrincipal': hip,
            'vehiculoPrincipal': veh,
            'horaCritica': hora,
            'muertos': muertos,
            'lesionados': lesionados,
            'meses': meses,
            'años': [str(y) for y in years],
            'factorSemSanta': float(factor_ss),
            'radioMetros': int(radius_km * 1000),
        })

    return clusters

def main():
    print('📂 Leyendo archivo Excel DITRA...')
    df = pd.read_excel(INPUT_FILE)
    print(f'✅ {len(df):,} registros cargados')

    # Detect year column — look for the AÑO column specifically (may have encoding issues)
    year_col = None
    for c in df.columns:
        if 'Calend' in c and ('AÑO' in c or 'A\u00d1O' in c or 'AÃ' in c or 'A?O' in c or c.endswith('O') and len(c) < 15):
            year_col = c
            break
    # Fallback: extract year from FECHA_HECHO
    if year_col is None or 'FECHA' in str(year_col):
        print('   Extrayendo año desde Calend_FECHA_HECHO...')
        df['_year_extracted'] = pd.to_datetime(df['Calend_FECHA_HECHO'], errors='coerce').dt.year
        year_col = '_year_extracted'
    print(f'   Columna de año: {year_col}')

    # Parse lat/lng
    df['lat'] = pd.to_numeric(df['LATITUD'], errors='coerce')
    df['lng'] = pd.to_numeric(df['LONGITUD'], errors='coerce')

    valid = df[(df['lat'].notna()) & (df['lng'].notna()) &
               (df['lat'] != 0) & (df['lng'] != 0) &
               (df['lat'] > -5) & (df['lat'] < 13) &
               (df['lng'] > -80) & (df['lng'] < -66)].copy()
    print(f'🗺️  {len(valid):,} registros con coordenadas válidas')

    # Assign corridors
    valid['corridorId'] = valid.apply(lambda r: assign_corridor(r['lat'], r['lng']), axis=1)
    corridored = valid[valid['corridorId'].notna()].copy()
    print(f'🛣️  {len(corridored):,} incidentes asignados a los 7 corredores')

    # Calculate IRA
    corridored['ira'] = corridored.apply(calc_ira, axis=1)
    corridored['id'] = corridored['Hechos_HECHOS_ID']
    corridored['hipotesis'] = corridored['HIPOTESIS_HECHOS_ACCI']
    corridored['evento'] = corridored['EVENTO']
    corridored['vehiculo'] = corridored['CLASE_VEHICULO']
    corridored['hora'] = corridored['Hechos_INTERVALOS_HORA']
    corridored['mes'] = corridored['Calend_MES']
    corridored['mesNum'] = corridored['Calend_MES_numero']
    corridored['año'] = corridored[year_col] if year_col else None
    corridored['municipio'] = corridored['Hechos_MUNICIPIO_HECHO']
    corridored['zona'] = corridored['Hechos_ZONA']

    # Process per corridor
    resumen = {}
    all_hotspots = []

    for cid in CORRIDOR_BOUNDS.keys():
        cinc = corridored[corridored['corridorId'] == cid]
        ira_total = cinc['ira'].sum()
        eventos_upper = cinc['evento'].str.upper().str.strip()

        resumen[cid] = {
            'corridorId': cid,
            'nombre': NOMBRES[cid],
            'totalIncidentes': int(len(cinc)),
            'muertos': int((eventos_upper == 'MUERTO').sum()),
            'lesionados': int((eventos_upper == 'LESIONADO').sum()),
            'iraPromedio': round(ira_total / len(cinc), 2) if len(cinc) > 0 else 0,
            'iraTotal': round(float(ira_total), 2),
            'pctSemSanta': round(pd.to_numeric(cinc['mesNum'], errors='coerce').isin([3,4]).sum() / max(len(cinc),1) * 100, 1),
            'vehiculoDominante': mode_val(cinc['vehiculo']),
            'horaCritica': mode_val(cinc['hora']),
            'hipotesisPrincipal': mode_val(cinc['hipotesis']),
        }

        # Cluster hotspots
        print(f'  {cid} ({NOMBRES[cid]}): {len(cinc)} incidentes...', end=' ', flush=True)
        hotspots = cluster_hotspots(cinc[['id','corridorId','lat','lng','ira','hipotesis','evento','vehiculo','hora','mes','mesNum','año']].copy(), 0.5)
        top15 = sorted(hotspots, key=lambda h: h['iraScore'], reverse=True)[:15]
        all_hotspots.extend(top15)
        print(f'→ {len(hotspots)} hotspots → top {len(top15)}')

    output = {
        'generado': pd.Timestamp.now().isoformat(),
        'totalRegistros': int(len(valid)),
        'totalCorredores': len(resumen),
        'totalHotspots': len(all_hotspots),
        'resumenPorCorredor': resumen,
        'hotspots': all_hotspots,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    size_kb = os.path.getsize(OUTPUT_FILE) / 1024
    print(f'\n✅ Procesamiento completo → {OUTPUT_FILE}')
    print(f'   Total hotspots generados: {len(all_hotspots)}')
    print(f'   Tamaño del archivo: {size_kb:.0f} KB')

if __name__ == '__main__':
    main()
