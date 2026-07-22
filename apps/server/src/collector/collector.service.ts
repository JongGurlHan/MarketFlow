// CollectorService — 수집 파이프라인의 배선.
// 주입된 커넥터들의 ticks$(정규화된 스트림)를 구독해 MarketBus에 publish 한다.
// collector와 distribution은 MarketBus 인터페이스로만 통신한다(CLAUDE.md CRITICAL).
// 실 소켓은 여기서 자동으로 열지 않는다 — start()는 런타임(step 4 main.ts)에서 호출된다.

import { Inject, Injectable } from '@nestjs/common';
import type { Subscription } from 'rxjs';
import { MARKET_BUS } from './bus/market-bus';
import type { MarketBus } from './bus/market-bus';
import { SOURCE_CONNECTORS } from './connectors/source-connector';
import type { SourceConnector } from './connectors/source-connector';

@Injectable()
export class CollectorService {
  private readonly subscriptions: Subscription[] = [];

  constructor(
    @Inject(MARKET_BUS) private readonly bus: MarketBus,
    @Inject(SOURCE_CONNECTORS) private readonly connectors: SourceConnector[],
  ) {}

  start(): void {
    for (const connector of this.connectors) {
      // 구독을 connect() 이전에 걸어 초기 tick을 놓치지 않는다.
      this.subscriptions.push(
        connector.ticks$.subscribe((tick) => this.bus.publish(tick)),
      );
      connector.connect();
    }
  }

  stop(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions.length = 0;
    for (const connector of this.connectors) {
      connector.disconnect();
    }
  }
}
