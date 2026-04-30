"""
SUMO Engine — FastAPI Server + TraCI Controller
Motor de microsimulación para el Gemelo Digital VIITS-NEXUS

Arquitectura:
  1. SUMO corre como subprocess con la red real .net.xml (OSM)
  2. FastAPI expone un WebSocket para streaming de posiciones vehiculares
  3. Un Calibrador dinámico recibe datos de Google/Waze y ajusta los tramos
  4. El frontend React renderiza los vehículos sobre la geometría real

Autor: VIITS-NEXUS / Ministerio de Transporte — DITRA
"""

import os
import sys
import json
import asyncio
import time
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

try:
    import traci
    TRACI_AVAILABLE = True
except ImportError:
    TRACI_AVAILABLE = False
    logging.warning("TraCI no disponible — modo simulado activado")

load_dotenv()

# ── Configuración ──────────────────────────────────────────────
SUMO_BINARY = os.getenv("SUMO_BINARY", "sumo")  # "sumo-gui" para debug visual
NETWORK_DIR = Path(__file__).parent / "networks"
CONFIG_DIR = Path(__file__).parent / "config"
STEP_LENGTH = float(os.getenv("SUMO_STEP_LENGTH", "0.5"))  # 0.5s por step
STREAM_INTERVAL = float(os.getenv("STREAM_INTERVAL", "0.5"))  # 500ms entre broadcasts
MAX_VEHICLES = int(os.getenv("MAX_VEHICLES", "5000"))

logging.basicConfig(level=logging.INFO, format="[SUMO-Engine] %(message)s")
log = logging.getLogger("sumo-engine")

# ── Estado Global ──────────────────────────────────────────────
simulation_state = {
    "running": False,
    "step": 0,
    "vehicle_count": 0,
    "network_id": None,
    "network_bounds": None,
}

# ── Manifiesto de redes de vías congestionadas ──
WAZE_MANIFEST_PATH = NETWORK_DIR / "waze_segments" / "manifest.json"

def load_waze_manifest() -> list:
    """Cargar manifiesto de redes generadas por generate_network.py."""
    if not WAZE_MANIFEST_PATH.exists():
        return []
    try:
        with open(WAZE_MANIFEST_PATH) as f:
            data = json.load(f)
        return data.get("segments", [])
    except Exception:
        return []

connected_clients: set[WebSocket] = set()


