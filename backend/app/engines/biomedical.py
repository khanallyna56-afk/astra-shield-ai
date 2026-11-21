"""Biomedical engine: per-astronaut RadiationScore and SleepDeficitScore (both 0..100).

PROTOTYPE, NOT A MEDICAL DEVICE. All weights below are transparent design
choices, not clinically validated limits. Crew data is simulated.

RadiationScore
--------------
    raw   = BASE_ORBIT_DOSE + saa_intensity * SAA_WEIGHT + flare_factor * FLARE_WEIGHT
    score = clamp(raw * shielding[location], 0, 100)

* BASE_ORBIT_DOSE (10): galactic cosmic ray background always present in LEO.
* SAA_WEIGHT (40): trapped protons in the South Atlantic Anomaly dominate LEO dose.
* FLARE_WEIGHT (40): solar particle event likelihood rises with flare class
  (flare_factor C=0.2, M=0.6, X=1.0 from the space engine).
* Location shielding multiplier: cabin 1.0, sleep station 0.8 (extra water/poly
  walls), shielded area 0.4 (storm shelter), EVA 1.6 (suit only).

SleepDeficitScore
-----------------
Weighted sum of four 0..100 components (weights sum to 1):

* Sleep debt (0.40): rolling-72 h hours below an 8 h/night target; 8 h debt = 100.
* HRV suppression (0.25): drop of HRV (RMSSD) below personal baseline; a 40 %
  drop = 100. Lower HRV indicates autonomic stress / poor recovery.
* Fatigue (0.25): Samn-Perelli 7-point scale mapped linearly (1 -> 0, 7 -> 100).
* Circadian misalignment (0.10): orbital sunrises per day vs Earth's one;
  16 sunrises/day = 100. Constant-ish in LEO but kept for transparency and for
  ground use (e.g. night-shift clinicians) where it varies.
"""
from __future__ import annotations

from dataclasses import dataclass

BASE_ORBIT_DOSE = 10.0
SAA_WEIGHT = 40.0
FLARE_WEIGHT = 40.0
SHIELDING = {"cabin": 1.0, "sleep_station": 0.8, "shielded_area": 0.4, "EVA": 1.6}

SLEEP_TARGET_H = 8.0
W_DEBT, W_HRV, W_FATIGUE, W_CIRCADIAN = 0.40, 0.25, 0.25, 0.10
DEBT_FULL_SCALE_H = 8.0
HRV_FULL_SCALE_DROP = 0.40
SUNRISES_FULL_SCALE = 16.0

# Simulated mSv per hour, before shielding (illustrative LEO magnitudes, ISS ~0.5 mSv/day).
DOSE_MSV_PER_H = {"base": 0.02, "saa_peak": 0.15, "flare_x": 0.50}


def clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def radiation_score(saa_intensity: float, flare_factor: float, location: str = "cabin") -> float:
    """0..100 radiation hazard score for one astronaut at a given location."""
    raw = BASE_ORBIT_DOSE + saa_intensity * SAA_WEIGHT + flare_factor * FLARE_WEIGHT
    return round(clamp(raw * SHIELDING.get(location, 1.0)), 2)


def dose_rate_msv_h(saa_intensity: float, flare_factor: float, location: str = "cabin") -> float:
    """Simulated dose rate (mSv/h) for the cumulative-dose display. Not a dosimetry model."""
    r = (DOSE_MSV_PER_H["base"] + saa_intensity * DOSE_MSV_PER_H["saa_peak"]
         + flare_factor * DOSE_MSV_PER_H["flare_x"])
    return round(r * SHIELDING.get(location, 1.0), 4)


@dataclass(frozen=True)
class SleepComponents:
    debt: float
    hrv: float
    fatigue: float
    circadian: float

    @property
    def total(self) -> float:
        return round(W_DEBT * self.debt + W_HRV * self.hrv + W_FATIGUE * self.fatigue
                     + W_CIRCADIAN * self.circadian, 2)


def sleep_components(sleep_debt_h: float, hrv_ms: float, hrv_baseline: float, fatigue_sp: int,
                     sunrises_per_day: float = SUNRISES_FULL_SCALE) -> SleepComponents:
    """Break the sleep deficit into its four 0..100 components (for explainability)."""
    debt = clamp(sleep_debt_h / DEBT_FULL_SCALE_H * 100)
    drop = max(0.0, 1 - hrv_ms / hrv_baseline) if hrv_baseline > 0 else 0.0
    hrv = clamp(drop / HRV_FULL_SCALE_DROP * 100)
    fatigue = clamp((fatigue_sp - 1) / 6 * 100)
    circadian = clamp(sunrises_per_day / SUNRISES_FULL_SCALE * 100)
    return SleepComponents(debt, hrv, fatigue, circadian)


def sleep_deficit_score(sleep_debt_h: float, hrv_ms: float, hrv_baseline: float, fatigue_sp: int,
                        sunrises_per_day: float = SUNRISES_FULL_SCALE) -> float:
    """0..100 sleep deficit score (higher = worse)."""
    return sleep_components(sleep_debt_h, hrv_ms, hrv_baseline, fatigue_sp, sunrises_per_day).total
