import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { NormalizedTick } from '@market/shared';
import { InMemoryMarketBus, MARKET_BUS } from '../collector/bus/market-bus';
import { MarketController } from './market.controller';

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

describe('MarketController (REST)', () => {
  let app: INestApplication;
  let bus: InMemoryMarketBus;

  beforeEach(async () => {
    // MARKET_BUS를 시드된 인메모리 버스로 오버라이드 — distribution은 버스로만 읽는다.
    bus = new InMemoryMarketBus();
    bus.publish(makeTick({ symbol: 'BTC/KRW', price: 98_750_000 }));
    bus.publish(
      makeTick({ source: 'binance', symbol: 'BTC/USDT', price: 68_000 }),
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [MarketController],
      providers: [{ provide: MARKET_BUS, useValue: bus }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /v1/symbols → 활성 심볼 목록', async () => {
    const res = await request(app.getHttpServer()).get('/v1/symbols').expect(200);
    expect(res.body).toEqual(expect.arrayContaining(['BTC/KRW', 'BTC/USDT']));
    expect(res.body).toHaveLength(2);
  });

  it('GET /v1/ticks → 전체 스냅샷(NormalizedTick[])', async () => {
    const res = await request(app.getHttpServer()).get('/v1/ticks').expect(200);
    expect(res.body).toHaveLength(2);
    const btc = (res.body as NormalizedTick[]).find((t) => t.symbol === 'BTC/KRW');
    expect(btc).toMatchObject({
      source: 'upbit',
      symbol: 'BTC/KRW',
      assetClass: 'crypto',
      price: 98_750_000,
    });
  });

  it('GET /v1/ticks/BTC%2FKRW → 해당 심볼 스냅샷(URL 디코드)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/ticks/BTC%2FKRW')
      .expect(200);
    expect(res.body).toMatchObject({ symbol: 'BTC/KRW', price: 98_750_000 });
  });

  it('GET /v1/ticks/:symbol 없는 심볼 → 404', async () => {
    await request(app.getHttpServer()).get('/v1/ticks/ZZZ%2FKRW').expect(404);
  });
});
