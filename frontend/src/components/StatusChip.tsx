import Chip from '@mui/material/Chip';

import type { Status } from '../api/types';
import { STATUS_COLORS } from '../theme';

const LABEL: Record<Status, string> = { green: 'GREEN', amber: 'AMBER', red: 'RED' };

export function StatusChip({ status, size = 'small' }: { status: Status; size?: 'small' | 'medium' }) {
  return (
    <Chip
      size={size}
      label={LABEL[status]}
      sx={{ bgcolor: STATUS_COLORS[status], color: '#fff', fontWeight: 700, letterSpacing: 0.8 }}
      data-testid={`status-${status}`}
    />
  );
}
