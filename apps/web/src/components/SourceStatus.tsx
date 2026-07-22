// 스트림 연결 상태 표시줄. UI_GUIDE 상태 인디케이터 규칙: 작은 원형 점(초록/노랑/빨강)
// + 레이블. 글로우·펄스 애니메이션 금지(단순 색상만).

import type { ConnectionStatus } from '@/lib/useMarketStream';

const STATUS_META: Record<ConnectionStatus, { color: string; label: string }> = {
  open: { color: '#22c55e', label: '연결됨' },
  connecting: { color: '#eab308', label: '연결 중' },
  closed: { color: '#ef4444', label: '끊김' },
};

export function SourceStatus({ status }: { status: ConnectionStatus }): JSX.Element {
  const meta = STATUS_META[status];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.875rem',
        color: '#a3a3a3',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: meta.color,
          display: 'inline-block',
        }}
      />
      <span>실시간 스트림</span>
      <span style={{ color: meta.color }}>{meta.label}</span>
      <span style={{ color: '#737373' }}>· Upbit · Binance</span>
    </div>
  );
}
