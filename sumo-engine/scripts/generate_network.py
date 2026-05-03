#!/usr/bin/env python3
"""
Generador Dinámico de Redes SUMO — Vías Congestionadas Waze TVT
═════════════════════════════════════════════════════════════════

Este script genera redes SUMO (.net.xml) para cada vía que aparece en la
tabla "Top Puntos de Congestión Críticos" del Monitor NEXUS.

Las vías congestionadas provienen del feed Waze TVT (Traffic View Timeline)
y tienen una polyline real con coordenadas geográficas exactas (jam.line[]).

Estrategia:
  1. Consultar el backend NEXUS para obtener las top 10 vías congestionadas actuales
  2. Para cada vía, calcular un bounding box a partir de su polyline
  3. Descargar la red vial de OSM para esa zona
  4. Generar la red SUMO con netconvert
  5. Crear un .sumocfg listo para simular

Las redes generadas se almacenan con un ID derivado del hash de la polyline,
evitando regenerar redes ya existentes.

Uso:
  python generate_network.py                    # Genera para los top jams actuales
  python generate_network.py --backend http://localhost:3000  # URL del backend NEXUS

Requisitos:
  - SUMO instalado (netconvert en PATH)
  - Acceso a internet (Overpass API + backend NEXUS)
"""

import os
import sys
import json
import hashlib
import argparse
import subprocess
import urllib.request
import urllib.parse
import math
import xml.etree.ElementTree as ET
from pathlib import Path

# ── Directorios ──
BASE_DIR = Path(__file__).parent.parent
NETWORKS_DIR = BASE_DIR / "networks" / "waze_segments"
CONFIGS_DIR = BASE_DIR / "config"
NETWORKS_DIR.mkdir(parents=True, exist_ok=True)
CONFIGS_DIR.mkdir(parents=True, exist_ok=True)

# ── Tipos de vía a incluir en la red ──
OSM_ROAD_TYPES = [
    "highway.motorway", "highway.motorway_link",
    "highway.trunk", "highway.trunk_link",
    "highway.primary", "highway.primary_link",
    "highway.secondary", "highway.secondary_link",
    "highway.tertiary", "highway.tertiary_link",
]

# ── Margen alrededor del jam (en grados) para capturar contexto vial ──
BBOX_PADDING = 0.008  # ~800m de contexto alrededor de la polyline

# ── Filtrado de OSM por proximidad a la polilínea Waze ──
# Bumpear si cambia la lógica de filtrado: invalida caches existentes en disco.
FILTER_VERSION = 1
# Primer intento (override por env var). Fallbacks hardcoded para vías rurales.
POLYLINE_BUFFER_M = float(os.getenv("POLYLINE_BUFFER_M", "30"))
BUFFER_FALLBACKS_M = [50.0, 80.0]
EARTH_RADIUS_M = 6371000.0
MIN_WAYS_AFTER_FILTER = 3


