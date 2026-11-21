"""Radiation-aware 24 h re-planner (greedy).

Inputs: per-astronaut baseline blocks, predicted SAA passes, optional extra hazard
windows (e.g. a flare particle-watch period), crew risk, and sleep debt.

Algorithm (each step mutates per-astronaut timelines; every change is logged in a diff):

1. **Protect sleep.** For crew with sleep debt > 4 h, grow their sleep block to
   >= 7 h by taking time from the adjacent *work* block (before first, then after).
2. **Fix the EVA.**
   a. If the EVA holder is RED, reassign to the safest eligible crew member
      (GREEN, or AMBER < 55; see ``decision.safest_eva_candidate``). If nobody
      qualifies the EVA is deferred beyond the 24 h horizon.
   b. Place the EVA in the earliest slot, at or after ``now``, that lies entirely
      inside the assignee's *work* time and does not overlap any SAA pass
      (+/- 15 min buffer) or hazard window. The vacated EVA slot becomes work for
      the original holder, so total crew work hours stay constant.
3. **Move exercise out of SAA windows** using the same slot search (no buffer);
   the vacated slot becomes work.

Slots are searched on a 15-minute grid. Greedy, first-fit: simple, explainable,
and fast enough for 3 crew x 24 h. It is not globally optimal.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.engines.decision import CrewRisk, safest_eva_candidate

SAA_BUFFER = timedelta(minutes=15)
GRID = timedelta(minutes=15)
MIN_SLEEP = timedelta(hours=7)
SLEEP_DEBT_PROTECT_H = 4.0


@dataclass
class Block:
    start: datetime
    end: datetime
    activity: str
    is_replanned: bool = False
    reason: str | None = None

    @property
    def duration(self) -> timedelta:
        return self.end - self.start


@dataclass
class ReplanResult:
    schedule: dict[str, list[Block]]
    diff: list[dict] = field(default_factory=list)


Window = tuple[datetime, datetime]


def _overlaps(a0: datetime, a1: datetime, b0: datetime, b1: datetime) -> bool:
    return a0 < b1 and b0 < a1


def _place(tl: list[Block], start: datetime, end: datetime, activity: str, reason: str) -> list[Block]:
    """Carve [start, end) out of the timeline and insert a new block; returns a new sorted timeline."""
    out: list[Block] = []
    for b in tl:
        if not _overlaps(b.start, b.end, start, end):
            out.append(b)
            continue
        if b.start < start:
            out.append(Block(b.start, start, b.activity, b.is_replanned, b.reason))
        if b.end > end:
            out.append(Block(end, b.end, b.activity, b.is_replanned, b.reason))
    out.append(Block(start, end, activity, True, reason))
    return _merge(sorted(out, key=lambda b: b.start))


def _merge(tl: list[Block]) -> list[Block]:
    """Merge touching blocks with the same activity and replanned state."""
    out: list[Block] = []
    for b in tl:
        if out and out[-1].activity == b.activity and out[-1].end == b.start \
                and out[-1].is_replanned == b.is_replanned and out[-1].reason == b.reason:
            out[-1] = Block(out[-1].start, b.end, b.activity, b.is_replanned, b.reason)
        else:
            out.append(b)
    return out


def _is_work_covered(tl: list[Block], start: datetime, end: datetime) -> bool:
    """True if [start, end) is fully covered by 'work' blocks."""
    covered = timedelta()
    for b in tl:
        if b.activity == "work" and _overlaps(b.start, b.end, start, end):
            covered += min(b.end, end) - max(b.start, start)
    return covered == end - start


def find_slot(tl: list[Block], duration: timedelta, forbidden: list[Window], earliest: datetime,
              horizon_end: datetime, buffer: timedelta = timedelta()) -> datetime | None:
    """Earliest grid-aligned start where the slot is all work time and clear of forbidden windows (+buffer)."""
    if not tl:
        return None
    t0 = tl[0].start
    t = t0 + ((max(earliest, t0) - t0 + GRID - timedelta(microseconds=1)) // GRID) * GRID
    while t + duration <= horizon_end:
        end = t + duration
        clear = all(not _overlaps(t, end, w0 - buffer, w1 + buffer) for w0, w1 in forbidden)
        if clear and _is_work_covered(tl, t, end):
            return t
        t += GRID
    return None


def _diff(callsign: str, activity: str, change: str, old: Block | None, new: tuple | None, reason: str) -> dict:
    return {
        "callsign": callsign, "activity": activity, "change": change,
        "from_start": old.start if old else None, "from_end": old.end if old else None,
        "to_start": new[0] if new else None, "to_end": new[1] if new else None,
        "reason": reason,
    }


def _hhmm(t: datetime) -> str:
    return t.strftime("%H:%M")


def protect_sleep(schedule: dict[str, list[Block]], sleep_debt: dict[str, float], diff: list[dict]) -> None:
    """Step 1: extend short sleep blocks to >= 7 h for crew with > 4 h sleep debt."""
    for cs, tl in schedule.items():
        if sleep_debt.get(cs, 0) <= SLEEP_DEBT_PROTECT_H:
            continue
        for i, b in enumerate(tl):
            if b.activity != "sleep" or b.duration >= MIN_SLEEP:
                continue
            need = MIN_SLEEP - b.duration
            reason = f"Sleep debt {sleep_debt[cs]:.1f} h > 4 h: protect a >= 7 h sleep block."
            prev = tl[i - 1] if i > 0 else None
            nxt = tl[i + 1] if i + 1 < len(tl) else None
            if prev and prev.activity == "work" and prev.duration > need:
                new = (b.start - need, b.end)
            elif nxt and nxt.activity == "work" and nxt.duration > need:
                new = (b.start, b.end + need)
            else:
                diff.append(_diff(cs, "sleep", "unchanged", b, None, reason + " No adjacent work time to borrow."))
                continue
            schedule[cs] = _place(tl, new[0], new[1], "sleep", reason)
            diff.append(_diff(cs, "sleep", "extended", b, new, reason))
            break


def replan(
    baseline: dict[str, list[Block]],
    saa_passes: list[Window],
    crew: list[CrewRisk],
    sleep_debt: dict[str, float],
    now: datetime,
    hazards: list[Window] | None = None,
) -> ReplanResult:
    """Produce a re-planned schedule and a human-readable diff. Does not mutate ``baseline``."""
    schedule = {cs: [Block(b.start, b.end, b.activity) for b in tl] for cs, tl in baseline.items()}
    diff: list[dict] = []
    forbidden = list(saa_passes) + list(hazards or [])
    horizon_end = max(b.end for tl in schedule.values() for b in tl)
    by_cs = {c.callsign: c for c in crew}

    protect_sleep(schedule, sleep_debt, diff)

    # ---- Step 2: EVA --------------------------------------------------------
    for owner, tl in list(schedule.items()):
        for eva in [b for b in tl if b.activity == "eva"]:
            assignee = owner
            reasons = []
            owner_risk = by_cs.get(owner)
            if owner_risk and owner_risk.status == "red":
                cand = safest_eva_candidate(crew, exclude=owner)
                reasons.append(f"{owner} RED (risk {owner_risk.risk}): no EVA for red crew.")
                if cand is None:
                    schedule[owner] = _place(schedule[owner], eva.start, eva.end, "work", "EVA deferred")
                    diff.append(_diff(owner, "eva", "deferred", eva, None,
                                      " ".join(reasons) + " No eligible crew; EVA deferred beyond 24 h."))
                    continue
                assignee = cand.callsign
                reasons.append(f"Reassigned to {assignee} ({cand.status.upper()} {cand.risk}).")

            overlaps_saa = any(_overlaps(eva.start, eva.end, w0 - SAA_BUFFER, w1 + SAA_BUFFER)
                               for w0, w1 in forbidden)
            if assignee == owner and not overlaps_saa and eva.start >= now:
                continue  # EVA is fine where it is

            # vacate the original slot for the owner (becomes work)
            schedule[owner] = _place(schedule[owner], eva.start, eva.end, "work",
                                     "Former EVA slot returned to work.")
            slot = find_slot(schedule[assignee], eva.duration, forbidden, now, horizon_end, SAA_BUFFER)
            if overlaps_saa:
                reasons.append("Original slot overlaps an SAA pass (+/-15 min).")
            if slot is None:
                diff.append(_diff(owner, "eva", "deferred", eva, None,
                                  " ".join(reasons) + " No SAA-free work window in 24 h; EVA deferred."))
                continue
            new = (slot, slot + eva.duration)
            reasons.append(f"New slot {_hhmm(new[0])}-{_hhmm(new[1])} UTC is clear of SAA passes.")
            reason = " ".join(reasons)
            schedule[assignee] = _place(schedule[assignee], new[0], new[1], "eva", reason)
            change = "reassigned" if assignee != owner else "moved"
            entry = _diff(assignee, "eva", change, eva, new, reason)
            entry["from_callsign"] = owner
            diff.append(entry)

    # ---- Step 3: exercise out of SAA ---------------------------------------
    for cs in list(schedule):
        for ex in [b for b in schedule[cs] if b.activity == "exercise"]:
            if not any(_overlaps(ex.start, ex.end, w0, w1) for w0, w1 in saa_passes):
                continue
            tmp = _place(schedule[cs], ex.start, ex.end, "work", "Former exercise slot returned to work.")
            slot = find_slot(tmp, ex.duration, saa_passes, now, horizon_end)
            reason = "Exercise raises breathing rate and time near thin walls; moved out of SAA pass."
            if slot is None:
                diff.append(_diff(cs, "exercise", "unchanged", ex, None, reason + " No SAA-free work window."))
                continue
            new = (slot, slot + ex.duration)
            schedule[cs] = _place(tmp, new[0], new[1], "exercise", reason)
            diff.append(_diff(cs, "exercise", "moved", ex, new, reason))

    return ReplanResult(schedule, diff)


def work_hours(schedule: dict[str, list[Block]]) -> float:
    """Total crew work hours (for the 'roughly constant' check)."""
    return sum(b.duration.total_seconds() for tl in schedule.values() for b in tl if b.activity == "work") / 3600
