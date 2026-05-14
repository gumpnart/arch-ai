import { useEffect, useRef } from 'react';

export interface SSEEvent {
  event: string;
  [key: string]: unknown;
}

interface UseSSEOptions {
  onMessage: (event: SSEEvent) => void;
  onStatus: (status: 'connecting' | 'live' | 'disconnected') => void;
}

export function useSSE({ onMessage, onStatus }: UseSSEOptions) {
  const onMessageRef = useRef(onMessage);
  const onStatusRef = useRef(onStatus);
  onMessageRef.current = onMessage;
  onStatusRef.current = onStatus;

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      onStatusRef.current('connecting');
      es = new EventSource('/api/events');

      es.addEventListener('message', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data as string) as SSEEvent;
          if (data.event === 'connected') {
            onStatusRef.current('live');
          } else {
            onMessageRef.current(data);
          }
        } catch {
          // ignore malformed messages
        }
      });

      es.addEventListener('error', () => {
        onStatusRef.current('disconnected');
        es?.close();
        retryTimer = setTimeout(connect, 3000);
      });
    }

    connect();

    return () => {
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);
}
