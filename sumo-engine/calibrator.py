"""
Calibrador Dinamico v3 — Auto-switch + Auto-regeneracion
═════════════════════════════════════════════════════════════════
Cambios v3 sobre v2:
  - Auto-switch: si el top jam cambia, cambia de red automaticamente
  - Auto-regeneracion: cada 10 min ejecuta generate_network.py
  - Selecciona top jam por (jamLevel x length_m)
  - Robusto: ignora jams sin red disponible
"""

import asyncio
import hashlib
import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("sumo-calibrator")

STATION_EDGE_MAP = {
    "C3-01": {"edge": "chusaca_main", "name": "CHUSACA", "lat": 4.537553, "lng": -74.272106},
    "C3-02": {"edge": "chinauta_main", "name": "CHINAUTA", "lat": 4.269378, "lng": -74.500107},
    "C3-03": {"edge": "pubenza_main", "name": "PUBENZA", "lat": 4.403316, "lng": -74.731464},
    "C3-04": {"edge": "flandes_main", "name": "FLANDES", "lat": 4.192173, "lng": -74.861153},
}

NEXUS_BACKEND_URL = os.getenv("NEXUS_BACKEND_URL", "http://localhost:3000")
NETWORK_DIR = Path(__file__).parent / "networks"
CONFIG_DIR = Path(__file__).parent / "config"
SCRIPTS_DIR = Path(__file__).parent / "scripts"
WAZE_MANIFEST_PATH = NETWORK_DIR / "waze_segments" / "manifest.json"

# Intervalos
REGEN_INTERVAL = float(os.getenv("REGEN_INTERVAL", "600"))  # 10 minutos

DENSITY_BY_JAMLEVEL = {
    0: 20,
    1: 40,
    2: 80,
    3: 140,
    4: 220,
    5: 320,
}


def get_available_network_ids() -> set:
    """Lista de IDs de redes que tienen .sumocfg generado."""
    if not CONFIG_DIR.exists():
        return set()
    ids = set()
    for cfg in CONFIG_DIR.glob("waze_*.sumocfg"):
        # waze_33d6b04e920c.sumocfg -> 33d6b04e920c
        ids.add(cfg.stem.replace("waze_", ""))
    return ids


