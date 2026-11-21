import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { Status } from '../api/types';
import { STATUS_COLORS } from '../theme';

/** Semicircular 0-100 gauge with green/amber/red bands (40 / 70) and a needle. Pure SVG. */
export function RiskGauge({ value, status, size = 180 }: { value: number; status: Status; size?: number }) {
  const r = 80;
  const cx = 100;
  const cy = 100;
  const pt = (v: number) => {
    const a = Math.PI * (1 - Math.min(100, Math.max(0, v)) / 100);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a);
    const [x2, y2] = pt(b);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const [nx, ny] = pt(value);
  return (
    <Box sx={{ width: size, mx: 'auto', textAlign: 'center' }} role="meter" aria-valuenow={value}
         aria-valuemin={0} aria-valuemax={100} aria-label="Compound risk">
      <svg viewBox="0 0 200 118" width="100%">
        <path d={arc(0, 39.5)} stroke={STATUS_COLORS.green} strokeWidth={14} fill="none" opacity={0.85} />
        <path d={arc(40, 69.5)} stroke={STATUS_COLORS.amber} strokeWidth={14} fill="none" opacity={0.85} />
        <path d={arc(70, 100)} stroke={STATUS_COLORS.red} strokeWidth={14} fill="none" opacity={0.85} />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e6f1ff" strokeWidth={3} strokeLinecap="round"
              style={{ transition: 'all 600ms ease' }} />
        <circle cx={cx} cy={cy} r={6} fill="#e6f1ff" />
      </svg>
      <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1, mt: -1, color: STATUS_COLORS[status] }}
                  data-testid="risk-value">
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">compound risk / 100</Typography>
    </Box>
  );
}
