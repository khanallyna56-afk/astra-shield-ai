import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { useQuery } from '@tanstack/react-query';
import type { Data, Layout } from 'plotly.js';
import { useSearchParams } from 'react-router-dom';

import { api } from '../api/client';
import { useLive } from '../api/live';
import type { CrewMember } from '../api/types';
import Plot, { PLOT_CONFIG } from '../components/Plot';
import { Label, Panel, Readout, StatusTag } from '../components/ui';
import { PLOT_LAYOUT_BASE, STATUS_TEXT, T, crewColor } from '../theme';

function Chart({ title, data, layout, note }: { title: string; data: Data[]; layout?: Partial<Layout>; note?: string }) {
  return (
    <Panel title={title} sx={{ height: '100%' }}>
      <Plot data={data} layout={{ ...PLOT_LAYOUT_BASE, height: 220, showlegend: data.length > 1, ...layout }}
            config={PLOT_CONFIG} style={{ width: '100%' }} useResizeHandler />
      {note && <Box sx={{ fontSize: 11.5, color: T.muted, mt: 0.5 }}>{note}</Box>}
    </Panel>
  );
}

function Detail({ c }: { c: CrewMember }) {
  const q = useQuery({ queryKey: ['readings', c.id, c.risk], queryFn: () => api.readings(c.id, 72), placeholderData: (p) => p });
  const color = crewColor(c.callsign);
  const hrvDrop = (1 - c.reading.hrv_ms / c.hrv_baseline) * 100;
  const sc = c.sleep_components;

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'grid', gap: 0, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(6, 1fr)' },
                 border: `1px solid ${T.line}`, borderRadius: 1, bgcolor: T.panel }}>
        {[
          <Readout key="r" size="lg" label="Compound risk" value={c.risk} unit="/100" color={STATUS_TEXT[c.status]} />,
          <Readout key="rad" size="lg" label="Radiation" value={c.radiation.toFixed(0)} hint="0.60 weight" />,
          <Readout key="sl" size="lg" label="Sleep deficit" value={c.sleep_deficit.toFixed(0)} hint="0.40 weight" />,
          <Readout key="d" size="lg" label="Sleep debt" value={c.reading.sleep_debt_h.toFixed(1)} unit="h" hint="Rolling 72 h vs 8 h/night" />,
          <Readout key="h" size="lg" label="HRV" value={c.reading.hrv_ms.toFixed(0)} unit={`ms (${hrvDrop > 0 ? '−' : '+'}${Math.abs(hrvDrop).toFixed(0)}%)`}
                   color={hrvDrop >= 20 ? STATUS_TEXT.amber : undefined} hint={`Baseline ${c.hrv_baseline} ms`} />,
          <Readout key="dose" size="lg" label="Dose · 72 h" value={q.data ? q.data.dose.total_msv.toFixed(2) : '–'} unit="mSv" hint="Simulated along the real ground track" />,
        ].map((el, i) => (
          <Box key={i} sx={{ p: 2, borderRight: { md: i < 5 ? `1px solid ${T.hairline}` : 'none' }, borderBottom: { xs: `1px solid ${T.hairline}`, md: 'none' } }}>{el}</Box>
        ))}
      </Box>

      <Panel title="Sleep-deficit breakdown">
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
          {[['Sleep debt', sc.debt, 0.4], ['HRV suppression', sc.hrv, 0.25], ['Fatigue', sc.fatigue, 0.25], ['Circadian load', sc.circadian, 0.1]].map(([l, v, wgt]) => (
            <Box key={l as string}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Box sx={{ fontSize: 12.5, color: T.text2 }}>{l}</Box>
                <Box className="mono" sx={{ fontSize: 12, color: T.muted }}>{(v as number).toFixed(0)} × {(wgt as number).toFixed(2)}</Box>
              </Box>
              <Box sx={{ height: 6, bgcolor: T.panel2, borderRadius: 0.5 }}>
                <Box sx={{ width: `${v}%`, height: '100%', bgcolor: '#6f7fd6', borderRadius: 0.5, transition: 'width 600ms' }} />
              </Box>
            </Box>
          ))}
        </Box>
      </Panel>

      {!q.data ? <Skeleton variant="rounded" height={480} sx={{ bgcolor: T.panel }} /> : (() => {
        const r = q.data.readings;
        const ts = r.map((x) => x.ts);
        const trend = q.data.risk_trend;
        return (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
            <Chart title="Sleep debt · 72 h" data={[
              { type: 'scatter', mode: 'lines', x: ts, y: r.map((x) => x.sleep_debt_h), name: 'Sleep debt (h)',
                line: { color, width: 2 }, fill: 'tozeroy', fillcolor: `${color}22`, hovertemplate: '%{y:.1f} h<extra></extra>' },
            ]} layout={{ yaxis: { ...PLOT_LAYOUT_BASE.yaxis, rangemode: 'tozero', ticksuffix: ' h' } }}
                   note="Threshold for sleep protection in the scheduler: 4 h" />
            <Chart title="HRV vs personal baseline" data={[
              { type: 'scatter', mode: 'lines', x: ts, y: r.map((x) => x.hrv_ms), name: 'HRV', line: { color, width: 2 },
                hovertemplate: '%{y:.0f} ms<extra></extra>' },
              { type: 'scatter', mode: 'lines', x: [ts[0], ts[ts.length - 1]], y: [c.hrv_baseline, c.hrv_baseline], name: 'Baseline',
                line: { color: T.muted, width: 1, dash: 'dash' }, hoverinfo: 'skip' },
            ]} layout={{ yaxis: { ...PLOT_LAYOUT_BASE.yaxis, ticksuffix: ' ms' } }} />
            <Chart title="Fatigue · Samn-Perelli (1 alert – 7 exhausted)" data={[
              { type: 'scatter', mode: 'lines', x: ts, y: r.map((x) => x.fatigue_sp), name: 'Fatigue', line: { shape: 'hv', color, width: 2 },
                hovertemplate: '%{y} / 7<extra></extra>' },
            ]} layout={{ yaxis: { ...PLOT_LAYOUT_BASE.yaxis, range: [0.5, 7.5], dtick: 1 } }} />
            <Chart title="Cumulative dose · simulated" data={[
              { type: 'scatter', mode: 'lines', x: q.data.dose.series.map((p) => p.ts), y: q.data.dose.series.map((p) => p.msv), name: 'Dose',
                line: { color, width: 2 }, hovertemplate: '%{y:.3f} mSv<extra></extra>' },
            ]} layout={{ yaxis: { ...PLOT_LAYOUT_BASE.yaxis, ticksuffix: ' mSv', rangemode: 'tozero' } }} />
            <Box sx={{ gridColumn: { lg: '1 / -1' } }}>
              <Chart title="Radiation vs sleep-deficit score · 24 h" data={[
                { type: 'scatter', mode: 'lines', x: trend.map((p) => p.ts), y: trend.map((p) => p.radiation), name: 'Radiation',
                  line: { color: '#c25450', width: 2 }, hovertemplate: 'Radiation %{y:.0f}<extra></extra>' },
                { type: 'scatter', mode: 'lines', x: trend.map((p) => p.ts), y: trend.map((p) => p.sleep_deficit), name: 'Sleep deficit',
                  line: { color: '#6f7fd6', width: 2 }, hovertemplate: 'Sleep %{y:.0f}<extra></extra>' },
              ]} layout={{ yaxis: { ...PLOT_LAYOUT_BASE.yaxis, range: [0, 100] } }}
                     note="Radiation spikes follow SAA passes; the sleep score moves slowly. Risk is critical when both are high." />
            </Box>
          </Box>
        );
      })()}
    </Box>
  );
}

