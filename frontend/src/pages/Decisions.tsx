import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Data, Shape } from 'plotly.js';

import { api } from '../api/client';
import { useLive } from '../api/live';
import type { Alert } from '../api/types';
import Plot, { PLOT_CONFIG } from '../components/Plot';
import { PLOT_LAYOUT_BASE, STATUS_COLORS } from '../theme';
import { ActionList } from './Overview';

const LINE = ['#22d3ee', '#ef5350', '#a78bfa'];
const SEV = { red: STATUS_COLORS.red, amber: STATUS_COLORS.amber, info: '#4a8fd4' };

export default function Decisions() {
  const live = useLive();
  const qc = useQueryClient();
  const hist = useQuery({ queryKey: ['risk-history', live.data?.ts.slice(0, 16)], queryFn: () => api.riskHistory(24) });
  const alerts = useQuery({ queryKey: ['alerts', live.data?.alerts.length, live.data?.demo_active], queryFn: api.alerts });
  const ack = useMutation({ mutationFn: api.ackAlert, onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }) });

  const bands: Partial<Shape>[] = [[0, 40, 'green'], [40, 70, 'amber'], [70, 100, 'red']].map(([a, b, c]) => ({
    type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: a as number, y1: b as number, layer: 'below',
    line: { width: 0 }, fillcolor: STATUS_COLORS[c as keyof typeof STATUS_COLORS] + '22',
  }));
  const traces: Data[] = (hist.data ?? []).map((s, i) => ({
    type: 'scatter', mode: 'lines', name: s.callsign, x: s.points.map((p) => p.ts), y: s.points.map((p) => p.risk),
    line: { color: LINE[i % LINE.length], width: 2 },
  }));

  const cols: GridColDef<Alert>[] = [
    { field: 'ts', headerName: 'Time (UTC)', width: 150, valueFormatter: (v: string) => `${v.slice(5, 10)} ${v.slice(11, 19)}` },
    { field: 'severity', headerName: 'Severity', width: 100,
      renderCell: (p) => <Chip size="small" label={p.value.toUpperCase()} sx={{ bgcolor: SEV[p.value as keyof typeof SEV], color: '#fff', fontWeight: 700 }} /> },
    { field: 'action_type', headerName: 'Action', width: 170 },
    { field: 'message', headerName: 'Reason', flex: 1, minWidth: 260 },
    { field: 'acknowledged', headerName: '', width: 130, sortable: false,
      renderCell: (p) => p.row.acknowledged
        ? <Typography variant="caption" color="text.secondary">Acknowledged</Typography>
        : <Button size="small" variant="outlined" onClick={() => ack.mutate(p.row.id)}>Acknowledge</Button> },
  ];

  return (
    <Box className="flex flex-col gap-4">
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="overline" color="primary">Compound risk trend (24 h)</Typography>
              {hist.data ? (
                <Plot data={traces} config={PLOT_CONFIG} style={{ width: '100%' }} useResizeHandler
                      layout={{ ...PLOT_LAYOUT_BASE, height: 320, shapes: bands,
                                yaxis: { ...PLOT_LAYOUT_BASE.yaxis, range: [0, 100], title: { text: 'Risk' } } }} />
              ) : <Skeleton height={320} />}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="overline" color="primary">Module lighting</Typography>
              <Box className="mt-2 flex flex-col gap-2">
                {Object.entries(live.data?.lighting ?? {}).map(([cs, mode]) => (
                  <Box key={cs} className="flex items-center justify-between">
                    <Typography>{cs}</Typography>
                    <Chip label={mode === 'warm_2700K' ? 'Warm sleep 2700K' : 'Cool work 6500K'}
                          sx={{ fontWeight: 700, color: '#fff',
                                bgcolor: mode === 'warm_2700K' ? '#b45309' : '#0e7490' }}
                          data-testid={`lighting-${cs}`} />
                  </Box>
                ))}
              </Box>
              <Typography variant="overline" color="primary" sx={{ display: 'block', mt: 3 }}>Active actions</Typography>
              <ActionList actions={live.data?.actions ?? []} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Card>
        <CardContent>
          <Typography variant="overline" color="primary">Alerts log</Typography>
          <Box sx={{ height: 420, mt: 1 }}>
            <DataGrid rows={alerts.data ?? []} columns={cols} loading={alerts.isLoading} density="compact"
                      disableRowSelectionOnClick initialState={{ sorting: { sortModel: [{ field: 'ts', sort: 'desc' }] } }}
                      sx={{ border: 0 }} />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
