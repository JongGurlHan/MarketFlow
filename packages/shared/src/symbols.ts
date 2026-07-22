// 심볼 유틸 — 내부 표준은 BASE/QUOTE 대문자(예: 'BTC/KRW').
// 공급처 원본 심볼은 정규화 단계(step 2)에서 이 유틸로 변환한다.

/** base·quote를 내부 표준 심볼로 조합. 예: ('btc','krw') → 'BTC/KRW' */
export function toStandardSymbol(base: string, quote: string): string {
  return `${base.toUpperCase()}/${quote.toUpperCase()}`;
}

/** 표준 심볼을 base·quote로 분해. 예: 'BTC/KRW' → { base: 'BTC', quote: 'KRW' } */
export function splitSymbol(symbol: string): { base: string; quote: string } {
  const [base, quote] = symbol.split('/');
  if (!base || !quote) {
    throw new Error(`Invalid standard symbol: '${symbol}' (expected 'BASE/QUOTE')`);
  }
  return { base, quote };
}

// MVP 대상 심볼 레지스트리(공급처 원본 → 표준). 커넥터가 구독 목록으로 사용한다.
export interface MarketEntry {
  raw: string; // 공급처 원본 심볼
  symbol: string; // 내부 표준 심볼
}

export const UPBIT_MARKETS: MarketEntry[] = [
  { raw: 'KRW-BTC', symbol: 'BTC/KRW' },
  { raw: 'KRW-ETH', symbol: 'ETH/KRW' },
];

export const BINANCE_MARKETS: MarketEntry[] = [
  { raw: 'BTCUSDT', symbol: 'BTC/USDT' },
  { raw: 'ETHUSDT', symbol: 'ETH/USDT' },
];
