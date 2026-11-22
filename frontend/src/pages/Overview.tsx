import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { Link as RouterLink } from 'react-router-dom';

import { useGroundTrack, useRiskHistory } from '../api/hooks';
import { useLive } from '../api/live';
import { CrewPanel } from '../components/CrewPanel';
import { Directives } from '../components/Directives';
import { OrbitMap } from '../components/OrbitMap';
import { OrbitStrip } from '../components/OrbitStrip';
import { ScenarioPanel } from '../components/ScenarioPanel';
import { Panel, Readout } from '../components/ui';
import { STATUS_TEXT, T } from '../theme';

function ErrorState() {
  return (
    <Panel title="Connection">
      <Box sx={{ color: STATUS_TEXT.red, fontSize: 14 }}>Cannot reach the ASTRA SHIELD API.</Box>
      <Box sx={{ color: T.text2, fontSize: 13, mt: 0.5 }}>
        Start the backend: <Box component="code" className="mono">uvicorn app.main:app --port 8000</Box>
      </Box>
    </Panel>
  );
}

export default function Overview() {
  const live = useLive();
  const hist = useRiskHistory();
  const track = useGroundTrack();

  if (live.isError && !live.data) return <ErrorState />;
  if (!live.data) return <Skeleton variant="rounded" height={480} sx={{ bgcolor: T.panel }} />;
  const d = live.data;
  const s = d.space;
  const series = (cs: string) => hist.data?.find((h) => h.callsign === cs)?.points.map((p) => p.risk) ?? [];
  const counts = { red: d.crew.filter((c) => c.status === 'red').length, amber: d.crew.filter((c) => c.status === 'amber').length };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {/* summary line */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1.5, color: T.text2, fontSize: 13 }}>
        <Box component="span" sx={{ color: T.text, fontWeight: 600 }}>
          {counts.red ? `${counts.red} crew critical` : counts.amber ? `${counts.amber} crew on caution` : 'All crew nominal'}
        </Box>
        <span>·</span>
        <span>Risk = 0.60 × Radiation + 0.40 × Sleep deficit</span>
        <span>·</span>
        <span>Nominal &lt; 40 · Caution 40–69 · Critical ≥ 70</span>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' } }}>
        {d.crew.map((c) => (
          <CrewPanel key={c.id} c={c} history={series(c.callsign)} lighting={d.lighting[c.callsign]} />
        ))}
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' } }}>
        <Panel title="Orbit environment · next 24 h" pad={false}
               actions={<Box component={RouterLink} to="/space" sx={{ fontSize: 12, color: T.accent, textDecoration: 'none' }}>Open orbit view →</Box>}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 200px' } }}>
            <Box sx={{ borderRight: { md: `1px solid ${T.hairline}` } }}>
              {track.data ? <OrbitMap track={track.data} state={s} height={260} compact /> : <Skeleton height={260} />}
            </Box>
            <Box sx={{ p: 2, display: 'grid', gap: 1.5, alignContent: 'start' }}>
              <Readout label="Altitude" value={s.alt_km.toFixed(1)} unit="km" />
              <Readout label="Illumination" value={s.sunlit ? 'Sunlit' : 'Eclipse'} color={s.sunlit ? '#e7c35a' : '#9085e9'} />
              <Readout label="SAA" value={s.in_saa ? `Inside · ${s.saa_intensity.toFixed(2)}` : 'Clear'} color={s.in_saa ? STATUS_TEXT.red : undefined} />
              <Readout label="X-ray class" value={s.flare_class}
                       color={s.flare_class[0] === 'X' ? STATUS_TEXT.red : s.flare_class[0] === 'M' ? STATUS_TEXT.amber : undefined}
                       hint={s.flare_source} />
            </Box>
          </Box>
          <Box sx={{ p: 2, borderTop: `1px solid ${T.hairline}` }}>
            {track.data ? <OrbitStrip track={track.data} nowIso={s.ts} /> : <Skeleton height={70} />}
          </Box>
        </Panel>
        <ScenarioPanel active={d.demo_active} />
      </Box>

      <Panel title={`Active directives · ${d.actions.length}`}
             actions={<Box component={RouterLink} to="/decisions" sx={{ fontSize: 12, color: T.accent, textDecoration: 'none' }}>Decision log →</Box>}>
        <Directives actions={d.top_actions ?? d.actions} limit={6} />
      </Panel>
    </Box>
  );
}
