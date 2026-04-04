---
description: Flujo de trabajo para cargar y procesar nuevos datos de accidentabilidad desde Excel.
---

# Ingesta de Datos de Accidentabilidad (DITRA)

Este flujo de trabajo permite transformar archivos Excel masivos (DITRA/INVÍAS) en datasets optimizados para el visualizador 3D de VIITS-Nexus.

## Requisitos
1. El archivo Excel debe llamarse `incidentes_ditra.xlsx`.
2. Debe estar ubicado en la carpeta: `data/incidentes_ditra.xlsx`.

## Pasos

### 1. Preparación del archivo
Asegúrate de que el Excel contenga las columnas: `LATITUD`, `LONGITUD`, `GRAVEDAD` y `CLASE_VEHICULO`.

// turbo
### 2. Ejecutar Procesamiento
Ejecuta el script de purificación para generar el JSON optimizado.
```powershell
node backend/scripts/processDitraExcel.js
```

### 3. Sincronización del Frontend
Para que los cambios se reflejen en el entorno de producción, es necesario regenerar el build.
```powershell
npm run build; npm run serve
```

---
**Nota:** El proceso puede tardar entre 10 y 30 segundos dependiendo del tamaño del archivo.
