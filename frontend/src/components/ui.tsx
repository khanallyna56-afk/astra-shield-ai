import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorIcon from '@mui/icons-material/ErrorOutline';
import WarningIcon from '@mui/icons-material/WarningAmber';
import Box, { type BoxProps } from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { Status } from '../api/types';
import { STATUS_COLORS, STATUS_TEXT, T } from '../theme';

/** Bordered section with a small uppercase header and optional right-side controls. */
export function Panel({ title, actions, children, pad = true, sx, ...rest }:
  { title?: ReactNode; actions?: ReactNode; children: ReactNode; pad?: boolean } & BoxProps) {
  return (
    <Box sx={{ bgcolor: T.panel, border: `1px solid ${T.line}`, borderRadius: 1, minWidth: 0, ...sx }} {...rest}>
      {(title || actions) && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 2, py: 1.1,
                   borderBottom: `1px solid ${T.hairline}`, minHeight: 40 }}>
          <Box sx={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: T.text2 }}>
            {title}
          </Box>
          {actions}
        </Box>
      )}
      <Box sx={pad ? { p: 2 } : undefined}>{children}</Box>
    </Box>
  );
}

export function Label({ children, sx }: { children: ReactNode; sx?: BoxProps['sx'] }) {
  return (
    <Box sx={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.1, textTransform: 'uppercase', color: T.muted, ...sx }}>
      {children}
    </Box>
  );
}

/** Label over a monospaced value with optional unit. */
export function Readout({ label, value, unit, color, hint, size = 'md' }: {
  label: ReactNode; value: ReactNode; unit?: string; color?: string; hint?: ReactNode; size?: 'sm' | 'md' | 'lg';
}) {
  const fs = { sm: 13, md: 17, lg: 26 }[size];
  const body = (
    <Box sx={{ minWidth: 0 }}>
      <Label>{label}</Label>
      <Box className="mono" sx={{ fontSize: fs, fontWeight: 500, color: color ?? T.text, lineHeight: 1.35, whiteSpace: 'nowrap' }}>
        {value}
        {unit && <Box component="span" sx={{ fontSize: fs * 0.62, color: T.muted, ml: 0.5 }}>{unit}</Box>}
      </Box>
    </Box>
  );
  return hint ? <Tooltip title={hint} arrow placement="top">{body}</Tooltip> : body;
}

const STATUS_ICON = { green: CheckCircleIcon, amber: WarningIcon, red: ErrorIcon };
const STATUS_LABEL: Record<Status, string> = { green: 'Nominal', amber: 'Caution', red: 'Critical' };

/** Status is never color-only: icon + label + color. */
export function StatusTag({ status, compact = false }: { status: Status; compact?: boolean }) {
  const Icon = STATUS_ICON[status];
  return (
    <Box data-testid={`status-${status}`} sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5, px: compact ? 0.75 : 1, py: 0.25, borderRadius: 0.75,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: STATUS_TEXT[status],
      bgcolor: `${STATUS_COLORS[status]}26`, border: `1px solid ${STATUS_COLORS[status]}66`, whiteSpace: 'nowrap',
    }}>
      <Icon sx={{ fontSize: 14 }} />
      {compact ? status.toUpperCase() : STATUS_LABEL[status]}
    </Box>
  );
}

/** Tween a number toward its target (respects reduced motion). */
export function AnimatedNumber({ value, decimals = 0, duration = 650 }: { value: number; decimals?: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof requestAnimationFrame === 'undefined') { setShown(value); return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown.toFixed(decimals)}</>;
}

/** Inline SVG sparkline with threshold guides at 40 / 70 and an end dot. Hover shows the value. */
export function Sparkline({ values, color, height = 34, max = 100, thresholds = [40, 70] }: {
  values: number[]; color: string; height?: number; max?: number; thresholds?: number[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 200;
  if (values.length < 2) return <Box sx={{ height }} />;
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => height - 2 - (Math.min(max, v) / max) * (height - 4);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const idx = hover ?? values.length - 1;
  return (
    <Box sx={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none"
           onMouseMove={(e) => {
             const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
             setHover(Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)));
           }}
           onMouseLeave={() => setHover(null)} style={{ display: 'block', cursor: 'crosshair' }}>
        {thresholds.map((t) => (
          <line key={t} x1={0} x2={w} y1={y(t)} y2={y(t)} stroke={T.line} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={d} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        {hover !== null && <line x1={x(idx)} x2={x(idx)} y1={0} y2={height} stroke={T.muted} vectorEffect="non-scaling-stroke" />}
        <circle cx={x(idx)} cy={y(values[idx])} r={2.6} fill={color} stroke={T.panel} strokeWidth={1} />
      </svg>
      {hover !== null && (
        <Box className="mono" sx={{ position: 'absolute', top: -18, right: 0, fontSize: 10.5, color: T.text2 }}>
          {values[idx].toFixed(0)}
        </Box>
      )}
    </Box>
  );
}

/** Horizontal 0-100 scale with green/amber/red zones and a marker. */
export function RiskScale({ value }: { value: number }) {
  const zones: [number, number, string][] = [[0, 40, STATUS_COLORS.green], [40, 70, STATUS_COLORS.amber], [70, 100, STATUS_COLORS.red]];
  return (
    <Box sx={{ position: 'relative', height: 16 }} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}
         aria-label="Compound risk scale">
      <Box sx={{ position: 'absolute', top: 6, left: 0, right: 0, height: 4, display: 'flex', gap: '2px' }}>
        {zones.map(([a, b, c]) => (
          <Box key={a} sx={{ width: `${b - a}%`, bgcolor: c, opacity: value >= a && value < b + (b === 100 ? 1 : 0) ? 0.95 : 0.25, borderRadius: 0.5 }} />
        ))}
      </Box>
      <Box sx={{ position: 'absolute', top: 1, left: `calc(${Math.min(100, value)}% - 1px)`, width: 2, height: 14,
                 bgcolor: T.text, borderRadius: 1, transition: 'left 650ms cubic-bezier(.2,.8,.2,1)' }} />
    </Box>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <Box component="kbd" className="mono" sx={{ fontSize: 10.5, px: 0.6, py: 0.1, border: `1px solid ${T.line}`,
                                               borderBottomWidth: 2, borderRadius: 0.5, color: T.text2, bgcolor: T.panel2 }}>
      {children}
    </Box>
  );
}

export function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return <Box className={pulse ? 'pulse-red' : undefined}
              sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0, display: 'inline-block' }} />;
}

export const fmtTime = (iso?: string | null) => (iso ? iso.slice(11, 16) : '--:--');
export const fmtTimeSec = (iso?: string | null) => (iso ? iso.slice(11, 19) : '--:--:--');
