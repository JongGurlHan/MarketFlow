import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import WebSocket from 'ws';
import type { NormalizedTick } from '@market/shared';
import { InMemoryMarketBus, MARKET_BUS } from '../collector/bus/market-bus';
import { MarketGateway } from './market.gateway';

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

function once<T>(client: WebSocket, event: 'open' | 'message'): Promise<T> {
  return new Promise((resolve) => client.once(event, (arg: T) => resolve(arg)));
}

describe('MarketGateway (WebSocket)', () => {
  let app: INestApplication;
  let bus: InMemoryMarketBus;
  let url: string;

  beforeEach(async () => {
    bus = new InMemoryMarketBus();
    const moduleRef = await Test.createTestingModule({
      providers: [MarketGateway, { provide: MARKET_BUS, useValue: bus }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(0); // 임의 포트 — 외부망 접속 없음.

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    url = `ws://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  it('subscribe 후 버스에 publish된 tick을 {event:tick}으로 push한다', async () => {
    const client = new WebSocket(url);
    await once(client, 'open');

    const received = once<Buffer>(client, 'message');
    client.send(
      JSON.stringify({ event: 'subscribe', data: { symbols: ['BTC/KRW'] } }),
    );
    // 서버가 구독 프레임을 처리(RxJS 구독 등록)할 시간을 준 뒤 publish.
    await new Promise((r) => setTimeout(r, 50));
    bus.publish(makeTick({ symbol: 'BTC/KRW', price: 123 }));

    const msg = JSON.parse((await received).toString());
    expect(msg.event).toBe('tick');
    expect(msg.data.symbol).toBe('BTC/KRW');
    expect(msg.data.price).toBe(123);

    client.close();
  });

  it('구독하지 않은 심볼의 tick은 push하지 않는다', async () => {
    const client = new WebSocket(url);
    await once(client, 'open');

    let messages = 0;
    client.on('message', () => {
      messages += 1;
    });
    client.send(
      JSON.stringify({ event: 'subscribe', data: { symbols: ['BTC/KRW'] } }),
    );
    await new Promise((r) => setTimeout(r, 50));
    bus.publish(makeTick({ source: 'binance', symbol: 'BTC/USDT', price: 7 }));
    await new Promise((r) => setTimeout(r, 50));

    expect(messages).toBe(0);
    client.close();
  });
});
