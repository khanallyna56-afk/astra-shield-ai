import BoltIcon from '@mui/icons-material/Bolt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid2';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../api/client';
import { useLive, useLiveStatus } from '../api/live';
import type { Action, SpaceState } from '../api/types';
import { CrewCard } from '../components/CrewCard';
import { STATUS_COLORS } from '../theme';

const ACTION_LABEL: Record<string, string> = {
  POSTPONE_EVA: 'Postpone EVA',
  REASSIGN_EVA: 'Reassign EVA',
  MOVE_TO_SHIELDED: 'Move to shielded area',
  LIGHTING_WARM: 'Lighting: warm sleep mode',
  ADVISORY: 'Advisory',
  INCREASE_MONITORING: 'Increase monitoring',
};
const SEV_COLOR = { red: STATUS_COLORS.red, amber: STATUS_COLORS.amber, info: '#4a8fd4' };

function useCountdown(target?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const s = Math.max(0, Math.round((new Date(target).getTime() - now) / 1000));
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10 }}>{label}</Typography>
      <Typography variant="h6" sx={{ color, lineHeight: 1.2 }}>{value}</Typography>
    </Box>
  );
}

function OrbitStateCard({ s }: { s: SpaceState }) {
  const nxt = s.next_saa_pass;
  // In a frozen demo scenario the countdown is relative to the scenario clock, so show minutes only.
  const countdown = useCountdown(!s.demo_active && nxt && !nxt.active ? nxt.start : undefined);
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="overline" color="primary">Orbit state</Typography>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={6}><Stat label="Lighting" value={s.sunlit ? 'Sunlit' : 'Eclipse'}
                               color={s.sunlit ? '#fbbf24' : '#818cf8'} /></Grid>
          <Grid size={6}><Stat label="In SAA" value={s.in_saa ? `YES (${s.saa_intensity.toFixed(2)})` : 'No'}
                               color={s.in_saa ? STATUS_COLORS.red : undefined} /></Grid>
          <Grid size={6}><Stat label="Position" value={`${s.lat.toFixed(1)}, ${s.lon.toFixed(1)}`} /></Grid>
          <Grid size={6}><Stat label="Altitude" value={`${s.alt_km.toFixed(0)} km`} /></Grid>
          <Grid size={12}>
            <Stat label="Next SAA pass" value={
              !nxt ? 'None in 24 h'
                : nxt.active ? <span style={{ color: STATUS_COLORS.red }}>IN PROGRESS (peak {nxt.peak_intensity})</span>
                : countdown ?? `in ${nxt.minutes_until.toFixed(0)} min`} />
          </Grid>
          <Grid size={12}>
            <Typography variant="caption" color="text.secondary">
              {s.sunrises_24h} orbital sunrises / 24 h. TLE: {s.tle_source}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

function FlareCard({ s }: { s: SpaceState }) {
  const letter = s.flare_class[0];
  const color = letter === 'X' ? STATUS_COLORS.red : letter === 'M' ? STATUS_COLORS.amber : undefined;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="overline" color="primary">Solar activity</Typography>
        <Typography variant="h3" sx={{ fontWeight: 800, color, mt: 1 }} data-testid="flare-class">
          {s.flare_class}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          GOES 1-8 A flux {s.flare_flux ? s.flare_flux.toExponential(2) : 'n/a'} W/m²
        </Typography>
        <Typography variant="caption" color="text.secondary">{s.flare_source}</Typography>
      </CardContent>
    </Card>
  );
}

export function ActionList({ actions, empty = 'No actions. All crew nominal.' }: { actions: Action[]; empty?: string }) {
  if (!actions.length) return <Typography color="text.secondary" sx={{ py: 2 }}>{empty}</Typography>;
  return (
    <List dense disablePadding>
      {actions.map((a, i) => (
        <ListItem key={i} disableGutters sx={{ borderLeft: 3, borderColor: SEV_COLOR[a.severity], pl: 1.5, mb: 1,
                                               bgcolor: 'rgba(148,197,255,0.03)', borderRadius: 1 }}>
          <ListItemText
            primary={<Box className="flex flex-wrap items-center gap-2">
              <Typography sx={{ fontWeight: 700 }}>{ACTION_LABEL[a.type] ?? a.type}</Typography>
              <Chip size="small" label={a.target} variant="outlined" />
            </Box>}
            secondary={a.reason}
          />
        </ListItem>
      ))}
    </List>
  );
}

export default function Overview() {
  const live = useLive();
  const { refresh } = useLiveStatus();
  const qc = useQueryClient();
  const onDone = () => { qc.invalidateQueries(); refresh(); };
  const demo = useMutation({ mutationFn: api.runDemo, onSuccess: onDone });
  const reset = useMutation({ mutationFn: api.resetDemo, onSuccess: onDone });

  if (live.isError) return <Alert severity="error">Cannot reach the backend API. Is it running on port 8000?</Alert>;
  if (!live.data) return <Skeleton variant="rounded" height={420} />;
  const d = live.data;
  const active = d.demo_active;

  return (
    <Box className="flex flex-col gap-4">
      <Card sx={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.10), rgba(124,156,255,0.06))' }}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <Box>
            <Typography variant="h5">Radiation + sleep compound risk</Typography>
            <Typography variant="body2" color="text.secondary">
              Risk = 0.60 x Radiation + 0.40 x Sleep deficit. GREEN &lt; 40, AMBER 40-69, RED &ge; 70.
            </Typography>
          </Box>
          <Box className="flex gap-2">
            {active && (
              <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={() => reset.mutate()}
                      disabled={reset.isPending}>Reset</Button>
            )}
            <Button variant="contained" color="error" size="large" data-testid="run-demo"
                    startIcon={demo.isPending ? <CircularProgress size={18} color="inherit" /> : <BoltIcon />}
                    onClick={() => demo.mutate()} disabled={demo.isPending}>
              Run Solar Flare Demo
            </Button>
          </Box>
        </CardContent>
      </Card>
      {demo.isError && <Alert severity="error">Demo failed: {(demo.error as Error).message}</Alert>}
      {active && (
        <Alert severity="warning" variant="outlined">
          Scenario active: {d.space.flare_class} flare injected while the spacecraft enters an SAA pass. Mission clock
          frozen at {d.space.ts.slice(11, 16)} UTC. See Smart Schedule for the re-plan.
        </Alert>
      )}

      <Grid container spacing={2}>
        {d.crew.map((c) => (
          <Grid key={c.id} size={{ xs: 12, md: 4 }}>
            <CrewCard c={c} lighting={d.lighting[c.callsign]} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}><OrbitStateCard s={d.space} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><FlareCard s={d.space} /></Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="overline" color="primary">Top actions</Typography>
              <ActionList actions={(d.top_actions ?? d.actions).slice(0, 5)} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
