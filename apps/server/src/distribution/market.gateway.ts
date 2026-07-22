// 실시간 시세 배포 WebSocket 게이트웨이.
// 클라이언트가 { event:'subscribe', data:{ symbols } }를 보내면 해당 심볼의
// 버스 스트림을 client별로 구독해 tick마다 { event:'tick', data } 로 push 한다.
// 데이터는 MARKET_BUS(MarketBus 인터페이스)로만 읽는다 — 커넥터를 직접 참조하지
// 않는다(CLAUDE.md CRITICAL). client close 시 RxJS 구독을 해제해 누수를 막는다.

import { Inject } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Subscription } from 'rxjs';
import type { WebSocket } from 'ws';
import type { NormalizedTick } from '@market/shared';
import { MARKET_BUS } from '../collector/bus/market-bus';
import type { MarketBus } from '../collector/bus/market-bus';

interface SubscribePayload {
  symbols?: string[];
}

@WebSocketGateway()
export class MarketGateway implements OnGatewayDisconnect {
  // client별 RxJS 구독. close 시 해제해 메모리 누수를 방지한다.
  private readonly subscriptions = new Map<WebSocket, Subscription>();

  constructor(@Inject(MARKET_BUS) private readonly bus: MarketBus) {}

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() payload: SubscribePayload,
  ): void {
    const symbols = Array.isArray(payload?.symbols) ? payload.symbols : [];

    // 재구독 시 기존 구독을 먼저 해제한다.
    this.subscriptions.get(client)?.unsubscribe();

    const sub = this.bus.subscribe(symbols).subscribe((tick: NormalizedTick) => {
      client.send(JSON.stringify({ event: 'tick', data: tick }));
    });
    this.subscriptions.set(client, sub);
  }

  handleDisconnect(client: WebSocket): void {
    this.subscriptions.get(client)?.unsubscribe();
    this.subscriptions.delete(client);
  }
}
