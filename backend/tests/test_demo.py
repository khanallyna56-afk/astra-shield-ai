"""End-to-end solar-flare demo: exact outcomes required by the brief."""
from datetime import datetime

from app.engines.scheduler import SAA_BUFFER


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def test_solar_flare_demo_outcomes(client):
    out = client.post("/api/demo/solar-flare").json()
    crew = {c["callsign"]: c for c in out["crew"]}

    # 1. risk numbers
    assert crew["Vyomnaut 02"]["risk"] == 76 and crew["Vyomnaut 02"]["status"] == "red"
    for cs in ("Vyomnaut 01", "Vyomnaut 03"):
        assert crew[cs]["status"] == "amber" and 40 <= crew[cs]["risk"] <= 69

    # 2. the four actions
    types = {a["type"] for a in out["actions"]}
    assert {"POSTPONE_EVA", "REASSIGN_EVA", "MOVE_TO_SHIELDED", "LIGHTING_WARM"} <= types
    assert next(a for a in out["actions"] if a["type"] == "REASSIGN_EVA")["target"] == "Vyomnaut 03"
    assert out["lighting"]["Vyomnaut 02"] == "warm_2700K"

    # 3. re-planned schedule: EVA on Vyomnaut 03, clear of every SAA pass (+/-15 min), with a diff
    sched = out["schedule"]
    assert sched["version"] >= 1
    evas = [(c["callsign"], b) for c in sched["crew"] for b in c["blocks"] if b["activity"] == "eva"]
    assert len(evas) == 1 and evas[0][0] == "Vyomnaut 03"
    e0, e1 = _dt(evas[0][1]["start"]), _dt(evas[0][1]["end"])
    for p in sched["saa_passes"]:
        assert not (e0 < _dt(p["end"]) + SAA_BUFFER and _dt(p["start"]) - SAA_BUFFER < e1)
    eva_diff = next(d for d in sched["diff"] if d["activity"] == "eva")
    assert eva_diff["change"] == "reassigned" and eva_diff["from_callsign"] == "Vyomnaut 02"

    # 4. alerts rows written; live overview reflects the scenario
    alerts = client.get("/api/alerts").json()
    assert {"POSTPONE_EVA", "REASSIGN_EVA", "MOVE_TO_SHIELDED", "LIGHTING_WARM"} <= {a["action_type"] for a in alerts}
    o = client.get("/api/mission/overview").json()
    assert o["demo_active"] and o["any_red"] and o["space"]["in_saa"] and o["space"]["flare_class"] == "X2.1"
    assert o["space"]["next_saa_pass"]["active"] is True
    assert client.get("/api/schedule?version=latest").json()["diff"]


def test_demo_is_repeatable(client):
    a = client.post("/api/demo/solar-flare").json()
    b = client.post("/api/demo/solar-flare").json()
    assert [c["risk"] for c in a["crew"]] == [c["risk"] for c in b["crew"]]
    assert len(client.get("/api/alerts").json()) == len({(x["type"], x["target"]) for x in b["actions"]})


def test_demo_streams_over_websocket(client):
    with client.websocket_connect("/ws/live") as ws:
        ws.receive_json()  # initial snapshot
        client.post("/api/demo/solar-flare")
        msgs = [ws.receive_json() for _ in range(2)]
        tick = next(m for m in msgs if m["type"] == "tick")
        assert tick["any_red"] and tick["demo_active"]
        assert any(m["type"] == "demo" for m in msgs)


def test_reset_restores_normal_ops(client):
    client.post("/api/demo/solar-flare")
    assert client.post("/api/demo/reset").json() == {"reset": True}
    o = client.get("/api/mission/overview").json()
    assert o["demo_active"] is False and o["space"]["flare_class"] != "X2.1"
    assert client.get("/api/schedule?version=latest").json()["version"] == 0
    assert client.get("/api/alerts").json() == []
    assert client.get("/api/risk/history").json()