def compute_jam_hash(jam: dict) -> str:
    """Replica get_jam_id() de generate_network.py."""
    line = jam.get("line", [])
    if not line:
        return hashlib.md5(json.dumps(jam.get("name", "")).encode()).hexdigest()[:12]
    key_points = [line[0], line[len(line)//2], line[-1]]
    key_str = "|".join(f"{p.get('y',0):.4f},{p.get('x',0):.4f}" for p in key_points)
    return hashlib.md5(key_str.encode()).hexdigest()[:12]


class TrafficCalibrator:
    def __init__(self, controller):
        self.controller = controller
        self.client = httpx.AsyncClient(timeout=10)
        self.last_data = {}
        self.last_waze_data = {}
        self.last_injection = {}
        self.last_switch = None
        self.last_regen = None
        self.regen_running = False
        self.poll_interval = float(os.getenv("CALIBRATOR_INTERVAL", "30"))

    async def start(self):
        log.info(f"Calibrador v3 iniciado — polling cada {self.poll_interval}s desde {NEXUS_BACKEND_URL}")
        log.info(f"Auto-regeneracion cada {REGEN_INTERVAL}s")
        await asyncio.sleep(5)

        # Lanzar loop de regeneracion en paralelo
        asyncio.create_task(self._regen_loop())

        # Loop principal
        while True:
            try:
                await self.poll_and_calibrate()
            except Exception as e:
                log.warning(f"Error en ciclo de calibracion: {e}")
            await asyncio.sleep(self.poll_interval)

    async def poll_and_calibrate(self):
        try:
            resp = await self.client.get(f"{NEXUS_BACKEND_URL}/api/traffic/snapshot")
            if resp.status_code != 200:
                log.warning(f"Backend retorno {resp.status_code}")
                return

            data = resp.json()
            traffic_data = data.get("data", {})
            waze_jams = data.get("nationalWazeJams", [])

            # ── Calibrar peajes (legacy) ──
            for station_id, mapping in STATION_EDGE_MAP.items():
                station_traffic = traffic_data.get(station_id)
                if not station_traffic:
                    continue
                current_speed = station_traffic.get("currentSpeed")
                congestion = station_traffic.get("congestionRatio", 0)
                if current_speed is not None:
                    q_max = 2400
                    flow = q_max * 4 * congestion * (1 - congestion) if congestion < 1 else 100
                    self.controller.calibrate(
                        edge_id=mapping["edge"],
                        speed_kmh=current_speed,
                        flow_vph=round(flow),
                    )
                    self.last_data[station_id] = {
                        "speed": current_speed,
                        "congestion": congestion,
                        "flow_estimated": round(flow),
                    }

            # ── Procesar jams Waze ──
            available_networks = get_available_network_ids()
            jams_with_hash = []
            
            for jam in waze_jams:
                jam_id = jam.get("uuid", jam.get("id", "?"))
                jam_speed = self._estimate_jam_speed(jam)
                jam_level = jam.get("jamLevel", 0)
                jam_length = jam.get("length", 0)
                jam_hash = compute_jam_hash(jam)
                jam_name = jam.get("name", "Tramo")

                self.last_waze_data[jam_id] = {
                    "name": jam_name,
                    "speed_kmh": jam_speed,
                    "jamLevel": jam_level,
                    "length_m": jam_length,
                    "time_s": jam.get("time", 0),
                    "hash_id": jam_hash,
                    "has_network": jam_hash in available_networks,
                }

                jams_with_hash.append({
                    "jam": jam,
                    "hash": jam_hash,
                    "level": jam_level,
                    "length": jam_length,
                    "name": jam_name,
                    "score": jam_level * (jam_length / 1000),  # Level x km
                    "has_network": jam_hash in available_networks,
                })

            # ── Auto-switch: elegir top jam con red disponible ──
            jams_with_network = [j for j in jams_with_hash if j["has_network"]]
            jams_with_network.sort(key=lambda j: j["score"], reverse=True)

            if jams_with_network:
                top_jam = jams_with_network[0]
                top_hash = top_jam["hash"]
                top_target_network = f"waze_{top_hash}"
                current_network = getattr(self.controller, "_current_network", None)

                # Decidir si hacer switch
                if current_network != top_target_network:
                    log.info(
                        f"AUTO-SWITCH: {current_network} → {top_target_network} "
                        f"({top_jam['name'][:40]}, score={top_jam['score']:.1f})"
                    )
                    self.controller.stop()
                    success = self.controller.start(f"waze_{top_hash}")
                    if success:
                        self.last_switch = {
                            "from": current_network,
                            "to": top_target_network,
                            "jam_name": top_jam["name"],
                            "jam_level": top_jam["level"],
                            "jam_length_m": top_jam["length"],
                            "score": top_jam["score"],
                        }
                        # Esperar 2s para que SUMO estabilice antes de inyectar
                        await asyncio.sleep(2)
                    else:
                        log.warning(f"Fallo el switch a {top_target_network}")
                        return

                # ── Inyectar vehiculos ──
                target = DENSITY_BY_JAMLEVEL.get(top_jam["level"], 50)
                log.info(
                    f"Calibrando red activa: {top_jam['name'][:40]} Level={top_jam['level']} → target={target} veh"
                )
                result = self.controller.inject_vehicles(target_count=target)
                self.last_injection = {
                    "jam_id": top_hash,
                    "jam_name": top_jam["name"],
                    "level": top_jam["level"],
                    "target": target,
                    "result": result,
                }
            else:
                log.info(f"Ningun jam tiene red disponible. {len(jams_with_hash)} jams totales.")

            log.info(f"Calibrados {len(self.last_data)} peajes + {len(self.last_waze_data)} tramos Waze")

        except httpx.ConnectError:
            log.debug("Backend NEXUS no disponible")
        except Exception as e:
            log.warning(f"Error obteniendo datos del backend: {e}")

    async def _regen_loop(self):
        """Loop de regeneracion de redes cada REGEN_INTERVAL segundos."""
        # Esperar 1 minuto antes del primer regen para dejar que el sistema estabilice
        await asyncio.sleep(60)
        while True:
            try:
                await self._regenerate_networks()
            except Exception as e:
                log.warning(f"Error en regeneracion: {e}")
            await asyncio.sleep(REGEN_INTERVAL)

    async def _regenerate_networks(self):
        """Ejecutar generate_network.py en subprocess no-bloqueante."""
        if self.regen_running:
            log.info("Regeneracion ya en curso, saltando")
            return

        self.regen_running = True
        log.info("AUTO-REGEN: Iniciando regeneracion de redes desde Waze...")
        try:
            script = SCRIPTS_DIR / "generate_network.py"
            if not script.exists():
                log.warning(f"Script no encontrado: {script}")
                return

            proc = await asyncio.create_subprocess_exec(
                "python3", str(script),
                "--backend", NEXUS_BACKEND_URL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()

            if proc.returncode == 0:
                # Buscar linea de resumen
                summary = ""
                for line in stdout.decode().split("\n"):
                    if "RESUMEN" in line or "redes generadas" in line.lower():
                        summary = line.strip()
                        break
                self.last_regen = {
                    "status": "ok",
                    "summary": summary or "completado",
                }
                log.info(f"AUTO-REGEN: completada. {summary}")
            else:
                err = stderr.decode()[-300:] if stderr else "sin detalles"
                log.warning(f"AUTO-REGEN fallo: {err}")
                self.last_regen = {"status": "error", "error": err[-200:]}
        except Exception as e:
            log.warning(f"AUTO-REGEN excepcion: {e}")
            self.last_regen = {"status": "exception", "error": str(e)}
        finally:
            self.regen_running = False

    def _estimate_jam_speed(self, jam: dict) -> float:
        length_m = jam.get("length", 1000)
        time_s = jam.get("time", 60)
        if time_s > 0:
            speed_kmh = (length_m / 1000) / (time_s / 3600)
            return round(min(speed_kmh, 120), 1)
        return 40.0

    def get_waze_jam_data(self, jam_id: str) -> Optional[dict]:
        return self.last_waze_data.get(jam_id)

    def get_all_waze_data(self) -> dict:
        return self.last_waze_data

    def get_status(self) -> dict:
        return {
            "stations_calibrated": len(self.last_data),
            "waze_segments_tracked": len(self.last_waze_data),
            "available_networks": len(get_available_network_ids()),
            "current_network": getattr(self.controller, "_current_network", None),
            "last_switch": self.last_switch,
            "last_injection": self.last_injection,
            "last_regen": self.last_regen,
            "regen_running": self.regen_running,
            "toll_data": self.last_data,
            "waze_data": self.last_waze_data,
            "backend_url": NEXUS_BACKEND_URL,
            "poll_interval": self.poll_interval,
            "regen_interval": REGEN_INTERVAL,
        }
