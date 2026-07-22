import {
  toStandardSymbol,
  splitSymbol,
  UPBIT_MARKETS,
  BINANCE_MARKETS,
} from './symbols';

describe('toStandardSymbol', () => {
  it('base·quote를 대문자 BASE/QUOTE로 조합한다', () => {
    expect(toStandardSymbol('btc', 'krw')).toBe('BTC/KRW');
    expect(toStandardSymbol('eth', 'usdt')).toBe('ETH/USDT');
  });

  it('이미 대문자여도 그대로 조합한다', () => {
    expect(toStandardSymbol('BTC', 'USDT')).toBe('BTC/USDT');
  });
});

describe('splitSymbol', () => {
  it('표준 심볼을 base·quote로 분해한다', () => {
    expect(splitSymbol('BTC/KRW')).toEqual({ base: 'BTC', quote: 'KRW' });
  });

  it('toStandardSymbol과 왕복 변환이 일치한다', () => {
    const { base, quote } = splitSymbol('ETH/USDT');
    expect(toStandardSymbol(base, quote)).toBe('ETH/USDT');
  });

  it('구분자가 없는 잘못된 심볼이면 throw 한다', () => {
    expect(() => splitSymbol('BTCKRW')).toThrow();
    expect(() => splitSymbol('BTC/')).toThrow();
  });
});

describe('마켓 레지스트리', () => {
  it('UPBIT_MARKETS의 raw·표준 매핑이 정확하다', () => {
    expect(UPBIT_MARKETS).toEqual([
      { raw: 'KRW-BTC', symbol: 'BTC/KRW' },
      { raw: 'KRW-ETH', symbol: 'ETH/KRW' },
    ]);
  });

  it('BINANCE_MARKETS의 raw·표준 매핑이 정확하다', () => {
    expect(BINANCE_MARKETS).toEqual([
      { raw: 'BTCUSDT', symbol: 'BTC/USDT' },
      { raw: 'ETHUSDT', symbol: 'ETH/USDT' },
    ]);
  });

  it('레지스트리의 표준 심볼은 splitSymbol로 분해 가능하다', () => {
    for (const { symbol } of [...UPBIT_MARKETS, ...BINANCE_MARKETS]) {
      expect(() => splitSymbol(symbol)).not.toThrow();
    }
  });
});
