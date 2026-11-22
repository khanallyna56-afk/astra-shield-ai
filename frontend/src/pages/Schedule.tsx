import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '../api/client';
import { useLive } from '../api/live';
import type { DiffEntry, Status } from '../api/types';
import { ScheduleTimeline, type Selected } from '../components/ScheduleTimeline';
import { Label, Panel, Readout, fmtTime } from '../components/ui';
import { ACTIVITY_COLORS, ACTIVITY_LABEL, STATUS_TEXT, T } from '../theme';

const CHANGE: Record<string, { label: string; color: string }> = {
  reassigned: { label: 'Reassigned', color: '#e0a526' },
  moved: { label: 'Moved', color: '#3987e5' },
  extended: { label: 'Extended', color: '#9085e9' },
  deferred: { label: 'Deferred', color: STATUS_TEXT.red },
  unchanged: { label: 'Unchanged', color: T.muted },
};

const hours = (a: string | null, b: string | null) => (a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 3600e3 : 0);

function DiffItem({ d, i, onFocus }: { d: DiffEntry; i: number; onFocus: () => void }) {
  const ch = CHANGE[d.change] ?? CHANGE.unchanged;
  const who = d.from_callsign && d.from_callsign !== d.callsign ? `${d.from_callsign} → ${d.callsign}` : d.callsign;
  return (
    <Box data-testid="diff-row" className="fade-up" onClick={onFocus} sx={{
      display: 'grid', gridTemplateColumns: { xs: '1fr', md: '24px 200px 230px 1fr' }, gap: 1.5, alignItems: 'start', py: 1.25, px: 2,
      borderBottom: `1px solid ${T.hairline}`, cursor: 'pointer', animationDelay: `${i * 60}ms`, '&:hover': { bgcolor: T.panel2 },
    }}>
      <Box className="mono" sx={{ fontSize: 11, color: T.muted, pt: 0.25 }}>{String(i + 1).padStart(2, '0')}</Box>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: ACTIVITY_COLORS[d.activity] }} />
          <Box sx={{ fontWeight: 600, fontSize: 13.5 }}>{ACTIVITY_LABEL[d.activity] ?? d.activity}</Box>
          <Box sx={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: ch.color }}>{ch.label}</Box>
        </Box>
        <Box sx={{ fontSize: 12, color: T.text2, mt: 0.25 }}>{who}</Box>
      </Box>
      <Box className="mono" sx={{ fontSize: 12.5 }}>
        {d.from_start && <Box component="span" sx={{ color: T.muted, textDecoration: d.to_start ? 'line-through' : 'none' }}>{fmtTime(d.from_start)}–{fmtTime(d.from_end)}</Box>}
        {d.to_start && <><Box component="span" sx={{ color: T.muted }}> → </Box><Box component="span" sx={{ color: T.text }}>{fmtTime(d.to_start)}–{fmtTime(d.to_end)}</Box></>}
        <Box component="span" sx={{ color: T.muted }}> Z</Box>
        {d.change === 'extended' && <Box sx={{ fontSize: 11, color: T.muted }}>{hours(d.from_start, d.from_end).toFixed(1)} h → {hours(d.to_start, d.to_end).toFixed(1)} h</Box>}
      </Box>
      <Box sx={{ fontSize: 12.5, color: T.text2, lineHeight: 1.55 }}>{d.reason}</Box>
    </Box>
  );
}

