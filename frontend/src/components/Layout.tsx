import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import PublicIcon from '@mui/icons-material/Public';
import FavoriteIcon from '@mui/icons-material/MonitorHeart';
import GavelIcon from '@mui/icons-material/NotificationImportant';
import EventIcon from '@mui/icons-material/CalendarMonth';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { useLive, useLiveStatus } from '../api/live';
import { ACCENT } from '../theme';
import { AlertBanner } from './AlertBanner';

const DRAWER_W = 232;
export const NAV = [
  { to: '/', label: 'Mission Overview', icon: <DashboardIcon /> },
  { to: '/space', label: 'Orbit & Radiation', icon: <PublicIcon /> },
  { to: '/crew', label: 'Crew Health', icon: <FavoriteIcon /> },
  { to: '/decisions', label: 'Decisions & Alerts', icon: <GavelIcon /> },
  { to: '/schedule', label: 'Smart Schedule', icon: <EventIcon /> },
];

function fmt(d: Date, tz: string) {
  return d.toLocaleTimeString('en-GB', { timeZone: tz, hour12: false });
}

export function MissionClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Box className="flex gap-4 font-mono text-sm" aria-label="Mission clock">
      <span><span className="opacity-60">UTC </span>{fmt(now, 'UTC')}</span>
      <span className="hidden sm:inline"><span className="opacity-60">IST </span>{fmt(now, 'Asia/Kolkata')}</span>
    </Box>
  );
}

export const DISCLAIMER =
  'Prototype decision support, not a medical device. Crew data is simulated. ' +
  'Risk formula weights are design choices, not clinically validated.';

export function Footer() {
  return (
    <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', px: 3, py: 1.5, mt: 4 }}>
      <Typography variant="caption" color="text.secondary" data-testid="disclaimer">
        {DISCLAIMER} Orbit: ISS TLE as a labelled Gaganyaan-class stand-in. Solar data: NOAA SWPC GOES / ISRO
        Aditya-L1 (PRADAN).
      </Typography>
    </Box>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const live = useLive();
  const { connected } = useLiveStatus();
  const desktop = useMediaQuery('(min-width:900px)');
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const mode = live.data?.space.data_mode ?? 'offline';
  const demo = live.data?.demo_active;

  const nav = (
    <Box sx={{ pt: 1 }}>
      <Toolbar sx={{ gap: 1.5 }}>
        <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden>
          <path d="M32 4 8 14v16c0 15 10 26 24 30 14-4 24-15 24-30V14L32 4z" fill="#0b1a2e" stroke={ACCENT}
                strokeWidth="4" />
          <circle cx="32" cy="30" r="8" fill={ACCENT} />
        </svg>
        <Box>
          <Typography sx={{ fontWeight: 800, letterSpacing: 1.2, lineHeight: 1.1 }}>ASTRA SHIELD</Typography>
          <Typography variant="caption" color="text.secondary">Mission Control AI</Typography>
        </Box>
      </Toolbar>
      <List sx={{ px: 1 }}>
        {NAV.map((n) => (
          <ListItemButton key={n.to} component={NavLink} to={n.to} selected={loc.pathname === n.to}
                          onClick={() => setOpen(false)} sx={{ borderRadius: 2, mb: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 38, color: loc.pathname === n.to ? 'primary.main' : 'inherit' }}>
              {n.icon}
            </ListItemIcon>
            <ListItemText primary={n.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" color="inherit" elevation={0}
              sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: 'rgba(7,17,31,0.92)', backdropFilter: 'blur(8px)',
                    borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2 }}>
          {!desktop && (
            <IconButton edge="start" onClick={() => setOpen(true)} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }} noWrap>
            {NAV.find((n) => n.to === loc.pathname)?.label ?? 'ASTRA SHIELD AI'}
          </Typography>
          {demo && <Chip size="small" color="warning" label="DEMO SCENARIO" sx={{ fontWeight: 700 }} />}
          <Tooltip title={connected ? 'Live WebSocket connected' : 'WebSocket offline; polling every 5 s'}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: connected ? 'success.main' : 'warning.main' }}
                 aria-label={connected ? 'live connected' : 'polling'} />
          </Tooltip>
          <Chip size="small" variant="outlined" label={mode.toUpperCase()} data-testid="data-mode"
                sx={{ fontWeight: 700, borderColor: mode === 'live' ? 'success.main' : 'text.secondary',
                      color: mode === 'live' ? 'success.main' : 'text.secondary' }} />
          <MissionClock />
        </Toolbar>
        <AlertBanner crew={live.data?.crew ?? []} />
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_W }, flexShrink: { md: 0 } }}>
        <Drawer variant={desktop ? 'permanent' : 'temporary'} open={desktop || open} onClose={() => setOpen(false)}
                sx={{ '& .MuiDrawer-paper': { width: DRAWER_W, boxSizing: 'border-box' } }}>
          {nav}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Toolbar />
        {live.data?.any_red && <Box sx={{ height: 64 }} />}
        <Box sx={{ p: { xs: 2, md: 3 }, flexGrow: 1 }}>{children}</Box>
        <Footer />
      </Box>
    </Box>
  );
}
