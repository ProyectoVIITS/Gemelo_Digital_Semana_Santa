"""
Calibrador Dinamico v4 — Multi-Instancia
═════════════════════════════════════════════════════════════════
Cambios v4 sobre v3:
  - Habla directamente con SUMOPool (no más adapter sync)
  - Top N jams por score (delay_ratio × km) → todos arrancan instancia
    delay_ratio = time / historicTime (multiplicador visible en frontend).
    Fallback a (jamLevel × km) si historicTime ≤ 0 o no existe.
  - Inyecta densidad en TODAS las instancias activas (no solo en el #1)
  - pool.set_top_jam(top_hash) para que /ws/sumo legacy apunte ahí
  - Toll data se trackea para status pero NO se calibra en TraCI
    (el pool es waze-only; los edges de peaje no existen en las redes activas)
  - Inyección via pool.inject_into() para tomar el lock global TraCI
  - Auto-regeneracion cada 10 min sin cambios
"""

import asyncio
import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("sumo-calibrator")

NEXUS_BACKEND_URL = os.getenv("NEXUS_BACKEND_URL", "http://localhost:3000")
NETWORK_DIR = Path(__file__).parent / "networks"
CONFIG_DIR = Path(__file__).parent / "config"
SCRIPTS_DIR = Path(__file__).parent / "scripts"
WAZE_MANIFEST_PATH = NETWORK_DIR / "waze_segments" / "manifest.json"

REGEN_INTERVAL = float(os.getenv("REGEN_INTERVAL", "600"))
TOP_N_JAMS = int(os.getenv("TOP_N_JAMS", "20"))

DENSITY_BY_JAMLEVEL = {
    0: 20,
    1: 40,
    2: 80,
    3: 140,
    4: 220,
    5: 320,
}

# Mantenemos para reportar stations en /api/calibrator/status
STATION_EDGE_MAP = {
    "C3-01": {"edge": "chusaca_main", "name": "CHUSACA", "lat": 4.537553, "lng": -74.272106},
    "C3-02": {"edge": "chinauta_main", "name": "CHINAUTA", "lat": 4.269378, "lng": -74.500107},
    "C3-03": {"edge": "pubenza_main", "name": "PUBENZA", "lat": 4.403316, "lng": -74.731464},
    "C3-04": {"edge": "flandes_main", "name": "FLANDES", "lat": 4.192173, "lng": -74.861153},
}


def get_available_network_hashes() -> set:
    """Hashes de redes Waze con .sumocfg generado."""
    if not CONFIG_DIR.exists():
        return set()
    return {
        cfg.stem.replace("waze_", "")
        for cfg in CONFIG_DIR.glob("waze_*.sumocfg")
    }