# ── Gestión del ciclo de vida de SUMO ──────────────────────────
class SUMOController:
    """Controlador del proceso SUMO vía TraCI."""

    def __init__(self):
        self.is_running = False
        self.step_count = 0
        self.network_bounds = None  # (xmin, ymin, xmax, ymax) en coordenadas UTM

    def start(self, network_id: str = "C3"):
        """Iniciar SUMO con la red especificada."""
        if not TRACI_AVAILABLE:
            log.warning("TraCI no instalado — ejecutando en modo simulado")
            self.is_running = True
            simulation_state["running"] = True
            simulation_state["network_id"] = network_id
            return True

        sumocfg = CONFIG_DIR / f"{network_id}.sumocfg"
        if not sumocfg.exists():
            log.error(f"Configuración no encontrada: {sumocfg}")
            return False

        try:
            sumo_cmd = [
                SUMO_BINARY,
                "-c", str(sumocfg),
                "--step-length", str(STEP_LENGTH),
                "--no-warnings", "true",
                "--no-step-log", "true",
                "--random",
                "--start",
            ]
            traci.start(sumo_cmd)

            # Obtener límites de la red para transformación de coordenadas
            self.network_bounds = traci.simulation.getNetBoundary()
            simulation_state["network_bounds"] = {
                "min": {"x": self.network_bounds[0][0], "y": self.network_bounds[0][1]},
                "max": {"x": self.network_bounds[1][0], "y": self.network_bounds[1][1]},
            }

            self.is_running = True
            simulation_state["running"] = True
            simulation_state["network_id"] = network_id
            log.info(f"SUMO iniciado con red '{network_id}' — bounds: {self.network_bounds}")
            return True
        except Exception as e:
            log.error(f"Error iniciando SUMO: {e}")
            return False

    def step(self) -> dict:
        """Ejecutar un paso de simulación y devolver estado vehicular."""
        if not self.is_running:
            return {"vehicles": [], "step": 0}

        self.step_count += 1
        simulation_state["step"] = self.step_count

        if not TRACI_AVAILABLE:
            return self._simulated_step()

        try:
            traci.simulationStep()
            vehicles = []
            veh_ids = traci.vehicle.getIDList()

            for vid in veh_ids[:MAX_VEHICLES]:
                x, y = traci.vehicle.getPosition(vid)
                speed = traci.vehicle.getSpeed(vid)
                lane_id = traci.vehicle.getLaneID(vid)
                vtype = traci.vehicle.getTypeID(vid)
                angle = traci.vehicle.getAngle(vid)
                
                # Obtener lon/lat para coordenadas geográficas
                lon, lat = traci.simulation.convertGeo(x, y)

                vehicles.append({
                    "id": vid,
                    "x": round(x, 1),
                    "y": round(y, 1),
                    "lon": round(lon, 6),
                    "lat": round(lat, 6),
                    "speed": round(speed * 3.6, 1),  # m/s → km/h
                    "angle": round(angle, 1),
                    "lane": lane_id,
                    "type": vtype,
                })

            simulation_state["vehicle_count"] = len(vehicles)

            return {
                "vehicles": vehicles,
                "step": self.step_count,
                "time": round(traci.simulation.getTime(), 1),
                "vehicleCount": len(vehicles),
                "departed": traci.simulation.getDepartedNumber(),
                "arrived": traci.simulation.getArrivedNumber(),
            }
        except traci.exceptions.FatalTraCIError:
            log.error("Conexión TraCI perdida")
            self.is_running = False
            simulation_state["running"] = False
            return {"vehicles": [], "step": self.step_count, "error": "traci_disconnected"}

    def calibrate(self, edge_id: str, speed_kmh: float, flow_vph: float):
        """Calibrar un tramo con datos reales de Google/Waze."""
        if not TRACI_AVAILABLE or not self.is_running:
            return

        try:
            # Ajustar velocidad máxima del tramo
            speed_ms = speed_kmh / 3.6
            traci.edge.setMaxSpeed(edge_id, speed_ms)

            # Si hay calibradores definidos en la red, usarlos
            # Los calibradores SUMO ajustan flujo y velocidad automáticamente
            log.info(f"Calibrado edge '{edge_id}': {speed_kmh} km/h, {flow_vph} veh/h")
        except Exception as e:
            log.warning(f"Error calibrando edge '{edge_id}': {e}")

    def stop(self):
        """Detener SUMO."""
        if TRACI_AVAILABLE and self.is_running:
            try:
                traci.close()
            except Exception:
                pass
        self.is_running = False
        simulation_state["running"] = False
        log.info("SUMO detenido")

    def _simulated_step(self) -> dict:
        """Modo simulado sin SUMO real (para desarrollo local)."""
        import math
        t = self.step_count * STEP_LENGTH
        n_vehicles = 30
        vehicles = []

        for i in range(n_vehicles):
            # Simular vehículos moviéndose a lo largo de una línea
            phase = (t * 0.3 + i * 0.5) % 20
            vehicles.append({
                "id": f"veh_{i}",
                "x": phase * 100,
                "y": 50 + (i % 3) * 20 + math.sin(t + i) * 2,
                "lon": -74.272 + phase * 0.001,
                "lat": 4.537 + (i % 3) * 0.0002,
                "speed": round(30 + math.sin(t * 0.5 + i) * 15, 1),
                "angle": 90.0,
                "lane": f"lane_{i % 3}",
                "type": ["car", "bus", "truck"][i % 3],
            })

        simulation_state["vehicle_count"] = len(vehicles)
        return {
            "vehicles": vehicles,
            "step": self.step_count,
            "time": round(t, 1),
            "vehicleCount": len(vehicles),
            "departed": 0,
            "arrived": 0,
        }


# ── Instancia global del controlador ──
controller = SUMOController()


# ── FastAPI Application ───────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Iniciar SUMO al arrancar el servidor, detenerlo al cerrar."""
    network = os.getenv("SUMO_NETWORK", "C3")
    log.info(f"Iniciando SUMO Engine con red: {network}")
    controller.start(network)

    # Lanzar el loop de simulación en background
    task = asyncio.create_task(simulation_loop())
    yield

    task.cancel()
    controller.stop()


