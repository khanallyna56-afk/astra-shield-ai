import type { Data } from 'plotly.js';

import type { GroundTrack, SpaceState } from '../api/types';
import { T } from '../theme';
import Plot, { PLOT_CONFIG } from './Plot';

/** Split the track into one condition's segments, breaking lines at the antimeridian. */
function segments(track: GroundTrack, keep: (sunlit: boolean) => boolean) {
  const lat: (number | null)[] = [];
  const lon: (number | null)[] = [];
  const text: string[] = [];
  let prevLon: number | null = null;
  for (const p of track.points) {
    if (!keep(p.sunlit)) {
      if (lat[lat.length - 1] !== null) { lat.push(null); lon.push(null); text.push(''); }
      prevLon = null;
      continue;
    }
    if (prevLon !== null && Math.abs(p.lon - prevLon) > 180) { lat.push(null); lon.push(null); text.push(''); }
    lat.push(p.lat);
    lon.push(p.lon);
    text.push(`${p.ts.slice(11, 16)}Z · SAA ${p.saa_intensity.toFixed(2)}`);
    prevLon = p.lon;
  }
  return { lat, lon, text };
}

export function OrbitMap({ track, state, height = 420, compact = false }:
  { track: GroundTrack; state?: SpaceState; height?: number; compact?: boolean }) {
  const sun = segments(track, (s) => s);
  const night = segments(track, (s) => !s);
  const poly = [...track.saa_polygon, track.saa_polygon[0]];
  const data: Data[] = [
    { type: 'scattergeo', mode: 'lines', lat: poly.map((p) => p.lat), lon: poly.map((p) => p.lon), fill: 'toself',
      fillcolor: 'rgba(211,47,47,0.14)', line: { color: 'rgba(255,107,102,0.65)', width: 1 }, name: 'SAA zone',
      hoverinfo: 'name' },
    { type: 'scattergeo', mode: 'lines', lat: sun.lat, lon: sun.lon, text: sun.text, name: 'Sunlit',
      line: { color: '#e7c35a', width: 1.5 }, hovertemplate: '%{text}<extra>Sunlit</extra>' },
    { type: 'scattergeo', mode: 'lines', lat: night.lat, lon: night.lon, text: night.text, name: 'Eclipse',
      line: { color: '#9085e9', width: 1.5 }, hovertemplate: '%{text}<extra>Eclipse</extra>' },
  ];
  if (state) {
    data.push({ type: 'scattergeo', mode: 'markers', lat: [state.lat], lon: [state.lon], name: 'Spacecraft',
      marker: { size: 16, color: 'rgba(57,135,229,0.25)', line: { color: T.accent, width: 1 } }, hoverinfo: 'skip', showlegend: false });
    data.push({ type: 'scattergeo', mode: 'markers', lat: [state.lat], lon: [state.lon], name: 'Spacecraft',
      marker: { size: 8, color: '#fff', line: { color: T.accent, width: 2 } },
      hovertemplate: `Spacecraft<br>%{lat:.2f}, %{lon:.2f}<br>${state.alt_km.toFixed(0)} km<extra></extra>` });
  }
  return (
    <Plot
      data={data}
      layout={{
        height, margin: { l: 0, r: 0, t: 0, b: 0 }, paper_bgcolor: 'rgba(0,0,0,0)',
        font: { color: T.text2, family: T.sans, size: 11 }, showlegend: !compact,
        legend: { orientation: 'h', y: 0.04, x: 0.01, bgcolor: 'rgba(10,12,15,0.75)', bordercolor: T.line, borderwidth: 1 },
        hoverlabel: { bgcolor: T.raised, bordercolor: T.line, font: { family: T.mono, size: 11, color: T.text } },
        geo: { projection: { type: 'equirectangular' }, showland: true, landcolor: '#161b22', showocean: true,
               oceancolor: '#0b0e12', showcountries: true, countrycolor: '#232931', coastlinecolor: '#36404c',
               coastlinewidth: 0.6, countrywidth: 0.4, bgcolor: 'rgba(0,0,0,0)', showframe: false,
               lataxis: { range: [-62, 72], showgrid: true, gridcolor: '#151a20', dtick: 30 },
               lonaxis: { showgrid: true, gridcolor: '#151a20', dtick: 30 } },
      }}
      config={{ ...PLOT_CONFIG, scrollZoom: false }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  );
}
