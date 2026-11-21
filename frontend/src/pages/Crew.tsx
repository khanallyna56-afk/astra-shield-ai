import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid2';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import type { Data, Layout } from 'plotly.js';
import { useState } from 'react';

import { api } from '../api/client';
import { useLive } from '../api/live';
import type { CrewMember } from '../api/types';
import Plot, { PLOT_CONFIG } from '../components/Plot';
import { StatusChip } from '../components/StatusChip';
import { PLOT_LAYOUT_BASE } from '../theme';

function Chart({ title, data, layout }: { title: string; data: Data[]; layout?: Partial<Layout> }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="overline" color="primary">{title}</Typography>
        <Plot data={data} layout={{ ...PLOT_LAYOUT_BASE, height: 260, ...layout }} config={PLOT_CONFIG}
              style={{ width: '100%' }} useResizeHandler />
      </CardContent>
    </Card>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10 }}>{label}</Typography>
        <Typography variant="h5">{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function CrewDetail({ c }: { c: CrewMember }) {
  const q = useQuery({ queryKey: ['readings', c.id], queryFn: () => api.readings(c.id, 72) });
  if (!q.data) return <Skeleton variant="rounded" height={400} />;
  const r = q.data.readings;
  const ts = r.map((x) => x.ts);
  const hrvDrop = Math.round((1 - c.reading.hrv_ms / c.hrv_baseline) * 100);
  return (
    <Box className="flex flex-col gap-2">
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Compound risk" value={`${c.risk}`} sub={c.status.toUpperCase()} /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Sleep debt (72 h)" value={`${c.reading.sleep_debt_h.toFixed(1)} h`} sub="vs 8 h/night target" /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><Tile label="HRV" value={`${c.reading.hrv_ms.toFixed(0)} ms`} sub={`${hrvDrop > 0 ? '-' : '+'}${Math.abs(hrvDrop)}% vs baseline ${c.hrv_baseline}`} /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Fatigue (Samn-Perelli)" value={`${c.reading.fatigue_sp} / 7`} /></Grid>
        <Grid size={{ xs: 12, md: 2.4 }}><Tile label="Dose, last 72 h (sim.)" value={`${q.data.dose.total_msv.toFixed(2)} mSv`} sub={`now ${c.dose_rate_msv_h.toFixed(3)} mSv/h`} /></Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Chart title="Sleep: hours per night and rolling debt (72 h)" data={[
            { type: 'scatter', mode: 'lines', x: ts, y: r.map((x) => x.sleep_hours), name: 'Sleep h', line: { color: '#7c9cff' } },
            { type: 'scatter', mode: 'lines', x: ts, y: r.map((x) => x.sleep_debt_h), name: 'Debt h', line: { color: '#ed6c02' }, fill: 'tozeroy', fillcolor: 'rgba(237,108,2,0.12)' },
          ]} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Chart title="HRV vs personal baseline" data={[
            { type: 'scatter', mode: 'lines', x: ts, y: r.map((x) => x.hrv_ms), name: 'HRV ms', line: { color: '#22d3ee' } },
            { type: 'scatter', mode: 'lines', x: [ts[0], ts[ts.length - 1]], y: [c.hrv_baseline, c.hrv_baseline], name: 'Baseline', line: { color: '#8fa6c3', dash: 'dash' } },
          ]} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Chart title="Fatigue (1 alert .. 7 exhausted)" data={[
            { type: 'scatter', mode: 'lines', line: { shape: 'hv', color: '#e0a526' }, x: ts, y: r.map((x) => x.fatigue_sp), name: 'Fatigue' },
          ]} layout={{ yaxis: { ...PLOT_LAYOUT_BASE.yaxis, range: [0.5, 7.5], dtick: 1 } }} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Chart title="Cumulative dose (simulated mSv)" data={[
            { type: 'scatter', mode: 'lines', x: q.data.dose.series.map((p) => p.ts), y: q.data.dose.series.map((p) => p.msv), name: 'mSv', line: { color: '#ef5350' }, fill: 'tozeroy', fillcolor: 'rgba(239,83,80,0.10)' },
          ]} />
        </Grid>
        <Grid size={12}>
          <Chart title="Radiation vs sleep-deficit sub-scores (24 h)" data={[
            { type: 'scatter', mode: 'lines', x: q.data.risk_trend.map((p) => p.ts), y: q.data.risk_trend.map((p) => p.radiation), name: 'Radiation', line: { color: '#ef5350' } },
            { type: 'scatter', mode: 'lines', x: q.data.risk_trend.map((p) => p.ts), y: q.data.risk_trend.map((p) => p.sleep_deficit), name: 'Sleep deficit', line: { color: '#7c9cff' } },
          ]} layout={{ yaxis: { ...PLOT_LAYOUT_BASE.yaxis, range: [0, 100] } }} />
        </Grid>
      </Grid>
    </Box>
  );
}

export default function Crew() {
  const live = useLive();
  const [tab, setTab] = useState(0);
  const crew = live.data?.crew ?? [];
  if (!crew.length) return <Skeleton variant="rounded" height={420} />;
  const c = crew[Math.min(tab, crew.length - 1)];
  return (
    <Box className="flex flex-col gap-3">
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
        {crew.map((m) => (
          <Tab key={m.id} label={<Box className="flex items-center gap-2">{m.callsign}<StatusChip status={m.status} /></Box>} />
        ))}
      </Tabs>
      <Typography variant="body2" color="text.secondary">{c.name} · {c.role} · simulated biometrics</Typography>
      <CrewDetail c={c} />
    </Box>
  );
}
