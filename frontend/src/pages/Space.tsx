import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { useQuery } from '@tanstack/react-query';
import type { Shape } from 'plotly.js';
import { useState } from 'react';

import { api } from '../api/client';
import { useGroundTrack } from '../api/hooks';
import { useLive } from '../api/live';
import { OrbitMap } from '../components/OrbitMap';
import { OrbitStrip } from '../components/OrbitStrip';
import Plot, { PLOT_CONFIG } from '../components/Plot';
import { Label, Panel, Readout, fmtTime } from '../components/ui';
import { PLOT_LAYOUT_BASE, STATUS_TEXT, T } from '../theme';

const BAND = { A: 'rgba(255,255,255,0.00)', B: 'rgba(255,255,255,0.015)', C: 'rgba(237,108,2,0.05)', M: 'rgba(237,108,2,0.10)', X: 'rgba(211,47,47,0.13)' } as Record<string, string>;

export default function Space() {
  const live = useLive();
  const track = useGroundTrack();
  const passes = useQuery({ queryKey: ['saa-passes', live.data?.demo_active], queryFn: () => api.saaPasses(24) });
  const flares = useQuery({ queryKey: ['flares'], queryFn: api.flares, refetchInterval: 60_000 });
  const [sel, setSel] = useState<string | null>(null);
  const s = live.data?.space;

  const bands: Partial<Shape>[] = (flares.data?.class_bands ?? []).map((b) => ({
    type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: b.min_flux, y1: b.min_flux * 10,
    fillcolor: BAND[b.class], line: { width: 0 }, layer: 'below',
  }));
  const bandLines: Partial<Shape>[] = (flares.data?.class_bands ?? []).map((b) => ({
    type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: b.min_flux, y1: b.min_flux,
    line: { color: T.line, width: 1, dash: 'dot' }, layer: 'below',
  }));
  const selPass = passes.data?.find((p) => p.start === sel);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Panel title="Ground track · 24 h" pad={false}
             actions={s && <Box className="mono" sx={{ fontSize: 11.5, color: T.muted }}>{s.eclipse_model}</Box>}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 240px' } }}>
          <Box sx={{ borderRight: { lg: `1px solid ${T.hairline}` } }}>
            {track.data ? <OrbitMap track={track.data} state={s} height={430} /> : <Skeleton height={430} />}
          </Box>
          {s && (
            <Box sx={{ p: 2, display: 'grid', gap: 1.75, alignContent: 'start' }}>
              <Readout label="Latitude" value={s.lat.toFixed(3)} unit="°" />
              <Readout label="Longitude" value={s.lon.toFixed(3)} unit="°" />
              <Readout label="Altitude" value={s.alt_km.toFixed(1)} unit="km" />
              <Readout label="Orbits / day" value={s.orbits_per_day.toFixed(2)} hint="Mean motion from the TLE" />
              <Readout label="Orbital sunrises / 24 h" value={s.sunrises_24h} hint="Each one is a light-dark cycle for the crew" />
              <Box sx={{ pt: 1, borderTop: `1px solid ${T.hairline}` }}>
                <Label>TLE</Label>
                <Box sx={{ fontSize: 12, color: T.text2, mt: 0.25 }}>{s.tle_source}</Box>
                <Box className="mono" sx={{ fontSize: 11, color: T.muted }}>epoch {s.tle_epoch.slice(0, 16).replace('T', ' ')}Z</Box>
              </Box>
            </Box>
          )}
        </Box>
        <Box sx={{ p: 2, borderTop: `1px solid ${T.hairline}` }}>
          {track.data ? <OrbitStrip track={track.data} nowIso={s?.ts} /> : <Skeleton height={70} />}
        </Box>
      </Panel>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '5fr 7fr' } }}>
        <Panel title={`Predicted SAA passes · ${passes.data?.length ?? 0}`} pad={false}>
          {passes.data ? (
            <Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 70px 64px 1fr', px: 2, py: 1, borderBottom: `1px solid ${T.hairline}` }}>
                {['Window (UTC)', 'Duration', 'Peak', 'Intensity'].map((h) => <Label key={h}>{h}</Label>)}
              </Box>
              {passes.data.map((p) => {
                const c = p.peak_intensity >= 0.7 ? STATUS_TEXT.red : p.peak_intensity >= 0.4 ? STATUS_TEXT.amber : T.text2;
                return (
                  <Box key={p.start} onClick={() => setSel(sel === p.start ? null : p.start)} sx={{
                    display: 'grid', gridTemplateColumns: '1fr 70px 64px 1fr', alignItems: 'center', px: 2, py: 0.9,
                    borderBottom: `1px solid ${T.hairline}`, cursor: 'pointer', bgcolor: sel === p.start ? T.raised : 'transparent',
                    '&:hover': { bgcolor: T.panel2 },
                  }}>
                    <Box className="mono" sx={{ fontSize: 12.5 }}>{p.start.slice(5, 10)} {fmtTime(p.start)}–{fmtTime(p.end)}</Box>
                    <Box className="mono" sx={{ fontSize: 12.5, color: T.text2 }}>{p.duration_min?.toFixed(0)} min</Box>
                    <Box className="mono" sx={{ fontSize: 12.5, color: c, fontWeight: 500 }}>{p.peak_intensity.toFixed(2)}</Box>
                    <Box sx={{ height: 4, bgcolor: T.panel2, borderRadius: 0.5 }}>
                      <Box sx={{ width: `${p.peak_intensity * 100}%`, height: '100%', bgcolor: c, borderRadius: 0.5 }} />
                    </Box>
                  </Box>
                );
              })}
              {selPass && (
                <Box className="fade-up" sx={{ p: 2, fontSize: 12.5, color: T.text2, lineHeight: 1.6 }}>
                  During this pass crew in the cabin receive roughly {(selPass.peak_intensity * 40).toFixed(0)} additional radiation-score
                  points at peak. EVA and exercise are kept at least 15 min clear of it by the scheduler.
                </Box>
              )}
            </Box>
          ) : <Skeleton height={300} sx={{ mx: 2 }} />}
        </Panel>

        <Panel title="Solar X-ray flux · GOES 1–8 Å"
               actions={flares.data && <Box className="mono" sx={{ fontSize: 11.5, color: T.muted }}>{flares.data.source}</Box>}>
          {flares.data ? (
            <>
              <Plot
                data={[{ type: 'scatter', mode: 'lines', x: flares.data.series.map((p) => p.time), y: flares.data.series.map((p) => p.flux),
                         line: { color: '#3987e5', width: 1.5 }, name: 'Flux', hovertemplate: '%{y:.2e} W/m²<extra></extra>' }]}
                layout={{ ...PLOT_LAYOUT_BASE, height: 300, shapes: [...bands, ...bandLines], showlegend: false,
                          margin: { l: 56, r: 28, t: 8, b: 32 },
                          yaxis: { ...PLOT_LAYOUT_BASE.yaxis, type: 'log', exponentformat: 'power', range: [-8.6, -3] },
                          annotations: flares.data.class_bands.map((b) => ({
                            xref: 'paper', x: 1.02, xanchor: 'left', yref: 'y', y: Math.log10(b.min_flux * 3.16), text: b.class,
                            showarrow: false, font: { size: 11, color: T.muted, family: T.mono } })) }}
                config={PLOT_CONFIG} style={{ width: '100%' }} useResizeHandler
              />
              <Box sx={{ display: 'flex', gap: 3, mt: 1, flexWrap: 'wrap' }}>
                <Readout size="sm" label="Current class" value={flares.data.current.flare_class} />
                <Readout size="sm" label="Instrument" value={flares.data.instrument} />
                <Box sx={{ fontSize: 12, color: T.muted, maxWidth: 340 }}>
                  Flare X-rays arrive at light speed: a flare signals higher solar particle event likelihood, not a dose itself.
                </Box>
              </Box>
            </>
          ) : <Skeleton height={300} />}
        </Panel>
      </Box>
    </Box>
  );
}
