import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../api/client';
import { useLiveStatus } from '../api/live';
import type { DemoResult } from '../api/types';
import { STATUS_TEXT, T } from '../theme';
import { Label, Panel, fmtTime } from './ui';

type Phase = 'idle' | 'armed' | 'running' | 'done';

function steps(r?: DemoResult & { sim_now?: string }) {
  const crew = r?.crew ?? [];
  const v = (cs: string) => crew.find((c) => c.callsign === cs);
  const eva = r?.schedule.diff.find((d) => d.activity === 'eva');
  const crit = r?.actions.filter((a) => a.priority === 1).length ?? 0;
  return [
    { t: 'Advance clock to next SAA cluster entry', d: r?.sim_now ? `Scenario clock ${fmtTime(r.sim_now)}Z, spacecraft entering SAA` : '' },
    { t: 'Inject X-class solar flare', d: 'GOES X2.1 (2.1×10⁻⁴ W/m²), SAA intensity 0.80' },
    { t: 'Recompute fused risk', d: crew.length ? `V01 ${v('Vyomnaut 01')?.risk} · V02 ${v('Vyomnaut 02')?.risk} · V03 ${v('Vyomnaut 03')?.risk}` : '' },
    { t: 'Decision engine fires actions', d: r ? `${r.actions.length} actions, ${crit} critical, logged as alerts` : '' },
    { t: 'Re-plan 24 h schedule around SAA', d: eva ? `EVA ${eva.from_callsign ?? ''} → ${eva.callsign} at ${fmtTime(eva.to_start)}Z` : '' },
  ];
}

/** Guided, two-step (arm → execute) scenario runner that narrates each engine stage. */
export function ScenarioPanel({ active }: { active: boolean }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { refresh } = useLiveStatus();
  const [phase, setPhase] = useState<Phase>(active ? 'done' : 'idle');
  const [shown, setShown] = useState(active ? 5 : 0);
  const [result, setResult] = useState<(DemoResult & { sim_now?: string }) | undefined>();

  useEffect(() => {
    if (!active && phase === 'done' && !result) { setPhase('idle'); setShown(0); }
    if (active && phase === 'idle') { setPhase('done'); setShown(5); }
  }, [active, phase, result]);

  const run = useMutation({
    mutationFn: api.runDemo,
    onMutate: () => { setPhase('running'); setShown(0); },
    onSuccess: (r) => {
      setResult(r);
      let i = 0;
      const tick = () => {
        i += 1;
        setShown(i);
        if (i < 5) setTimeout(tick, 420);
        else { setPhase('done'); qc.invalidateQueries(); refresh(); }
      };
      setTimeout(tick, 150);
    },
    onError: () => setPhase('idle'),
  });
  const reset = useMutation({
    mutationFn: api.resetDemo,
    onSuccess: () => { setResult(undefined); setPhase('idle'); setShown(0); qc.invalidateQueries(); refresh(); },
  });

  const list = steps(result);
  return (
    <Panel title="Scenario · Solar flare during SAA pass" sx={{ height: '100%' }}
           actions={phase === 'done' ? <Box sx={{ fontSize: 11, color: STATUS_TEXT.amber, fontWeight: 600 }}>ACTIVE</Box> : null}>
      <Box sx={{ fontSize: 13, color: T.text2, mb: 1.75, lineHeight: 1.55 }}>
        Simulates an X-class flare as the spacecraft enters the South Atlantic Anomaly while Vyomnaut 02 is
        sleep-deprived and scheduled for EVA. Deterministic: anchored to the predicted orbit, not the wall clock.
      </Box>
      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, mb: 2 }}>
        {list.map((s, i) => {
          const done = i < shown;
          const current = phase === 'running' && i === shown;
          return (
            <Box component="li" key={s.t} sx={{ display: 'flex', gap: 1.25, py: 0.75, opacity: done || current || phase === 'idle' || phase === 'armed' ? 1 : 0.4 }}>
              <Box className="mono" sx={{
                width: 20, height: 20, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 10.5,
                border: `1px solid ${done ? STATUS_TEXT.green : T.line}`, color: done ? STATUS_TEXT.green : T.muted,
                bgcolor: done ? 'rgba(46,125,50,.15)' : 'transparent',
              }}>
                {current ? <CircularProgress size={11} thickness={6} /> : done ? '✓' : i + 1}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ fontSize: 13, color: done ? T.text : T.text2 }}>{s.t}</Box>
                {done && s.d && <Box className="mono fade-up" sx={{ fontSize: 11.5, color: T.muted, mt: 0.25 }}>{s.d}</Box>}
              </Box>
            </Box>
          );
        })}
      </Box>

      {phase === 'idle' && (
        <Button fullWidth variant="contained" color="error" onClick={() => setPhase('armed')} data-testid="run-demo">
          Arm scenario
        </Button>
      )}
      {phase === 'armed' && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" color="inherit" onClick={() => setPhase('idle')} sx={{ color: T.text2, borderColor: T.line }}>Cancel</Button>
          <Button fullWidth variant="contained" color="error" onClick={() => run.mutate()} data-testid="confirm-demo">
            Execute: inject flare
          </Button>
        </Box>
      )}
      {phase === 'running' && (
        <Button fullWidth variant="outlined" disabled>Running scenario…</Button>
      )}
      {phase === 'done' && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" color="inherit" onClick={() => reset.mutate()} disabled={reset.isPending}
                  sx={{ color: T.text2, borderColor: T.line }}>Reset</Button>
          <Button fullWidth variant="contained" onClick={() => nav('/schedule')}>View re-planned schedule</Button>
        </Box>
      )}
      {run.isError && <Label sx={{ color: STATUS_TEXT.red, mt: 1 }}>Scenario failed: {(run.error as Error).message}</Label>}
    </Panel>
  );
}
