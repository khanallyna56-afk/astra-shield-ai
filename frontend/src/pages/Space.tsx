import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import type { Shape } from 'plotly.js';

import { api } from '../api/client';
import { useLive } from '../api/live';
import { OrbitMap } from '../components/OrbitMap';
import Plot, { PLOT_CONFIG } from '../components/Plot';
import { PLOT_LAYOUT_BASE, STATUS_COLORS } from '../theme';

const BAND_COLORS: Record<string, string> = {
  A: 'rgba(46,125,50,0.06)', B: 'rgba(46,125,50,0.10)', C: 'rgba(237,108,2,0.08)',
  M: 'rgba(237,108,2,0.16)', X: 'rgba(211,47,47,0.18)',
};

const hhmm = (iso: string) => iso.slice(11, 16);

export default function Space() {
  const live = useLive();
  const track = useQuery({ queryKey: ['groundtrack', live.data?.demo_active], queryFn: () => api.groundTrack(24) });
  const passes = useQuery({ queryKey: ['saa-passes', live.data?.demo_active], queryFn: () => api.saaPasses(24) });
  const flares = useQuery({ queryKey: ['flares'], queryFn: api.flares, refetchInterval: 60_000 });

  const bands: Partial<Shape>[] = (flares.data?.class_bands ?? []).map((b) => ({
    type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: b.min_flux, y1: b.min_flux * 10,
    fillcolor: BAND_COLORS[b.class], line: { width: 0 }, layer: 'below',
  }));

  return (
    <Box className="flex flex-col gap-4">
      <Card>
        <CardContent>
          <Box className="flex flex-wrap items-center justify-between gap-2">
            <Typography variant="overline" color="primary">24 h ground track</Typography>
            {live.data && (
              <Box className="flex flex-wrap gap-1">
                <Chip size="small" label={live.data.space.sunlit ? 'Sunlit' : 'Eclipse'} />
                <Chip size="small" label={`${live.data.space.sunrises_24h} sunrises / day`} />
                <Chip size="small" label={live.data.space.eclipse_model} variant="outlined" />
              </Box>
            )}
          </Box>
          {track.data ? <OrbitMap track={track.data} state={live.data?.space} /> : <Skeleton height={440} />}
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="overline" color="primary">Upcoming SAA passes</Typography>
              {passes.data ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Start (UTC)</TableCell><TableCell>End</TableCell>
                      <TableCell align="right">Min</TableCell><TableCell align="right">Peak</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {passes.data.map((p) => (
                      <TableRow key={p.start}>
                        <TableCell>{p.start.slice(5, 10)} {hhmm(p.start)}</TableCell>
                        <TableCell>{hhmm(p.end)}</TableCell>
                        <TableCell align="right">{p.duration_min?.toFixed(0)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700,
                          color: p.peak_intensity >= 0.7 ? STATUS_COLORS.red : p.peak_intensity >= 0.4 ? STATUS_COLORS.amber : undefined }}>
                          {p.peak_intensity.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Skeleton height={300} />}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="overline" color="primary">Solar X-ray flux (GOES 1-8 A, log scale)</Typography>
              {flares.data ? (
                <>
                  <Plot
                    data={[{ type: 'scatter', mode: 'lines', x: flares.data.series.map((p) => p.time),
                             y: flares.data.series.map((p) => p.flux), line: { color: '#22d3ee', width: 1.5 },
                             name: 'Flux' }]}
                    layout={{ ...PLOT_LAYOUT_BASE, height: 320, shapes: bands, showlegend: false,
                              yaxis: { ...PLOT_LAYOUT_BASE.yaxis, type: 'log', title: { text: 'W/m²' },
                                       exponentformat: 'power', range: [-8.5, -3] },
                              annotations: (flares.data.class_bands).map((b) => ({
                                xref: 'paper', x: 1, xanchor: 'right', y: Math.log10(b.min_flux * 3), yref: 'y',
                                text: b.class, showarrow: false, font: { size: 13, color: '#8fa6c3' } })) }}
                    config={PLOT_CONFIG} style={{ width: '100%' }} useResizeHandler
                  />
                  <Typography variant="caption" color="text.secondary">
                    Source: {flares.data.source} ({flares.data.instrument}). Current: {flares.data.current.flare_class}
                  </Typography>
                </>
              ) : <Skeleton height={320} />}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
