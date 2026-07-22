import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { UpbitConnector } from './upbit.connector';
import type { SocketFactory, WsLike } from './source-connector';
import upbitBtc from '../__fixtures__/upbit-btc.json';

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

describe('UpbitConnector', () => {
  it('connect 시 레지스트리 코드로 구독 메시지를 전송한다', () => {
    const socket = new FakeSocket();
    const factory: SocketFactory = (url) => {
      socket.url = url;
      return socket;
    };
    const connector = new UpbitConnector(factory);

    connector.connect();
    socket.emit('open');

    expect(socket.url).toContain('api.upbit.com');
    expect(socket.sent).toHaveLength(1);
    const parsed = JSON.parse(socket.sent[0]);
    expect(parsed[0]).toEqual({ ticket: 'marketstream' });
    expect(parsed[1]).toEqual({ type: 'ticker', codes: ['KRW-BTC', 'KRW-ETH'] });
  });

  it('바이너리 message 수신 시 정규화된 tick을 ticks$로 emit한다', async () => {
    const socket = new FakeSocket();
    const connector = new UpbitConnector(() => socket);
    const received = firstValueFrom(connector.ticks$.pipe(take(1)));

    connector.connect();
    // Upbit는 바이너리(Buffer)로 올 수 있다.
    socket.emit('message', Buffer.from(JSON.stringify(upbitBtc)));

    const tick = await received;
    expect(tick.source).toBe('upbit');
    expect(tick.symbol).toBe('BTC/KRW');
    expect(tick.price).toBe(upbitBtc.trade_price);
  });

  it('파싱 불가한 message는 무시하고 emit하지 않는다', async () => {
    const socket = new FakeSocket();
    const connector = new UpbitConnector(() => socket);
    const received = firstValueFrom(connector.ticks$.pipe(take(1)));

    connector.connect();
    socket.emit('message', Buffer.from('not-json'));
    socket.emit('message', Buffer.from(JSON.stringify(upbitBtc)));

    const tick = await received;
    expect(tick.symbol).toBe('BTC/KRW');
  });

  it('disconnect가 소켓을 닫는다', () => {
    const socket = new FakeSocket();
    const connector = new UpbitConnector(() => socket);
    connector.connect();
    connector.disconnect();
    expect(socket.closed).toBe(true);
  });
});
