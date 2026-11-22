import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { CrewMember, Schedule } from '../api/types';
import { CrewPanel } from '../components/CrewPanel';
import { Directives } from '../components/Directives';
import { Footer } from '../components/Layout';
import { ScheduleTimeline } from '../components/ScheduleTimeline';
import { RiskScale, StatusTag } from '../components/ui';
import { theme } from '../theme';

vi.mock('../components/Plot', () => ({ default: () => null, PLOT_CONFIG: {} }));

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

const member = (over: Partial<CrewMember> = {}): CrewMember => ({
  id: 2, callsign: 'Vyomnaut 02', name: 'x', role: 'Flight Engineer', location: 'cabin', hrv_baseline: 58, radiation: 82,
  sleep_deficit: 67, risk: 76, status: 'red',
  sleep_components: { debt: 62.5, hrv: 62.5, fatigue: 66.7, circadian: 96.8 },
  reading: { ts: '', sleep_hours: 6, sleep_debt_h: 5, hrv_ms: 43.5, fatigue_sp: 5, heart_rate: 70 },
  dose_rate_msv_h: 0.66, ...over,
});

describe('console components', () => {
  it('shows the honest-limits disclaimer', () => {
    wrap(<Footer />);
    expect(screen.getByTestId('disclaimer')).toHaveTextContent('not a medical device');
    expect(screen.getByTestId('disclaimer')).toHaveTextContent('simulated');
  });

  it('status is conveyed by label, not color alone', () => {
    wrap(<><StatusTag status="red" /><StatusTag status="amber" /><StatusTag status="green" /></>);
    expect(screen.getByTestId('status-red')).toHaveTextContent('Critical');
    expect(screen.getByTestId('status-amber')).toHaveTextContent('Caution');
    expect(screen.getByTestId('status-green')).toHaveTextContent('Nominal');
  });

  it('risk scale exposes its value accessibly', () => {
    wrap(<RiskScale value={76} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '76');
  });

  it('crew panel shows risk, formula contributions and vitals', () => {
    wrap(<CrewPanel c={member()} history={[30, 32, 33, 35, 76]} lighting="warm_2700K" />);
    expect(screen.getByTestId('crew-card-Vyomnaut 02')).toHaveTextContent('Vyomnaut 02');
    expect(screen.getByText('49.2')).toBeInTheDocument();       // 82 x 0.60
    expect(screen.getByText('26.8')).toBeInTheDocument();       // 67 x 0.40
    expect(screen.getByText('Warm 2700 K')).toBeInTheDocument();
  });

  it('directives render with priority and readable labels', () => {
    wrap(<Directives actions={[
      { type: 'POSTPONE_EVA', target: 'Vyomnaut 02', reason: 'r', priority: 1, severity: 'red', astronaut_id: 2 },
      { type: 'REASSIGN_EVA', target: 'Vyomnaut 03', reason: 'r', priority: 1, severity: 'red', astronaut_id: 3 },
    ]} />);
    expect(screen.getByText('Postpone EVA')).toBeInTheDocument();
    expect(screen.getAllByText('P1')).toHaveLength(2);
  });

  it('timeline renders blocks, ghost of moved EVA, and selects on click', () => {
    const sched: Schedule = {
      version: 1, is_baseline: false, saa_passes: [{ start: '2026-11-22T01:30:00Z', end: '2026-11-22T01:50:00Z', peak_intensity: 0.9 }],
      diff: [{ callsign: 'Vyomnaut 03', from_callsign: 'Vyomnaut 02', activity: 'eva', change: 'reassigned',
               from_start: '2026-11-22T01:00:00Z', from_end: '2026-11-22T04:00:00Z', to_start: '2026-11-22T09:00:00Z',
               to_end: '2026-11-22T12:00:00Z', reason: 'RED' }],
      crew: [
        { callsign: 'Vyomnaut 02', blocks: [{ start: '2026-11-22T00:00:00Z', end: '2026-11-23T00:00:00Z', activity: 'work', is_replanned: false, reason: null }] },
        { callsign: 'Vyomnaut 03', blocks: [
          { start: '2026-11-22T00:00:00Z', end: '2026-11-22T09:00:00Z', activity: 'sleep', is_replanned: false, reason: null },
          { start: '2026-11-22T09:00:00Z', end: '2026-11-22T12:00:00Z', activity: 'eva', is_replanned: true, reason: 'Reassigned' },
          { start: '2026-11-22T12:00:00Z', end: '2026-11-23T00:00:00Z', activity: 'work', is_replanned: false, reason: null },
        ] },
      ],
    };
    const onSelect = vi.fn();
    wrap(<ScheduleTimeline schedule={sched} diff={sched.diff} onSelect={onSelect} />);
    expect(screen.getByText('EVA was here')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('eva-block'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ callsign: 'Vyomnaut 03' }));
  });
});
