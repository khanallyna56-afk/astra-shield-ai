"""Service layer: joins the engines with the database. Routers stay thin.

Mission clock
-------------
Normally the mission clock is real UTC (or the TLE epoch if the TLE is stale).
When a scenario (the solar-flare demo) is active, the clock is frozen at the
scenario time and the injected hazards override live space data, so the
on-screen numbers are deterministic.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.data import flare_client, tle_client
from app.data.cache import get_any, set_cached
from app.engines import biomedical as bio
from app.engines import decision as dec
from app.engines import scheduler as sch
from app.engines.space import SpaceEngine, classify_flare, flare_factor, next_saa_pass
from app.models import Alert, Astronaut, CrewReading, RiskScore, Scenario, ScheduleBlock, SpaceSnapshot

PARTICLE_WATCH = timedelta(hours=2)   # EVA hazard window after an >= M flare
_engines: dict[tuple[str, str], SpaceEngine] = {}
SCENARIO: dict | None = None          # active scenario overrides (in-process)


# ------------------------------------------------------------------ helpers
def aware(dt: datetime | None) -> datetime | None:
    """SQLite returns naive datetimes; all stored times are UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def iso(dt: datetime | None) -> str | None:
    return aware(dt).isoformat().replace("+00:00", "Z") if dt else None


async def get_engine(session: AsyncSession | None = None) -> SpaceEngine:
    tle = await tle_client.get_tle(session)
    key = (tle["line1"], tle["line2"])
    if key not in _engines:
        _engines.clear()
        _engines[key] = SpaceEngine(tle["name"], tle["line1"], tle["line2"], tle["source"])
    eng = _engines[key]
    eng.source = tle["source"]
    return eng


def mission_now(engine: SpaceEngine) -> datetime:
    if SCENARIO:
        return SCENARIO["sim_now"]
    return engine.reference_time()


# ------------------------------------------------------------------- space
async def flare_now(session: AsyncSession | None) -> dict:
    data = await flare_client.get_flares(session)
    last = flare_client.latest(data)
    cls = classify_flare(last["flux"]) if data.get("units") == "W/m^2" else "n/a"
    out = {"flare_class": cls, "flare_flux": last["flux"], "time": last["time"],
           "source": data["source"], "instrument": data.get("instrument"), "units": data.get("units")}
    if SCENARIO:
        out.update(flare_class=SCENARIO["flare_class"], flare_flux=SCENARIO["flare_flux"],
                   source="Scenario injection (demo)", time=iso(SCENARIO["sim_now"]))
    return out


async def space_state(session: AsyncSession | None) -> dict:
    eng = await get_engine(session)
    now = mission_now(eng)
    p = eng.state_at(now)
    flare = await flare_now(session)
    passes = eng.predict_saa_passes(24, now - timedelta(minutes=30))
    nxt = next_saa_pass(passes, now)
    in_saa, intensity = p.in_saa, p.saa_intensity
    if SCENARIO:
        in_saa, intensity = True, SCENARIO["saa_intensity"]
    nxt_out = None
    if nxt:
        active = nxt["start"] <= now < nxt["end"]
        nxt_out = {"start": iso(nxt["start"]), "end": iso(nxt["end"]), "peak_intensity": nxt["peak_intensity"],
                   "active": active, "minutes_until": 0.0 if active else round((nxt["start"] - now).total_seconds() / 60, 1)}
    return {
        "ts": iso(now), "lat": p.lat, "lon": p.lon, "alt_km": p.alt_km, "sunlit": p.sunlit,
        "in_saa": in_saa, "saa_intensity": round(intensity, 3),
        "flare_class": flare["flare_class"], "flare_flux": flare["flare_flux"], "flare_source": flare["source"],
        "next_saa_pass": nxt_out,
        "sunrises_24h": eng.sunrise_count(24, now.replace(second=0)),
        "orbits_per_day": eng.orbits_per_day,
        "tle_source": eng.source, "tle_epoch": iso(eng.epoch), "eclipse_model": eng.eclipse_model,
        "data_mode": get_settings().data_mode, "demo_active": SCENARIO is not None,
    }


