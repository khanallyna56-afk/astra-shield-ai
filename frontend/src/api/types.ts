export type Status = 'green' | 'amber' | 'red';

export interface Reading {
  ts: string;
  sleep_hours: number;
  sleep_debt_h: number;
  hrv_ms: number;
  fatigue_sp: number;
  heart_rate: number;
}

export interface CrewMember {
  id: number;
  callsign: string;
  name: string;
  role: string;
  location: string;
  hrv_baseline: number;
  radiation: number;
  sleep_deficit: number;
  risk: number;
  status: Status;
  sleep_components: { debt: number; hrv: number; fatigue: number; circadian: number };
  reading: Reading;
  dose_rate_msv_h: number;
}

export interface SaaPass {
  start: string;
  end: string;
  peak_intensity: number;
  duration_min?: number;
}

export interface SpaceState {
  ts: string;
  lat: number;
  lon: number;
  alt_km: number;
  sunlit: boolean;
  in_saa: boolean;
  saa_intensity: number;
  flare_class: string;
  flare_flux: number;
  flare_source: string;
  next_saa_pass: (SaaPass & { active: boolean; minutes_until: number }) | null;
  sunrises_24h: number;
  orbits_per_day: number;
  tle_source: string;
  tle_epoch: string;
  eclipse_model: string;
  data_mode: 'live' | 'offline';
  demo_active: boolean;
}

export interface Action {
  type: string;
  target: string;
  reason: string;
  priority: number;
  severity: 'red' | 'amber' | 'info';
  astronaut_id: number | null;
}

export interface Alert {
  id: number;
  ts: string;
  severity: 'red' | 'amber' | 'info';
  astronaut_id: number | null;
  callsign: string | null;
  action_type: string;
  message: string;
  acknowledged: boolean;
}

export interface LivePayload {
  type: 'tick';
  ts: string;
  space: SpaceState;
  crew: CrewMember[];
  actions: Action[];
  lighting: Record<string, 'warm_2700K' | 'cool_6500K'>;
  alerts: Alert[];
  any_red: boolean;
  demo_active: boolean;
  top_actions?: Action[];
}

export interface TrackPoint {
  ts: string;
  lat: number;
  lon: number;
  alt_km: number;
  sunlit: boolean;
  in_saa: boolean;
  saa_intensity: number;
}

export interface GroundTrack {
  start: string;
  step_s: number;
  points: TrackPoint[];
  saa_polygon: { lat: number; lon: number }[];
  eclipse_windows: { start: string; end: string }[];
}

export interface Flares {
  source: string;
  instrument: string;
  units: string;
  series: { time: string; flux: number }[];
  current: { flare_class: string; flare_flux: number; source: string };
  class_bands: { class: string; min_flux: number }[];
}

export interface RiskPoint {
  ts: string;
  risk: number;
  radiation: number;
  sleep_deficit: number;
  status: Status;
}

export interface RiskSeries {
  callsign: string;
  astronaut_id: number;
  points: RiskPoint[];
}

export interface CrewReadings {
  astronaut: { id: number; callsign: string; name: string; role: string; hrv_baseline: number; location: string };
  readings: Reading[];
  dose: { total_msv: number; series: { ts: string; msv: number }[]; simulated: boolean };
  risk_trend: RiskPoint[];
  simulated: boolean;
}

export interface ScheduleBlock {
  start: string;
  end: string;
  activity: string;
  is_replanned: boolean;
  reason: string | null;
}

export interface DiffEntry {
  callsign: string;
  activity: string;
  change: string;
  from_start: string | null;
  from_end: string | null;
  to_start: string | null;
  to_end: string | null;
  reason: string;
  from_callsign?: string;
}

export interface Schedule {
  version: number;
  is_baseline: boolean;
  crew: { callsign: string; blocks: ScheduleBlock[] }[];
  saa_passes: SaaPass[];
  diff: DiffEntry[];
}

export interface DemoResult {
  scenario: string;
  crew: CrewMember[];
  actions: Action[];
  schedule: Schedule;
}
