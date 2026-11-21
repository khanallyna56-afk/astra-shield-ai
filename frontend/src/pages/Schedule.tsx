import AutorenewIcon from '@mui/icons-material/Autorenew';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '../api/client';
import { useLive } from '../api/live';
import type { DiffEntry } from '../api/types';
import { TimelineChart } from '../components/TimelineChart';
import { ACTIVITY_COLORS } from '../theme';

const t = (iso: string | null) => (iso ? iso.slice(11, 16) : '');
const CHANGE_COLOR: Record<string, string> = {
  reassigned: '#b45309', moved: '#0e7490', extended: '#4338ca', deferred: '#b91c1c', unchanged: '#475569',
};

function DiffRow({ d }: { d: DiffEntry }) {
  const from = d.from_start ? `${t(d.from_start)}-${t(d.from_end)}` : '';
  const to = d.to_start ? `${t(d.to_start)}-${t(d.to_end)}` : '';
  return (
    <Box sx={{ borderLeft: 3, borderColor: ACTIVITY_COLORS[d.activity] ?? '#888', pl: 1.5, py: 1, mb: 1,
               bgcolor: 'rgba(148,197,255,0.03)', borderRadius: 1 }} data-testid="diff-row">
      <Box className="flex flex-wrap items-center gap-2">
        <Chip size="small" label={d.change.toUpperCase()} sx={{ bgcolor: CHANGE_COLOR[d.change], color: '#fff', fontWeight: 700 }} />
        <Typography sx={{ fontWeight: 700 }}>{d.activity.toUpperCase()}</Typography>
        <Typography color="text.secondary">
          {d.from_callsign && d.from_callsign !== d.callsign ? `${d.from_callsign} -> ${d.callsign}` : d.callsign}
        </Typography>
        <Typography sx={{ fontFamily: 'monospace' }}>{from}{to && ` -> ${to}`} UTC</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{d.reason}</Typography>
    </Box>
  );
}

export default function Schedule() {
  const live = useLive();
  const qc = useQueryClient();
  const [view, setView] = useState<'latest' | 'baseline'>('latest');
  const sched = useQuery({ queryKey: ['schedule', view, live.data?.demo_active], queryFn: () => api.schedule(view) });
  const latest = useQuery({ queryKey: ['schedule', 'latest', live.data?.demo_active], queryFn: () => api.schedule('latest') });
  const replan = useMutation({ mutationFn: api.replan, onSuccess: () => { setView('latest'); qc.invalidateQueries({ queryKey: ['schedule'] }); } });

  const diff = latest.data?.diff ?? [];
  return (
    <Box className="flex flex-col gap-4">
      <Card>
        <CardContent>
          <Box className="flex flex-wrap items-center justify-between gap-2">
            <Box>
              <Typography variant="overline" color="primary">24 h crew schedule</Typography>
              <Typography variant="body2" color="text.secondary">
                Red bands = predicted SAA passes. Cyan outline = re-planned block. Version {sched.data?.version ?? '-'}
              </Typography>
            </Box>
            <Box className="flex gap-2">
              <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
                <ToggleButton value="baseline">Baseline</ToggleButton>
                <ToggleButton value="latest">Re-planned</ToggleButton>
              </ToggleButtonGroup>
              <Button variant="contained" startIcon={<AutorenewIcon />} onClick={() => replan.mutate()}
                      disabled={replan.isPending}>Re-plan now</Button>
            </Box>
          </Box>
          {sched.data ? <TimelineChart schedule={sched.data} nowIso={live.data?.space.ts} /> : <Skeleton height={360} />}
          <Box className="mt-1 flex flex-wrap gap-2">
            {Object.entries(ACTIVITY_COLORS).map(([a, c]) => (
              <Chip key={a} size="small" label={a.toUpperCase()} sx={{ bgcolor: c, color: '#fff' }} />
            ))}
          </Box>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="overline" color="primary">What changed and why</Typography>
          {latest.data?.version === 0 && (
            <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
              Showing the baseline plan. Press "Re-plan now" or run the Solar Flare Demo to generate a radiation-aware plan.
            </Alert>
          )}
          {latest.data && latest.data.version > 0 && !diff.length && (
            <Typography color="text.secondary" sx={{ mt: 1 }}>No changes needed: the baseline already avoids SAA passes.</Typography>
          )}
          <Box sx={{ mt: 1 }}>{diff.map((d, i) => <DiffRow key={i} d={d} />)}</Box>
        </CardContent>
      </Card>
    </Box>
  );
}
