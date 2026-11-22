import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { useNavigate } from 'react-router-dom';

import type { CrewMember } from '../api/types';
import { STATUS_TEXT, T, crewColor } from '../theme';
import { AnimatedNumber, Label, Readout, RiskScale, Sparkline, StatusTag } from './ui';

const LOCATION: Record<string, string> = {
  cabin: 'Cabin', sleep_station: 'Sleep station', shielded_area: 'Shielded area', EVA: 'EVA',
};

function Contribution({ label, score, weight, color, hint }: {
  label: string; score: number; weight: number; color: string; hint: string;
}) {
  const pts = score * weight;
  return (
    <Tooltip title={hint} arrow placement="top">
      <Box sx={{ cursor: 'help' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
          <Box sx={{ fontSize: 12, color: T.text2 }}>{label}</Box>
          <Box className="mono" sx={{ fontSize: 12, color: T.text2 }}>
            <Box component="span" sx={{ color: T.text }}>{score.toFixed(0)}</Box>
            <Box component="span" sx={{ color: T.muted }}> × {weight.toFixed(2)} = </Box>
            <Box component="span" sx={{ color: T.text, fontWeight: 500 }}>{pts.toFixed(1)}</Box>
          </Box>
        </Box>
        <Box sx={{ height: 4, bgcolor: T.panel2, borderRadius: 0.5, overflow: 'hidden' }}>
          <Box sx={{ width: `${Math.min(100, score)}%`, height: '100%', bgcolor: color, transition: 'width 650ms ease' }} />
        </Box>
      </Box>
    </Tooltip>
  );
}

export function CrewPanel({ c, history, lighting }: { c: CrewMember; history: number[]; lighting?: string }) {
  const nav = useNavigate();
  const color = crewColor(c.callsign);
  const prev = history.length > 4 ? history[history.length - 5] : undefined;   // ~1 h ago at 15-min steps
  const delta = prev !== undefined ? c.risk - prev : 0;
  const hrvDrop = (1 - c.reading.hrv_ms / c.hrv_baseline) * 100;
  const critical = c.status === 'red';

  return (
    <Box role="button" tabIndex={0} data-testid={`crew-card-${c.callsign}`}
         onClick={() => nav(`/crew?id=${c.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/crew?id=${c.id}`)}
         sx={{
           bgcolor: T.panel, border: `1px solid ${critical ? '#7a2422' : T.line}`, borderRadius: 1, cursor: 'pointer',
           position: 'relative', overflow: 'hidden', transition: 'border-color 200ms, background-color 200ms',
           '&:hover': { borderColor: critical ? '#a33330' : '#3a4350', bgcolor: '#12161b' },
           '&:focus-visible': { outline: `2px solid ${T.accent}`, outlineOffset: 2 },
           boxShadow: critical ? 'inset 0 0 0 1px rgba(211,47,47,.25), 0 0 32px rgba(211,47,47,.12)' : 'none',
         }}>
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: color }} />
      <Box sx={{ px: 2, pt: 1.5, pb: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                 borderBottom: `1px solid ${T.hairline}` }}>
        <Box>
          <Box sx={{ fontWeight: 600, fontSize: 15 }}>{c.callsign}</Box>
          <Box sx={{ fontSize: 12, color: T.muted }}>{c.role}</Box>
        </Box>
        <StatusTag status={c.status} />
      </Box>

      <Box sx={{ px: 2, pt: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Box>
            <Label>Compound risk</Label>
            <Box className="mono" sx={{ fontSize: 44, fontWeight: 500, lineHeight: 1.05, color: STATUS_TEXT[c.status],
                                        letterSpacing: -1 }} data-testid="risk-value">
              <AnimatedNumber value={c.risk} />
              <Box component="span" sx={{ fontSize: 15, color: T.muted, ml: 0.5, letterSpacing: 0 }}>/100</Box>
            </Box>
          </Box>
          {prev !== undefined && delta !== 0 && (
            <Box className="mono" sx={{ fontSize: 12, color: delta > 0 ? STATUS_TEXT.red : STATUS_TEXT.green, pb: 0.75 }}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} <Box component="span" sx={{ color: T.muted }}>vs 1 h</Box>
            </Box>
          )}
        </Box>
        <Box sx={{ mt: 1 }}><RiskScale value={c.risk} /></Box>
        <Box className="mono" sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: T.muted, mt: 0.25 }}>
          <span>0</span><span style={{ marginLeft: '28%' }}>40</span><span style={{ marginLeft: '18%' }}>70</span><span>100</span>
        </Box>
        <Box sx={{ mt: 1.25 }}>
          <Label sx={{ mb: 0.5 }}>24 h trend</Label>
          <Sparkline values={history.length ? history : [c.risk, c.risk]} color={color} />
        </Box>
      </Box>

      <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Contribution label="Radiation" score={c.radiation} weight={0.6} color="#c25450"
                      hint={`Orbit background + SAA intensity + flare factor, × ${LOCATION[c.location] ?? c.location} shielding`} />
        <Contribution label="Sleep deficit" score={c.sleep_deficit} weight={0.4} color="#6f7fd6"
                      hint={`Debt ${c.sleep_components.debt.toFixed(0)} · HRV ${c.sleep_components.hrv.toFixed(0)} · Fatigue ${c.sleep_components.fatigue.toFixed(0)} · Circadian ${c.sleep_components.circadian.toFixed(0)}`} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: `1px solid ${T.hairline}` }}>
        {[
          <Readout key="d" size="sm" label="Sleep debt" value={c.reading.sleep_debt_h.toFixed(1)} unit="h" hint="Rolling 72 h vs 8 h/night" />,
          <Readout key="h" size="sm" label="HRV" value={`${hrvDrop > 0 ? '−' : '+'}${Math.abs(hrvDrop).toFixed(0)}`} unit="%"
                   color={hrvDrop >= 20 ? STATUS_TEXT.amber : undefined} hint={`${c.reading.hrv_ms} ms vs baseline ${c.hrv_baseline} ms`} />,
          <Readout key="f" size="sm" label="Fatigue" value={c.reading.fatigue_sp} unit="/7" hint="Samn-Perelli scale" />,
          <Readout key="r" size="sm" label="Dose rate" value={(c.dose_rate_msv_h * 1000).toFixed(0)} unit="µSv/h" hint="Simulated" />,
        ].map((el, i) => (
          <Box key={i} sx={{ px: 1.5, py: 1, borderRight: i < 3 ? `1px solid ${T.hairline}` : 'none' }}>{el}</Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 0.9, borderTop: `1px solid ${T.hairline}`,
                 fontSize: 11.5, color: T.muted }}>
        <span>Location: <Box component="span" sx={{ color: T.text2 }}>{LOCATION[c.location] ?? c.location}</Box></span>
        {lighting && (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: lighting === 'warm_2700K' ? '#f0a54a' : '#9cc9ff' }} />
            <Box component="span" sx={{ color: T.text2 }}>{lighting === 'warm_2700K' ? 'Warm 2700 K' : 'Cool 6500 K'}</Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
