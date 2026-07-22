// Binance WebSocket 커넥터 — SourceConnector 구현.
// combined stream(URL에 streams 지정)이라 별도 구독 메시지가 필요 없다. message는
// { stream, data } 래핑으로 오며 data가 24hrTicker 페이로드다. mapBinanceRaw로
// 정규화한 뒤에만 ticks$로 흘린다 — raw 포맷은 밖으로 새지 않는다.

import { Observable, Subject } from 'rxjs';
import type { NormalizedTick, Source } from '@market/shared';
import { BINANCE_MARKETS } from '@market/shared';
import { mapBinanceRaw } from '../normalizer/binance.normalizer';
import type { SocketFactory, SourceConnector, WsLike } from './source-connector';

// 구독 스트림도 레지스트리에서 조립한다(공급처 분기 없이). 예: btcusdt@ticker/ethusdt@ticker
const BINANCE_WS_URL = `wss://stream.binance.com:9443/stream?streams=${BINANCE_MARKETS.map(
  (m) => `${m.raw.toLowerCase()}@ticker`,
).join('/')}`;

export class BinanceConnector implements SourceConnector {
  readonly source: Source = 'binance';

  private readonly ticks = new Subject<NormalizedTick>();
  readonly ticks$: Observable<NormalizedTick> = this.ticks.asObservable();

  private socket?: WsLike;

  constructor(private readonly socketFactory: SocketFactory) {}

  connect(): void {
    const socket = this.socketFactory(BINANCE_WS_URL);
    this.socket = socket;

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
      const parsed = JSON.parse(toText(data));
      // combined stream이면 { stream, data } 래핑 → data 언랩.
      const payload =
        parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed;
      return mapBinanceRaw(payload);
    } catch {
      return undefined;
    }
  }
}

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