# -------------------------------------------------------------------- crew
async def latest_readings(session: AsyncSession) -> list[tuple[Astronaut, CrewReading]]:
    crew = (await session.execute(select(Astronaut).order_by(Astronaut.id))).scalars().all()
    out = []
    for a in crew:
        r = (await session.execute(select(CrewReading).where(CrewReading.astronaut_id == a.id)
                                   .order_by(CrewReading.ts.desc()).limit(1))).scalar_one_or_none()
        if r:
            out.append((a, r))
    return out


def _score(a: Astronaut, r: CrewReading, saa_intensity: float, ffactor: float, sunrises: float) -> dict:
    rad = bio.radiation_score(saa_intensity, ffactor, a.location)
    comp = bio.sleep_components(r.sleep_debt_h, r.hrv_ms, a.hrv_baseline, r.fatigue_sp, sunrises)
    cr = dec.assess(a.id, a.callsign, rad, comp.total)
    return {"risk": cr, "components": comp}


async def crew_risk(session: AsyncSession, state: dict | None = None) -> tuple[list[dict], dict]:
    """Current per-astronaut risk. Returns (crew rows, space state)."""
    state = state or await space_state(session)
    ff = flare_factor(state["flare_class"])
    rows = []
    for a, r in await latest_readings(session):
        s = _score(a, r, state["saa_intensity"], ff, state["orbits_per_day"])
        cr: dec.CrewRisk = s["risk"]
        c = s["components"]
        rows.append({
            "id": a.id, "callsign": a.callsign, "name": a.name, "role": a.role, "location": a.location,
            "hrv_baseline": a.hrv_baseline, "radiation": cr.radiation, "sleep_deficit": cr.sleep_deficit,
            "risk": cr.risk, "status": cr.status,
            "sleep_components": {"debt": round(c.debt, 1), "hrv": round(c.hrv, 1), "fatigue": round(c.fatigue, 1),
                                 "circadian": round(c.circadian, 1)},
            "reading": {"ts": iso(r.ts), "sleep_hours": r.sleep_hours, "sleep_debt_h": r.sleep_debt_h,
                        "hrv_ms": r.hrv_ms, "fatigue_sp": r.fatigue_sp, "heart_rate": r.heart_rate},
            "dose_rate_msv_h": bio.dose_rate_msv_h(state["saa_intensity"], ff, a.location),
        })
    return rows, state


def _crew_objs(rows: list[dict]) -> list[dec.CrewRisk]:
    return [dec.CrewRisk(r["id"], r["callsign"], r["radiation"], r["sleep_deficit"], r["risk"], r["status"])
            for r in rows]


# ---------------------------------------------------------------- schedule
async def latest_version(session: AsyncSession) -> int:
    return (await session.execute(select(func.max(ScheduleBlock.version)))).scalar() or 0


async def load_schedule(session: AsyncSession, version: int) -> dict[str, list[sch.Block]]:
    rows = (await session.execute(
        select(ScheduleBlock, Astronaut.callsign).join(Astronaut, Astronaut.id == ScheduleBlock.astronaut_id)
        .where(ScheduleBlock.version == version).order_by(Astronaut.id, ScheduleBlock.start))).all()
    out: dict[str, list[sch.Block]] = {}
    for b, cs in rows:
        out.setdefault(cs, []).append(sch.Block(aware(b.start), aware(b.end), b.activity, b.is_replanned, b.reason))
    return out


async def eva_assignee(session: AsyncSession, now: datetime) -> str | None:
    sched = await load_schedule(session, await latest_version(session))
    for cs, tl in sched.items():
        if any(b.activity == "eva" and b.end > now for b in tl):
            return cs
    return None


def _diff_json(d: dict) -> dict:
    return {k: (iso(v) if isinstance(v, datetime) else v) for k, v in d.items()}


async def schedule_payload(session: AsyncSession, version: int) -> dict:
    sched = await load_schedule(session, version)
    diff = (await get_any(session, f"schedule_diff:{version}") or {}).get("diff", []) if version else []
    eng = await get_engine(session)
    starts = [b.start for tl in sched.values() for b in tl]
    t0 = min(starts) if starts else mission_now(eng)
    passes = eng.predict_saa_passes(24, t0.replace(second=0, microsecond=0))
    return {
        "version": version,
        "is_baseline": version == 0,
        "crew": [{"callsign": cs, "blocks": [{"start": iso(b.start), "end": iso(b.end), "activity": b.activity,
                                             "is_replanned": b.is_replanned, "reason": b.reason} for b in tl]}
                 for cs, tl in sched.items()],
        "saa_passes": [{"start": iso(p["start"]), "end": iso(p["end"]), "peak_intensity": p["peak_intensity"]}
                       for p in passes],
        "diff": diff,
    }


