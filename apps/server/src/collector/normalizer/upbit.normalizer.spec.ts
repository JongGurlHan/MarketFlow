import { isValidTick } from '@market/shared';
import { mapUpbitRaw } from './upbit.normalizer';
import upbitBtc from '../__fixtures__/upbit-btc.json';
import upbitEth from '../__fixtures__/upbit-eth.json';

describe('mapUpbitRaw', () => {
  it('KRW-BTC raw를 BTC/KRW NormalizedTick으로 정규화한다', () => {
    const tick = mapUpbitRaw(upbitBtc);
    expect(tick.source).toBe('upbit');
    expect(tick.assetClass).toBe('crypto');
    expect(tick.symbol).toBe('BTC/KRW'); // 레지스트리로 코드 변환
    expect(tick.price).toBe(98750000);
    expect(tick.changeRate24h).toBeCloseTo(1.23, 6); // 0.0123 × 100
    expect(tick.volume24h).toBe(1234.56789012);
    expect(tick.sourceTimestamp).toBe(1721650000000); // trade_timestamp 우선
    expect(typeof tick.ingestTimestamp).toBe('number');
  });

  it('KRW-ETH raw를 ETH/KRW로 정규화하고 음수 등락률을 퍼센트로 환산한다', () => {
    const tick = mapUpbitRaw(upbitEth);
    expect(tick.symbol).toBe('ETH/KRW');
    expect(tick.price).toBe(4850000);
    expect(tick.changeRate24h).toBeCloseTo(-0.87, 6);
  });

  it('정규화 결과는 zod 스키마 검증을 통과한다(표준 스키마 게이트)', () => {
    expect(isValidTick(mapUpbitRaw(upbitBtc))).toBe(true);
    expect(isValidTick(mapUpbitRaw(upbitEth))).toBe(true);
  });

  it('trade_timestamp가 없으면 timestamp로 fallback 한다', () => {
    const tick = mapUpbitRaw({ ...upbitBtc, trade_timestamp: undefined });
    expect(tick.sourceTimestamp).toBe(upbitBtc.timestamp);
  });

  it('레지스트리에 없는 코드는 매핑을 거부한다', () => {
    expect(() => mapUpbitRaw({ ...upbitBtc, code: 'KRW-DOGE' })).toThrow();
  });
});
