import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useLive, useLiveStatus } from '../api/live';
import type { Alert, LivePayload } from '../api/types';
import { STATUS_TEXT, T } from '../theme';
import { Dot, Kbd, Label, fmtTime } from './ui';

export const NAV = [
  { to: '/', label: 'Overview', title: 'Mission Overview' },
  { to: '/space', label: 'Orbit & Radiation', title: 'Orbit & Radiation' },
  { to: '/crew', label: 'Crew Health', title: 'Crew Health' },
  { to: '/decisions', label: 'Decisions', title: 'Decisions & Alerts' },
  { to: '/schedule', label: 'Schedule', title: 'Smart Schedule' },
];

export const DISCLAIMER =
  'Prototype decision support, not a medical device. Crew data is simulated. ' +
  'Risk formula weights are design choices, not clinically validated.';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const tz = (d: Date, zone: string) => d.toLocaleTimeString('en-GB', { timeZone: zone, hour12: false });

export function MissionClock() {
  const now = useClock();
  return (
    <Box className="mono" sx={{ display: 'flex', gap: 2.5, fontSize: 13, color: T.text }} aria-label="Mission clock">
      <span><Box component="span" sx={{ color: T.muted, mr: 0.75 }}>UTC</Box>{tz(now, 'UTC')}</span>
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
        <Box component="span" sx={{ color: T.muted, mr: 0.75 }}>IST</Box>{tz(now, 'Asia/Kolkata')}
      </Box>
    </Box>
  );
}

function Countdown({ target }: { target: string }) {
  const now = useClock();
  const s = Math.max(0, Math.round((new Date(target).getTime() - now.getTime()) / 1000));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return <>T-{hh ? `${hh}:` : ''}{mm}:{ss}</>;
}

function Cell({ label, children, color, hint }: { label: string; children: ReactNode; color?: string; hint?: string }) {
  const c = (
    <Box sx={{ px: 2, py: 0.9, borderRight: `1px solid ${T.hairline}`, flexShrink: 0 }}>
      <Label sx={{ fontSize: 9.5 }}>{label}</Label>
      <Box className="mono" sx={{ fontSize: 12.5, color: color ?? T.text, whiteSpace: 'nowrap', lineHeight: 1.5 }}>{children}</Box>
    </Box>
  );
  return hint ? <Tooltip title={hint} arrow>{c}</Tooltip> : c;
}