app = FastAPI(
    title="SUMO Engine — VIITS NEXUS",
    description="Motor de microsimulación para el Gemelo Digital del Ministerio de Transporte",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Loop de Simulación ────────────────────────────────────────
async def simulation_loop():
    """Loop principal: avanza SUMO y transmite estado a todos los clientes."""
    while True:
        if not controller.is_running:
            await asyncio.sleep(1)
            continue

        # Ejecutar paso SUMO
        state = controller.step()

        # Broadcast a todos los clientes WebSocket conectados
        if connected_clients and state.get("vehicles"):
            try:
                import orjson
                payload = orjson.dumps({
                    "type": "sumo_frame",
                    "data": state,
                    "bounds": simulation_state.get("network_bounds"),
                    "networkId": simulation_state.get("network_id"),
                })
            except ImportError:
                payload = json.dumps({
                    "type": "sumo_frame",
                    "data": state,
                    "bounds": simulation_state.get("network_bounds"),
                    "networkId": simulation_state.get("network_id"),
                })

            disconnected = set()
            for ws in connected_clients:
                try:
                    await ws.send_bytes(payload) if isinstance(payload, bytes) else await ws.send_text(payload)
                except Exception:
                    disconnected.add(ws)

            connected_clients.difference_update(disconnected)

        await asyncio.sleep(STREAM_INTERVAL)


# ── REST Endpoints ────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "sumo_running": simulation_state["running"],
        "network": simulation_state["network_id"],
        "vehicles": simulation_state["vehicle_count"],
        "step": simulation_state["step"],
    }


@app.get("/api/state")
async def get_state():
    """Estado actual de la simulación."""
    return simulation_state


@app.get("/api/networks")
async def list_networks():
    """Listar redes disponibles (peajes + vías congestionadas Waze)."""
    # Redes de peajes (estáticas)
    toll_networks = []
    for cfg in CONFIG_DIR.glob("*.sumocfg"):
        if not cfg.stem.startswith("waze_"):
            toll_networks.append({"id": cfg.stem, "file": cfg.name, "type": "toll"})

    # Redes de vías congestionadas Waze (dinámicas)
    waze_segments = load_waze_manifest()
    waze_networks = [{
        "id": seg["id"],
        "name": seg.get("name", "Tramo desconocido"),
        "jamLevel": seg.get("jamLevel"),
        "length_m": seg.get("length_m", 0),
        "cfg_file": seg.get("cfg_file"),
        "type": "waze_segment",
    } for seg in waze_segments]

    return {
        "toll_networks": toll_networks,
        "waze_networks": waze_networks,
        "total": len(toll_networks) + len(waze_networks),
    }


@app.post("/api/switch/{network_id}")
async def switch_network(network_id: str):
    """Cambiar la red SUMO activa (para simular otra vía congestionada)."""
    log.info(f"Solicitud de cambio de red: {network_id}")
    controller.stop()
    
    # Intentar primero como red de peaje
    cfg_peaje = CONFIG_DIR / f"{network_id}.sumocfg"
    cfg_waze = CONFIG_DIR / f"waze_{network_id}.sumocfg"
    
    if cfg_peaje.exists():
        success = controller.start(network_id)
    elif cfg_waze.exists():
        success = controller.start(f"waze_{network_id}")
    else:
        return {"ok": False, "error": f"Red '{network_id}' no encontrada"}
    
    return {"ok": success, "network": network_id, "state": simulation_state}


@app.post("/api/calibrate")
async def calibrate_edge(edge_id: str, speed_kmh: float = 60, flow_vph: float = 500):
    """Calibrar un tramo con datos de tráfico real."""
    controller.calibrate(edge_id, speed_kmh, flow_vph)
    return {"ok": True, "edge": edge_id, "speed": speed_kmh, "flow": flow_vph}


# ── WebSocket Streaming ───────────────────────────────────────
@app.websocket("/ws/sumo")
async def sumo_websocket(websocket: WebSocket):
    """Stream de posiciones vehiculares en tiempo real."""
    await websocket.accept()
    connected_clients.add(websocket)
    log.info(f"Cliente SUMO conectado — total: {len(connected_clients)}")

    # Enviar estado inicial
    await websocket.send_json({
        "type": "sumo_init",
        "state": simulation_state,
    })

    try:
        while True:
            # Escuchar comandos del frontend (ej: calibración manual)
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "calibrate":
                    controller.calibrate(
                        msg["edgeId"],
                        msg.get("speed", 60),
                        msg.get("flow", 500),
                    )
                elif msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except (json.JSONDecodeError, KeyError):
                pass
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
        log.info(f"Cliente SUMO desconectado — total: {len(connected_clients)}")


# ── Entrypoint ────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100, log_level="info")
