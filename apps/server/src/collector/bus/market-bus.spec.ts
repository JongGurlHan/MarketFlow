import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { take, toArray } from 'rxjs/operators';
import type { NormalizedTick } from '@market/shared';
import { CollectorModule } from '../collector.module';
import { InMemoryMarketBus, MARKET_BUS, MarketBus } from './market-bus';

function makeTick(overrides: Partial<NormalizedTick> = {}): NormalizedTick {
  return {
    source: 'upbit',
    symbol: 'BTC/KRW',
    assetClass: 'crypto',
    price: 100_000_000,
    sourceTimestamp: 1_700_000_000_000,
    ingestTimestamp: 1_700_000_000_001,
    ...overrides,
  };
}

describe('InMemoryMarketBus', () => {
  let bus: MarketBus;

  beforeEach(() => {
    bus = new InMemoryMarketBus();
  });

  describe('snapshot (최신값)', () => {
    it('publish 후 getLatestBySymbol이 해당 심볼의 tick을 반환한다', () => {
      const tick = makeTick();
      bus.publish(tick);
      expect(bus.getLatestBySymbol('BTC/KRW')).toEqual(tick);
    });

    it('publish 되지 않은 심볼은 undefined', () => {
      expect(bus.getLatestBySymbol('ETH/KRW')).toBeUndefined();
    });

    it('getLatest가 심볼별 최신값 전체를 반환한다', () => {
      const btc = makeTick({ symbol: 'BTC/KRW' });
      const eth = makeTick({ symbol: 'ETH/KRW', price: 5_000_000 });
      bus.publish(btc);
      bus.publish(eth);
      const latest = bus.getLatest();
      expect(latest).toHaveLength(2);
      expect(latest).toEqual(expect.arrayContaining([btc, eth]));
    });

    it('같은 심볼 재publish 시 최신 tick으로 덮어쓴다', () => {
      bus.publish(makeTick({ price: 100 }));
      bus.publish(makeTick({ price: 200 }));
      expect(bus.getLatestBySymbol('BTC/KRW')?.price).toBe(200);
      expect(bus.getLatest()).toHaveLength(1);
    });
  });

  describe('subscribe (스트림)', () => {
    it('구독한 심볼의 tick만 흘리고 다른 심볼은 걸러낸다', async () => {
      const received = firstValueFrom(
        bus.subscribe(['BTC/KRW']).pipe(take(2), toArray()),
      );
      bus.publish(makeTick({ symbol: 'ETH/KRW', price: 1 })); // 걸러짐
      bus.publish(makeTick({ symbol: 'BTC/KRW', price: 2 }));
      bus.publish(makeTick({ symbol: 'ETH/USDT', price: 3 })); // 걸러짐
      bus.publish(makeTick({ symbol: 'BTC/KRW', price: 4 }));
      const ticks = await received;
      expect(ticks.map((t) => t.symbol)).toEqual(['BTC/KRW', 'BTC/KRW']);
      expect(ticks.map((t) => t.price)).toEqual([2, 4]);
    });

    it('여러 심볼 구독 시 구독 집합의 tick만 수신한다', async () => {
      const received = firstValueFrom(
        bus.subscribe(['BTC/KRW', 'ETH/KRW']).pipe(take(2), toArray()),
      );
      bus.publish(makeTick({ symbol: 'ETH/USDT', price: 1 })); // 걸러짐
      bus.publish(makeTick({ symbol: 'BTC/KRW', price: 2 }));
      bus.publish(makeTick({ symbol: 'ETH/KRW', price: 3 }));
      const ticks = await received;
      expect(ticks.map((t) => t.symbol)).toEqual(['BTC/KRW', 'ETH/KRW']);
    });

    it('빈 배열이면 전체 스트림을 수신한다', async () => {
      const received = firstValueFrom(
        bus.subscribe([]).pipe(take(3), toArray()),
      );
      bus.publish(makeTick({ symbol: 'BTC/KRW', price: 1 }));
      bus.publish(makeTick({ symbol: 'ETH/KRW', price: 2 }));
      bus.publish(makeTick({ symbol: 'ETH/USDT', price: 3 }));
      const ticks = await received;
      expect(ticks.map((t) => t.symbol)).toEqual([
        'BTC/KRW',
        'ETH/KRW',
        'ETH/USDT',
      ]);
    });

    it('구독은 구독 이후 publish된 tick만 받는다(과거 tick 미수신)', async () => {
      bus.publish(makeTick({ symbol: 'BTC/KRW', price: 1 })); // 구독 전 → 미수신
      const received = firstValueFrom(
        bus.subscribe(['BTC/KRW']).pipe(take(1), toArray()),
      );
      bus.publish(makeTick({ symbol: 'BTC/KRW', price: 2 }));
      const ticks = await received;
      expect(ticks.map((t) => t.price)).toEqual([2]);
    });
  });

  describe('DI (MARKET_BUS 토큰)', () => {
    it('CollectorModule이 MARKET_BUS 토큰으로 InMemoryMarketBus를 제공·export 한다', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [CollectorModule],
      }).compile();
      const injected = moduleRef.get<MarketBus>(MARKET_BUS, { strict: false });
      expect(injected).toBeInstanceOf(InMemoryMarketBus);
    });
  });
});
