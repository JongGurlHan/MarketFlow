// Binance 24hrTicker raw → NormalizedTick 순수 매퍼.
// parseTick(zod)을 통과한 객체만 반환한다 — 표준 스키마 게이트(CLAUDE.md CRITICAL).

import { parseTick, BINANCE_MARKETS } from '@market/shared';
import type { NormalizedTick } from '@market/shared';

// Binance 24hrTicker 페이로드(combined stream의 data; 필요 필드만).
export interface BinanceRawTicker {
  s: string; // 심볼, 예: 'BTCUSDT'
  c: string; // 종가(문자열)
  P?: string; // 24h 변동률 % (문자열)
  v?: string; // 24h 거래량(문자열)
  E: number; // 이벤트 시각 epoch ms
  [key: string]: unknown;
}

export function mapBinanceRaw(raw: BinanceRawTicker): NormalizedTick {
  const entry = BINANCE_MARKETS.find((m) => m.raw === raw.s);
  if (!entry) {
    throw new Error(`Unknown Binance symbol: ${String(raw.s)}`);
  }
  return parseTick({
    source: 'binance',
    symbol: entry.symbol,
    assetClass: 'crypto',
    price: Number(raw.c),
    // P는 이미 퍼센트 단위 문자열(예: '1.2') → 숫자만 변환.
    changeRate24h: raw.P === undefined ? undefined : Number(raw.P),
    volume24h: raw.v === undefined ? undefined : Number(raw.v),
    sourceTimestamp: raw.E,
    ingestTimestamp: Date.now(),
  });
}
