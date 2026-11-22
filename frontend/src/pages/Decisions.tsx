import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Data, Shape } from 'plotly.js';
import { useState } from 'react';

import { api } from '../api/client';
import { useRiskHistory } from '../api/hooks';
import { useLive } from '../api/live';
import type { Alert } from '../api/types';
import { ACTION_LABEL, Directives, SEV_COLOR } from '../components/Directives';
import Plot, { PLOT_CONFIG } from '../components/Plot';
import { Label, Panel, fmtTimeSec } from '../components/ui';
import { PLOT_LAYOUT_BASE, STATUS_COLORS, T, crewColor } from '../theme';

type Filter = 'open' | 'all' | 'critical';

export default function Decisions() {
  const live = useLive();
  const qc = useQueryClient();
  const hist = useRiskHistory();
  const [filter, setFilter] = useState<Filter>('open');
  const alerts = useQuery({ queryKey: ['alerts', live.data?.alerts.map((a) => a.id).join(','), live.data?.demo_active], queryFn: api.alerts,
                            placeholderData: (p) => p });
  const ack = useMutation({ mutationFn: api.ackAlert, onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }) });
  const ackAll = useMutation({
    mutationFn: async (ids: number[]) => { for (const id of ids) await api.ackAlert(id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const zones: Partial<Shape>[] = ([[0, 40, 'green'], [40, 70, 'amber'], [70, 100, 'red']] as const).map(([a, b, c]) => ({
    type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: a, y1: b, layer: 'below', line: { width: 0 },
    fillcolor: `${STATUS_COLORS[c]}14`,
  }));
  const traces: Data[] = (hist.data ?? []).map((s) => ({
    type: 'scatter', mode: 'lines', name: s.callsign, x: s.points.map((p) => p.ts), y: s.points.map((p) => p.risk),
    line: { color: crewColor(s.callsign), width: 2 }, hovertemplate: `${s.callsign} %{y}<extra></extra>`,
  }));

  const rows = (alerts.data ?? []).filter((a) => filter === 'all' || (filter === 'open' ? !a.acknowledged : a.severity === 'red'));
  const open = (alerts.data ?? []).filter((a) => !a.acknowledged);

  const cols: GridColDef<Alert>[] = [
    { field: 'ts', headerName: 'Time (UTC)', width: 110, renderCell: (p) => <span className="mono">{fmtTimeSec(p.value)}</span> },
    { field: 'severity', headerName: 'Sev', width: 80, renderCell: (p) => (
      <Box className="mono" sx={{ color: SEV_COLOR[p.value as keyof typeof SEV_COLOR], fontWeight: 600, fontSize: 11.5 }}>
        {p.value === 'red' ? 'CRIT' : p.value === 'amber' ? 'WARN' : 'INFO'}
      </Box>) },
    { field: 'action_type', headerName: 'Directive', width: 150, valueFormatter: (v: string) => ACTION_LABEL[v] ?? v },
    { field: 'message', headerName: 'Detail', flex: 1, minWidth: 280 },
    { field: 'acknowledged', headerName: 'Status', width: 140, sortable: false, renderCell: (p) => p.row.acknowledged
      ? <Box sx={{ color: T.muted, fontSize: 12 }}>Acknowledged</Box>
      : <Button size="small" variant="outlined" onClick={() => ack.mutate(p.row.id)} sx={{ borderColor: T.line, color: T.text }}>Acknowledge</Button> },
  ];

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '8fr 4fr' } }}>
        <Panel title="Compound risk · 24 h">
          {hist.data ? (
            <Plot data={traces} config={PLOT_CONFIG} style={{ width: '100%' }} useResizeHandler
                  layout={{ ...PLOT_LAYOUT_BASE, height: 300, shapes: zones,
                            yaxis: { ...PLOT_LAYOUT_BASE.yaxis, range: [0, 100], tickvals: [0, 40, 70, 100] } }} />
          ) : <Skeleton height={300} />}
          <Box sx={{ fontSize: 11.5, color: T.muted }}>Bands: nominal &lt; 40 · caution 40–69 · critical ≥ 70. Spikes align with SAA passes.</Box>
        </Panel>
        <Panel title="Module lighting">
          <Box sx={{ display: 'grid', gap: 1 }}>
            {Object.entries(live.data?.lighting ?? {}).map(([cs, mode]) => {
              const warm = mode === 'warm_2700K';
              return (
                <Box key={cs} data-testid={`lighting-${cs}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25,
                                                               border: `1px solid ${T.hairline}`, borderRadius: 1, bgcolor: T.panel2 }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, transition: 'all 600ms',
                             background: warm ? 'radial-gradient(circle, #ffb35c 0%, #a85a12 70%)' : 'radial-gradient(circle, #e8f3ff 0%, #5c8fc8 70%)',
                             boxShadow: warm ? '0 0 18px rgba(255,160,70,.45)' : '0 0 18px rgba(156,201,255,.35)' }} />
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ fontWeight: 600, fontSize: 13 }}>{cs}</Box>
                    <Box sx={{ fontSize: 12, color: T.text2 }}>{warm ? 'Warm sleep mode · 2700 K, dimmed' : 'Cool work mode · 6500 K'}</Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
          <Box sx={{ fontSize: 11.5, color: T.muted, mt: 1.5 }}>
            Warm, dim light before sleep supports melatonin onset; triggered when sleep deficit &gt; 60 on caution or critical crew.
          </Box>
        </Panel>
      </Box>

      <Panel title={`Active directives · ${live.data?.actions.length ?? 0}`}>
        <Directives actions={live.data?.actions ?? []} />
      </Panel>

      <Panel title="Alert log" pad={false} actions={
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
            <ToggleButton value="open">Open · {open.length}</ToggleButton>
            <ToggleButton value="critical">Critical</ToggleButton>
            <ToggleButton value="all">All</ToggleButton>
          </ToggleButtonGroup>
          <Button size="small" variant="outlined" disabled={!open.length || ackAll.isPending}
                  onClick={() => ackAll.mutate(open.map((a) => a.id))} sx={{ borderColor: T.line, color: T.text }}>
            Acknowledge all
          </Button>
        </Box>
      }>
        <Box sx={{ height: 400 }}>
          <DataGrid rows={rows} columns={cols} loading={alerts.isLoading} density="compact" disableRowSelectionOnClick
                    initialState={{ sorting: { sortModel: [{ field: 'ts', sort: 'desc' }] } }}
                    localeText={{ noRowsLabel: filter === 'open' ? 'No open alerts' : 'No alerts' }}
                    sx={{ border: 0, fontSize: 12.5, '--DataGrid-containerBackground': T.panel, '& .MuiDataGrid-columnHeaderTitle': { fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: T.muted, fontWeight: 600 },
                          '& .MuiDataGrid-cell': { borderColor: T.hairline }, '& .MuiDataGrid-row:hover': { bgcolor: T.panel2 } }} />
        </Box>
      </Panel>
      <Label sx={{ textAlign: 'right' }}>Every directive is written to the alerts table and pushed over /ws/live</Label>
    </Box>
  );
}
