import { render, screen } from '@testing-library/react';
import type { NormalizedTick } from '@market/shared';
import { TickTable } from './TickTable';

// 순수 컴포넌트 — props(NormalizedTick[])만으로 렌더된다. 백엔드/외부망 의존 없음.
function makeTick(overrides: Partial<NormalizedTick> = {}): NormalizedTick {
  return {
    source: 'upbit',
    symbol: 'BTC/KRW',
    assetClass: 'crypto',
    price: 68_000_000,
    changeRate24h: 2.5,
    sourceTimestamp: 1_700_000_000_000,
    ingestTimestamp: 1_700_000_000_500,
    ...overrides,
  };
}

describe('TickTable', () => {
  it('심볼과 포맷된 현재가를 렌더한다', () => {
    render(<TickTable ticks={[makeTick()]} />);

    expect(screen.getByText('BTC/KRW')).toBeInTheDocument();
    expect(screen.getByText('68,000,000')).toBeInTheDocument();
  });

  it('상승(양수 변동률)에는 상승 색 클래스를 적용한다', () => {
    render(<TickTable ticks={[makeTick({ changeRate24h: 2.5 })]} />);

    const cell = screen.getByText('+2.50%');
    expect(cell).toHaveClass('change-up');
    expect(cell).toHaveStyle({ color: '#22c55e' });
  });

  it('하락(음수 변동률)에는 하락 색 클래스를 적용한다', () => {
    render(
      <TickTable
        ticks={[makeTick({ symbol: 'ETH/USDT', price: 3200, changeRate24h: -1.3 })]}
      />,
    );

    const cell = screen.getByText('-1.30%');
    expect(cell).toHaveClass('change-down');
    expect(cell).toHaveStyle({ color: '#ef4444' });
  });

  it('심볼마다 한 행을 렌더한다', () => {
    render(
      <TickTable
        ticks={[
          makeTick({ symbol: 'BTC/KRW' }),
          makeTick({ symbol: 'ETH/KRW', price: 4_200_000, source: 'upbit' }),
        ]}
      />,
    );

    expect(screen.getByText('BTC/KRW')).toBeInTheDocument();
    expect(screen.getByText('ETH/KRW')).toBeInTheDocument();
  });
});
