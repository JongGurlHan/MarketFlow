// Upbit raw ticker → NormalizedTick 순수 매퍼.
// parseTick(zod)을 통과한 객체만 반환한다 — 표준 스키마 게이트(CLAUDE.md CRITICAL).

import { parseTick, UPBIT_MARKETS } from '@market/shared';
import type { NormalizedTick } from '@market/shared';

// Upbit ticker 원본(필요 필드만; 그 외는 무시).
export interface UpbitRawTicker {
  code: string; // 예: 'KRW-BTC'
  trade_price: number;
  signed_change_rate?: number; // 예: 0.012 (비율)
  acc_trade_volume_24h?: number;
  trade_timestamp?: number; // epoch ms
  timestamp?: number; // epoch ms (fallback)
  [key: string]: unknown;
}

export function mapUpbitRaw(raw: UpbitRawTicker): NormalizedTick {
  const entry = UPBIT_MARKETS.find((m) => m.raw === raw.code);
  if (!entry) {
    throw new Error(`Unknown Upbit market code: ${String(raw.code)}`);
  }
  return parseTick({
    source: 'upbit',
    symbol: entry.symbol,
    assetClass: 'crypto',
    price: raw.trade_price,
    // signed_change_rate는 비율(0.012) → 퍼센트(1.2)로 환산.
    changeRate24h:
      raw.signed_change_rate === undefined ? undefined : raw.signed_change_rate * 100,
    volume24h: raw.acc_trade_volume_24h,
    sourceTimestamp: raw.trade_timestamp ?? raw.timestamp,
    ingestTimestamp: Date.now(),
  });
}
