# Design decisions

Simplest-reasonable choices made where the brief was ambiguous.

| # | Decision | Rationale |
|---|---|---|
| 1 | Logic ported from the earlier Streamlit prototype (`astra_shield/`) | Preserves validated team work (SAA model, GOES classifier, Aditya-L1 loader). |
| 2 | Offline TLE and GOES fixtures captured 2026-11-21 | Demo must run with no internet. |
| 3 | Local non-Docker runs use SQLite (`sqlite+aiosqlite`) via `backend/.env`; Docker/CI/prod use PostgreSQL 16 | Postgres not installed on the dev machine; models stay portable (JSON type with JSONB variant on Postgres). |
| 4 | Eclipse via Skyfield `is_sunlit` + DE421 when `EPHEMERIS_PATH` exists; analytic low-precision Sun model otherwise | DE421 is bundled in the Docker image; local runs still work offline without it. |
| 5 | Dependencies pinned to versions verified on Python 3.14 (local) and used on 3.12 (Docker) | Older pins lack Python 3.14 wheels. |
| 6 | SQLAlchemy pinned to 2.0.x | Windows Smart App Control blocks the 2.1 Cython extension; 2.0 falls back to pure Python automatically. |
| 7 | A predicted SAA "pass" = contiguous in-polygon window with peak intensity >= 0.2 (`SAA_PASS_MIN_PEAK`) | The spec rectangle (lat -50..0, lon -90..+40) is clipped ~16x/day; filtering shallow clips yields ~8 significant passes/day, close to real ISS behaviour, and leaves EVA windows. |
