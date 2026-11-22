# Deployment

Target: **Render** (one account, sign in with GitHub). The repo's `render.yaml` blueprint creates everything:

| Resource | Type | Plan |
|---|---|---|
| `astra-shield-db` | PostgreSQL 16 | Free (expires 30 days after creation; upgrade or recreate) |
| `astra-shield-api` | Docker web service (`backend/Dockerfile`) | Free (sleeps after 15 min idle) |
| `astra-shield-web` | Static site (`frontend/`, `npm run build` → `dist`) | Free |

## Steps

1. **Create a Render account**: https://dashboard.render.com/register → *Sign in with GitHub* → authorize Render.
2. **Grant repo access**: when asked, allow Render to access `astra-shield-ai` (or all repositories).
3. **Create the blueprint**: Dashboard → **New** → **Blueprint** → choose `astra-shield-ai` → Render reads `render.yaml` and lists the three resources → **Apply**.
4. **Wait for the first build** (about 8–12 min): the backend image installs Python packages and downloads the DE421 ephemeris; the frontend runs `npm ci && npm run build`. Order is handled automatically (the frontend reads the backend host via `fromService`).
5. **Verify**:
   - `https://astra-shield-api.onrender.com/api/health` → `{"status":"ok","db":true,"data_mode":"live"}`
   - `https://astra-shield-web.onrender.com` → dashboard loads, telemetry strip shows **LIVE** link.
   - Run the scenario (Overview → Arm → Execute) and confirm Vyomnaut 02 = 76 critical.
   If Render appended a suffix to a service name (name already taken), use the URLs shown in the dashboard.

## How the pieces connect

- **Database URL**: injected as `DATABASE_URL` (`postgres://…`); `app/config.py` rewrites it to `postgresql+asyncpg://…`.
- **Migrations + seed**: run on every container start (`alembic upgrade head && python -m app.seed`), both idempotent.
- **API location**: the static site gets `VITE_API_HOST=<backend host>` at build time; the client calls `https://<host>/api/*` and `wss://<host>/ws/live`.
- **CORS**: `CORS_ORIGIN_REGEX=https://astra-shield-[a-z0-9-]+\.onrender\.com` admits the frontend.
- **Data mode**: `DATA_MODE=live` fetches CelesTrak / NOAA SWPC with cache and fixture fallback.

## Before a live demo

Free services sleep after 15 minutes without traffic. Open the site **1–2 minutes before** presenting so the backend wakes up (first request takes ~50 s).

## Redeploys

`autoDeploy: true`: every push to `main` rebuilds both services. Manual: service page → **Manual Deploy** → *Deploy latest commit*.

## Alternatives

- **Vercel frontend**: import the repo, root `frontend/`, build `npm run build`, output `dist`, env `VITE_API_URL=https://<render-backend>`; add the Vercel URL to backend `CORS_ORIGINS`.
- **Single VM with Docker**: `git clone … && cp .env.example .env && docker compose up -d --build`, then put Caddy or nginx with HTTPS in front of port 5173.
