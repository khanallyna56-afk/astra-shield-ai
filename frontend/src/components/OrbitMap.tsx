import type { Data } from 'plotly.js';

import type { GroundTrack, SpaceState } from '../api/types';
import { ACCENT } from '../theme';
import Plot, { PLOT_CONFIG } from './Plot';

/** Split the track into segments for one condition, breaking lines at the antimeridian. */
function segments(track: GroundTrack, keep: (sunlit: boolean) => boolean) {
  const lat: (number | null)[] = [];
  const lon: (number | null)[] = [];
  let prevLon: number | null = null;
  for (const p of track.points) {
    if (!keep(p.sunlit)) {
      if (lat.at(-1) !== null) { lat.push(null); lon.push(null); }
      prevLon = null;
      continue;
    }
    if (prevLon !== null && Math.abs(p.lon - prevLon) > 180) { lat.push(null); lon.push(null); }
    lat.push(p.lat);
    lon.push(p.lon);
    prevLon = p.lon;
  }
  return { lat, lon };
}

export function OrbitMap({ track, state, height = 440 }: { track: GroundTrack; state?: SpaceState; height?: number }) {
  const sun = segments(track, (s) => s);
  const night = segments(track, (s) => !s);
  const poly = [...track.saa_polygon, track.saa_polygon[0]];
  const data: Data[] = [
    { type: 'scattergeo', mode: 'lines', lat: poly.map((p) => p.lat), lon: poly.map((p) => p.lon), fill: 'toself',
      fillcolor: 'rgba(211,47,47,0.18)', line: { color: 'rgba(239,83,80,0.8)', width: 1.5 }, name: 'SAA zone',
      hoverinfo: 'name' },
    { type: 'scattergeo', mode: 'lines', lat: sun.lat, lon: sun.lon, name: 'Sunlit',
      line: { color: '#fbbf24', width: 1.6 }, hoverinfo: 'skip' },
    { type: 'scattergeo', mode: 'lines', lat: night.lat, lon: night.lon, name: 'Eclipse',
      line: { color: '#6366f1', width: 1.6 }, hoverinfo: 'skip' },
  ];
  if (state) {
    data.push({ type: 'scattergeo', mode: 'markers', lat: [state.lat], lon: [state.lon], name: 'Spacecraft now',
      marker: { size: 14, color: ACCENT, line: { color: '#fff', width: 2 }, symbol: 'circle' },
      hovertemplate: `Lat %{lat:.1f}, Lon %{lon:.1f}<br>Alt ${state.alt_km.toFixed(0)} km<extra></extra>` });
  }
  return (
    <Plot
      data={data}
      layout={{
        height, margin: { l: 0, r: 0, t: 0, b: 0 }, paper_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#c9d8ec' }, showlegend: true,
        legend: { orientation: 'h', y: 0.02, x: 0.01, bgcolor: 'rgba(7,17,31,0.7)' },
        geo: { projection: { type: 'equirectangular' }, showland: true, landcolor: '#16283f', showocean: true,
               oceancolor: '#0a1626', showcountries: true, countrycolor: 'rgba(148,197,255,0.15)',
               coastlinecolor: 'rgba(148,197,255,0.35)', bgcolor: 'rgba(0,0,0,0)', showframe: false,
               lataxis: { range: [-70, 75] } },
      }}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
      useResizeHandler
    />
  );
}
