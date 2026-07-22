// Upbit WebSocket 커넥터 — SourceConnector 구현.
// 소켓은 주입된 SocketFactory로 생성한다(테스트는 fake, 런타임은 'ws'). raw 메시지는
// mapUpbitRaw로 정규화한 뒤에만 ticks$로 흘린다 — raw 포맷은 밖으로 새지 않는다.

import { Observable, Subject } from 'rxjs';
import type { NormalizedTick, Source } from '@market/shared';
import { UPBIT_MARKETS } from '@market/shared';
import { mapUpbitRaw } from '../normalizer/upbit.normalizer';
import type { SocketFactory, SourceConnector, WsLike } from './source-connector';

const UPBIT_WS_URL = 'wss://api.upbit.com/websocket/v1';

export class UpbitConnector implements SourceConnector {
  readonly source: Source = 'upbit';

  private readonly ticks = new Subject<NormalizedTick>();
  readonly ticks$: Observable<NormalizedTick> = this.ticks.asObservable();

  private socket?: WsLike;

  constructor(private readonly socketFactory: SocketFactory) {}

  connect(): void {
    const socket = this.socketFactory(UPBIT_WS_URL);
    this.socket = socket;

    socket.on('open', () => {
      // Upbit 구독 메시지: 대상 코드는 레지스트리에서(공급처 분기 없이).
      socket.send(
        JSON.stringify([
          { ticket: 'marketstream' },
          { type: 'ticker', codes: UPBIT_MARKETS.map((m) => m.raw) },
        ]),
      );
    });

    socket.on('message', (data) => {
      const tick = this.normalize(data);
      if (tick) {
        this.ticks.next(tick);
      }
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = undefined;
  }

  private normalize(data: unknown): NormalizedTick | undefined {
    try {
      const raw = JSON.parse(toText(data));
      return mapUpbitRaw(raw);
    } catch {
      // ticker가 아닌 메시지(상태 등)·검증 실패분은 조용히 버린다.
      return undefined;
    }
  }
}

// Upbit는 메시지를 바이너리(Buffer)로 보낼 수 있으니 문자열로 정규화한다.
function toText(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof Buffer) {
    return data.toString('utf-8');
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('utf-8');
  }
  return String(data);
}
