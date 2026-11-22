FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-dev.txt ./
RUN pip install -r requirements-dev.txt

# Bundle the JPL DE421 ephemeris at build time (never downloaded at runtime).
# Non-fatal: if JPL is unreachable the engine falls back to its analytic eclipse model.
RUN mkdir -p /opt/ephem && (curl -fsSL --retry 3 -o /opt/ephem/de421.bsp \
      https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de421.bsp \
      || (rm -f /opt/ephem/de421.bsp && echo "DE421 unavailable; using analytic eclipse model"))
ENV EPHEMERIS_PATH=/opt/ephem/de421.bsp

COPY . .

EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
