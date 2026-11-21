"""Decision engine: fuse radiation and sleep into one 0..100 risk and choose actions.

    risk = round(W_RAD * RadiationScore + W_SLEEP * SleepDeficitScore)   (0.60 / 0.40 default)
    GREEN < 40 <= AMBER < 70 <= RED

Action rules (evaluated in order, each returns structured ``Action`` objects):

1. Compound hazard: any crew RED **and** an SAA pass active or starting within
   30 min **and** a flare >= M-class:
     - POSTPONE_EVA (the scheduled EVA)
     - REASSIGN_EVA to the lowest-risk crew member who is GREEN, or AMBER below 55
     - MOVE_TO_SHIELDED for all crew for the duration of the pass
2. Any RED or AMBER crew with SleepDeficitScore > 60: LIGHTING_WARM (2700 K,
   dimmed) for that astronaut's module, to protect the next sleep opportunity.
3. AMBER crew: ADVISORY alert and INCREASE_MONITORING.
4. RED crew (outside rule 1): ADVISORY for flight-surgeon review.

Weights and thresholds are design choices, not clinically validated.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

from app.config import get_settings

REASSIGN_MAX_RISK = 55
SAA_LOOKAHEAD_MIN = 30
FLARE_ORDER = {"A": 0, "B": 1, "C": 2, "M": 3, "X": 4}


def fuse_risk(radiation: float, sleep_deficit: float) -> int:
    s = get_settings()
    return int(round(s.risk_w_radiation * radiation + s.risk_w_sleep * sleep_deficit))


def status_for(risk: int) -> str:
    s = get_settings()
    if risk >= s.red_at_or_above:
        return "red"
    if risk >= s.green_below:
        return "amber"
    return "green"


def flare_at_least(flare_class: str, letter: str) -> bool:
    return FLARE_ORDER.get((flare_class or "A")[0].upper(), 0) >= FLARE_ORDER[letter]


@dataclass
class CrewRisk:
    astronaut_id: int
    callsign: str
    radiation: float
    sleep_deficit: float
    risk: int
    status: str


@dataclass
class Action:
    type: str            # POSTPONE_EVA | REASSIGN_EVA | MOVE_TO_SHIELDED | LIGHTING_WARM | ADVISORY | INCREASE_MONITORING
    target: str          # callsign, "ALL CREW", or module name
    reason: str
    priority: int        # 1 = critical, 2 = high, 3 = advisory
    astronaut_id: int | None = None

    @property
    def severity(self) -> str:
        return {1: "red", 2: "amber"}.get(self.priority, "info")

    def to_dict(self) -> dict:
        return {**asdict(self), "severity": self.severity}


def assess(astronaut_id: int, callsign: str, radiation: float, sleep_deficit: float) -> CrewRisk:
    risk = fuse_risk(radiation, sleep_deficit)
    return CrewRisk(astronaut_id, callsign, round(radiation, 2), round(sleep_deficit, 2), risk, status_for(risk))


def safest_eva_candidate(crew: list[CrewRisk], exclude: str | None = None) -> CrewRisk | None:
    """Lowest-risk crew member who is GREEN, or AMBER below 55; ``None`` if nobody qualifies."""
    eligible = [c for c in crew if c.callsign != exclude
                and (c.status == "green" or (c.status == "amber" and c.risk < REASSIGN_MAX_RISK))]
    return min(eligible, key=lambda c: (c.risk, c.callsign)) if eligible else None


def decide(crew: list[CrewRisk], *, in_saa: bool, minutes_to_next_saa: float | None, flare_class: str,
           eva_assignee: str | None = None) -> list[Action]:
    """Apply the action rules to the current crew risk picture. Pure function."""
    actions: list[Action] = []
    reds = [c for c in crew if c.status == "red"]
    saa_soon = in_saa or (minutes_to_next_saa is not None and minutes_to_next_saa <= SAA_LOOKAHEAD_MIN)
    compound = bool(reds) and saa_soon and flare_at_least(flare_class, "M")

    if compound:
        red_names = ", ".join(f"{c.callsign} ({c.risk})" for c in reds)
        window = "SAA pass in progress" if in_saa else f"SAA pass in {minutes_to_next_saa:.0f} min"
        why = f"{red_names} RED during {window} with {flare_class} flare"
        if eva_assignee:
            eva_owner = next((c for c in crew if c.callsign == eva_assignee), None)
            actions.append(Action("POSTPONE_EVA", eva_assignee, f"{why}; EVA moved out of the SAA window.", 1,
                                  eva_owner.astronaut_id if eva_owner else None))
            cand = safest_eva_candidate(crew, exclude=eva_assignee)
            if cand:
                actions.append(Action("REASSIGN_EVA", cand.callsign,
                                      f"Lowest-risk eligible crew ({cand.status.upper()} {cand.risk}).", 1,
                                      cand.astronaut_id))
            else:
                actions.append(Action("ADVISORY", "EVA", "No crew GREEN or AMBER<55; EVA held until risk drops.", 1))
        actions.append(Action("MOVE_TO_SHIELDED", "ALL CREW",
                              f"{why}; shelter in shielded area until the pass ends.", 1))

    for c in crew:
        if c.status in ("red", "amber") and c.sleep_deficit > 60:
            actions.append(Action("LIGHTING_WARM", c.callsign,
                                  f"Sleep deficit {c.sleep_deficit:.0f} > 60; warm 2700 K dimmed lighting to "
                                  "protect the next sleep period.", 2, c.astronaut_id))

    for c in crew:
        if c.status == "amber":
            actions.append(Action("ADVISORY", c.callsign,
                                  f"AMBER risk {c.risk} (radiation {c.radiation:.0f}, sleep {c.sleep_deficit:.0f}).",
                                  3, c.astronaut_id))
            actions.append(Action("INCREASE_MONITORING", c.callsign,
                                  "Raise vitals/dosimeter sampling to every 5 min.", 3, c.astronaut_id))
        elif c.status == "red" and not compound:
            actions.append(Action("ADVISORY", c.callsign,
                                  f"RED risk {c.risk}; flight-surgeon review, defer high-exposure tasks.", 2,
                                  c.astronaut_id))
    return sorted(actions, key=lambda a: a.priority)


def lighting_state(actions: list[Action], callsigns: list[str]) -> dict[str, str]:
    """Per-astronaut module lighting: warm sleep mode if a LIGHTING_WARM action targets them."""
    warm = {a.target for a in actions if a.type == "LIGHTING_WARM"}
    return {c: ("warm_2700K" if c in warm else "cool_6500K") for c in callsigns}
