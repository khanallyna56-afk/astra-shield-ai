"""API and WebSocket tests against a seeded SQLite database (offline data)."""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"status": "ok", "db": True, "data_mode": "offline"}


def test_overview_shape(client):
    o = client.get("/api/mission/overview").json()
    assert [c["callsign"] for c in o["crew"]] == ["Vyomnaut 01", "Vyomnaut 02", "Vyomnaut 03"]
    for c in o["crew"]:
        assert 0 <= c["risk"] <= 100 and c["status"] in {"green", "amber", "red"}
    assert len(o["top_actions"]) <= 5
    assert set(o["lighting"]) == {"Vyomnaut 01", "Vyomnaut 02", "Vyomnaut 03"}
    assert o["space"]["data_mode"] == "offline" and o["demo_active"] is False


def test_space_endpoints(client):
    s = client.get("/api/space/state").json()
    assert -52 <= s["lat"] <= 52 and 14 <= s["sunrises_24h"] <= 17
    g = client.get("/api/space/groundtrack?hours=24").json()
    assert len(g["points"]) == 1441 and len(g["saa_polygon"]) == 4 and g["eclipse_windows"]
    passes = client.get("/api/space/saa-passes?hours=24").json()
    assert passes and all(p["peak_intensity"] >= 0.2 for p in passes)
    f = client.get("/api/space/flares").json()
    assert f["units"] == "W/m^2" and f["series"] and f["current"]["flare_class"][0] in "ABCMX"
    assert client.get("/api/space/groundtrack?hours=0").status_code == 422


def test_crew_endpoints(client):
    crew = client.get("/api/crew").json()
    v2 = next(c for c in crew if c["callsign"] == "Vyomnaut 02")
    assert v2["reading"]["sleep_debt_h"] == 5.0 and v2["sleep_deficit"] > 60
    r = client.get(f"/api/crew/{v2['id']}/readings?hours=72").json()
    assert len(r["readings"]) == 73 and r["simulated"] is True
    assert r["dose"]["total_msv"] > 0 and r["dose"]["series"]
    assert r["risk_trend"]  # backfilled on startup
    assert client.get("/api/crew/999/readings").status_code == 404


def test_risk_endpoints(client):
    cur = client.get("/api/risk/current").json()
    assert cur["formula"]["w_radiation"] == 0.6 and len(cur["crew"]) == 3
    hist = client.get("/api/risk/history?hours=24").json()
    assert len(hist) == 3 and len(hist[0]["points"]) >= 90


def test_schedule_baseline_and_replan(client):
    base = client.get("/api/schedule?version=baseline").json()
    assert base["version"] == 0 and base["is_baseline"] and len(base["crew"]) == 3
    assert any(b["activity"] == "eva" for c in base["crew"] for b in c["blocks"])
    assert client.get("/api/schedule?version=latest").json()["version"] == 0
    re = client.post("/api/schedule/replan").json()
    assert re["version"] == 1 and isinstance(re["diff"], list)
    assert client.get("/api/schedule?version=latest").json()["version"] == 1
    assert client.get("/api/schedule?version=bogus").status_code == 422


def test_tick_records_and_alerts_ack(client):
    import asyncio

    from app import services as svc
    from app.db import SessionLocal

    async def run():
        async with SessionLocal() as s:
            return await svc.tick(s)

    payload = asyncio.run(run())
    assert payload["type"] == "tick"
    alerts = client.get("/api/alerts").json()
    assert isinstance(alerts, list)
    if alerts:
        acked = client.post(f"/api/alerts/{alerts[0]['id']}/ack").json()
        assert acked["acknowledged"] is True
    assert client.post("/api/alerts/99999/ack").status_code == 404


def test_websocket_pushes_live_payload(client):
    with client.websocket_connect("/ws/live") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "tick" and len(msg["crew"]) == 3 and "space" in msg
        ws.send_text("refresh")
        assert ws.receive_json()["type"] == "tick"
