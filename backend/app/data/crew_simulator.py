"""Deterministic, seeded crew health simulator.

ALL CREW DATA IS SIMULATED. Values are plausible, not measured.

Each astronaut has a profile (nightly sleep, HRV baseline, fatigue trend). The
simulator produces hourly readings for the last N hours. The *final* reading
always lands exactly on the profile's target so the demo is reproducible:

* Vyomnaut 02 is deliberately sleep-deprived: ~5 h rolling sleep debt,
  HRV 25 % below personal baseline, Samn-Perelli fatigue 5/7.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np

SLEEP_TARGET_H = 8.0


@dataclass(frozen=True)
class CrewProfile:
    callsign: str
    name: str
    role: str
    hrv_baseline: float      # ms (RMSSD), personal baseline
    location: str            # cabin | sleep_station | shielded_area | EVA
    nightly_sleep_h: float   # average sleep per 24 h over the last 72 h
    hrv_ratio: float         # current HRV / baseline
    fatigue_sp: int          # Samn-Perelli 1 (fully alert) .. 7 (exhausted)
    resting_hr: float        # bpm
    seed: int


CREW_PROFILES: list[CrewProfile] = [
    CrewProfile("Vyomnaut 01", "Cdr. Arjun Rao (sim)", "Commander", 62.0, "cabin",
                7.4, 0.95, 3, 62.0, 101),
    CrewProfile("Vyomnaut 02", "Dr. Meera Iyer (sim)", "Flight Engineer / EVA lead", 58.0, "cabin",
                8.0 - 5.0 / 3.0, 0.75, 5, 71.0, 102),
    CrewProfile("Vyomnaut 03", "Lt. Kabir Singh (sim)", "Mission Specialist", 66.0, "sleep_station",
                7.6, 0.97, 2, 60.0, 103),
]

# Baseline 24 h day template per astronaut: (start_h, end_h, activity), offsets from schedule start.
# Vyomnaut 02 holds the EVA and only a 6.5 h sleep block (the scheduler should fix both).
BASELINE_TEMPLATES: dict[str, list[tuple[float, float, str]]] = {
    "Vyomnaut 01": [
        (0, 3, "work"), (3, 4, "comms"), (4, 5, "meal"), (5, 9, "work"), (9, 11, "exercise"),
        (11, 12, "meal"), (12, 15, "work"), (15, 23, "sleep"), (23, 24, "meal"),
    ],
    "Vyomnaut 02": [
        (0, 1, "work"), (1, 4, "eva"), (4, 5, "meal"), (5, 8, "work"), (8, 10, "exercise"),
        (10, 11, "meal"), (11, 12, "comms"), (12, 15, "work"), (15, 21.5, "sleep"),
        (21.5, 22.5, "meal"), (22.5, 24, "work"),
    ],
    "Vyomnaut 03": [
        (0, 8, "sleep"), (8, 9, "meal"), (9, 12, "work"), (12, 14, "exercise"), (14, 15, "meal"),
        (15, 19, "work"), (19, 20, "comms"), (20, 23, "work"), (23, 24, "meal"),
    ],
}


def target_reading(p: CrewProfile) -> dict:
    """The exact 'current' reading for a profile (last point of the series)."""
    return {
        "sleep_hours": round(p.nightly_sleep_h, 2),
        "sleep_debt_h": round(max(0.0, (SLEEP_TARGET_H - p.nightly_sleep_h) * 3), 2),
        "hrv_ms": round(p.hrv_baseline * p.hrv_ratio, 1),
        "fatigue_sp": p.fatigue_sp,
        "heart_rate": p.resting_hr,
    }


def generate_readings(p: CrewProfile, end: datetime, hours: int = 72) -> list[dict]:
    """Hourly readings for `hours` hours ending at `end`.

    The series drifts from a rested state toward the profile target with small
    seeded noise, so charts look realistic but every run is identical.
    """
    rng = np.random.default_rng(p.seed)
    tgt = target_reading(p)
    out: list[dict] = []
    for i in range(hours + 1):
        frac = i / hours                      # 0 -> 1 across the window
        ts = end - timedelta(hours=hours - i)
        noise = rng.normal(0, 1, 4)
        if i == hours:
            out.append({"ts": ts, **tgt})
            continue
        debt = tgt["sleep_debt_h"] * frac
        out.append({
            "ts": ts,
            "sleep_hours": round(float(np.clip(SLEEP_TARGET_H - (SLEEP_TARGET_H - tgt["sleep_hours"]) * frac
                                               + 0.2 * noise[0], 3, 10)), 2),
            "sleep_debt_h": round(max(0.0, debt + 0.15 * noise[1]), 2),
            "hrv_ms": round(float(p.hrv_baseline * (1 - (1 - p.hrv_ratio) * frac) + 2.0 * noise[2]), 1),
            "fatigue_sp": int(np.clip(round(1 + (tgt["fatigue_sp"] - 1) * frac + 0.4 * noise[3]), 1, 7)),
            "heart_rate": round(float(p.resting_hr - 4 * (1 - frac) + 1.5 * noise[0]), 1),
        })
    return out


def baseline_blocks(callsign: str, start: datetime) -> list[dict]:
    """Materialise the 24 h baseline template for one astronaut starting at `start`."""
    return [
        {"start": start + timedelta(hours=s), "end": start + timedelta(hours=e), "activity": a}
        for s, e, a in BASELINE_TEMPLATES[callsign]
    ]
