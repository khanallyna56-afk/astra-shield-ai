import type {
  Alert,
  CrewMember,
  CrewReadings,
  DemoResult,
  Flares,
  GroundTrack,
  LivePayload,
  RiskSeries,
  SaaPass,
  Schedule,
  SpaceState,
} from './types';

/**
 * API origin. Empty = same origin (Vite dev proxy or nginx).
 * Split deployments set VITE_API_URL (full URL) or VITE_API_HOST (bare host, e.g. from a Render blueprint).
 */
const host = import.meta.env.VITE_API_HOST as string | undefined;
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) || (host ? `https://${host}` : ''))
  .replace(/\/$/, '');

export function wsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;
  if (API_BASE) return API_BASE.replace(/^http/, 'ws') + '/ws/live';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws/live`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string; db: boolean; data_mode: string }>('/api/health'),
  overview: () => request<LivePayload>('/api/mission/overview'),
  spaceState: () => request<SpaceState>('/api/space/state'),
  groundTrack: (hours = 24) => request<GroundTrack>(`/api/space/groundtrack?hours=${hours}`),
  saaPasses: (hours = 24) => request<SaaPass[]>(`/api/space/saa-passes?hours=${hours}`),
  flares: () => request<Flares>('/api/space/flares'),
  crew: () => request<CrewMember[]>('/api/crew'),
  readings: (id: number, hours = 72) => request<CrewReadings>(`/api/crew/${id}/readings?hours=${hours}`),
  riskHistory: (hours = 24) => request<RiskSeries[]>(`/api/risk/history?hours=${hours}`),
  schedule: (version: 'baseline' | 'latest') => request<Schedule>(`/api/schedule?version=${version}`),
  replan: () => request<Schedule>('/api/schedule/replan', { method: 'POST' }),
  alerts: () => request<Alert[]>('/api/alerts'),
  ackAlert: (id: number) => request<Alert>(`/api/alerts/${id}/ack`, { method: 'POST' }),
  runDemo: () => request<DemoResult>('/api/demo/solar-flare', { method: 'POST' }),
  resetDemo: () => request<{ reset: boolean }>('/api/demo/reset', { method: 'POST' }),
};
