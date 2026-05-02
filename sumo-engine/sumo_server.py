"""
SUMO Engine — FastAPI Server + TraCI Controller (v2 con inyección Waze)
Motor de microsimulación para el Gemelo Digital VIITS-NEXUS

Cambios v2:
  - inject_vehicles() para inyección dinámica
  - _current_network expuesto al calibrador
  - TrafficCalibrator arrancado en lifespan
  - Endpoint /api/calibrator/status y /api/inject
"""

import os
import sys
import json
import asyncio
import time
import random
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

SUMO_BINARY = os.getenv("SUMO_BINARY", "sumo")
NETWORK_DIR = Path(__file__).parent / "networks"
CONFIG_DIR = Path(__file__).parent / "config"
STEP_LENGTH = float(os.getenv("SUMO_STEP_LENGTH", "0.5"))
STREAM_INTERVAL = float(os.getenv("STREAM_INTERVAL", "0.5"))
MAX_VEHICLES = int(os.getenv("MAX_VEHICLES", "5000"))

logging.basicConfig(level=logging.INFO, format="[SUMO-Engine] %(message)s")
log = logging.getLogger("sumo-engine")

simulation_state = {
    "running": False,
    "step": 0,
    "vehicle_count": 0,
    "network_id": None,
    "network_bounds": None,
}

WAZE_MANIFEST_PATH = NETWORK_DIR / "waze_segments" / "manifest.json"


def load_waze_manifest() -> list:
    if not WAZE_MANIFEST_PATH.exists():
        return []
    try:
        with open(WAZE_MANIFEST_PATH) as f:
            data = json.load(f)
        return data.get("segments", [])
    except Exception:
        return []


connected_clients: set[WebSocket] = set()

VEHICLE_DISTRIBUTION = [
    ("car", 0.65),
    ("moto", 0.20),
    ("truck", 0.10),
    ("bus", 0.05),
]


