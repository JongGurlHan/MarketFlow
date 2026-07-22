import { NormalizedTick } from './types';
import { NormalizedTickSchema, parseTick, isValidTick } from './schema';

function validTick(overrides: Partial<NormalizedTick> = {}): NormalizedTick {
  return {
    source: 'upbit',
    symbol: 'BTC/KRW',
    assetClass: 'crypto',
    price: 100_000_000,
    changeRate24h: 0.0123,
    volume24h: 42.5,
    sourceTimestamp: 1_700_000_000_000,
    ingestTimestamp: 1_700_000_000_050,
    sequence: 7,
    ...overrides,
  };
}

describe('NormalizedTickSchema', () => {
  it('유효한 tick을 통과시킨다', () => {
    const tick = validTick();
    expect(parseTick(tick)).toEqual(tick);
    expect(isValidTick(tick)).toBe(true);
  });

  it('optional 필드가 없어도 통과한다', () => {
    const minimal: NormalizedTick = {
      source: 'binance',
      symbol: 'ETH/USDT',
      assetClass: 'crypto',
      price: 3500,
      sourceTimestamp: 1_700_000_000_000,
      ingestTimestamp: 1_700_000_000_010,
    };
    expect(parseTick(minimal)).toEqual(minimal);
  });

  it('필수 필드(price) 누락 시 throw 한다', () => {
    const { price: _price, ...noPrice } = validTick();
    expect(() => parseTick(noPrice)).toThrow();
    expect(isValidTick(noPrice)).toBe(false);
  });

  it('필수 타임스탬프 누락 시 throw 한다', () => {
    const { ingestTimestamp: _ts, ...noIngest } = validTick();
    expect(() => parseTick(noIngest)).toThrow();
  });

  it('price 타입 오류(string) 시 throw 한다', () => {
    expect(() => parseTick(validTick({ price: '100' as unknown as number }))).toThrow();
  });

  it('price가 유한수가 아니면(NaN/Infinity) throw 한다', () => {
    expect(() => parseTick(validTick({ price: Number.NaN }))).toThrow();
    expect(() => parseTick(validTick({ price: Number.POSITIVE_INFINITY }))).toThrow();
  });

  it('알 수 없는 source 값이면 throw 한다', () => {
    expect(() => parseTick(validTick({ source: 'coinbase' as unknown as NormalizedTick['source'] }))).toThrow();
  });

  it('assetClass가 crypto가 아니면 throw 한다', () => {
    expect(() =>
      parseTick(validTick({ assetClass: 'equity' as unknown as NormalizedTick['assetClass'] })),
    ).toThrow();
  });

  it('객체가 아닌 입력이면 throw 한다', () => {
    expect(() => parseTick(null)).toThrow();
    expect(() => parseTick('not-a-tick')).toThrow();
    expect(isValidTick(undefined)).toBe(false);
  });

  it('NormalizedTickSchema로 직접 파싱해도 동일하게 동작한다', () => {
    const tick = validTick();
    expect(NormalizedTickSchema.parse(tick)).toEqual(tick);
  });
});
