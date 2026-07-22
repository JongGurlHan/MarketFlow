'use client';

// 실시간 시세 대시보드. 최초 REST 스냅샷 → WS 구독으로 갱신(useMarketStream).
// UI_GUIDE: 금융 단말 미학, max-w-6xl 좌측 정렬, 상단 제목 + 소스 상태, 본문 시세 테이블.

import { useMemo } from 'react';
import { useMarketStream } from '@/lib/useMarketStream';
import { TickTable } from '@/components/TickTable';
import { SourceStatus } from '@/components/SourceStatus';

export default function Home() {
  const { ticks, status } = useMarketStream();

  // 심볼 오름차순 정렬로 행 순서를 안정화한다.
  const rows = useMemo(
    () => Object.values(ticks).sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [ticks],
  );

  return (
    <main
      style={{
        maxWidth: '72rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f5f5f5', margin: 0 }}>
          MarketStream
        </h1>
        <SourceStatus status={status} />
      </header>

      <TickTable ticks={rows} />
    </main>
  );
}
