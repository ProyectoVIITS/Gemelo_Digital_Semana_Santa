"""
SUMO Engine — FastAPI Server v3 (Multi-Instancia)
==================================================
Cambios v3 sobre v2:
  - SUMOPool: hasta SUMO_MAX_INSTANCES instancias paralelas (default 10)
  - SUMOInstance: cada instancia con su propio TraCI label
  - WebSocket parametrizado: /ws/sumo/{jam_hash}
  - WebSocket legacy /ws/sumo: sticky al top_jam_hash al momento de conectar
  - Endpoints /api/pool/{start|stop|status}
  - Auto-shutdown: instancias sin clientes >SUMO_INSTANCE_TTL segundos
  - Eviction LRU al alcanzar capacidad (sin desalojar instancias con clientes)
  - Calibrador v4 habla directamente con SUMOPool (sin adapter)
  - /api/calibrate y /api/inject aceptan ?hash=XXX opcional
"""

import os
import json
import asyncio
import time
import random
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
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
SUMO_MAX_INSTANCES = int(os.getenv("SUMO_MAX_INSTANCES", "15"))
SUMO_INSTANCE_TTL = float(os.getenv("SUMO_INSTANCE_TTL", "600"))
HOUSEKEEPING_INTERVAL = float(os.getenv("HOUSEKEEPING_INTERVAL", "60"))

logging.basicConfig(level=logging.INFO, format="[SUMO-Engine] %(message)s")
log = logging.getLogger("sumo-engine")

WAZE_MANIFEST_PATH = NETWORK_DIR / "waze_segments" / "manifest.json"

VEHICLE_DISTRIBUTION = [
    ("car", 0.65),
    ("moto", 0.20),
    ("truck", 0.10),
    ("bus", 0.05),
]


def load_waze_manifest() -> list:
    if not WAZE_MANIFEST_PATH.exists():
        return []
    try:
        with open(WAZE_MANIFEST_PATH) as f:
            data = json.load(f)
        return data.get("segments", [])
    except Exception:
        return []


def _resolve_sumocfg(network_id: str) -> Optional[Path]:
    """Acepta 'waze_HASH', 'HASH' o ID de peaje. Devuelve Path o None."""
    direct = CONFIG_DIR / f"{network_id}.sumocfg"
    if direct.exists():
        return direct
    waze = CONFIG_DIR / f"waze_{network_id}.sumocfg"
    if waze.exists():
        return waze
    return None


def _normalize_hash(network_id: str) -> str:
    """De 'waze_HASH' devuelve 'HASH'. De 'HASH' devuelve 'HASH'."""
    if network_id.startswith("waze_"):
        return network_id[len("waze_"):]
    return network_id


def _pick_vehicle_type() -> str:
    r = random.random()
    cum = 0.0
    for vt, prob in VEHICLE_DISTRIBUTION:
        cum += prob
        if r <= cum:
            return vt
    return "car"


