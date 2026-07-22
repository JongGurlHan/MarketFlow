import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { BinanceConnector } from './binance.connector';
import type { SocketFactory, WsLike } from './source-connector';
import binanceBtc from '../__fixtures__/binance-btc.json';

// 오프라인 fake 소켓 — 실 네트워크 접속 없이 이벤트를 수동 트리거한다(ADR-004).
class FakeSocket implements WsLike {
  readonly sent: string[] = [];
  url?: string;
  closed = false;
  private handlers: Record<string, ((arg?: unknown) => void)[]> = {};

  on(event: string, cb: (arg?: unknown) => void): void {
    (this.handlers[event] ||= []).push(cb);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
  emit(event: string, arg?: unknown): void {
    (this.handlers[event] || []).forEach((cb) => cb(arg));
  }
}

describe('BinanceConnector', () => {
  it('connect 시 combined stream URL을 레지스트리로 조립한다', () => {
    const socket = new FakeSocket();
    const factory: SocketFactory = (url) => {
      socket.url = url;
      return socket;
    };
    const connector = new BinanceConnector(factory);

    connector.connect();

    expect(socket.url).toContain('stream.binance.com');
    expect(socket.url).toContain('streams=btcusdt@ticker/ethusdt@ticker');
  });

  it('combined stream 래핑({ stream, data }) message에서 data를 언랩해 정규화한다', async () => {
    const socket = new FakeSocket();
    const connector = new BinanceConnector(() => socket);
    const received = firstValueFrom(connector.ticks$.pipe(take(1)));

    connector.connect();
    socket.emit(
      'message',
      Buffer.from(JSON.stringify({ stream: 'btcusdt@ticker', data: binanceBtc })),
    );

    const tick = await received;
    expect(tick.source).toBe('binance');
    expect(tick.symbol).toBe('BTC/USDT');
    expect(tick.price).toBe(68450.12);
  });

  it('파싱 불가한 message는 무시하고 emit하지 않는다', async () => {
    const socket = new FakeSocket();
    const connector = new BinanceConnector(() => socket);
    const received = firstValueFrom(connector.ticks$.pipe(take(1)));

    connector.connect();
    socket.emit('message', Buffer.from('<<not-json>>'));
    socket.emit(
      'message',
      Buffer.from(JSON.stringify({ stream: 'btcusdt@ticker', data: binanceBtc })),
    );

    const tick = await received;
    expect(tick.symbol).toBe('BTC/USDT');
  });

  it('disconnect가 소켓을 닫는다', () => {
    const socket = new FakeSocket();
    const connector = new BinanceConnector(() => socket);
    connector.connect();
    connector.disconnect();
    expect(socket.closed).toBe(true);
  });
});
