// 실 런타임 SocketFactory — 'ws' 패키지의 WebSocket을 WsLike로 감싼다.
// 'ws'는 팩토리가 실제로 호출될 때(= 커넥터 connect(), 런타임 기동은 step 4)에만
// 로드된다. 테스트는 fake 팩토리를 주입하므로 이 팩토리를 호출하지 않는다 → 오프라인 유지.

import type { SocketFactory, WsLike } from './source-connector';

export const wsSocketFactory: SocketFactory = (url: string): WsLike => {
  // 지연 로드: import 시점이 아니라 호출 시점에만 'ws'를 요구한다.
  const WebSocketCtor = require('ws');
  return new WebSocketCtor(url) as WsLike;
};
