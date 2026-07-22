import { Test } from '@nestjs/testing';
import { Observable, Subject } from 'rxjs';
import type { NormalizedTick, Source } from '@market/shared';
import { InMemoryMarketBus } from './bus/market-bus';
import { CollectorModule } from './collector.module';
import { CollectorService } from './collector.service';
import type { SourceConnector } from './connectors/source-connector';

// 오프라인 fake 커넥터 — 소켓 없이 tick을 수동으로 밀어 넣는다.
class FakeConnector implements SourceConnector {
  connected = false;
  private readonly subject = new Subject<NormalizedTick>();
  readonly ticks$: Observable<NormalizedTick> = this.subject.asObservable();

  constructor(readonly source: Source) {}

  connect(): void {
    this.connected = true;
  }
  disconnect(): void {
    this.connected = false;
  }
  push(tick: NormalizedTick): void {
    this.subject.next(tick);
  }
}

function makeTick(overrides: Partial<NormalizedTick> = {}): NormalizedTick {
  return {
    source: 'upbit',
    symbol: 'BTC/KRW',
    assetClass: 'crypto',
    price: 98_750_000,
    sourceTimestamp: 1_721_650_000_000,
    ingestTimestamp: 1_721_650_000_001,
    ...overrides,
  };
}

describe('CollectorService', () => {
  it('start() 후 커넥터의 tick이 버스에 publish되어 스냅샷으로 조회된다', () => {
    const bus = new InMemoryMarketBus();
    const upbit = new FakeConnector('upbit');
    const binance = new FakeConnector('binance');
    const service = new CollectorService(bus, [upbit, binance]);

    service.start();
    expect(upbit.connected).toBe(true);
    expect(binance.connected).toBe(true);

    upbit.push(makeTick({ symbol: 'BTC/KRW', price: 1 }));
    binance.push(makeTick({ source: 'binance', symbol: 'BTC/USDT', price: 2 }));

    expect(bus.getLatestBySymbol('BTC/KRW')?.price).toBe(1);
    expect(bus.getLatestBySymbol('BTC/USDT')?.price).toBe(2);
    expect(bus.getLatest()).toHaveLength(2);
  });

  it('stop() 후에는 커넥터를 끊고 더 이상 publish하지 않는다', () => {
    const bus = new InMemoryMarketBus();
    const upbit = new FakeConnector('upbit');
    const service = new CollectorService(bus, [upbit]);

    service.start();
    service.stop();
    expect(upbit.connected).toBe(false);

    upbit.push(makeTick({ price: 999 }));
    expect(bus.getLatestBySymbol('BTC/KRW')).toBeUndefined();
  });

  it('CollectorModule이 CollectorService를 제공·export한다(버스 재사용)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CollectorModule],
    }).compile();
    const service = moduleRef.get(CollectorService, { strict: false });
    expect(service).toBeInstanceOf(CollectorService);
  });
});