async def replan(session: AsyncSession) -> dict:
    """Re-plan from the baseline using current risk and predicted SAA passes; store as a new version."""
    rows, state = await crew_risk(session)
    eng = await get_engine(session)
    now = mission_now(eng)
    baseline = await load_schedule(session, 0)
    t0 = min(b.start for tl in baseline.values() for b in tl)
    passes = [(p["start"], p["end"]) for p in eng.predict_saa_passes(24, t0.replace(second=0, microsecond=0))]
    hazards = [(now, now + PARTICLE_WATCH)] if dec.flare_at_least(state["flare_class"], "M") else []
    debt = {r["callsign"]: r["reading"]["sleep_debt_h"] for r in rows}
    result = sch.replan(baseline, passes, _crew_objs(rows), debt, now=now, hazards=hazards)

    version = await latest_version(session) + 1
    ids = {r["callsign"]: r["id"] for r in rows}
    for cs, tl in result.schedule.items():
        session.add_all(ScheduleBlock(astronaut_id=ids[cs], start=b.start, end=b.end, activity=b.activity,
                                      version=version, is_replanned=b.is_replanned, reason=b.reason) for b in tl)
    await session.commit()
    await set_cached(session, f"schedule_diff:{version}", {"diff": [_diff_json(d) for d in result.diff]})
    return await schedule_payload(session, version)


# --------------------------------------------------------- actions/alerts
async def current_actions(session: AsyncSession, rows: list[dict], state: dict) -> list[dec.Action]:
    nxt = state["next_saa_pass"]
    eng = await get_engine(session)
    return dec.decide(_crew_objs(rows), in_saa=state["in_saa"],
                      minutes_to_next_saa=nxt["minutes_until"] if nxt else None,
                      flare_class=state["flare_class"], eva_assignee=await eva_assignee(session, mission_now(eng)))


async def record_alerts(session: AsyncSession, actions: list[dec.Action], now: datetime) -> list[Alert]:
    """Write one alerts row per new action; skip if an identical unacknowledged alert already exists."""
    new = []
    for a in actions:
        msg = f"{a.target}: {a.reason}"
        exists = (await session.execute(select(Alert.id).where(
            Alert.action_type == a.type, Alert.message == msg, Alert.acknowledged.is_(False)).limit(1))).first()
        if exists:
            continue
        al = Alert(ts=now, severity=a.severity, astronaut_id=a.astronaut_id, action_type=a.type, message=msg,
                   acknowledged=False)
        session.add(al)
        new.append(al)
    await session.commit()
    return new


def alert_json(a: Alert, callsigns: dict[int, str] | None = None) -> dict:
    return {"id": a.id, "ts": iso(a.ts), "severity": a.severity, "astronaut_id": a.astronaut_id,
            "callsign": (callsigns or {}).get(a.astronaut_id), "action_type": a.action_type,
            "message": a.message, "acknowledged": a.acknowledged}


async def list_alerts(session: AsyncSession, limit: int = 200) -> list[dict]:
    cs = dict((await session.execute(select(Astronaut.id, Astronaut.callsign))).all())
    rows = (await session.execute(select(Alert).order_by(Alert.ts.desc(), Alert.id.desc()).limit(limit))).scalars()
    return [alert_json(a, cs) for a in rows]


# -------------------------------------------------------------- snapshots
async def tick(session: AsyncSession) -> dict:
    """Evaluate everything once: persist a space snapshot, risk rows and new alerts. Returns a live payload."""
    rows, state = await crew_risk(session)
    now = datetime.fromisoformat(state["ts"].replace("Z", "+00:00"))
    session.add(SpaceSnapshot(ts=now, lat=state["lat"], lon=state["lon"], alt_km=state["alt_km"],
                              sunlit=state["sunlit"], in_saa=state["in_saa"], saa_intensity=state["saa_intensity"],
                              flare_class=state["flare_class"], flare_flux=state["flare_flux"] or 0.0))
    session.add_all(RiskScore(astronaut_id=r["id"], ts=now, radiation=r["radiation"], sleep_deficit=r["sleep_deficit"],
                              risk=r["risk"], status=r["status"]) for r in rows)
    actions = await current_actions(session, rows, state)
    await record_alerts(session, actions, now)
    return await live_payload(session, rows, state, actions)


