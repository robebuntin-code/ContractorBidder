'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './api';

// The gateway namespace lives at <api-origin>/realtime. Derive the origin from
// the REST base URL (strip the trailing /api/v1).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

export interface RealtimeHandlers {
  onNotification?: (payload: unknown) => void;
  onBid?: (payload: unknown) => void;
  onMessage?: (payload: unknown) => void;
}

/**
 * Connect to the realtime gateway, optionally subscribe to a job room, and
 * dispatch incoming events to the provided handlers. Re-subscribes on jobId
 * change and tears down on unmount.
 */
export function useRealtime(jobId: string | undefined, handlers: RealtimeHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const token = tokenStore.access;
    if (!token) return;

    const socket: Socket = io(`${ORIGIN}/realtime`, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      if (jobId) socket.emit('job:subscribe', { jobId });
    });
    socket.on('notification', (p) => handlersRef.current.onNotification?.(p));
    socket.on('bid', (p) => handlersRef.current.onBid?.(p));
    socket.on('message', (p) => handlersRef.current.onMessage?.(p));

    return () => {
      if (jobId) socket.emit('job:unsubscribe', { jobId });
      socket.disconnect();
    };
  }, [jobId]);
}
