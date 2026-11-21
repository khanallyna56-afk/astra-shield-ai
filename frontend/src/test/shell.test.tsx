import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AlertBanner } from '../components/AlertBanner';
import { Footer } from '../components/Layout';
import { RiskGauge } from '../components/RiskGauge';
import { StatusChip } from '../components/StatusChip';
import { theme } from '../theme';
import type { CrewMember } from '../api/types';

vi.mock('../components/Plot', () => ({ default: () => null, PLOT_CONFIG: {} }));

export function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

const member = (over: Partial<CrewMember>): CrewMember => ({
  id: 1, callsign: 'Vyomnaut 02', name: 'x', role: 'r', location: 'cabin', hrv_baseline: 58, radiation: 82,
  sleep_deficit: 67, risk: 76, status: 'red',
  sleep_components: { debt: 1, hrv: 1, fatigue: 1, circadian: 1 },
  reading: { ts: '', sleep_hours: 6, sleep_debt_h: 5, hrv_ms: 43.5, fatigue_sp: 5, heart_rate: 70 },
  dose_rate_msv_h: 0.1, ...over,
});

describe('shell components', () => {
  it('shows the honest-limits disclaimer', () => {
    wrap(<Footer />);
    expect(screen.getByTestId('disclaimer')).toHaveTextContent('not a medical device');
    expect(screen.getByTestId('disclaimer')).toHaveTextContent('simulated');
  });

  it('renders the risk value and status chip', () => {
    wrap(<><RiskGauge value={76} status="red" /><StatusChip status="red" /></>);
    expect(screen.getByTestId('risk-value')).toHaveTextContent('76');
    expect(screen.getByTestId('status-red')).toHaveTextContent('RED');
  });

  it('alert banner appears only when someone is red', () => {
    const { rerender } = wrap(<AlertBanner crew={[member({ status: 'amber', risk: 50 })]} />);
    expect(screen.queryByTestId('alert-banner')).toBeNull();
    rerender(<ThemeProvider theme={theme}><AlertBanner crew={[member({})]} /></ThemeProvider>);
    expect(screen.getByTestId('alert-banner')).toHaveTextContent('Vyomnaut 02 (76)');
  });
});