/** Always-visible telemetry readouts. */
function TelemetryStrip({ d }: { d?: LivePayload }) {
  const { connected } = useLiveStatus();
  const s = d?.space;
  const nxt = s?.next_saa_pass;
  const flareLetter = s?.flare_class?.[0];
  return (
    <Box sx={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${T.line}`, bgcolor: T.panel,
               scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }} data-testid="telemetry">
      <Cell label="Link" color={connected ? STATUS_TEXT.green : STATUS_TEXT.amber}
            hint={connected ? 'WebSocket /ws/live connected, updates pushed every 5 s' : 'WebSocket down, polling every 5 s'}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <span className={connected ? 'pulse-live' : undefined}><Dot color={connected ? STATUS_TEXT.green : STATUS_TEXT.amber} /></span>
          {connected ? 'LIVE' : 'POLL'}
        </Box>
      </Cell>
      <Cell label="Data" hint={s ? `TLE: ${s.tle_source}. Flux: ${s.flare_source}` : undefined}
            color={s?.data_mode === 'live' ? STATUS_TEXT.green : T.text}>{(s?.data_mode ?? '---').toUpperCase()}</Cell>
      <Cell label="Sub-satellite point">
        {s ? `${s.lat >= 0 ? 'N' : 'S'}${Math.abs(s.lat).toFixed(2)}  ${s.lon >= 0 ? 'E' : 'W'}${Math.abs(s.lon).toFixed(2)}` : '--'}
      </Cell>
      <Cell label="Altitude">{s ? `${s.alt_km.toFixed(1)} km` : '--'}</Cell>
      <Cell label="Illumination" color={s ? (s.sunlit ? '#e7c35a' : '#9085e9') : undefined}>
        {s ? (s.sunlit ? 'SUNLIT' : 'ECLIPSE') : '--'}
      </Cell>
      <Cell label="SAA" color={s?.in_saa ? STATUS_TEXT.red : undefined}
            hint="South Atlantic Anomaly: trapped-proton zone; intensity 0-1">
        {s ? (s.in_saa ? `INSIDE  ${s.saa_intensity.toFixed(2)}` : 'CLEAR') : '--'}
      </Cell>
      <Cell label="Next SAA pass" color={nxt?.active ? STATUS_TEXT.red : undefined}>
        {!nxt ? '--' : nxt.active ? `ACTIVE  pk ${nxt.peak_intensity.toFixed(2)}`
          : s?.demo_active ? `T-${nxt.minutes_until.toFixed(0)} min` : <Countdown target={nxt.start} />}
      </Cell>
      <Cell label="X-ray class" hint="GOES 1-8 A flux class; M and X raise solar particle event likelihood"
            color={flareLetter === 'X' ? STATUS_TEXT.red : flareLetter === 'M' ? STATUS_TEXT.amber : undefined}>
        {s?.flare_class ?? '--'}
      </Cell>
      <Cell label="Sunrises / 24 h">{s?.sunrises_24h ?? '--'}</Cell>
      {d?.demo_active && (
        <Cell label="Scenario" color={STATUS_TEXT.amber} hint="Mission clock frozen at scenario time">
          FLARE+SAA  {fmtTime(s?.ts)}Z
        </Cell>
      )}
    </Box>
  );
}

/** Red strip under the telemetry whenever any crew member is critical. */
function CriticalStrip({ d }: { d?: LivePayload }) {
  const nav = useNavigate();
  const reds = d?.crew.filter((c) => c.status === 'red') ?? [];
  if (!reds.length) return null;
  return (
    <Box className="flash-red" data-testid="alert-banner" sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 0.9, borderBottom: '1px solid #5a1d1d',
      bgcolor: 'rgba(211,47,47,0.12)', color: STATUS_TEXT.red,
    }}>
      <span className="pulse-red" style={{ borderRadius: '50%' }}><Dot color={STATUS_TEXT.red} /></span>
      <Box sx={{ fontWeight: 600, fontSize: 13 }}>
        COMPOUND RISK CRITICAL: {reds.map((c) => `${c.callsign} (${c.risk})`).join(', ')}
      </Box>
      <Box sx={{ color: T.text2, fontSize: 12.5, display: { xs: 'none', md: 'block' } }}>
        Radiation exposure and sleep deficit elevated simultaneously.
      </Box>
      <Box sx={{ flex: 1 }} />
      <Button size="small" color="error" variant="outlined" onClick={() => nav('/decisions')}>Review actions</Button>
    </Box>
  );
}

/** Toast for each newly raised critical alert. */
function AlertToasts({ alerts }: { alerts: Alert[] }) {
  const seen = useRef<Set<number> | null>(null);
  const [queue, setQueue] = useState<Alert[]>([]);
  useEffect(() => {
    if (seen.current === null) { seen.current = new Set(alerts.map((a) => a.id)); return; }
    const fresh = alerts.filter((a) => !seen.current!.has(a.id) && a.severity === 'red');
    alerts.forEach((a) => seen.current!.add(a.id));
    if (fresh.length) setQueue((q) => [...q, ...fresh].slice(-4));
  }, [alerts]);
  const current = queue[0];
  return (
    <Snackbar open={!!current} autoHideDuration={4500} onClose={(_, r) => r !== 'clickaway' && setQueue((q) => q.slice(1))}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} key={current?.id}>
      <Box sx={{ bgcolor: T.raised, border: `1px solid ${T.line}`, borderLeft: `3px solid ${STATUS_TEXT.red}`,
                 borderRadius: 1, p: 1.5, pr: 1, maxWidth: 420, display: 'flex', gap: 1.5, boxShadow: '0 8px 30px rgba(0,0,0,.5)' }}>
        <Box sx={{ minWidth: 0 }}>
          <Label sx={{ color: STATUS_TEXT.red }}>{current?.action_type.replace(/_/g, ' ')}</Label>
          <Box sx={{ fontSize: 13, color: T.text, mt: 0.25 }}>{current?.message}</Box>
          {queue.length > 1 && <Box sx={{ fontSize: 11, color: T.muted, mt: 0.5 }}>+{queue.length - 1} more</Box>}
        </Box>
        <IconButton size="small" onClick={() => setQueue((q) => q.slice(1))} aria-label="Dismiss"><CloseIcon fontSize="small" /></IconButton>
      </Box>
    </Snackbar>
  );
}

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { bgcolor: T.panel, border: `1px solid ${T.line}`, p: 3, minWidth: 320 } }}>
      <Label sx={{ mb: 2 }}>Keyboard shortcuts</Label>
      {NAV.map((n, i) => (
        <Box key={n.to} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6, fontSize: 13 }}>
          {n.title}<Kbd>{i + 1}</Kbd>
        </Box>
      ))}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6, fontSize: 13 }}>Show shortcuts<Kbd>?</Kbd></Box>
    </Dialog>
  );
}

export function Footer() {
  return (
    <Box component="footer" sx={{ borderTop: `1px solid ${T.line}`, px: 3, py: 1.5, mt: 3, display: 'flex',
                                  flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ fontSize: 11.5, color: T.muted }} data-testid="disclaimer">{DISCLAIMER}</Box>
      <Box sx={{ fontSize: 11.5, color: T.muted }}>
        Orbit: ISS TLE (labelled Gaganyaan-class stand-in) · Solar: NOAA SWPC GOES / ISRO Aditya-L1 (PRADAN)
      </Box>
    </Box>
  );
}

function Brand() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, height: 56, borderBottom: `1px solid ${T.line}` }}>
      <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden>
        <path d="M32 4 8 14v16c0 15 10 26 24 30 14-4 24-15 24-30V14L32 4z" fill="none" stroke={T.accent} strokeWidth="5" />
        <path d="M20 34l8 8 16-18" fill="none" stroke={T.text} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Box>
        <Box sx={{ fontWeight: 600, letterSpacing: 2, fontSize: 13 }}>ASTRA SHIELD</Box>
        <Box sx={{ fontSize: 10, color: T.muted, letterSpacing: 1.2 }}>CREW RISK OPS</Box>
      </Box>
    </Box>
  );
}

const RAIL_W = 212;

export function Layout({ children }: { children: ReactNode }) {
  const live = useLive();
  const desktop = useMediaQuery('(min-width:960px)');
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const d = live.data;
  const page = NAV.find((n) => n.to === loc.pathname) ?? NAV[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable) return;
      const i = Number(e.key);
      if (i >= 1 && i <= NAV.length) nav(NAV[i - 1].to);
      if (e.key === '?') setHelp((h) => !h);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);

  const rail = (
    <Box sx={{ width: RAIL_W, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: T.panel }}>
      <Brand />
      <Box sx={{ px: 1, py: 1.5 }}>
        <Label sx={{ px: 1.25, pb: 1 }}>Console</Label>
        {NAV.map((n, i) => {
          const active = loc.pathname === n.to;
          return (
            <Box key={n.to} component={NavLink} to={n.to} onClick={() => setOpen(false)} sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.25, py: 0.9, mb: 0.25,
              borderRadius: 0.75, textDecoration: 'none', fontSize: 13.5, fontWeight: active ? 600 : 500,
              color: active ? T.text : T.text2, bgcolor: active ? T.raised : 'transparent',
              boxShadow: active ? `inset 2px 0 0 ${T.accent}` : 'none',
              '&:hover': { bgcolor: T.panel2, color: T.text },
            }}>
              {n.label}
              <Box className="mono" sx={{ fontSize: 10.5, color: T.muted }}>{i + 1}</Box>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ flex: 1 }} />
      <Box sx={{ px: 2, py: 1.5, borderTop: `1px solid ${T.line}`, fontSize: 11.5, color: T.muted }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }} onClick={() => setHelp(true)}>
          <Kbd>?</Kbd> Shortcuts
        </Box>
        <Box sx={{ mt: 1 }}>Crew data simulated</Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: T.bg }}>
      {desktop ? (
        <Box component="nav" sx={{ width: RAIL_W, flexShrink: 0, borderRight: `1px solid ${T.line}`, position: 'sticky',
                                   top: 0, height: '100vh' }}>{rail}</Box>
      ) : (
        <Drawer open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { bgcolor: T.panel } }}>{rail}</Drawer>
      )}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: T.bg }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: { xs: 1.5, md: 3 }, height: 56,
                     borderBottom: `1px solid ${T.line}` }}>
            {!desktop && <IconButton onClick={() => setOpen(true)} aria-label="Open navigation"><MenuIcon /></IconButton>}
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ fontSize: 11, color: T.muted, letterSpacing: 0.4 }}>Gaganyaan-class LEO · 3 crew</Box>
              <Box component="h1" sx={{ m: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.25 }}>{page.title}</Box>
            </Box>
            <Box sx={{ flex: 1 }} />
            <MissionClock />
          </Box>
          <TelemetryStrip d={d} />
          <CriticalStrip d={d} />
        </Box>
        <Box component="main" sx={{ p: { xs: 1.5, md: 3 }, flex: 1 }}>{children}</Box>
        <Footer />
      </Box>
      <AlertToasts alerts={d?.alerts ?? []} />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
    </Box>
  );
}
