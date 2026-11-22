import Box from '@mui/material/Box';
import { useMemo, useState } from 'react';

import type { GroundTrack } from '../api/types';
import { STATUS_TEXT, T } from '../theme';
import { Label, fmtTime } from './ui';

/**
 * 24 h orbit-environment strip: illumination lane (sunlit / eclipse) and SAA intensity lane,
 * with hour ticks and a hover crosshair reading out the time and conditions.
 */
export function OrbitStrip({ track, nowIso }: { track: GroundTrack; nowIso?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = track.points;
  const n = pts.length;
  const t0 = new Date(pts[0].ts).getTime();
  const t1 = new Date(pts[n - 1].ts).getTime();
  const pos = (iso: string) => ((new Date(iso).getTime() - t0) / (t1 - t0)) * 100;

  const { sun, saa } = useMemo(() => {
    const sunSegs: { a: number; b: number; lit: boolean }[] = [];
    const saaBars: { a: number; v: number }[] = [];
    let start = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n || pts[i].sunlit !== pts[start].sunlit) {
        sunSegs.push({ a: (start / (n - 1)) * 100, b: ((i - 1) / (n - 1)) * 100, lit: pts[start].sunlit });
        start = i;
      }
    }
    pts.forEach((p, i) => { if (p.saa_intensity > 0.02) saaBars.push({ a: (i / (n - 1)) * 100, v: p.saa_intensity }); });
    return { sun: sunSegs, saa: saaBars };
  }, [pts, n]);

  const hp = hover !== null ? pts[Math.min(n - 1, Math.max(0, Math.round((hover / 100) * (n - 1))))] : null;
  const hours = Array.from({ length: 7 }, (_, i) => i * 4);

  return (
    <Box>
      <Box sx={{ position: 'relative', userSelect: 'none' }}
           onMouseMove={(e) => {
             const r = e.currentTarget.getBoundingClientRect();
             setHover(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
           }}
           onMouseLeave={() => setHover(null)}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '88px 1fr', rowGap: 0.75, alignItems: 'center' }}>
          <Label>Illumination</Label>
          <Box sx={{ position: 'relative', height: 14, bgcolor: T.panel2, borderRadius: 0.5, overflow: 'hidden' }}>
            {sun.map((s, i) => (
              <Box key={i} sx={{ position: 'absolute', left: `${s.a}%`, width: `${Math.max(0.2, s.b - s.a)}%`, top: 0, bottom: 0,
                                 bgcolor: s.lit ? '#6b5a22' : '#2e2a5c' }} />
            ))}
          </Box>
          <Label>SAA dose</Label>
          <Box sx={{ position: 'relative', height: 22, bgcolor: T.panel2, borderRadius: 0.5, overflow: 'hidden' }}>
            {saa.map((s, i) => (
              <Box key={i} sx={{ position: 'absolute', left: `${s.a}%`, width: '0.2%', bottom: 0, height: `${Math.max(8, s.v * 100)}%`,
                                 bgcolor: STATUS_TEXT.red, opacity: 0.25 + s.v * 0.75 }} />
            ))}
          </Box>
          <Box />
          <Box sx={{ position: 'relative', height: 14 }}>
            {hours.map((h) => (
              <Box key={h} className="mono" sx={{ position: 'absolute', left: `${(h / 24) * 100}%`, transform: h ? 'translateX(-50%)' : 'none',
                                                  fontSize: 10, color: T.muted }}>
                {fmtTime(new Date(t0 + h * 3600e3).toISOString())}
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ position: 'absolute', left: 88, right: 0, top: 0, bottom: 14, pointerEvents: 'none' }}>
          {nowIso && pos(nowIso) >= 0 && pos(nowIso) <= 100 && (
            <Box sx={{ position: 'absolute', left: `${pos(nowIso)}%`, top: -4, bottom: 0, width: '1px', bgcolor: T.accent }} />
          )}
          {hover !== null && <Box sx={{ position: 'absolute', left: `${hover}%`, top: 0, bottom: 0, width: '1px', bgcolor: T.text2 }} />}
        </Box>
      </Box>
      <Box className="mono" sx={{ height: 18, mt: 0.5, fontSize: 11.5, color: T.text2 }}>
        {hp ? `${fmtTime(hp.ts)}Z  ·  ${hp.sunlit ? 'sunlit' : 'eclipse'}  ·  SAA ${hp.saa_intensity.toFixed(2)}  ·  ${hp.lat.toFixed(1)}, ${hp.lon.toFixed(1)}`
            : <Box component="span" sx={{ color: T.muted }}>Hover the strip to inspect conditions · blue line = mission time</Box>}
      </Box>
    </Box>
  );
}
