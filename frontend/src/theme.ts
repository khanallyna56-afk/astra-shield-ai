import { createTheme } from '@mui/material/styles';

/**
 * Design tokens: an operations-console palette.
 * Status colors are reserved for state and always paired with an icon + label.
 * Crew identity uses the first three validated categorical slots (dark mode),
 * which are CVD-safe for all pairs.
 */
export const T = {
  bg: '#0a0c0f',
  panel: '#101317',
  panel2: '#151920',
  raised: '#1a1f27',
  line: '#232931',
  hairline: '#1b2027',
  text: '#e6e8eb',
  text2: '#9aa3ad',
  muted: '#646d78',
  accent: '#3987e5',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  sans: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
} as const;

export const STATUS_COLORS = { green: '#2e7d32', amber: '#ed6c02', red: '#d32f2f' } as const;
export const STATUS_TEXT = { green: '#5cb860', amber: '#ff9a3d', red: '#ff6b66' } as const;

/** Fixed crew identity colors (categorical slots 1-3, dark steps). Never reused for status. */
export const CREW_COLORS: Record<string, string> = {
  'Vyomnaut 01': '#3987e5',
  'Vyomnaut 02': '#d95926',
  'Vyomnaut 03': '#199e70',
};
export const crewColor = (cs: string) => CREW_COLORS[cs] ?? T.text2;

/** Routine blocks are muted so EVA and SAA windows carry the signal. */
export const ACTIVITY_COLORS: Record<string, string> = {
  sleep: '#2c3a6b',
  work: '#262d37',
  exercise: '#1f5c49',
  eva: '#c98500',
  meal: '#3b3348',
  comms: '#1c3f66',
};
export const ACTIVITY_LABEL: Record<string, string> = {
  sleep: 'Sleep', work: 'Work', exercise: 'Exercise', eva: 'EVA', meal: 'Meal', comms: 'Comms',
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: T.accent, contrastText: '#fff' },
    success: { main: STATUS_COLORS.green },
    warning: { main: STATUS_COLORS.amber },
    error: { main: STATUS_COLORS.red },
    background: { default: T.bg, paper: T.panel },
    divider: T.line,
    text: { primary: T.text, secondary: T.text2, disabled: T.muted },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: T.sans,
    fontSize: 13,
    h4: { fontWeight: 600, letterSpacing: -0.4 },
    h5: { fontWeight: 600, letterSpacing: -0.2 },
    h6: { fontWeight: 600, fontSize: 15 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0.1 },
    overline: { fontWeight: 600, letterSpacing: 1.2, fontSize: 10.5, lineHeight: 1.6 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: T.bg, fontFeatureSettings: '"tnum" 1, "zero" 1' } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 4, paddingInline: 14 }, sizeSmall: { paddingInline: 10 } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: T.raised, border: `1px solid ${T.line}`, fontSize: 12, color: T.text,
                   padding: '6px 10px', maxWidth: 360 },
        arrow: { color: T.raised },
      },
    },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 44 } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 44 }, indicator: { height: 2 } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, padding: '4px 12px' } } },
    MuiSnackbarContent: { styleOverrides: { root: { backgroundColor: T.raised, color: T.text } } },
  },
});

export const AXIS = { gridcolor: '#1b2027', zerolinecolor: '#232931', linecolor: '#232931',
                      tickfont: { family: T.mono, size: 10.5, color: T.muted } };

export const PLOT_LAYOUT_BASE = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { color: T.text2, family: T.sans, size: 11.5 },
  margin: { l: 44, r: 12, t: 8, b: 32 },
  xaxis: { ...AXIS },
  yaxis: { ...AXIS },
  hoverlabel: { bgcolor: T.raised, bordercolor: T.line, font: { family: T.mono, size: 11.5, color: T.text } },
  hovermode: 'x unified' as const,
  legend: { orientation: 'h' as const, y: 1.12, x: 0, font: { size: 11 } },
};
