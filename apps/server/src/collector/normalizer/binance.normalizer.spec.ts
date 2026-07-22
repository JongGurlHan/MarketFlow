import { isValidTick } from '@market/shared';
import { mapBinanceRaw } from './binance.normalizer';
import binanceBtc from '../__fixtures__/binance-btc.json';
import binanceEth from '../__fixtures__/binance-eth.json';

describe('mapBinanceRaw', () => {
  it('BTCUSDT raw를 BTC/USDT NormalizedTick으로 정규화한다', () => {
    const tick = mapBinanceRaw(binanceBtc);
    expect(tick.source).toBe('binance');
    expect(tick.assetClass).toBe('crypto');
    expect(tick.symbol).toBe('BTC/USDT'); // 레지스트리로 심볼 변환
    expect(tick.price).toBe(68450.12); // 문자열 → 숫자
    expect(tick.changeRate24h).toBe(1.234); // P는 이미 퍼센트
    expect(tick.volume24h).toBe(12345.6789);
    expect(tick.sourceTimestamp).toBe(1721650000000); // E
    expect(typeof tick.ingestTimestamp).toBe('number');
  });

  it('ETHUSDT raw를 ETH/USDT로 정규화하고 문자열 수치를 숫자로 변환한다', () => {
    const tick = mapBinanceRaw(binanceEth);
    expect(tick.symbol).toBe('ETH/USDT');
    expect(tick.price).toBe(3620.55);
    expect(tick.changeRate24h).toBe(-0.876);
    expect(typeof tick.price).toBe('number');
  });

  it('정규화 결과는 zod 스키마 검증을 통과한다(표준 스키마 게이트)', () => {
    expect(isValidTick(mapBinanceRaw(binanceBtc))).toBe(true);
    expect(isValidTick(mapBinanceRaw(binanceEth))).toBe(true);
  });

  it('레지스트리에 없는 심볼은 매핑을 거부한다', () => {
    expect(() => mapBinanceRaw({ ...binanceBtc, s: 'DOGEUSDT' })).toThrow();
  });
});