def compute_jam_hash(jam: dict) -> str:
    """Replica get_jam_id() de generate_network.py."""
    line = jam.get("line", [])
    if not line:
        return hashlib.md5(json.dumps(jam.get("name", "")).encode()).hexdigest()[:12]
    key_points = [line[0], line[len(line) // 2], line[-1]]
    key_str = "|".join(f"{p.get('y',0):.4f},{p.get('x',0):.4f}" for p in key_points)
    return hashlib.md5(key_str.encode()).hexdigest()[:12]


class TrafficCalibrator:
    def __init__(self, pool):
        self.pool = pool
        self.client = httpx.AsyncClient(timeout=10)
        self.poll_interval = float(os.getenv("CALIBRATOR_INTERVAL", "30"))
        self.last_data: dict = {}             # toll station data (display only)
        self.last_waze_data: dict = {}        # all Waze jams del último poll
        self.jam_levels_by_hash: dict = {}    # hash → jamLevel (para target densidad)
        self.last_top_jams: list = []         # snapshot top del último ciclo
        self.last_pool_actions: list = []     # qué arrancó/falló este ciclo
        self.last_injection: dict = {}        # resumen de inyección por ciclo
        self.last_regen: Optional[dict] = None
        self.regen_running: bool = False

    async def start(self):
        log.info(
            f"Calibrador v4 — poll {self.poll_interval}s desde {NEXUS_BACKEND_URL} "
            f"| top={TOP_N_JAMS} | regen={REGEN_INTERVAL}s"
        )
        await asyncio.sleep(5)
        asyncio.create_task(self._regen_loop())
        while True:
            try:
                await self.poll_and_calibrate()
            except Exception as e:
                log.warning(f"Error en ciclo: {e}")
            await asyncio.sleep(self.poll_interval)

    async def poll_and_calibrate(self):
        # 1) Fetch backend
        try:
            resp = await self.client.get(f"{NEXUS_BACKEND_URL}/api/traffic/snapshot")
            if resp.status_code != 200:
                log.warning(f"Backend retorno {resp.status_code}")
                return
            data = resp.json()
        except httpx.ConnectError:
            log.debug("Backend NEXUS no disponible")
            return
        except Exception as e:
            log.warning(f"Error obteniendo datos: {e}")
            return

        traffic_data = data.get("data", {})
        waze_jams = data.get("nationalWazeJams", [])

        # 2) Toll station data (solo display, sin TraCI)
        for station_id, mapping in STATION_EDGE_MAP.items():
            st = traffic_data.get(station_id)
            if not st:
                continue
            current_speed = st.get("currentSpeed")
            congestion = st.get("congestionRatio", 0)
            if current_speed is not None:
                q_max = 2400
                flow = q_max * 4 * congestion * (1 - congestion) if congestion < 1 else 100
                self.last_data[station_id] = {
                    "name": mapping["name"],
                    "speed": current_speed,
                    "congestion": congestion,
                    "flow_estimated": round(flow),
                }

        # 3) Calcular score y rank de cada jam con red disponible
        available = get_available_network_hashes()
        jams_ranked = []
        self.last_waze_data = {}

        for jam in waze_jams:
            jam_id = jam.get("uuid", jam.get("id", "?"))
            jam_hash = compute_jam_hash(jam)
            jam_level = jam.get("jamLevel", 0)
            jam_length = jam.get("length", 0)
            jam_name = jam.get("name", "Tramo")
            jam_speed = self._estimate_jam_speed(jam)

            # Score híbrido: delay_ratio × km cuando hay datos históricos,
            # fallback a jamLevel × km en caso contrario. delay_ratio es el
            # mismo multiplicador que el frontend muestra en la tabla.
            jam_time = jam.get("time", 0)
            jam_historic = jam.get("historicTime", 0)
            if jam_historic and jam_historic > 0:
                delay_ratio = jam_time / jam_historic
                score = delay_ratio * (jam_length / 1000)
                score_source = "delay"
            else:
                delay_ratio = None
                score = jam_level * (jam_length / 1000)
                score_source = "level"

            has_network = jam_hash in available

            self.last_waze_data[jam_id] = {
                "name": jam_name,
                "speed_kmh": jam_speed,
                "jamLevel": jam_level,
                "length_m": jam_length,
                "time_s": jam_time,
                "historic_time_s": jam_historic,
                "delay_ratio": round(delay_ratio, 2) if delay_ratio is not None else None,
                "hash_id": jam_hash,
                "has_network": has_network,
                "score": round(score, 2),
                "score_source": score_source,
            }

            if has_network:
                jams_ranked.append({
                    "hash": jam_hash,
                    "name": jam_name,
                    "level": jam_level,
                    "length_m": jam_length,
                    "score": score,
                    "score_source": score_source,
                    "delay_ratio": delay_ratio,
                })

        jams_ranked.sort(key=lambda j: j["score"], reverse=True)
        top_jams = jams_ranked[:TOP_N_JAMS]
        self.last_top_jams = top_jams

        if not top_jams:
            log.info(
                f"Sin jams con red disponible ({len(jams_ranked)} candidatos, "
                f"{len(available)} redes generadas)"
            )
            return

        # 4) Cache de level por hash (para TODOS los rankeados, no solo top)
        # Instancias activas que cayeron fuera del top siguen necesitando
        # densidad correcta hasta que las desaloje el housekeeping.
        for j in jams_ranked:
            self.jam_levels_by_hash[j["hash"]] = j["level"]

        # 5) Asegurar instancia en pool para cada top jam (idempotente)
        actions = []
        for j in top_jams:
            cfg = CONFIG_DIR / f"waze_{j['hash']}.sumocfg"
            result = await self.pool.start_instance(j["hash"], cfg)
            entry = {
                "hash": j["hash"],
                "name": j["name"][:40],
                "score": round(j["score"], 1),
                "status": result.get("status") or ("failed" if not result.get("ok") else "ok"),
            }
            if not result.get("ok"):
                entry["error"] = result.get("error")
                log.warning(
                    f"No se pudo arrancar {j['hash']} ({j['name'][:40]}): {result.get('error')}"
                )
            actions.append(entry)
        self.last_pool_actions = actions

        # 6) Marcar top #1
        top_hash = top_jams[0]["hash"]
        previous_top = self.pool.top_jam_hash
        if previous_top != top_hash:
            top_meta = top_jams[0]
            extras = []
            if top_meta.get("delay_ratio") is not None:
                extras.append(f"delay={top_meta['delay_ratio']:.1f}x")
            extras.append(f"src={top_meta.get('score_source', '?')}")
            log.info(
                f"TOP cambia: {previous_top} → {top_hash} "
                f"({top_meta['name'][:40]}, score={top_meta['score']:.1f}, {', '.join(extras)})"
            )
            self.pool.set_top_jam(top_hash)

        # 7) Inyectar densidad en TODAS las instancias activas
        injection_summary = []
        for inst in self.pool.active_instances():
            level = self.jam_levels_by_hash.get(inst.jam_hash, 0)
            target = DENSITY_BY_JAMLEVEL.get(level, 20)
            result = await self.pool.inject_into(inst.jam_hash, target)
            injection_summary.append({
                "hash": inst.jam_hash,
                "level": level,
                "target": target,
                "injected": result.get("injected", 0),
                "current_before": result.get("current_before"),
            })

        total_injected = sum(s["injected"] for s in injection_summary)
        self.last_injection = {
            "instances": len(injection_summary),
            "total_injected": total_injected,
            "details": injection_summary,
        }

        log.info(
            f"Ciclo OK — top={top_jams[0]['name'][:40]} "
            f"| pool: {len(self.pool.active_instances())}/{self.pool.max_instances} activas "
            f"| inyectados: {total_injected}"
        )

    async def _regen_loop(self):
        await asyncio.sleep(60)
        while True:
            try:
                await self._regenerate_networks()
            except Exception as e:
                log.warning(f"Error en regeneracion: {e}")
            await asyncio.sleep(REGEN_INTERVAL)

    async def _regenerate_networks(self):
        if self.regen_running:
            log.info("Regeneracion ya en curso, saltando")
            return
        self.regen_running = True
        log.info("AUTO-REGEN: regenerando redes desde Waze...")
        try:
            script = SCRIPTS_DIR / "generate_network.py"
            if not script.exists():
                log.warning(f"Script no encontrado: {script}")
                return
            proc = await asyncio.create_subprocess_exec(
                "python3", str(script), "--backend", NEXUS_BACKEND_URL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode == 0:
                summary = ""
                for line in stdout.decode().split("\n"):
                    if "RESUMEN" in line or "redes generadas" in line.lower():
                        summary = line.strip()
                        break
                self.last_regen = {"status": "ok", "summary": summary or "completado"}
                log.info(f"AUTO-REGEN: {summary}")
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
            "stations_tracked": len(self.last_data),
            "waze_segments_tracked": len(self.last_waze_data),
            "available_networks": len(get_available_network_hashes()),
            "pool_active": len(self.pool.active_instances()),
            "pool_max": self.pool.max_instances,
            "top_jam_hash": self.pool.top_jam_hash,
            "top_jams": self.last_top_jams,
            "last_pool_actions": self.last_pool_actions,
            "last_injection": self.last_injection,
            "last_regen": self.last_regen,
            "regen_running": self.regen_running,
            "toll_data": self.last_data,
            "waze_data": self.last_waze_data,
            "backend_url": NEXUS_BACKEND_URL,
            "poll_interval": self.poll_interval,
            "regen_interval": REGEN_INTERVAL,
            "top_n": TOP_N_JAMS,
        }