async def live_payload(session: AsyncSession, rows=None, state=None, actions=None) -> dict:
    if rows is None:
        rows, state = await crew_risk(session)
    if actions is None:
        actions = await current_actions(session, rows, state)
    alerts = [a for a in await list_alerts(session, 50) if not a["acknowledged"]]
    return {
        "type": "tick", "ts": state["ts"], "space": state, "crew": rows,
        "actions": [a.to_dict() for a in actions],
        "lighting": dec.lighting_state(actions, [r["callsign"] for r in rows]),
        "alerts": alerts[:20], "any_red": any(r["status"] == "red" for r in rows),
        "demo_active": SCENARIO is not None,
    }


async def backfill_history(session: AsyncSession, hours: int = 24, step_min: int = 15) -> int:
    """If no risk history exists, compute it from the real orbit over the last ``hours`` (no flares)."""
    if (await session.execute(select(RiskScore.id).limit(1))).first():
        return 0
    eng = await get_engine(session)
    end = eng.reference_time().replace(second=0)
    track = eng.ground_track(hours, end - timedelta(hours=hours), step_s=step_min * 60)
    readings = await latest_readings(session)
    n = 0
    for p in track:
        for a, r in readings:
            s = _score(a, r, p.saa_intensity, 0.0, eng.orbits_per_day)["risk"]
            session.add(RiskScore(astronaut_id=a.id, ts=p.ts, radiation=s.radiation, sleep_deficit=s.sleep_deficit,
                                  risk=s.risk, status=s.status))
            n += 1
    await session.commit()
    return n


async def risk_history(session: AsyncSession, hours: int) -> list[dict]:
    latest = (await session.execute(select(func.max(RiskScore.ts)))).scalar()
    if latest is None:
        return []
    since = aware(latest) - timedelta(hours=hours)
    rows = (await session.execute(
        select(RiskScore, Astronaut.callsign).join(Astronaut, Astronaut.id == RiskScore.astronaut_id)
        .where(RiskScore.ts >= since).order_by(RiskScore.ts))).all()
    out: dict[str, dict] = {}
    for r, cs in rows:
        s = out.setdefault(cs, {"callsign": cs, "astronaut_id": r.astronaut_id, "points": []})
        s["points"].append({"ts": iso(r.ts), "risk": r.risk, "radiation": r.radiation,
                            "sleep_deficit": r.sleep_deficit, "status": r.status})
    return list(out.values())


async def cumulative_dose(session: AsyncSession, astronaut: Astronaut, hours: int = 72) -> dict:
    """Simulated cumulative dose over the last ``hours`` along the real ground track (10-min steps)."""
    eng = await get_engine(session)
    end = mission_now(eng).replace(second=0)
    step_h = 1 / 6
    track = eng.ground_track(hours, end - timedelta(hours=hours), step_s=600)
    total, series = 0.0, []
    for i, p in enumerate(track):
        total += bio.dose_rate_msv_h(p.saa_intensity, 0.0, astronaut.location) * step_h
        if i % 6 == 0:
            series.append({"ts": iso(p.ts), "msv": round(total, 4)})
    if SCENARIO:   # the injected flare adds to the latest point
        total += bio.dose_rate_msv_h(SCENARIO["saa_intensity"], flare_factor(SCENARIO["flare_class"]),
                                     astronaut.location) * step_h
        series.append({"ts": iso(end), "msv": round(total, 4)})
    return {"total_msv": round(total, 3), "series": series, "simulated": True}


# --------------------------------------------------------------- scenarios
async def clear_dynamic(session: AsyncSession) -> None:
    """Drop replanned schedules, alerts, history and scenarios (keeps crew, readings, baseline)."""
    global SCENARIO
    SCENARIO = None
    await session.execute(delete(ScheduleBlock).where(ScheduleBlock.version > 0))
    for m in (Alert, RiskScore, SpaceSnapshot, Scenario):
        await session.execute(delete(m))
    await session.commit()
