import pytest

from app.data import tle_client
from app.data.crew_simulator import CREW_PROFILES, target_reading
from app.engines import biomedical as bio
from app.engines import decision as dec
from app.engines.space import SpaceEngine


@pytest.fixture(scope="module")
def sunrises():
    t = tle_client.load_fixture()
    return SpaceEngine(t["name"], t["line1"], t["line2"]).orbits_per_day


# ---- biomedical ----------------------------------------------------------------
def test_orbits_per_day_is_iss_like(sunrises):
    assert 15.4 < sunrises < 15.6


@pytest.mark.parametrize("saa,flare,loc,expected", [
    (0.0, 0.0, "cabin", 10.0),
    (1.0, 0.0, "cabin", 50.0),
    (0.8, 1.0, "cabin", 82.0),
    (0.8, 1.0, "sleep_station", 65.6),
    (0.8, 1.0, "shielded_area", 32.8),
    (1.0, 1.0, "EVA", 100.0),          # clamped
    (0.0, 0.0, "unknown", 10.0),       # defaults to cabin
])
def test_radiation_score(saa, flare, loc, expected):
    assert bio.radiation_score(saa, flare, loc) == pytest.approx(expected)


def test_shielding_reduces_dose_rate():
    assert bio.dose_rate_msv_h(1, 1, "shielded_area") < bio.dose_rate_msv_h(1, 1, "cabin") < bio.dose_rate_msv_h(1, 1, "EVA")


def test_sleep_components_bounds():
    worst = bio.sleep_components(20, 10, 60, 7, 30)
    assert (worst.debt, worst.hrv, worst.fatigue, worst.circadian) == (100, 100, 100, 100)
    best = bio.sleep_components(0, 70, 60, 1, 0)
    assert best.total == 0
    assert bio.sleep_components(1, 50, 0, 1).hrv == 0  # zero baseline guarded


def test_sleep_deficit_monotonic():
    a = bio.sleep_deficit_score(1, 60, 60, 2)
    b = bio.sleep_deficit_score(5, 45, 60, 5)
    assert b > a


def test_vyomnaut_02_sleep_deficit_over_60(sunrises):
    v2 = CREW_PROFILES[1]
    r = target_reading(v2)
    s = bio.sleep_deficit_score(r["sleep_debt_h"], r["hrv_ms"], v2.hrv_baseline, r["fatigue_sp"], sunrises)
    assert 65.75 <= s < 68.25


# ---- decision ------------------------------------------------------------------
@pytest.mark.parametrize("risk,status", [(0, "green"), (39, "green"), (40, "amber"), (69, "amber"), (70, "red"), (100, "red")])
def test_status_thresholds(risk, status):
    assert dec.status_for(risk) == status


def test_fuse_risk_formula():
    assert dec.fuse_risk(100, 0) == 60
    assert dec.fuse_risk(0, 100) == 40
    assert dec.fuse_risk(82, 66.98) == 76


def test_flare_at_least():
    assert dec.flare_at_least("M1.0", "M") and dec.flare_at_least("X2.1", "M")
    assert not dec.flare_at_least("C9.9", "M") and not dec.flare_at_least("", "M")


def _crew_for_demo(sunrises):
    """Expected demo inputs: X2.1 flare (factor 1.0), SAA intensity 0.80."""
    out = []
    for i, p in enumerate(CREW_PROFILES, start=1):
        r = target_reading(p)
        rad = bio.radiation_score(0.80, 1.0, p.location)
        sleep = bio.sleep_deficit_score(r["sleep_debt_h"], r["hrv_ms"], p.hrv_baseline, r["fatigue_sp"], sunrises)
        out.append(dec.assess(i, p.callsign, rad, sleep))
    return out


def test_demo_numbers(sunrises):
    crew = {c.callsign: c for c in _crew_for_demo(sunrises)}
    assert crew["Vyomnaut 02"].risk == 76 and crew["Vyomnaut 02"].status == "red"
    assert crew["Vyomnaut 01"].status == "amber" and 40 <= crew["Vyomnaut 01"].risk < 70
    assert crew["Vyomnaut 03"].status == "amber" and crew["Vyomnaut 03"].risk < 55


def test_compound_hazard_fires_all_four_actions(sunrises):
    crew = _crew_for_demo(sunrises)
    acts = dec.decide(crew, in_saa=True, minutes_to_next_saa=0, flare_class="X2.1", eva_assignee="Vyomnaut 02")
    types = [a.type for a in acts]
    for t in ("POSTPONE_EVA", "REASSIGN_EVA", "MOVE_TO_SHIELDED", "LIGHTING_WARM"):
        assert t in types
    reassign = next(a for a in acts if a.type == "REASSIGN_EVA")
    assert reassign.target == "Vyomnaut 03"
    assert [a.target for a in acts if a.type == "LIGHTING_WARM"] == ["Vyomnaut 02"]
    assert acts == sorted(acts, key=lambda a: a.priority)
    assert acts[0].severity == "red" and acts[0].to_dict()["severity"] == "red"
    assert dec.lighting_state(acts, ["Vyomnaut 01", "Vyomnaut 02"]) == {
        "Vyomnaut 01": "cool_6500K", "Vyomnaut 02": "warm_2700K"}


def test_no_compound_without_m_flare(sunrises):
    crew = _crew_for_demo(sunrises)
    acts = dec.decide(crew, in_saa=True, minutes_to_next_saa=0, flare_class="C5.0", eva_assignee="Vyomnaut 02")
    types = {a.type for a in acts}
    assert "POSTPONE_EVA" not in types and "MOVE_TO_SHIELDED" not in types
    assert any(a.type == "ADVISORY" and a.target == "Vyomnaut 02" and a.priority == 2 for a in acts)


def test_compound_triggers_on_upcoming_pass_within_30_min(sunrises):
    crew = _crew_for_demo(sunrises)
    soon = dec.decide(crew, in_saa=False, minutes_to_next_saa=25, flare_class="M1.0", eva_assignee="Vyomnaut 02")
    late = dec.decide(crew, in_saa=False, minutes_to_next_saa=45, flare_class="M1.0", eva_assignee="Vyomnaut 02")
    assert any(a.type == "POSTPONE_EVA" for a in soon)
    assert not any(a.type == "POSTPONE_EVA" for a in late)
    assert "in 25 min" in next(a for a in soon if a.type == "MOVE_TO_SHIELDED").reason


def test_no_eligible_reassignment():
    crew = [dec.CrewRisk(1, "A", 90, 70, 82, "red"), dec.CrewRisk(2, "B", 80, 40, 64, "amber")]
    acts = dec.decide(crew, in_saa=True, minutes_to_next_saa=0, flare_class="X1.0", eva_assignee="A")
    assert not any(a.type == "REASSIGN_EVA" for a in acts)
    assert any(a.type == "ADVISORY" and a.target == "EVA" for a in acts)


def test_compound_without_eva_still_shelters():
    crew = [dec.CrewRisk(1, "A", 90, 70, 82, "red")]
    types = [a.type for a in dec.decide(crew, in_saa=True, minutes_to_next_saa=0, flare_class="X1.0")]
    assert "MOVE_TO_SHIELDED" in types and "POSTPONE_EVA" not in types


def test_all_green_no_actions():
    crew = [dec.CrewRisk(1, "A", 10, 20, 14, "green")]
    assert dec.decide(crew, in_saa=False, minutes_to_next_saa=None, flare_class="B1.0") == []
