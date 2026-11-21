import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';

import type { CrewMember } from '../api/types';
import { STATUS_COLORS } from '../theme';
import { RiskGauge } from './RiskGauge';
import { StatusChip } from './StatusChip';

const LOCATION: Record<string, string> = {
  cabin: 'Cabin', sleep_station: 'Sleep station', shielded_area: 'Shielded area', EVA: 'EVA',
};

function SubScore({ label, value, weight }: { label: string; value: number; weight: string }) {
  const color = value >= 70 ? STATUS_COLORS.red : value >= 40 ? STATUS_COLORS.amber : STATUS_COLORS.green;
  return (
    <Box>
      <Box className="flex justify-between">
        <Typography variant="caption" color="text.secondary">{label} <span className="opacity-60">x{weight}</span></Typography>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>{Math.round(value)}</Typography>
      </Box>
      <LinearProgress variant="determinate" value={Math.min(100, value)}
                      sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(148,197,255,0.08)',
                            '& .MuiLinearProgress-bar': { bgcolor: color } }} />
    </Box>
  );
}

export function CrewCard({ c, lighting }: { c: CrewMember; lighting?: string }) {
  return (
    <Card sx={{ height: '100%', borderColor: c.status === 'red' ? 'error.main' : undefined,
                boxShadow: c.status === 'red' ? '0 0 0 1px #d32f2f, 0 0 24px rgba(211,47,47,0.35)' : undefined }}
          data-testid={`crew-card-${c.callsign}`}>
      <CardContent>
        <Box className="flex items-start justify-between gap-2">
          <Box>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{c.callsign}</Typography>
            <Typography variant="caption" color="text.secondary">{c.role}</Typography>
          </Box>
          <StatusChip status={c.status} />
        </Box>
        <Box sx={{ my: 1 }}><RiskGauge value={c.risk} status={c.status} size={170} /></Box>
        <Box className="flex flex-col gap-2">
          <SubScore label="Radiation" value={c.radiation} weight="0.6" />
          <SubScore label="Sleep deficit" value={c.sleep_deficit} weight="0.4" />
        </Box>
        <Box className="mt-3 flex flex-wrap gap-1">
          <Chip size="small" variant="outlined" label={LOCATION[c.location] ?? c.location} />
          <Chip size="small" variant="outlined" label={`Debt ${c.reading.sleep_debt_h.toFixed(1)} h`} />
          <Chip size="small" variant="outlined" label={`HRV ${c.reading.hrv_ms.toFixed(0)} ms`} />
          <Chip size="small" variant="outlined" label={`Fatigue ${c.reading.fatigue_sp}/7`} />
          {lighting && (
            <Chip size="small" label={lighting === 'warm_2700K' ? 'Warm 2700K' : 'Cool 6500K'}
                  sx={{ bgcolor: lighting === 'warm_2700K' ? '#7a4a12' : '#12405a', fontWeight: 600 }} />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
