import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { api, wsUrl } from './client';
import type { LivePayload } from './types';

interface LiveCtx {
  connected: boolean;
  refresh: () => void;
}

const Ctx = createContext<LiveCtx>({ connected: false, refresh: () => undefined });

/** Live data over /ws/live; falls back to 5 s polling of /api/mission/overview while disconnected. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (stopped || typeof WebSocket === 'undefined') return;
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'tick') {
            qc.setQueryData<LivePayload>(['live'], msg);
          } else if (msg.type === 'schedule' || msg.type === 'demo') {
            qc.invalidateQueries();
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [qc]);

  const refresh = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send('refresh');
    qc.invalidateQueries();
  };

  return <Ctx.Provider value={{ connected, refresh }}>{children}</Ctx.Provider>;
}

export function useLiveStatus() {
  return useContext(Ctx);
}

export function useLive() {
  const { connected } = useLiveStatus();
  return useQuery({
    queryKey: ['live'],
    queryFn: api.overview,
    refetchInterval: connected ? false : 5000,
    staleTime: connected ? Infinity : 0,
  });
}