# ─────────────────────────────────────────────────────────────────────
# SUMOInstance
# ─────────────────────────────────────────────────────────────────────
class SUMOInstance:
    def __init__(self, jam_hash: str, sumocfg_path: Path):
        self.jam_hash = jam_hash
        self.label = f"sumo_{jam_hash}"
        self.sumocfg_path = sumocfg_path
        self.is_running = False
        self.step_count = 0
        self.network_bounds = None
        self.clients: set[WebSocket] = set()
        self.last_client_disconnect: Optional[float] = time.time()
        self.created_at: float = time.time()
        self.last_step_vehicles: int = 0

    def _switch(self):
        if TRACI_AVAILABLE:
            traci.switch(self.label)

    def start(self) -> bool:
        if self.is_running:
            return True
        if not TRACI_AVAILABLE:
            self.is_running = True
            return True
        if not self.sumocfg_path.exists():
            log.error(f"[{self.jam_hash}] cfg no existe: {self.sumocfg_path}")
            return False
        try:
            sumo_cmd = [
                SUMO_BINARY,
                "-c", str(self.sumocfg_path),
                "--step-length", str(STEP_LENGTH),
                "--no-warnings", "true",
                "--no-step-log", "true",
                "--random",
                "--start",
            ]
            traci.start(sumo_cmd, label=self.label)
            traci.switch(self.label)
            bounds = traci.simulation.getNetBoundary()
            self.network_bounds = {
                "min": {"x": bounds[0][0], "y": bounds[0][1]},
                "max": {"x": bounds[1][0], "y": bounds[1][1]},
            }
            self.is_running = True
            log.info(f"[{self.jam_hash}] iniciada — bounds {bounds}")
            return True
        except Exception as e:
            log.error(f"[{self.jam_hash}] error iniciando SUMO: {e}")
            return False

    def stop(self):
        if not self.is_running:
            return
        if TRACI_AVAILABLE:
            try:
                traci.switch(self.label)
                traci.close()
            except Exception:
                pass
        self.is_running = False
        log.info(f"[{self.jam_hash}] detenida")

    def step(self) -> dict:
        if not self.is_running:
            return {"vehicles": [], "step": 0}
        self.step_count += 1
        if not TRACI_AVAILABLE:
            return self._simulated_step()
        try:
            self._switch()
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
            self.last_step_vehicles = len(vehicles)
            return {
                "vehicles": vehicles,
                "step": self.step_count,
                "time": round(traci.simulation.getTime(), 1),
                "vehicleCount": len(vehicles),
                "departed": traci.simulation.getDepartedNumber(),
                "arrived": traci.simulation.getArrivedNumber(),
            }
        except traci.exceptions.FatalTraCIError:
            log.error(f"[{self.jam_hash}] conexion TraCI perdida")
            self.is_running = False
            return {"vehicles": [], "step": self.step_count, "error": "traci_disconnected"}

    def calibrate(self, edge_id: str, speed_kmh: float, flow_vph: float = 0) -> bool:
        if not TRACI_AVAILABLE or not self.is_running:
            return False
        try:
            self._switch()
            traci.edge.setMaxSpeed(edge_id, speed_kmh / 3.6)
            return True
        except Exception as e:
            log.warning(f"[{self.jam_hash}] error calibrando '{edge_id}': {e}")
            return False

    def get_drivable_edges(self) -> list:
        if not TRACI_AVAILABLE or not self.is_running:
            return []
        try:
            self._switch()
            return [e for e in traci.edge.getIDList() if not e.startswith(":")]
        except Exception:
            return []

    def get_vehicle_count(self) -> int:
        if not TRACI_AVAILABLE or not self.is_running:
            return 0
        try:
            self._switch()
            return len(traci.vehicle.getIDList())
        except Exception:
            return 0

    def inject_vehicles(self, target_count: int) -> dict:
        if not TRACI_AVAILABLE or not self.is_running:
            return {"injected": 0, "skipped": "not_running"}
        try:
            self._switch()
            current = len(traci.vehicle.getIDList())
            to_inject = max(0, target_count - current)
            if to_inject == 0:
                return {"injected": 0, "current": current, "target": target_count}
            edges_pool = [e for e in traci.edge.getIDList() if not e.startswith(":")]
            if not edges_pool:
                return {"injected": 0, "current": current, "skipped": "no_edges"}
            injected = 0
            failed = 0
            for i in range(to_inject):
                vtype = _pick_vehicle_type()
                origin_edge = random.choice(edges_pool)
                dest_edge = random.choice(edges_pool)
                veh_id = f"inj_{int(time.time() * 1000)}_{i}"
                route_id = f"route_{veh_id}"
                try:
                    traci.route.add(route_id, [origin_edge, dest_edge])
                    traci.vehicle.add(
                        vehID=veh_id, routeID=route_id, typeID=vtype,
                        depart="now", departLane="best", departSpeed="random",
                    )
                    injected += 1
                except traci.exceptions.TraCIException:
                    try:
                        traci.route.add(route_id, [origin_edge])
                        traci.vehicle.add(
                            vehID=veh_id, routeID=route_id, typeID=vtype, depart="now",
                        )
                        injected += 1
                    except Exception:
                        failed += 1
            return {
                "injected": injected,
                "failed": failed,
                "current_before": current,
                "target": target_count,
                "edges_pool_size": len(edges_pool),
            }
        except Exception as e:
            log.error(f"[{self.jam_hash}] error en inject_vehicles: {e}")
            return {"injected": 0, "error": str(e)}

    def add_client(self, ws: WebSocket):
        self.clients.add(ws)
        self.last_client_disconnect = None

    def remove_client(self, ws: WebSocket):
        self.clients.discard(ws)
        if not self.clients:
            self.last_client_disconnect = time.time()

    def status(self) -> dict:
        now = time.time()
        return {
            "hash": self.jam_hash,
            "label": self.label,
            "is_running": self.is_running,
            "step": self.step_count,
            "vehicles": self.last_step_vehicles,
            "clients_count": len(self.clients),
            "uptime_s": round(now - self.created_at, 1),
            "last_client_disconnect_s_ago": (
                round(now - self.last_client_disconnect, 1)
                if self.last_client_disconnect else None
            ),
            "network_bounds": self.network_bounds,
            "cfg": str(self.sumocfg_path.name),
        }

    def _simulated_step(self) -> dict:
        import math
        t = self.step_count * STEP_LENGTH
        n_vehicles = 30
        vehicles = []
        for i in range(n_vehicles):
            phase = (t * 0.3 + i * 0.5) % 20
            vehicles.append({
                "id": f"veh_{self.jam_hash}_{i}",
                "x": phase * 100,
                "y": 50 + (i % 3) * 20 + math.sin(t + i) * 2,
                "lon": -74.272 + phase * 0.001,
                "lat": 4.537 + (i % 3) * 0.0002,
                "speed": round(30 + math.sin(t * 0.5 + i) * 15, 1),
                "angle": 90.0,
                "lane": f"lane_{i % 3}",
                "type": ["car", "bus", "truck"][i % 3],
            })
        self.last_step_vehicles = len(vehicles)
        return {
            "vehicles": vehicles,
            "step": self.step_count,
            "time": round(t, 1),
            "vehicleCount": len(vehicles),
            "departed": 0,
            "arrived": 0,
        }


