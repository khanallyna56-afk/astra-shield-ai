import { useQuery } from '@tanstack/react-query';

import { api } from './client';
import { useLive } from './live';

/** 24 h risk history, refetched when the live minute or scenario state changes. */
export function useRiskHistory(hours = 24) {
  const live = useLive();
  const key = `${live.data?.ts.slice(0, 16)}|${live.data?.demo_active}`;
  return useQuery({ queryKey: ['risk-history', hours, key], queryFn: () => api.riskHistory(hours), placeholderData: (p) => p });
}

export function useGroundTrack(hours = 24) {
  const live = useLive();
  return useQuery({ queryKey: ['groundtrack', hours, live.data?.demo_active], queryFn: () => api.groundTrack(hours),
                    placeholderData: (p) => p, staleTime: 60_000 });
}
