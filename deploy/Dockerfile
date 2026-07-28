# LARE backend — single image that runs the gateway + all 26 services under
# supervisord, mirroring run-all.ps1. Build context is the REPO ROOT so we can
# copy both backend/ and the shared lare_common library.
#
#   docker build -f deploy/Dockerfile -t lare-backend .
#
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# supervisor runs the 27 processes; curl is used by the healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends supervisor curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Python deps (one layer, cached unless requirements change).
COPY deploy/requirements-all.txt /app/deploy/requirements-all.txt
RUN pip install -r /app/deploy/requirements-all.txt

# 2) Shared library, installed as a real package so `import lare_common` works
#    from every service working directory.
COPY backend/libs /app/backend/libs
RUN pip install /app/backend/libs

# 3) Application code (services, registry, keys mount at runtime — not baked in).
COPY backend/services   /app/backend/services
COPY backend/services.txt /app/backend/services.txt

# 4) Entrypoint generates the supervisord config from services.txt, runs
#    init-db for every service, then launches supervisord.
COPY deploy/entrypoint.sh /app/deploy/entrypoint.sh
RUN chmod +x /app/deploy/entrypoint.sh

EXPOSE 8000
# Gateway health is the whole-stack liveness signal.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["/app/deploy/entrypoint.sh"]