# ─────────────────────────────────────────────────────────────────────
# SUMOPool
# ─────────────────────────────────────────────────────────────────────
class SUMOPool:
    def __init__(self, max_instances: int = SUMO_MAX_INSTANCES):
        self.instances: dict[str, SUMOInstance] = {}
        self.top_jam_hash: Optional[str] = None
        self.max_instances = max_instances
        self._lock = asyncio.Lock()

    def get_instance(self, jam_hash: str) -> Optional[SUMOInstance]:
        return self.instances.get(_normalize_hash(jam_hash))

    def get_top_instance(self) -> Optional[SUMOInstance]:
        if not self.top_jam_hash:
            return None
        return self.instances.get(self.top_jam_hash)

    def set_top_jam(self, jam_hash: str):
        self.top_jam_hash = _normalize_hash(jam_hash)

    def active_instances(self) -> list[SUMOInstance]:
        return [i for i in self.instances.values() if i.is_running]

    async def start_instance(self, jam_hash: str, sumocfg_path: Optional[Path] = None) -> dict:
        """Idempotente. LRU eviction si capacidad llena (sin desalojar con clientes)."""
        norm = _normalize_hash(jam_hash)
        async with self._lock:
            existing = self.instances.get(norm)
            if existing and existing.is_running:
                return {"ok": True, "status": "already_running", "hash": norm}

            if sumocfg_path is None:
                sumocfg_path = _resolve_sumocfg(norm) or _resolve_sumocfg(f"waze_{norm}")
            if sumocfg_path is None or not sumocfg_path.exists():
                return {"ok": False, "error": "config_not_found", "hash": norm}

            if len(self.active_instances()) >= self.max_instances:
                evicted = self._evict_lru_unlocked()
                if evicted is None:
                    return {
                        "ok": False,
                        "error": "all_instances_watched",
                        "active": len(self.active_instances()),
                    }

            inst = SUMOInstance(norm, sumocfg_path)
            ok = inst.start()
            if not ok:
                return {"ok": False, "error": "start_failed", "hash": norm}
            self.instances[norm] = inst
            return {"ok": True, "status": "started", "hash": norm}

    def _evict_lru_unlocked(self) -> Optional[str]:
        """Llamar con _lock adquirido. Devuelve hash desalojado o None."""
        candidates = [
            i for i in self.instances.values()
            if not i.clients and i.last_client_disconnect is not None
        ]
        if not candidates:
            return None
        victim = min(candidates, key=lambda i: i.last_client_disconnect)
        log.info(f"EVICT LRU: {victim.jam_hash} (sin clientes hace "
                 f"{round(time.time() - victim.last_client_disconnect, 0)}s)")
        victim.stop()
        del self.instances[victim.jam_hash]
        if self.top_jam_hash == victim.jam_hash:
            self.top_jam_hash = None
        return victim.jam_hash

    async def stop_instance(self, jam_hash: str) -> dict:
        norm = _normalize_hash(jam_hash)
        async with self._lock:
            inst = self.instances.get(norm)
            if inst is None:
                return {"ok": False, "error": "not_found", "hash": norm}
            inst.stop()
            del self.instances[norm]
            if self.top_jam_hash == norm:
                self.top_jam_hash = None
            return {"ok": True, "hash": norm}

    async def inject_into(self, jam_hash: str, target_count: int) -> dict:
        """Inyecta vehículos en una instancia tomando el lock global TraCI."""
        inst = self.get_instance(jam_hash)
        if not inst:
            return {"injected": 0, "skipped": "not_found"}
        async with self._lock:
            return inst.inject_vehicles(target_count)

    async def calibrate_in(
        self, jam_hash: str, edge_id: str, speed_kmh: float, flow_vph: float = 0
    ) -> bool:
        """Calibra un edge en una instancia tomando el lock global TraCI."""
        inst = self.get_instance(jam_hash)
        if not inst:
            return False
        async with self._lock:
            return inst.calibrate(edge_id, speed_kmh, flow_vph)

    def get_status(self) -> dict:
        return {
            "max_instances": self.max_instances,
            "active": len(self.active_instances()),
            "top_jam_hash": self.top_jam_hash,
            "ttl_seconds": SUMO_INSTANCE_TTL,
            "instances": [i.status() for i in self.instances.values()],
        }

    async def housekeeping(self):
        """Apaga instancias inactivas con TTL excedido."""
        while True:
            await asyncio.sleep(HOUSEKEEPING_INTERVAL)
            try:
                now = time.time()
                expired = []
                for h, inst in list(self.instances.items()):
                    if (
                        not inst.clients
                        and inst.last_client_disconnect is not None
                        and now - inst.last_client_disconnect > SUMO_INSTANCE_TTL
                    ):
                        expired.append(h)
                for h in expired:
                    log.info(f"AUTO-SHUTDOWN: {h} sin clientes >{SUMO_INSTANCE_TTL}s")
                    await self.stop_instance(h)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                log.warning(f"Error en housekeeping: {e}")


