'use client';

// 실시간 시세 스트림 훅. docs/ARCHITECTURE.md web 데이터 흐름을 그대로 구현한다:
// 최초 REST 스냅샷(GET /v1/ticks)으로 상태를 채운 뒤, WS로 구독해 tick마다 갱신한다.
// 모든 네트워크 접근은 useEffect(클라이언트) 안에서만 일어난다 — 빌드 타임 fetch 없음.

import { useEffect, useState } from 'react';
import type { NormalizedTick } from '@market/shared';
import { API_URL, WS_URL, SYMBOLS } from './config';

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export interface MarketStream {
  ticks: Record<string, NormalizedTick>;
  status: ConnectionStatus;
}

export function useMarketStream(): MarketStream {
  const [ticks, setTicks] = useState<Record<string, NormalizedTick>>({});
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    let cancelled = false;

    // 1) 최초 REST 스냅샷 — 서버가 없어도(오프라인) 조용히 무시하고 WS로 회복.
    fetch(`${API_URL}/v1/ticks`)
      .then((res) => (res.ok ? (res.json() as Promise<NormalizedTick[]>) : []))
      .then((snapshot: NormalizedTick[]) => {
        if (cancelled || !Array.isArray(snapshot)) {
          return;
        }
        setTicks((prev) => {
          const next = { ...prev };
          for (const tick of snapshot) {
            next[tick.symbol] = tick;
          }
          return next;
        });
      })
      .catch(() => {
        /* 서버 미기동 등 — 무시(WS 연결 상태로 사용자에게 표시). */
      });

    // 2) WS 실시간 구독.
    const socket = new WebSocket(WS_URL);
    setStatus('connecting');

    socket.onopen = () => {
      if (cancelled) {
        return;
      }
      setStatus('open');
      socket.send(JSON.stringify({ event: 'subscribe', data: { symbols: SYMBOLS } }));
    };

    socket.onmessage = (event: MessageEvent) => {
      if (cancelled) {
        return;
      }
      try {
        const message = JSON.parse(String(event.data)) as {
          event?: string;
          data?: NormalizedTick;
        };
        if (message.event === 'tick' && message.data && typeof message.data.symbol === 'string') {
          const tick = message.data;
          setTicks((prev) => ({ ...prev, [tick.symbol]: tick }));
        }
      } catch {
        /* 잘못된 메시지는 무시. */
      }
    };

    socket.onclose = () => {
      if (!cancelled) {
        setStatus('closed');
      }
    };
    socket.onerror = () => {
      if (!cancelled) {
        setStatus('closed');
      }
    };

    // 언마운트 시 소켓 정리.
    return () => {
      cancelled = true;
      socket.close();
    };
  }, []);

  return { ticks, status };
}
