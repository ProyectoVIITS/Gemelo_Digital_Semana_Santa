import pandas as pd
import json
import os
import math
import random
from datetime import datetime
from dateutil.relativedelta import relativedelta

input_path = '../../data/incidentes_ditra.xlsx'
output_path = '../../public/data/accidentes_ditra_3d_clean.json'

print("Iniciando inyector avanzado con Python (Pandas) para salto de capacidad...")

try:
    df = pd.read_excel(input_path)
    print(f"Cargados {len(df)} registros. Optimizando memoria...")

    # Identificar columna fecha
    date_col = next((col for col in df.columns if 'FECH' in str(col).upper()), None)
    print(f"Columna de fecha detectada: {date_col}")

    if date_col:
        # Convertir a datetime asumiendo varios formatos, coercing errors
        df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
        three_months_ago = datetime.now() - relativedelta(months=3)
        # Filtrar
        df = df[df[date_col] >= pd.Timestamp(three_months_ago)]
        print(f"Filtrado a ultimos 3 meses. Quedan {len(df)} registros.")

    processed = []
    
    # Pre-calcular columnas disponibles para velocidad
    lat_col = next((c for c in df.columns if str(c).upper() in ['LATITUD', 'LAT']), None)
    lng_col = next((c for c in df.columns if str(c).upper() in ['LONGITUD', 'LON', 'LNG']), None)
    gravedad_col = next((c for c in df.columns if str(c).upper() in ['GRAVEDAD', 'SEVERIDAD']), None)
    vehiculo_col = next((c for c in df.columns if str(c).upper() in ['CLASE_VEHICULO', 'CLASE', 'VEHICULO']), None)
    muertos_col = next((c for c in df.columns if str(c).upper() in ['MUERTOS', 'FALLECIDOS']), None)
    lesionados_col = next((c for c in df.columns if str(c).upper() in ['LESIONADOS']), None)
    hora_col = next((c for c in df.columns if str(c).upper() in ['HORA', 'HORA_HECHO']), None)

    for idx, row in df.iterrows():
        try:
            raw_lat = str(row[lat_col]).replace(',', '.') if lat_col and pd.notna(row[lat_col]) else '0'
            raw_lng = str(row[lng_col]).replace(',', '.') if lng_col and pd.notna(row[lng_col]) else '0'
            lat = float(raw_lat)
            lng = float(raw_lng)
        except ValueError:
            continue
        
        # Filtro geografico
        if pd.isna(lat) or pd.isna(lng) or lat == 0 or lat <= -5 or lat >= 14 or lng <= -82 or lng >= -66:
            continue
            
        severidad = str(row[gravedad_col]).upper() if gravedad_col and pd.notna(row[gravedad_col]) else 'SOLO DAÑOS'
        clase = str(row[vehiculo_col]).upper() if vehiculo_col and pd.notna(row[vehiculo_col]) else 'AUTO'
        muertos = int(row[muertos_col]) if muertos_col and pd.notna(row[muertos_col]) else 0
        lesionados = int(row[lesionados_col]) if lesionados_col and pd.notna(row[lesionados_col]) else 0
        
        real_hour = random.randint(0, 23)
        if hora_col and pd.notna(row[hora_col]):
            val = str(row[hora_col]).strip()
            # DITRA usa buckets como "06:00 - 11:59". Interpolaremos al azar dentro del bucket para dar fluidez.
            if "00:00" in val: real_hour = random.randint(0, 5)
            elif "06:00" in val: real_hour = random.randint(6, 11)
            elif "12:00" in val: real_hour = random.randint(12, 17)
            elif "18:00" in val: real_hour = random.randint(18, 23)
        elif date_col and pd.notna(row[date_col]) and hasattr(row[date_col], 'hour') and row[date_col].hour != 0:
            real_hour = row[date_col].hour
        
        vClass = 'AUTO'
        if 'MOTO' in clase: vClass = 'MOTO'
        elif 'PEAT' in clase: vClass = 'PEATON'
        elif 'BUS' in clase or 'MICRO' in clase: vClass = 'BUS'
        elif 'CAMION' in clase or 'TRACTO' in clase: vClass = 'CAMION'
        
        weight = 1
        if 'MUERTO' in severidad or 'FATAL' in severidad or muertos > 0: weight = 5
        elif 'HERIDO' in severidad or lesionados > 0: weight = 3
        
        processed.append({
            'lat': round(lat, 4),
            'lng': round(lng, 4),
            'vehiculo': vClass,
            'weight': weight,
            'horaNum': real_hour,
            'muertos': muertos,
            'lesionados': lesionados
        })
        
    print(f"Exportando {len(processed)} pines validados geográficamente...")
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(processed, f)
        
    print("✅ Transformación Exitosa DITRA en 3D")
    
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"❌ Error en Python: {e}")
