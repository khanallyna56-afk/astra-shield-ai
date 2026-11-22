import Box from '@mui/material/Box';

import type { Action } from '../api/types';
import { STATUS_TEXT, T } from '../theme';

export const ACTION_LABEL: Record<string, string> = {
  POSTPONE_EVA: 'Postpone EVA',
  REASSIGN_EVA: 'Reassign EVA',
  MOVE_TO_SHIELDED: 'Shelter crew',
  LIGHTING_WARM: 'Warm lighting',
  ADVISORY: 'Advisory',
  INCREASE_MONITORING: 'Monitoring ↑',
};
export const SEV_COLOR = { red: STATUS_TEXT.red, amber: STATUS_TEXT.amber, info: '#7fa7d9' } as const;
const PRIORITY = { 1: 'P1', 2: 'P2', 3: 'P3' } as Record<number, string>;

/** Console-style list of current decision-engine directives. */
export function Directives({ actions, limit, empty = 'No directives. All crew nominal.' }:
  { actions: Action[]; limit?: number; empty?: string }) {
  const list = limit ? actions.slice(0, limit) : actions;
  if (!list.length) {
    return <Box sx={{ py: 3, textAlign: 'center', color: T.muted, fontSize: 13 }}>{empty}</Box>;
  }
  return (
    <Box>
      {list.map((a, i) => (
        <Box key={`${a.type}-${a.target}-${i}`} className="fade-up" sx={{
          display: 'grid', gridTemplateColumns: '34px 130px 1fr', gap: 1.5, alignItems: 'baseline', py: 1,
          borderBottom: i < list.length - 1 ? `1px solid ${T.hairline}` : 'none', animationDelay: `${i * 40}ms`,
        }}>
          <Box className="mono" sx={{ fontSize: 11, fontWeight: 500, color: SEV_COLOR[a.severity] }}>{PRIORITY[a.priority]}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontSize: 13, fontWeight: 600, color: T.text }}>{ACTION_LABEL[a.type] ?? a.type}</Box>
            <Box sx={{ fontSize: 11.5, color: T.text2 }}>{a.target}</Box>
          </Box>
          <Box sx={{ fontSize: 12.5, color: T.text2, lineHeight: 1.5 }}>{a.reason}</Box>
        </Box>
      ))}
      {limit && actions.length > limit && (
        <Box sx={{ pt: 1, fontSize: 12, color: T.muted }}>+{actions.length - limit} more on Decisions</Box>
      )}
    </Box>
  );
}