# ─────────────────────────────────────────────────────────────────────
# Globals + lifespan
# ─────────────────────────────────────────────────────────────────────
pool = SUMOPool()
calibrator_instance = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global calibrator_instance
    log.info(f"SUMO Engine v3 iniciando — pool vacío "
             f"(max={SUMO_MAX_INSTANCES}, ttl={SUMO_INSTANCE_TTL}s)")

    sim_task = asyncio.create_task(simulation_loop())
    house_task = asyncio.create_task(pool.housekeeping())

    cal_task = None
    try:
        from calibrator import TrafficCalibrator
        calibrator_instance = TrafficCalibrator(pool)
        cal_task = asyncio.create_task(calibrator_instance.start())
        log.info("TrafficCalibrator iniciado (multi-instancia)")
    except Exception as e:
        log.warning(f"No se pudo iniciar calibrador: {e}")

    yield

    sim_task.cancel()
    house_task.cancel()
    if cal_task:
        cal_task.cancel()
    for h in list(pool.instances.keys()):
        try:
            pool.instances[h].stop()
        except Exception:
            pass


app = FastAPI(
    title="SUMO Engine — VIITS NEXUS",
    description="Motor de microsimulación multi-instancia v3",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────
# Simulation loop
# ─────────────────────────────────────────────────────────────────────
async def simulation_loop():
    try:
        import orjson
        def encode(payload): return orjson.dumps(payload)
        send_method = "send_bytes"
    except ImportError:
        def encode(payload): return json.dumps(payload)
        send_method = "send_text"

    while True:
        try:
            instances = pool.active_instances()
            if not instances:
                await asyncio.sleep(STREAM_INTERVAL)
                continue

            async with pool._lock:
                frames: list[tuple[SUMOInstance, dict]] = []
                for inst in instances:
                    state = inst.step()
                    frames.append((inst, state))

            for inst, state in frames:
                if not inst.clients or not state.get("vehicles"):
                    continue
                payload = encode({
                    "type": "sumo_frame",
                    "data": state,
                    "bounds": inst.network_bounds,
                    "networkId": inst.label,
                    "jamHash": inst.jam_hash,
                })
                disconnected = set()
                for ws in inst.clients:
                    try:
                        await getattr(ws, send_method)(payload)
                    except Exception:
                        disconnected.add(ws)
                for ws in disconnected:
                    inst.remove_client(ws)

            await asyncio.sleep(STREAM_INTERVAL)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.warning(f"Error en simulation_loop: {e}")
            await asyncio.sleep(1)


# ─────────────────────────────────────────────────────────────────────
# Endpoints REST
# ─────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    actives = pool.active_instances()
    return {
        "status": "ok",
        "pool_active": len(actives),
        "pool_max": SUMO_MAX_INSTANCES,
        "top_jam_hash": pool.top_jam_hash,
        "vehicles_total": sum(i.last_step_vehicles for i in actives),
    }


@app.get("/api/state")
async def get_state():
    return pool.get_status()


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


@app.post("/api/pool/start/{jam_hash}")
async def pool_start(jam_hash: str):
    result = await pool.start_instance(jam_hash)
    if not result.get("ok"):
        if result.get("error") == "all_instances_watched":
            raise HTTPException(status_code=503, detail=result)
        if result.get("error") == "config_not_found":
            raise HTTPException(status_code=404, detail=result)
        raise HTTPException(status_code=500, detail=result)
    return result


@app.post("/api/pool/stop/{jam_hash}")
async def pool_stop(jam_hash: str):
    result = await pool.stop_instance(jam_hash)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result)
    return result


