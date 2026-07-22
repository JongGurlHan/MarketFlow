// MarketBus — collector와 distribution이 공유하는 중심 계약.
// docs/ARCHITECTURE.md "MarketBus 계약 (인메모리)"를 그대로 구현한다.
// 지금은 인메모리 구현이지만, phase 1에서 Redis 구현으로 교체해도
// publisher/subscriber는 이 인터페이스만 의존하므로 무수정이어야 한다(ADR-003).

import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import type { NormalizedTick } from '@market/shared';

export interface MarketBus {
  publish(tick: NormalizedTick): void;
  getLatest(): NormalizedTick[];
  getLatestBySymbol(symbol: string): NormalizedTick | undefined;
  subscribe(symbols: string[]): Observable<NormalizedTick>;
}

// 인터페이스 주입용 Nest DI 토큰. collector·distribution은 이 토큰으로만 버스를 주입받는다.
export const MARKET_BUS = Symbol('MARKET_BUS');

@Injectable()
export class InMemoryMarketBus implements MarketBus {
  // 최신값 스냅샷: 심볼별 마지막 tick.
  private readonly latest = new Map<string, NormalizedTick>();
  // 실시간 스트림.
  private readonly stream$ = new Subject<NormalizedTick>();

  publish(tick: NormalizedTick): void {
    this.latest.set(tick.symbol, tick);
    this.stream$.next(tick);
  }

  getLatest(): NormalizedTick[] {
    return Array.from(this.latest.values());
  }

  getLatestBySymbol(symbol: string): NormalizedTick | undefined {
    return this.latest.get(symbol);
  }

  subscribe(symbols: string[]): Observable<NormalizedTick> {
    const source$ = this.stream$.asObservable();
    if (symbols.length === 0) {
      return source$; // 빈 배열 → 전체 스트림.
    }
    const wanted = new Set(symbols);
    return source$.pipe(filter((tick) => wanted.has(tick.symbol)));
  }
}
