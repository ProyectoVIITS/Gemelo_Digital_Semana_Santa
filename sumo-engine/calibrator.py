"""
Calibrador Dinámico — Bridge entre APIs de Tráfico y SUMO
═════════════════════════════════════════════════════════

Recibe datos del backend NEXUS (que fusiona Google Routes + Waze TVT + HERE)
y calibra la simulación SUMO en tiempo real.

Dos modos de calibración:
  1. Peajes (STATION_EDGE_MAP): para redes de corredores estáticos
  2. Waze Segments (jam.speed/jam.level): para vías congestionadas dinámicas

El calibrador ajusta:
  - Velocidad máxima del tramo (setMaxSpeed)
  - Flujo de inyección (vía calibrator objects o route injection via TraCI)
"""

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("sumo-calibrator")

# ── Mapeo: Station ID → SUMO Edge ID (para redes de peajes) ──
# Estos edge IDs se obtienen de la red .net.xml generada desde OSM
# Se actualizarán una vez que la red esté curada en netedit
STATION_EDGE_MAP = {
    "C3-01": {"edge": "chusaca_main", "name": "CHUSACÁ", "lat": 4.537553, "lng": -74.272106},
    "C3-02": {"edge": "chinauta_main", "name": "CHINAUTA", "lat": 4.269378, "lng": -74.500107},
    "C3-03": {"edge": "pubenza_main", "name": "PUBENZA", "lat": 4.403316, "lng": -74.731464},
    "C3-04": {"edge": "flandes_main", "name": "FLANDES", "lat": 4.192173, "lng": -74.861153},
}

NEXUS_BACKEND_URL = os.getenv("NEXUS_BACKEND_URL", "http://localhost:3000")
NETWORK_DIR = Path(__file__).parent / "networks"


class TrafficCalibrator:
    """
    Recibe datos del backend Node.js existente (que ya fusiona Google+Waze+HERE)
    y los inyecta en SUMO vía el controlador.
    
    Para vías congestionadas (Waze segments), lee directamente los datos del jam
    transmitidos por el WebSocket del backend NEXUS.
    """

    def __init__(self, controller):
        self.controller = controller
        self.client = httpx.AsyncClient(timeout=10)
        self.last_data = {}
        self.last_waze_data = {}
        self.poll_interval = float(os.getenv("CALIBRATOR_INTERVAL", "30"))

    async def start(self):
        """Loop de calibración continua."""
        log.info(f"Calibrador iniciado — polling cada {self.poll_interval}s desde {NEXUS_BACKEND_URL}")
        while True:
            try:
                await self.poll_and_calibrate()
            except Exception as e:
                log.warning(f"Error en ciclo de calibración: {e}")
            await asyncio.sleep(self.poll_interval)

    async def poll_and_calibrate(self):
        """Obtener datos del backend NEXUS y calibrar la simulación activa."""
        try:
            resp = await self.client.get(f"{NEXUS_BACKEND_URL}/api/traffic/snapshot")
            if resp.status_code != 200:
                return

            data = resp.json()
            traffic_data = data.get("data", {})
            waze_jams = data.get("nationalWazeJams", [])

            # ── Calibrar peajes (si la red activa es un corredor) ──
            network_id = self.controller.is_running and getattr(self.controller, '_current_network', None)
            
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
                        "source": station_traffic.get("sources", []),
                    }

            # ── Calibrar vías congestionadas Waze ──
            # Cada jam tiene velocidad, longitud de cola y tiempo de travesía
            # que usamos para ajustar la red SUMO correspondiente
            for jam in waze_jams:
                jam_speed = self._estimate_jam_speed(jam)
                jam_level = jam.get("jamLevel", 0)
                jam_length = jam.get("length", 0)

                self.last_waze_data[jam.get("uuid", jam.get("id", "?"))] = {
                    "name": jam.get("name", "Tramo"),
                    "speed_kmh": jam_speed,
                    "jamLevel": jam_level,
                    "length_m": jam_length,
                    "time_s": jam.get("time", 0),
                }

            total = len(self.last_data) + len(self.last_waze_data)
            if total > 0:
                log.info(f"Calibrados {len(self.last_data)} peajes + {len(self.last_waze_data)} tramos Waze")

        except httpx.ConnectError:
            log.debug("Backend NEXUS no disponible — usando parámetros base de SUMO")
        except Exception as e:
            log.warning(f"Error obteniendo datos del backend: {e}")

    def _estimate_jam_speed(self, jam: dict) -> float:
        """Estimar velocidad del jam a partir de los datos Waze."""
        length_m = jam.get("length", 1000)
        time_s = jam.get("time", 60)
        if time_s > 0:
            speed_kmh = (length_m / 1000) / (time_s / 3600)
            return round(min(speed_kmh, 120), 1)
        return 40.0

    def get_waze_jam_data(self, jam_id: str) -> Optional[dict]:
        """Obtener datos de calibración de un jam específico."""
        return self.last_waze_data.get(jam_id)

    def get_all_waze_data(self) -> dict:
        """Todos los datos de jams Waze activos."""
        return self.last_waze_data

    def get_status(self) -> dict:
        """Estado actual de la calibración."""
        return {
            "stations_calibrated": len(self.last_data),
            "waze_segments_tracked": len(self.last_waze_data),
            "toll_data": self.last_data,
            "waze_data": self.last_waze_data,
            "backend_url": NEXUS_BACKEND_URL,
            "poll_interval": self.poll_interval,
        }