@app.get("/api/pool/status")
async def pool_status():
    return pool.get_status()


@app.post("/api/switch/{network_id}")
async def switch_network(network_id: str):
    norm = _normalize_hash(network_id)
    result = await pool.start_instance(norm)
    if result.get("ok"):
        pool.set_top_jam(norm)
    return {"ok": result.get("ok"), "network": network_id, "result": result}


@app.post("/api/calibrate")
async def calibrate_edge(
    edge_id: str,
    speed_kmh: float = 60,
    flow_vph: float = 500,
    hash: Optional[str] = None,
):
    target_hash = hash if hash else pool.top_jam_hash
    if not target_hash:
        raise HTTPException(status_code=404, detail={"error": "no_top_instance"})
    if pool.get_instance(target_hash) is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "instance_not_found", "hash": target_hash},
        )
    ok = await pool.calibrate_in(target_hash, edge_id, speed_kmh, flow_vph)
    return {"ok": ok, "edge": edge_id, "hash": target_hash}


@app.post("/api/inject")
async def inject_vehicles_endpoint(target: int = 50, hash: Optional[str] = None):
    target_hash = hash if hash else pool.top_jam_hash
    if not target_hash:
        raise HTTPException(status_code=404, detail={"error": "no_top_instance"})
    if pool.get_instance(target_hash) is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "instance_not_found", "hash": target_hash},
        )
    result = await pool.inject_into(target_hash, target)
    return {"ok": True, "hash": target_hash, "result": result}


@app.get("/api/calibrator/status")
async def calibrator_status():
    if calibrator_instance is None:
        return {"running": False, "reason": "not_initialized"}
    return {"running": True, **calibrator_instance.get_status()}


# ─────────────────────────────────────────────────────────────────────
# WebSockets
# ─────────────────────────────────────────────────────────────────────
@app.websocket("/ws/sumo/{jam_hash}")
async def sumo_ws_by_hash(websocket: WebSocket, jam_hash: str):
    norm = _normalize_hash(jam_hash)
    inst = pool.get_instance(norm)

    if inst is None:
        # Lazy-start si hay cfg disponible
        result = await pool.start_instance(norm)
        if not result.get("ok"):
            await websocket.accept()
            await websocket.close(code=4404, reason=f"instance_unavailable:{result.get('error')}")
            return
        inst = pool.get_instance(norm)

    await websocket.accept()
    inst.add_client(websocket)
    log.info(f"WS conectado a {norm} — clientes: {len(inst.clients)}")
    await websocket.send_json({
        "type": "sumo_init",
        "jamHash": norm,
        "bounds": inst.network_bounds,
        "step": inst.step_count,
    })

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except (json.JSONDecodeError, KeyError):
                pass
    except WebSocketDisconnect:
        pass
    finally:
        inst.remove_client(websocket)
        log.info(f"WS desconectado de {norm} — clientes restantes: {len(inst.clients)}")


@app.websocket("/ws/sumo")
async def sumo_ws_legacy(websocket: WebSocket):
    """Legacy sticky: se ata al top_jam_hash al momento de conectar."""
    inst = pool.get_top_instance()
    if inst is None:
        await websocket.accept()
        await websocket.close(code=4503, reason="no_top_instance_yet")
        return

    target_hash = inst.jam_hash
    await websocket.accept()
    inst.add_client(websocket)
    log.info(f"WS legacy conectado — sticky a top={target_hash} (clientes: {len(inst.clients)})")
    await websocket.send_json({
        "type": "sumo_init",
        "jamHash": target_hash,
        "bounds": inst.network_bounds,
        "step": inst.step_count,
    })

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except (json.JSONDecodeError, KeyError):
                pass
    except WebSocketDisconnect:
        pass
    finally:
        inst.remove_client(websocket)
        log.info(f"WS legacy desconectado de {target_hash}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100, log_level="info")
