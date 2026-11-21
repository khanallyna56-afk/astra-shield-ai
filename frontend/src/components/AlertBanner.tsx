import MuiAlert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';

import type { CrewMember } from '../api/types';

/** Global red banner shown whenever any crew member is RED. */
export function AlertBanner({ crew }: { crew: CrewMember[] }) {
  const reds = crew.filter((c) => c.status === 'red');
  if (!reds.length) return null;
  return (
    <MuiAlert severity="error" variant="filled" sx={{ borderRadius: 0, py: 0.5 }} data-testid="alert-banner">
      <AlertTitle sx={{ mb: 0, fontWeight: 800 }}>
        COMPOUND RISK RED: {reds.map((c) => `${c.callsign} (${c.risk})`).join(', ')}
      </AlertTitle>
      Radiation and sleep loss are elevated at the same time. Review actions on Mission Overview.
    </MuiAlert>
  );
}