export default function Crew() {
  const live = useLive();
  const [params, setParams] = useSearchParams();
  const crew = live.data?.crew ?? [];
  if (!crew.length) return <Skeleton variant="rounded" height={420} sx={{ bgcolor: T.panel }} />;
  const id = Number(params.get('id')) || crew[0].id;
  const c = crew.find((m) => m.id === id) ?? crew[0];

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }} role="tablist">
        {crew.map((m) => {
          const active = m.id === c.id;
          return (
            <Box key={m.id} role="tab" aria-selected={active} tabIndex={0}
                 onClick={() => setParams({ id: String(m.id) })} onKeyDown={(e) => e.key === 'Enter' && setParams({ id: String(m.id) })}
                 sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, cursor: 'pointer', borderRadius: 1,
                       bgcolor: active ? T.raised : T.panel, border: `1px solid ${active ? '#3a4350' : T.line}`,
                       boxShadow: active ? `inset 0 -2px 0 ${crewColor(m.callsign)}` : 'none', '&:hover': { bgcolor: T.panel2 } }}>
              <Box sx={{ width: 3, height: 28, bgcolor: crewColor(m.callsign), borderRadius: 0.5 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ fontWeight: 600, fontSize: 14 }}>{m.callsign}</Box>
                <Box sx={{ fontSize: 11.5, color: T.muted }}>{m.role}</Box>
              </Box>
              <Box className="mono" sx={{ fontSize: 20, color: STATUS_TEXT[m.status] }}>{m.risk}</Box>
              <StatusTag status={m.status} compact />
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', color: T.text2, fontSize: 12.5 }}>
        <Label>Profile</Label>{c.name} · {c.role} · biometrics simulated
      </Box>
      <Detail c={c} />
    </Box>
  );
}
