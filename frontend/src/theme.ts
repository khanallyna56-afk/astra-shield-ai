import { createTheme } from '@mui/material/styles';

export const STATUS_COLORS = { green: '#2e7d32', amber: '#ed6c02', red: '#d32f2f' } as const;
export const ACCENT = '#22d3ee';
export const ACTIVITY_COLORS: Record<string, string> = {
  sleep: '#5b6bbf',
  work: '#2b7a9b',
  exercise: '#3f9b6b',
  eva: '#e0a526',
  meal: '#7d6a99',
  comms: '#4a8fd4',
};

/** Dark "mission control" theme: deep navy surfaces, cyan accent, standard status colors. */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: ACCENT, contrastText: '#04131f' },
    secondary: { main: '#7c9cff' },
    success: { main: STATUS_COLORS.green },
    warning: { main: STATUS_COLORS.amber },
    error: { main: STATUS_COLORS.red },
    background: { default: '#07111f', paper: '#0d1b2e' },
    divider: 'rgba(148, 197, 255, 0.12)',
    text: { primary: '#e6f1ff', secondary: '#8fa6c3' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, system-ui, sans-serif',
    h5: { fontWeight: 700, letterSpacing: 0.2 },
    h6: { fontWeight: 600 },
    overline: { letterSpacing: 1.4, fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', border: '1px solid rgba(148, 197, 255, 0.10)' },
      },
    },
    MuiAppBar: { styleOverrides: { root: { border: 'none' } } },
    MuiDrawer: { styleOverrides: { paper: { border: 'none', borderRight: '1px solid rgba(148,197,255,0.10)' } } },
    MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
  },
});

export const PLOT_LAYOUT_BASE = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { color: '#c9d8ec', family: 'Inter, Segoe UI, sans-serif', size: 12 },
  margin: { l: 50, r: 20, t: 20, b: 40 },
  xaxis: { gridcolor: 'rgba(148,197,255,0.08)', zerolinecolor: 'rgba(148,197,255,0.15)' },
  yaxis: { gridcolor: 'rgba(148,197,255,0.08)', zerolinecolor: 'rgba(148,197,255,0.15)' },
  legend: { orientation: 'h' as const, y: -0.2 },
};