class SUMOController:
    def __init__(self):
        self.is_running = False
        self.step_count = 0
        self.network_bounds = None
        self._current_network = None

    def start(self, network_id: str = "C3"):
        if not TRACI_AVAILABLE:
            log.warning("TraCI no instalado — modo simulado")
            self.is_running = True
            self._current_network = network_id
            simulation_state["running"] = True
            simulation_state["network_id"] = network_id
            return True

        sumocfg = CONFIG_DIR / f"{network_id}.sumocfg"
        if not sumocfg.exists():
            log.error(f"Configuracion no encontrada: {sumocfg}")
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

            self.network_bounds = traci.simulation.getNetBoundary()
            simulation_state["network_bounds"] = {
                "min": {"x": self.network_bounds[0][0], "y": self.network_bounds[0][1]},
                "max": {"x": self.network_bounds[1][0], "y": self.network_bounds[1][1]},
            }

            self.is_running = True
            self._current_network = network_id
            simulation_state["running"] = True
            simulation_state["network_id"] = network_id
            log.info(f"SUMO iniciado red '{network_id}' bounds: {self.network_bounds}")
            return True
        except Exception as e:
            log.error(f"Error iniciando SUMO: {e}")
            return False

    def step(self) -> dict:
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
                lon, lat = traci.simulation.convertGeo(x, y)

                vehicles.append({
                    "id": vid,
                    "x": round(x, 1),
                    "y": round(y, 1),
                    "lon": round(lon, 6),
                    "lat": round(lat, 6),
                    "speed": round(speed * 3.6, 1),
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
            log.error("Conexion TraCI perdida")
            self.is_running = False
            simulation_state["running"] = False
            return {"vehicles": [], "step": self.step_count, "error": "traci_disconnected"}

    def calibrate(self, edge_id: str, speed_kmh: float, flow_vph: float):
        if not TRACI_AVAILABLE or not self.is_running:
            return
        try:
            speed_ms = speed_kmh / 3.6
            traci.edge.setMaxSpeed(edge_id, speed_ms)
            log.info(f"Calibrado edge '{edge_id}': {speed_kmh} km/h, {flow_vph} veh/h")
        except Exception as e:
            log.warning(f"Error calibrando edge '{edge_id}': {e}")

    def get_drivable_edges(self) -> list:
        if not TRACI_AVAILABLE or not self.is_running:
            return []
        try:
            all_edges = traci.edge.getIDList()
            return [e for e in all_edges if not e.startswith(":")]
        except Exception:
            return []

    def get_current_vehicle_count(self) -> int:
        if not TRACI_AVAILABLE or not self.is_running:
            return 0
        try:
            return len(traci.vehicle.getIDList())
        except Exception:
            return 0

    def inject_vehicles(self, target_count: int, edges_pool: Optional[list] = None) -> dict:
        if not TRACI_AVAILABLE or not self.is_running:
            return {"injected": 0, "current": 0, "skipped": "not_running"}

        try:
            current = self.get_current_vehicle_count()
            to_inject = max(0, target_count - current)

            if to_inject == 0:
                return {"injected": 0, "current": current, "target": target_count}

            if not edges_pool:
                edges_pool = self.get_drivable_edges()

            if not edges_pool:
                return {"injected": 0, "current": current, "skipped": "no_edges"}

            injected = 0
            failed = 0
            for i in range(to_inject):
                r = random.random()
                cum = 0.0
                vtype = "car"
                for vt, prob in VEHICLE_DISTRIBUTION:
                    cum += prob
                    if r <= cum:
                        vtype = vt
                        break

                origin_edge = random.choice(edges_pool)
                dest_edge = random.choice(edges_pool)

                veh_id = f"inj_{int(time.time() * 1000)}_{i}"
                route_id = f"route_{veh_id}"

                try:
                    traci.route.add(route_id, [origin_edge, dest_edge])
                    traci.vehicle.add(
                        vehID=veh_id,
                        routeID=route_id,
                        typeID=vtype,
                        depart="now",
                        departLane="best",
                        departSpeed="random",
                    )
                    injected += 1
                except traci.exceptions.TraCIException:
                    try:
                        traci.route.add(route_id, [origin_edge])
                        traci.vehicle.add(
                            vehID=veh_id,
                            routeID=route_id,
                            typeID=vtype,
                            depart="now",
                        )
                        injected += 1
                    except Exception:
                        failed += 1

            log.info(f"Inyeccion: {injected} OK, {failed} fallidos, total ahora ~{current + injected}")
            return {
                "injected": injected,
                "failed": failed,
                "current_before": current,
                "target": target_count,
                "edges_pool_size": len(edges_pool),
            }
        except Exception as e:
            log.error(f"Error en inject_vehicles: {e}")
            return {"injected": 0, "error": str(e)}

    def stop(self):
        if TRACI_AVAILABLE and self.is_running:
            try:
                traci.close()
            except Exception:
                pass
        self.is_running = False
        self._current_network = None
        simulation_state["running"] = False
        log.info("SUMO detenido")

    def _simulated_step(self) -> dict:
        import math
        t = self.step_count * STEP_LENGTH
        n_vehicles = 30
        vehicles = []
        for i in range(n_vehicles):
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


controller = SUMOController()
calibrator_instance = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global calibrator_instance
    network = os.getenv("SUMO_NETWORK", "C3")
    log.info(f"Iniciando SUMO Engine con red: {network}")
    controller.start(network)

    sim_task = asyncio.create_task(simulation_loop())

    cal_task = None
    try:
        from calibrator import TrafficCalibrator
        calibrator_instance = TrafficCalibrator(controller)
        cal_task = asyncio.create_task(calibrator_instance.start())
        log.info("TrafficCalibrator iniciado en background")
    except Exception as e:
        log.warning(f"No se pudo iniciar calibrador: {e}")

    yield

    sim_task.cancel()
    if cal_task:
        cal_task.cancel()
    controller.stop()


app = FastAPI(
    title="SUMO Engine — VIITS NEXUS",
    description="Motor de microsimulacion con inyeccion Waze v2",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def simulation_loop():
    while True:
        if not controller.is_running:
            await asyncio.sleep(1)
            continue

        state = controller.step()

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
    return simulation_state


@app.get("/api/networks")
async def list_networks():
    toll_networks = []
    for cfg in CONFIG_DIR.glob("*.sumocfg"):
        if not cfg.stem.startswith("waze_"):
            toll_networks.append({"id": cfg.stem, "file": cfg.name, "type": "toll"})

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
    log.info(f"Solicitud cambio red: {network_id}")
    controller.stop()

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
    controller.calibrate(edge_id, speed_kmh, flow_vph)
    return {"ok": True, "edge": edge_id, "speed": speed_kmh, "flow": flow_vph}


@app.post("/api/inject")
async def inject_vehicles_endpoint(target: int = 50):
    result = controller.inject_vehicles(target_count=target)
    return {"ok": True, "result": result}


@app.get("/api/calibrator/status")
async def calibrator_status():
    if calibrator_instance is None:
        return {"running": False, "reason": "not_initialized"}
    return {"running": True, **calibrator_instance.get_status()}


@app.websocket("/ws/sumo")
async def sumo_websocket(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    log.info(f"Cliente conectado — total: {len(connected_clients)}")

    await websocket.send_json({"type": "sumo_init", "state": simulation_state})

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "calibrate":
                    controller.calibrate(msg["edgeId"], msg.get("speed", 60), msg.get("flow", 500))
                elif msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except (json.JSONDecodeError, KeyError):
                pass
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
        log.info(f"Cliente desconectado — total: {len(connected_clients)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100, log_level="info")
