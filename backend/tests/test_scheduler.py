from datetime import UTC, datetime, timedelta

import pytest

from app.data.crew_simulator import CREW_PROFILES, baseline_blocks, target_reading
from app.engines.decision import CrewRisk
from app.engines.scheduler import SAA_BUFFER, Block, find_slot, replan, work_hours

T0 = datetime(2026, 11, 22, 0, 0, tzinfo=UTC)


def h(x: float) -> datetime:
    return T0 + timedelta(hours=x)


def baseline() -> dict[str, list[Block]]:
    return {p.callsign: [Block(**b) for b in baseline_blocks(p.callsign, T0)] for p in CREW_PROFILES}


DEBT = {p.callsign: target_reading(p)["sleep_debt_h"] for p in CREW_PROFILES}
DEMO_CREW = [
    CrewRisk(1, "Vyomnaut 01", 82, 30.1, 61, "amber"),
    CrewRisk(2, "Vyomnaut 02", 82, 67.0, 76, "red"),
    CrewRisk(3, "Vyomnaut 03", 65.6, 21.8, 48, "amber"),
]
CALM_CREW = [
    CrewRisk(1, "Vyomnaut 01", 10, 30, 18, "green"),
    CrewRisk(2, "Vyomnaut 02", 10, 67, 33, "green"),
    CrewRisk(3, "Vyomnaut 03", 8, 22, 14, "green"),
]
# SAA passes: one overlapping V02's EVA (01:00-04:00), one at 12:30 over V03's exercise (12:00-14:00)
SAA = [(h(1.5), h(1.8)), (h(12.5), h(12.8))]


def _assert_contiguous(tl: list[Block]):
    for a, b in zip(tl, tl[1:]):
        assert a.end == b.start, (a, b)
    assert tl[0].start == T0 and tl[-1].end == h(24)


def _eva(schedule):
    return [(cs, b) for cs, tl in schedule.items() for b in tl if b.activity == "eva"]


def test_demo_replan_reassigns_and_avoids_saa():
    res = replan(baseline(), SAA, DEMO_CREW, DEBT, now=T0)
    evas = _eva(res.schedule)
    assert len(evas) == 1
    cs, eva = evas[0]
    assert cs == "Vyomnaut 03"
    assert eva.duration == timedelta(hours=3)
    for w0, w1 in SAA:
        assert not (eva.start < w1 + SAA_BUFFER and w0 - SAA_BUFFER < eva.end)
    d = next(x for x in res.diff if x["activity"] == "eva")
    assert d["change"] == "reassigned" and d["from_callsign"] == "Vyomnaut 02"
    assert "RED" in d["reason"]
    for tl in res.schedule.values():
        _assert_contiguous(tl)


def test_sleep_protected_for_high_debt():
    res = replan(baseline(), SAA, DEMO_CREW, DEBT, now=T0)
    sleep = [b for b in res.schedule["Vyomnaut 02"] if b.activity == "sleep"]
    assert max(b.duration for b in sleep) >= timedelta(hours=7)
    assert any(x["activity"] == "sleep" and x["change"] == "extended" for x in res.diff)
    # low-debt crew untouched
    assert not any(x["activity"] == "sleep" and x["callsign"] != "Vyomnaut 02" for x in res.diff)


def test_exercise_moved_out_of_saa():
    res = replan(baseline(), SAA, DEMO_CREW, DEBT, now=T0)
    for tl in res.schedule.values():
        for b in tl:
            if b.activity == "exercise":
                assert all(not (b.start < w1 and w0 < b.end) for w0, w1 in SAA)
    assert any(x["activity"] == "exercise" and x["change"] == "moved" for x in res.diff)


def test_work_hours_roughly_constant():
    before = work_hours(baseline())
    after = work_hours(replan(baseline(), SAA, DEMO_CREW, DEBT, now=T0).schedule)
    assert abs(after - before) <= 1.0


def test_baseline_not_mutated():
    base = baseline()
    snapshot = [(b.start, b.end, b.activity) for tl in base.values() for b in tl]
    replan(base, SAA, DEMO_CREW, DEBT, now=T0)
    assert snapshot == [(b.start, b.end, b.activity) for tl in base.values() for b in tl]


def test_non_red_owner_eva_moved_within_own_schedule():
    res = replan(baseline(), SAA, CALM_CREW, {}, now=T0)
    (cs, eva), = _eva(res.schedule)
    assert cs == "Vyomnaut 02"
    assert next(x for x in res.diff if x["activity"] == "eva")["change"] == "moved"


def test_eva_left_alone_when_clear():
    res = replan(baseline(), [(h(18), h(18.3))], CALM_CREW, {}, now=T0)
    (cs, eva), = _eva(res.schedule)
    assert (cs, eva.start, eva.end) == ("Vyomnaut 02", h(1), h(4))
    assert not [x for x in res.diff if x["activity"] == "eva"]


def test_eva_deferred_when_no_eligible_crew():
    crew = [CrewRisk(1, "Vyomnaut 01", 90, 60, 78, "red"), CrewRisk(2, "Vyomnaut 02", 90, 67, 80, "red"),
            CrewRisk(3, "Vyomnaut 03", 90, 50, 74, "red")]
    res = replan(baseline(), SAA, crew, DEBT, now=T0)
    assert not _eva(res.schedule)
    assert next(x for x in res.diff if x["activity"] == "eva")["change"] == "deferred"


def test_eva_deferred_when_no_clear_window():
    always = [(h(-1), h(25))]
    res = replan(baseline(), [], CALM_CREW, {}, now=T0, hazards=always)
    assert not _eva(res.schedule)
    assert "deferred" in {x["change"] for x in res.diff if x["activity"] == "eva"}


def test_eva_not_placed_in_the_past():
    res = replan(baseline(), [], CALM_CREW, {}, now=h(6))
    (cs, eva), = _eva(res.schedule)
    assert eva.start >= h(6)


@pytest.mark.parametrize("earliest,expect", [(T0, h(9)), (h(9.1), h(15))])
def test_find_slot_grid_and_work_only(earliest, expect):
    tl = baseline()["Vyomnaut 03"]
    assert find_slot(tl, timedelta(hours=3), [], earliest, h(24)) == expect
    assert find_slot([], timedelta(hours=1), [], T0, h(24)) is None


def test_orbit_anchored_demo_always_reassigns():
    """A week of start times: anchoring at the next SAA cluster always yields a reassigned, SAA-free EVA."""
    from app.data import tle_client
    from app.engines.space import SpaceEngine

    t = tle_client.load_fixture()
    eng = SpaceEngine(t["name"], t["line1"], t["line2"])
    t_start = datetime(2026, 11, 21, 12, tzinfo=UTC)
    for k in range(0, 7 * 24, 5):
        now = t_start + timedelta(hours=k)
        p = eng.next_saa_cluster_start(now)
        assert p and p["start"] >= now
        anchor = (p["start"] - timedelta(hours=1)).replace(second=0, microsecond=0)
        anchor -= timedelta(minutes=anchor.minute % 15)
        base = {q.callsign: [Block(**b) for b in baseline_blocks(q.callsign, anchor)] for q in CREW_PROFILES}
        passes = [(x["start"], x["end"]) for x in eng.predict_saa_passes(24, anchor)]
        res = replan(base, passes, DEMO_CREW, DEBT, now=p["start"])
        (cs, eva), = _eva(res.schedule)
        assert cs == "Vyomnaut 03", now
        assert all(not (eva.start < w1 + SAA_BUFFER and w0 - SAA_BUFFER < eva.end) for w0, w1 in passes)
