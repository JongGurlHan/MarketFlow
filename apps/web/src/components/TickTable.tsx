'use client';

// 시세 테이블(핵심 컴포넌트). props(NormalizedTick[])만으로 렌더되는 순수 컴포넌트라
// 테스트가 백엔드/외부망 없이 통과한다(docs/UI_GUIDE.md 시세 테이블 규격).
// 색·타이포·애니메이션은 UI_GUIDE를 따른다: 숫자는 모노스페이스 우측정렬,
// 상승 초록/하락 빨강, 가격 갱신 시 150ms 셀 플래시 외 애니메이션 금지.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { NormalizedTick } from '@market/shared';

// UI_GUIDE 시맨틱/텍스트 색상 토큰.
const UP = '#22c55e';
const DOWN = '#ef4444';
const FLAT = '#737373';
const TEXT = '#f5f5f5'; // neutral-100
const MUTED = '#a3a3a3'; // neutral-400
const BORDER = '#262626'; // neutral-800
const ROW_DIVIDER = '#1f1f1f';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

type ChangeDir = 'up' | 'down' | 'flat';

const CHANGE_COLOR: Record<ChangeDir, string> = { up: UP, down: DOWN, flat: FLAT };

function formatPrice(price: number): string {
  return price.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatChange(rate: number | undefined): { text: string; dir: ChangeDir } {
  if (rate === undefined || Number.isNaN(rate)) {
    return { text: '—', dir: 'flat' };
  }
  const dir: ChangeDir = rate > 0 ? 'up' : rate < 0 ? 'down' : 'flat';
  const text = `${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`;
  return { text, dir };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function thStyle(align: 'left' | 'right'): CSSProperties {
  return {
    textAlign: align,
    padding: '0.5rem 0.75rem',
    color: MUTED,
    fontWeight: 500,
    fontSize: '0.75rem',
    borderBottom: `1px solid ${BORDER}`,
  };
}

function tdStyle(align: 'left' | 'right'): CSSProperties {
  return {
    textAlign: align,
    padding: '0.5rem 0.75rem',
    borderBottom: `1px solid ${ROW_DIVIDER}`,
  };
}

const numericCell: CSSProperties = {
  fontFamily: MONO,
  fontVariantNumeric: 'tabular-nums',
};

// 현재가 셀 — 가격 변경 시 상승 초록/하락 빨강으로 150ms 배경 플래시 후 원복.
// props(price)만으로 렌더되며, 이전 값 비교는 내부 ref로만 처리한다(부수효과).
function PriceCell({ price }: { price: number }): JSX.Element {
  const prevRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<ChangeDir | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = price;
    if (prev === null || prev === price) {
      return;
    }
    setFlash(price > prev ? 'up' : 'down');
    const timer = setTimeout(() => setFlash(null), 150);
    return () => clearTimeout(timer);
  }, [price]);

  const backgroundColor =
    flash === 'up'
      ? 'rgba(34, 197, 94, 0.18)'
      : flash === 'down'
        ? 'rgba(239, 68, 68, 0.18)'
        : 'transparent';

  return (
    <td
      style={{
        ...tdStyle('right'),
        ...numericCell,
        color: TEXT,
        backgroundColor,
        transition: 'background-color 150ms ease-out',
      }}
    >
      {formatPrice(price)}
    </td>
  );
}

function TickRow({ tick }: { tick: NormalizedTick }): JSX.Element {
  const change = formatChange(tick.changeRate24h);
  return (
    <tr>
      <td style={{ ...tdStyle('left'), color: TEXT, fontFamily: MONO }}>{tick.symbol}</td>
      <PriceCell price={tick.price} />
      <td style={{ ...tdStyle('right'), ...numericCell }}>
        <span className={`change-${change.dir}`} style={{ color: CHANGE_COLOR[change.dir] }}>
          {change.text}
        </span>
      </td>
      <td style={{ ...tdStyle('left'), color: MUTED }}>{tick.source}</td>
      <td style={{ ...tdStyle('right'), ...numericCell, color: MUTED }}>
        {formatTime(tick.ingestTimestamp)}
      </td>
    </tr>
  );
}

export function TickTable({ ticks }: { ticks: NormalizedTick[] }): JSX.Element {
  return (
    <div
      style={{
        borderRadius: 6,
        background: '#141414',
        border: `1px solid ${BORDER}`,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ backgroundColor: ROW_DIVIDER }}>
            <th style={thStyle('left')}>심볼</th>
            <th style={thStyle('right')}>현재가</th>
            <th style={thStyle('right')}>24h 변동률</th>
            <th style={thStyle('left')}>소스</th>
            <th style={thStyle('right')}>최종 갱신</th>
          </tr>
        </thead>
        <tbody>
          {ticks.map((tick) => (
            <TickRow key={tick.symbol} tick={tick} />
          ))}
          {ticks.length === 0 && (
            <tr>
              <td colSpan={5} style={{ ...tdStyle('left'), color: MUTED, textAlign: 'center' }}>
                데이터 대기 중…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