def get_jam_id(jam: dict) -> str:
    """Generar un ID estable para un jam basado en su polyline."""
    line = jam.get("line", [])
    if not line:
        return hashlib.md5(json.dumps(jam.get("name", "")).encode()).hexdigest()[:12]
    # Hash de los puntos de la polyline (solo primeros y últimos para estabilidad)
    key_points = [line[0], line[len(line)//2], line[-1]]
    key_str = "|".join(f"{p.get('y',0):.4f},{p.get('x',0):.4f}" for p in key_points)
    return hashlib.md5(key_str.encode()).hexdigest()[:12]


def get_jam_bbox(jam: dict) -> dict:
    """Calcular bounding box de un jam con margen de contexto."""
    line = jam.get("line", [])
    if not line:
        return None
    lats = [p["y"] for p in line]
    lngs = [p["x"] for p in line]
    return {
        "south": min(lats) - BBOX_PADDING,
        "north": max(lats) + BBOX_PADDING,
        "west": min(lngs) - BBOX_PADDING,
        "east": max(lngs) + BBOX_PADDING,
    }


def get_jam_name(jam: dict) -> str:
    """Nombre sanitizado del jam para usar como nombre de archivo."""
    name = jam.get("name") or jam.get("street") or "tramo_desconocido"
    # Sanitizar para nombre de archivo
    safe = "".join(c if c.isalnum() or c in " _-" else "_" for c in name)
    return safe.strip().replace(" ", "_")[:60]


def fetch_top_jams(backend_url: str) -> list:
    """Obtener los top jams del backend NEXUS."""
    try:
        url = f"{backend_url}/api/traffic/snapshot"
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "VIITS-SUMO-NetworkGen/1.0")
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            jams = data.get("nationalWazeJams", [])
            print(f"  ✓ {len(jams)} vías congestionadas obtenidas del backend NEXUS")
            return jams
    except Exception as e:
        print(f"  ✗ Error conectando al backend: {e}")
        print(f"    Intentando con datos de ejemplo...")
        return []


def download_osm(jam_id: str, bbox: dict, output_dir: Path) -> Path:
    """Descargar datos OSM para el bounding box del jam."""
    osm_file = output_dir / f"{jam_id}.osm"
    if osm_file.exists():
        print(f"    ↪ OSM ya existente, reutilizando: {osm_file.name}")
        return osm_file

    bbox_str = f"{bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']}"
    overpass_query = f"""
    [out:xml][timeout:60];
    (
      way["highway"~"^(motorway|trunk|primary|secondary|tertiary)(_link)?$"]({bbox_str});
    );
    (._;>;);
    out body;
    """

    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": overpass_query}).encode()

    try:
        req = urllib.request.Request(url, data=data)
        req.add_header("User-Agent", "VIITS-NEXUS/1.0")
        with urllib.request.urlopen(req, timeout=120) as response:
            osm_data = response.read()
            with open(osm_file, "wb") as f:
                f.write(osm_data)
        size_kb = os.path.getsize(osm_file) / 1024
        print(f"    ✓ OSM descargado: {osm_file.name} ({size_kb:.0f} KB)")
        return osm_file
    except Exception as e:
        print(f"    ✗ Error descargando OSM: {e}")
        return None


def convert_to_sumo_net(jam_id: str, osm_file: Path, output_dir: Path) -> Path:
    """Convertir OSM a red SUMO (.net.xml)."""
    net_file = output_dir / f"{jam_id}.net.xml"
    if net_file.exists():
        try:
            if osm_file.stat().st_mtime <= net_file.stat().st_mtime:
                print(f"    ↪ Red SUMO ya existente, reutilizando: {net_file.name}")
                return net_file
            print(f"    ↪ OSM más nuevo que red SUMO, regenerando: {net_file.name}")
        except OSError:
            pass

    cmd = [
        "netconvert",
        "--osm-files", str(osm_file),
        "--output-file", str(net_file),
        # geometry.remove=false: preserva puntos intermedios. En vías rurales con
        # poca densidad OSM, simplificar nodos colineales convierte curvas en
        # líneas rectas → vehículos cruzan fuera de la polilínea Waze.
        "--geometry.remove", "false",
        "--ramps.guess", "true",
        "--roundabouts.guess", "true",
        "--junctions.join", "true",
        "--junctions.corner-detail", "5",
        "--output.street-names", "true",
        "--output.original-names", "true",
        "--keep-edges.by-type", ",".join(OSM_ROAD_TYPES),
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0 and net_file.exists():
            size_kb = os.path.getsize(net_file) / 1024
            warnings = result.stderr.count("Warning:") if result.stderr else 0
            print(f"    ✓ Red SUMO generada: {net_file.name} ({size_kb:.0f} KB, {warnings} warnings)")
            return net_file
        else:
            error_msg = (result.stderr or "Sin detalles")[-200:]
            print(f"    ✗ Error en netconvert: {error_msg}")
            return None
    except FileNotFoundError:
        print("    ✗ netconvert no encontrado — instale SUMO: https://eclipse.dev/sumo/")
        return None
    except subprocess.TimeoutExpired:
        print("    ✗ Timeout en netconvert (>120s)")
        return None


def generate_routes(jam_id: str, jam: dict, output_dir: Path) -> Path:
    """Generar archivo de rutas base con tipos vehiculares colombianos."""
    rou_file = output_dir / f"{jam_id}.rou.xml"

    # Velocidad base del jam (de Waze)
    length_m = jam.get("length", 1000)
    time_s = jam.get("time", 60)
    speed_kmh = (length_m / 1000) / (time_s / 3600) if time_s > 0 else 40

    routes_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<routes xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/routes_file.xsd">
    <!-- Tipos vehiculares calibrados para Colombia — Vía: {jam.get('name', 'N/A')} -->
    <!-- Velocidad actual Waze: {speed_kmh:.0f} km/h | Nivel: {jam.get('jamLevel', '?')} -->
    <vType id="car" accel="2.6" decel="4.5" sigma="0.5" length="4.5"
           minGap="2.5" maxSpeed="33.33" guiShape="passenger" color="0.3,0.7,1"/>
    <vType id="bus" accel="1.2" decel="3.0" sigma="0.4" length="12.0"
           minGap="3.0" maxSpeed="25.0" guiShape="bus" color="1,0.5,0"/>
    <vType id="truck" accel="0.8" decel="2.5" sigma="0.3" length="16.0"
           minGap="4.0" maxSpeed="22.22" guiShape="truck" color="0.6,0.4,0.8"/>
    <vType id="moto" accel="4.0" decel="6.0" sigma="0.6" length="2.0"
           minGap="1.5" maxSpeed="38.88" guiShape="motorcycle" color="0.3,0.9,0.3"/>

    <!-- Los flujos serán inyectados dinámicamente por el calibrator.py vía TraCI -->
</routes>
"""
    with open(rou_file, "w", encoding="utf-8") as f:
        f.write(routes_xml)
    return rou_file


def generate_sumocfg(jam_id: str, net_file: Path, rou_file: Path) -> Path:
    """Generar archivo de configuración SUMO para este segmento."""
    cfg_file = CONFIGS_DIR / f"waze_{jam_id}.sumocfg"

    # Rutas relativas desde config/ a networks/waze_segments/
    net_rel = os.path.relpath(net_file, CONFIGS_DIR)
    rou_rel = os.path.relpath(rou_file, CONFIGS_DIR)

    cfg_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<configuration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/sumoConfiguration.xsd">
    <input>
        <net-file value="{net_rel}"/>
        <route-files value="{rou_rel}"/>
    </input>
    <time>
        <begin value="0"/>
        <end value="86400"/>
        <step-length value="0.5"/>
    </time>
    <processing>
        <lateral-resolution value="0.8"/>
        <ignore-route-errors value="true"/>
        <collision.action value="warn"/>
        <time-to-teleport value="300"/>
    </processing>
    <report>
        <no-step-log value="true"/>
        <no-warnings value="true"/>
    </report>
</configuration>
"""
    with open(cfg_file, "w", encoding="utf-8") as f:
        f.write(cfg_xml)
    return cfg_file


def generate_manifest(results: list):
    """Generar un manifiesto JSON con todas las redes generadas."""
    manifest_file = NETWORKS_DIR / "manifest.json"
    manifest = {
        "generated_at": __import__("datetime").datetime.now().isoformat(),
        "segments": results,
        "total": len(results),
    }
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\n  📋 Manifiesto generado: {manifest_file}")
    return manifest_file


def _project_polyline_to_meters(polyline: list):
    """Proyecta la polilínea Waze a metros locales (equirectangular).
    Devuelve (segmentos_xy, ref_lat_deg, ref_lon_deg). Cada segmento es
    (ax, ay, dx, dy, len2) precomputado para distancia rápida punto-segmento.
    Devuelve (None, 0, 0) si la polilínea es inválida."""
    if not polyline or len(polyline) < 2:
        return None, 0.0, 0.0
    valid = [p for p in polyline if p and p.get("x") is not None and p.get("y") is not None]
    if len(valid) < 2:
        return None, 0.0, 0.0
    ref_lat = sum(p["y"] for p in valid) / len(valid)
    ref_lon = sum(p["x"] for p in valid) / len(valid)
    cos_ref = math.cos(math.radians(ref_lat))
    coords = []
    for p in valid:
        x = math.radians(p["x"] - ref_lon) * EARTH_RADIUS_M * cos_ref
        y = math.radians(p["y"] - ref_lat) * EARTH_RADIUS_M
        coords.append((x, y))
    segs = []
    for i in range(len(coords) - 1):
        ax, ay = coords[i]
        bx, by = coords[i + 1]
        dx = bx - ax
        dy = by - ay
        segs.append((ax, ay, dx, dy, dx * dx + dy * dy))
    return segs, ref_lat, ref_lon


def _min_dist2_to_segs(px: float, py: float, segs) -> float:
    """Distancia² mínima de (px, py) a cualquier segmento (en metros locales)."""
    min_d2 = float("inf")
    for ax, ay, dx, dy, len2 in segs:
        if len2 < 1e-9:
            d2 = (px - ax) ** 2 + (py - ay) ** 2
        else:
            t = ((px - ax) * dx + (py - ay) * dy) / len2
            if t < 0.0:
                t = 0.0
            elif t > 1.0:
                t = 1.0
            cx = ax + t * dx
            cy = ay + t * dy
            d2 = (px - cx) ** 2 + (py - cy) ** 2
        if d2 < min_d2:
            min_d2 = d2
    return min_d2


def _filter_osm_attempt(osm_file: Path, polyline: list, buffer_m: float):
    """Intento único de filtrado a un buffer dado.
    Devuelve (kept_count, dropped_count, tree_filtrado) o (kept, dropped, None)
    si la red queda con < MIN_WAYS_AFTER_FILTER ways (señal de retry)."""
    segs, ref_lat, ref_lon = _project_polyline_to_meters(polyline)
    if segs is None:
        return 0, 0, None

    try:
        tree = ET.parse(osm_file)
    except ET.ParseError as e:
        print(f"    ✗ OSM XML malformado: {e}")
        return 0, 0, None
    root = tree.getroot()

    # Lookup id → (lat, lon)
    nodes = {}
    for n in root.findall("node"):
        nid = n.get("id")
        if not nid:
            continue
        try:
            nodes[nid] = (float(n.get("lat")), float(n.get("lon")))
        except (TypeError, ValueError):
            continue

    cos_ref = math.cos(math.radians(ref_lat))
    buffer2 = buffer_m * buffer_m
    kept_node_ids = set()
    ways_to_remove = []
    kept_count = 0

    for w in root.findall("way"):
        nd_refs = [nd.get("ref") for nd in w.findall("nd") if nd.get("ref")]
        keep = False
        for nid in nd_refs:
            coord = nodes.get(nid)
            if coord is None:
                continue
            lat, lon = coord
            x = math.radians(lon - ref_lon) * EARTH_RADIUS_M * cos_ref
            y = math.radians(lat - ref_lat) * EARTH_RADIUS_M
            if _min_dist2_to_segs(x, y, segs) <= buffer2:
                keep = True
                break
        if keep:
            kept_count += 1
            kept_node_ids.update(nd_refs)
        else:
            ways_to_remove.append(w)

    if kept_count < MIN_WAYS_AFTER_FILTER:
        return kept_count, len(ways_to_remove), None

    # Mutación del árbol
    for w in ways_to_remove:
        root.remove(w)
    nodes_to_remove = [n for n in root.findall("node") if n.get("id") not in kept_node_ids]
    for n in nodes_to_remove:
        root.remove(n)
    # Eliminar relaciones: pueden referenciar ways borrados (turn restrictions, etc.).
    # No críticas para simulación de flujo en una sola vía.
    for r in list(root.findall("relation")):
        root.remove(r)

    return kept_count, len(ways_to_remove), tree


def filter_osm_by_polyline(osm_file: Path, polyline: list) -> Path:
    """Reescribe el OSM dejando solo ways cuyo geom esté cerca de la polilínea Waze.
    Cascada de buffers POLYLINE_BUFFER_M → 50m → 80m. Devuelve Path al .filtered.osm
    o None si todos los buffers fallan o la polilínea es inválida.
    Cache invalidada por FILTER_VERSION (marker .filter_v junto al .osm)."""
    filtered_file = osm_file.with_name(osm_file.stem + ".filtered.osm")
    marker_file = osm_file.with_name(osm_file.stem + ".filter_v")

    if filtered_file.exists() and marker_file.exists():
        try:
            if int(marker_file.read_text().strip()) == FILTER_VERSION:
                print(f"    ↪ OSM filtrado ya existente (v{FILTER_VERSION}), reutilizando")
                return filtered_file
        except (ValueError, OSError):
            pass

    buffers = [POLYLINE_BUFFER_M] + BUFFER_FALLBACKS_M
    for buffer_m in buffers:
        kept, dropped, tree = _filter_osm_attempt(osm_file, polyline, buffer_m)
        if tree is not None:
            tree.write(filtered_file, encoding="utf-8", xml_declaration=True)
            marker_file.write_text(str(FILTER_VERSION))
            print(f"    ✓ OSM filtrado a {buffer_m:.0f}m: {kept} ways dentro, {dropped} descartados")
            return filtered_file
        print(f"    ↪ buffer {buffer_m:.0f}m insuficiente ({kept} ways), probando siguiente")

    print(f"    ✗ Filtro de polilínea agotó cascada (30/50/80m), red descartada")
    return None


def process_jam(jam: dict, index: int) -> dict:
    """Procesar un jam individual: descargar OSM, generar red SUMO."""
    jam_id = get_jam_id(jam)
    jam_name = get_jam_name(jam)
    jam_level = jam.get("jamLevel", "?")
    cola_km = (jam.get("length", 0) / 1000)
    tiempo_min = round(jam.get("time", 0) / 60)

    print(f"\n  ┌─ [{index+1}] {jam.get('name', 'Sin nombre')}")
    print(f"  │   Nivel: {jam_level} | Cola: {cola_km:.1f} km | Tiempo: {tiempo_min} min")
    print(f"  │   ID: {jam_id} | Puntos polyline: {len(jam.get('line', []))}")

    # 1. Calcular bounding box
    bbox = get_jam_bbox(jam)
    if not bbox:
        print(f"  └─ ✗ Sin polyline — saltando")
        return None

    area_km2 = (bbox["north"] - bbox["south"]) * 111 * (bbox["east"] - bbox["west"]) * 85
    print(f"  │   BBox: {bbox['south']:.4f},{bbox['west']:.4f} → {bbox['north']:.4f},{bbox['east']:.4f} (~{area_km2:.1f} km²)")

    # 2. Crear directorio para este segmento
    seg_dir = NETWORKS_DIR / jam_id
    seg_dir.mkdir(parents=True, exist_ok=True)

    # 3. Guardar la polyline original de Waze (para renderizado en frontend)
    polyline_file = seg_dir / "polyline.json"
    with open(polyline_file, "w") as f:
        json.dump({
            "id": jam_id,
            "name": jam.get("name"),
            "jamLevel": jam_level,
            "line": jam.get("line", []),
            "length": jam.get("length"),
            "time": jam.get("time"),
            "historicTime": jam.get("historicTime"),
        }, f, indent=2)

    # 4. Descargar OSM
    osm_file = download_osm(jam_id, bbox, seg_dir)
    if not osm_file:
        print(f"  └─ ✗ Fallo en descarga OSM")
        return None

    # 4.5 Filtrar OSM a la polilínea Waze (descartar calles paralelas/laterales)
    filtered_osm = filter_osm_by_polyline(osm_file, jam.get("line", []))
    if not filtered_osm:
        print(f"  └─ ✗ Filtro de polilínea dejó red vacía o inválida")
        return None

    # 5. Convertir a red SUMO (input = OSM filtrado)
    net_file = convert_to_sumo_net(jam_id, filtered_osm, seg_dir)
    if not net_file:
        print(f"  └─ ✗ Fallo en conversión netconvert")
        return None

    # 6. Generar rutas y configuración
    rou_file = generate_routes(jam_id, jam, seg_dir)
    cfg_file = generate_sumocfg(jam_id, net_file, rou_file)

    print(f"  └─ ✓ Red completa: {net_file.name} + {cfg_file.name}")

    return {
        "id": jam_id,
        "name": jam.get("name"),
        "jamLevel": jam_level,
        "length_m": jam.get("length", 0),
        "time_s": jam.get("time", 0),
        "bbox": bbox,
        "net_file": str(net_file),
        "cfg_file": str(cfg_file),
        "polyline_file": str(polyline_file),
        "points": len(jam.get("line", [])),
    }


def main():
    parser = argparse.ArgumentParser(description="SUMO Network Generator — Vías Congestionadas Waze")
    parser.add_argument("--backend", default="http://localhost:3000",
                        help="URL del backend NEXUS (default: http://localhost:3000)")
    parser.add_argument("--jams-file", default=None,
                        help="Archivo JSON con jams (alternativa al backend)")
    args = parser.parse_args()

    print("═" * 70)
    print("  SUMO Network Generator — Vías Congestionadas del Monitor NEXUS")
    print("  VIITS-NEXUS · Ministerio de Transporte · DITRA")
    print("═" * 70)

    # Obtener jams
    if args.jams_file:
        with open(args.jams_file) as f:
            jams = json.load(f)
        print(f"\n  📂 Cargados {len(jams)} jams desde archivo: {args.jams_file}")
    else:
        print(f"\n  🔗 Consultando backend: {args.backend}")
        jams = fetch_top_jams(args.backend)

    if not jams:
        print("\n  ⚠ No hay vías congestionadas disponibles.")
        print("  Opciones:")
        print("    1. Asegúrese de que el backend NEXUS esté corriendo")
        print("    2. Use --jams-file con un JSON de ejemplo")
        print("    3. Espere a que haya congestión reportada en Waze")
        sys.exit(0)

    print(f"\n  🚧 Procesando {len(jams)} vías congestionadas...")
    print(f"  📁 Directorio de salida: {NETWORKS_DIR}")

    # Procesar cada jam
    results = []
    for i, jam in enumerate(jams):
        result = process_jam(jam, i)
        if result:
            results.append(result)
        # Pausa entre descargas para no sobrecargar Overpass API
        if i < len(jams) - 1:
            import time
            time.sleep(2)

    # Generar manifiesto
    if results:
        generate_manifest(results)

    # Resumen final
    print(f"\n{'═' * 70}")
    print(f"  ✅ RESUMEN: {len(results)}/{len(jams)} redes generadas exitosamente")
    print(f"{'═' * 70}")

    for r in results:
        print(f"  • {r['name'][:50]:50s} | Nivel {r['jamLevel']} | {r['length_m']/1000:.1f} km")

    print(f"\n  📍 Próximos pasos:")
    print(f"     1. Verificar redes en sumo-gui:")
    print(f"        sumo-gui -c config/waze_<id>.sumocfg")
    print(f"     2. El sumo_server.py las detectará automáticamente desde el manifiesto")
    print(f"     3. El frontend recibirá los vehículos sobre la geometría real de la vía")


if __name__ == "__main__":
    main()
