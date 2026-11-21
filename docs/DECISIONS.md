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
| 8 | Radiation weights: base 10, SAA 40, flare 40; sleep weights: debt .40, HRV .25, fatigue .25, circadian .10. Demo injects X2.1 flare + SAA intensity 0.80 | Back-solved so the demo yields Vyomnaut 02 = 76 RED, 01 = 61 AMBER, 03 = 48 AMBER (safest EVA candidate) exactly, while normal orbit keeps everyone GREEN to low AMBER. |
| 9 | Demo scenario clock anchors to the start of the next SAA pass *cluster* (first pass after a >= 3 h gap); baseline schedule re-anchored 1 h earlier | With wall-clock anchoring the EVA could only be reassigned ~73% of the time (orbit phase vs crew sleep). Orbit anchoring succeeded at 336/336 start times over a week. |
| 10 | Responses are plain dicts built in `services.py` (no separate `schemas.py`); OpenAPI still documents all routes | Keeps one source of truth for payload shape during the hackathon; typed client lives in the frontend. |
| 11 | During an active scenario the mission clock is frozen and injected hazards override live space data | Deterministic on-screen numbers for the demo. A 60 s ticker persists snapshots, risk rows and de-duplicated alerts otherwise. |