export default function Schedule() {
  const live = useLive();
  const qc = useQueryClient();
  const [view, setView] = useState<'latest' | 'baseline'>('latest');
  const [ghosts, setGhosts] = useState(true);
  const [selected, setSelected] = useState<Selected | null>(null);
  const k = live.data?.demo_active;
  const latest = useQuery({ queryKey: ['schedule', 'latest', k], queryFn: () => api.schedule('latest'), placeholderData: (p) => p });
  const baseline = useQuery({ queryKey: ['schedule', 'baseline', k], queryFn: () => api.schedule('baseline'), placeholderData: (p) => p });
  const replan = useMutation({ mutationFn: api.replan, onSuccess: () => { setView('latest'); qc.invalidateQueries({ queryKey: ['schedule'] }); } });

  const shown = view === 'baseline' ? baseline.data : latest.data;
  const diff = latest.data?.diff ?? [];
  const status = Object.fromEntries((live.data?.crew ?? []).map((c) => [c.callsign, c.status])) as Record<string, Status>;
  const evaOwner = latest.data?.crew.find((c) => c.blocks.some((b) => b.activity === 'eva'))?.callsign;
  const evaBlock = latest.data?.crew.flatMap((c) => c.blocks).find((b) => b.activity === 'eva');
  const workH = (s?: typeof shown) => (s?.crew ?? []).flatMap((c) => c.blocks).filter((b) => b.activity === 'work')
    .reduce((t, b) => t + hours(b.start, b.end), 0);

  const focus = (d: DiffEntry) => {
    const cs = d.callsign;
    const blk = latest.data?.crew.find((c) => c.callsign === cs)?.blocks.find((b) => b.start === d.to_start && b.activity === d.activity);
    setView('latest');
    if (blk) setSelected({ callsign: cs, block: blk });
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'grid', gap: 0, gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(5, 1fr)' },
                 border: `1px solid ${T.line}`, borderRadius: 1, bgcolor: T.panel }}>
        {[
          <Readout key="v" label="Plan version" value={latest.data ? (latest.data.version ? `v${latest.data.version}` : 'Baseline') : '–'} />,
          <Readout key="c" label="Changes" value={diff.length} />,
          <Readout key="e" label="EVA assigned to" value={evaOwner ?? 'Deferred'} color={evaOwner ? undefined : STATUS_TEXT.red} />,
          <Readout key="t" label="EVA window" value={evaBlock ? `${fmtTime(evaBlock.start)}–${fmtTime(evaBlock.end)}Z` : '–'} />,
          <Readout key="w" label="Crew work hours" value={workH(latest.data).toFixed(1)} unit={`h (baseline ${workH(baseline.data).toFixed(1)})`} />,
        ].map((el, i) => (
          <Box key={i} sx={{ p: 2, borderRight: { md: i < 4 ? `1px solid ${T.hairline}` : 'none' } }}>{el}</Box>
        ))}
      </Box>

      <Panel title="24 h crew timeline" actions={
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControlLabel control={<Switch size="small" checked={ghosts} onChange={(e) => setGhosts(e.target.checked)} />}
                            label={<Box sx={{ fontSize: 12, color: T.text2 }}>Show original positions</Box>} sx={{ mr: 0 }} />
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
            <ToggleButton value="baseline">Baseline</ToggleButton>
            <ToggleButton value="latest">Re-planned</ToggleButton>
          </ToggleButtonGroup>
          <Button size="small" variant="contained" onClick={() => replan.mutate()} disabled={replan.isPending}>Re-plan now</Button>
        </Box>
      }>
        {shown ? (
          <ScheduleTimeline schedule={shown} diff={view === 'latest' ? diff : []} ghosts={ghosts} nowIso={live.data?.space.ts}
                            status={status} selected={selected} onSelect={setSelected} />
        ) : <Skeleton height={260} />}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1.5, alignItems: 'center' }}>
          {Object.entries(ACTIVITY_COLORS).map(([a, c]) => (
            <Box key={a} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: T.text2 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: c, borderRadius: 0.5 }} />{ACTIVITY_LABEL[a]}
            </Box>
          ))}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: T.text2 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: 'rgba(211,47,47,.3)', border: '1px solid rgba(255,107,102,.5)' }} />SAA pass
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: T.text2 }}>
            <Box sx={{ width: 12, height: 12, outline: `1.5px solid ${T.accent}`, outlineOffset: -1 }} />Re-planned
          </Box>
        </Box>
        {selected && (
          <Box className="fade-up" sx={{ mt: 2, p: 1.5, border: `1px solid ${T.line}`, borderRadius: 1, bgcolor: T.panel2,
                                         display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <Readout size="sm" label="Block" value={`${ACTIVITY_LABEL[selected.block.activity]} · ${selected.callsign}`} />
            <Readout size="sm" label="Window" value={`${fmtTime(selected.block.start)}–${fmtTime(selected.block.end)}Z`} />
            <Readout size="sm" label="Duration" value={hours(selected.block.start, selected.block.end).toFixed(1)} unit="h" />
            <Box sx={{ flex: 1, minWidth: 240, fontSize: 12.5, color: T.text2 }}>
              {selected.block.reason ?? 'Unchanged from baseline.'}
            </Box>
            <Button size="small" onClick={() => setSelected(null)} sx={{ color: T.text2 }}>Close</Button>
          </Box>
        )}
      </Panel>

      <Panel title="Change log · why the plan moved" pad={false}>
        {latest.data?.version === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Box sx={{ color: T.text2, fontSize: 13 }}>This is the baseline plan. No radiation-aware re-plan has been generated yet.</Box>
            <Box sx={{ color: T.muted, fontSize: 12, mt: 0.5 }}>Press “Re-plan now”, or run the solar flare scenario from Overview.</Box>
          </Box>
        ) : diff.length ? (
          <>
            <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '24px 200px 230px 1fr', gap: 1.5, px: 2, py: 1, borderBottom: `1px solid ${T.hairline}` }}>
              <Label>#</Label><Label>Block</Label><Label>Time (UTC)</Label><Label>Reason</Label>
            </Box>
            {diff.map((d, i) => <DiffItem key={i} d={d} i={i} onFocus={() => focus(d)} />)}
          </>
        ) : (
          <Box sx={{ p: 3, color: T.text2, fontSize: 13 }}>No changes needed: the baseline already avoids SAA passes.</Box>
        )}
      </Panel>
    </Box>
  );
}
