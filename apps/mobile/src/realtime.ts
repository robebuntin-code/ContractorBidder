import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, getAccessTokenAsync } from './api';

const ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

export interface RealtimeHandlers {
  onNotification?: (payload: unknown) => void;
  onBid?: (payload: unknown) => void;
  onMessage?: (payload: unknown) => void;
}

/** Connect to the realtime gateway and (optionally) subscribe to a job room. */
export function useRealtime(jobId: string | undefined, handlers: RealtimeHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | undefined;

    void getAccessTokenAsync().then((token) => {
      if (cancelled || !token) return;

      socket = io(`${ORIGIN}/realtime`, {
        transports: ['websocket'],
        auth: { token },
      });

      socket.on('connect', () => {
        if (jobId) socket?.emit('job:subscribe', { jobId });
      });
      socket.on('notification', (p) => handlersRef.current.onNotification?.(p));
      socket.on('bid', (p) => handlersRef.current.onBid?.(p));
      socket.on('message', (p) => handlersRef.current.onMessage?.(p));
    });

    return () => {
      cancelled = true;
      if (jobId) socket?.emit('job:unsubscribe', { jobId });
      socket?.disconnect();
    };
  }, [jobId]);
}
