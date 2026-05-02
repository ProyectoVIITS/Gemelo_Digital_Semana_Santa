# ═══════════════════════════════════════════════════════════════
# SUMO Engine — Dockerfile
# Imagen para el motor de microsimulación del Gemelo Digital
# Base: Ubuntu 22.04 + SUMO 1.21 + Python 3.11 + FastAPI
# ═══════════════════════════════════════════════════════════════

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV SUMO_HOME=/usr/share/sumo
ENV PATH="${SUMO_HOME}/bin:${PATH}"

# ── 1. Dependencias del sistema + PPA oficial de SUMO ──
RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common \
    python3.11 python3.11-venv python3-pip \
    wget curl ca-certificates gnupg dirmngr \
    && add-apt-repository ppa:sumo/stable \
    && apt-get update \
    && apt-get install -y --no-install-recommends sumo sumo-tools \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ── 2. Directorio de trabajo ──
WORKDIR /app

# ── 3. Dependencias Python ──
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# ── 4. Copiar código y redes ──
COPY . .

# ── 5. Puerto FastAPI ──
EXPOSE 8100

# ── 6. Health check ──
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8100/health || exit 1

# ── 7. Arranque ──
CMD ["uvicorn", "sumo_server:app", "--host", "0.0.0.0", "--port", "8100", "--workers", "1"]
