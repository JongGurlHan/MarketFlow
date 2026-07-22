# Step 6: websocket-api

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (데이터 흐름의 WS 게이트웨이, Redis 키 규칙)
- `/docs/ADR.md` (ADR-003 pub/sub, ADR-004)
- `packages/shared/src/` — `NormalizedTick`, `fromWireSymbol`/`toWireSymbol`
- `apps/api/src/bus/redis-bus.ts` — step 5의 reader 버스(여기에 구독 기능을 추가)
- `apps/api/src/market/market.controller.ts` — step 5

## 작업

`apps/api`에 Redis 구독과 WebSocket 게이트웨이를 구현해 실시간 시세를 클라이언트로 팬아웃한다.

### 1. RedisBus 구독 확장 (`src/bus/redis-bus.ts`)
- 구독 전용 Redis 연결을 하나 더 둔다(ioredis는 subscribe 모드 전용 연결 필요). 주입 가능하게 유지.
- `subscribeTicks(handler: (tick: NormalizedTick) => void): Promise<void>`:
  - `PSUBSCRIBE market:ticks:*` 후 `pmessage` 수신 → JSON 파싱 → `handler(tick)`.

### 2. WebSocket 게이트웨이 (`src/market/market.gateway.ts`)
- Nest WebSocket 게이트웨이. **raw `ws`를 쓰기 위해** `@nestjs/websockets`, `@nestjs/platform-ws`, `ws`를 추가하고 `main.ts`에서 `app.useWebSocketAdapter(new WsAdapter(app))`를 설정하라. 경로는 `/stream`.
- 클라이언트 프로토콜(JSON 텍스트):
  - 클라이언트 → 서버: `{ "action": "subscribe", "symbols": ["BTC-KRW", "ETH-KRW"] }` (wire 표기). `unsubscribe`도 지원.
  - 서버 → 클라이언트: 구독한 심볼의 tick 발생 시 `{ "type": "tick", "data": <NormalizedTick> }`.
- 게이트웨이는 `클라이언트 → 구독 심볼(내부 표준)` 매핑을 유지. `RedisBus.subscribeTicks`에서 tick이 오면, 그 심볼을 구독 중인 클라이언트에게만 전송(팬아웃).
- 연결 종료 시 매핑 정리.

### 3. 테스트 (TDD — 오프라인)
- **단위**: 팬아웃 매핑 로직을 분리해 순수 테스트 — 특정 심볼 구독 클라이언트에게만 전달되는지(가짜 소켓 객체로 검증).
- **e2e(가능하면)**: `WsAdapter`로 임의 포트에 앱을 띄우고 실제 `ws` 클라이언트로 접속 → `subscribe` 전송 → `ioredis-mock`으로 `market:ticks:BTC/KRW`에 publish → 클라이언트가 tick 수신하는지. `ioredis-mock`의 pub/sub이 불안정하면 단위 테스트로 핵심 로직을 커버하고 e2e는 연결/subscribe 왕복까지만 검증하라.

## Acceptance Criteria

```bash
npm install
npm run lint
npm run build
npm run test
```
모두 exit 0. 실 Redis·외부망 없이 통과해야 한다.

## 검증 절차

1. 위 AC 실행.
2. 체크리스트:
   - `PSUBSCRIBE market:ticks:*`로 구독하고, 구독 심볼 클라이언트에게만 팬아웃하는가?
   - 프로토콜 심볼이 wire 표기이고 내부 변환을 거치는가?
   - WsAdapter가 설정되어 REST(3002)와 같은 포트에서 `/stream`이 동작하는가?
   - 테스트가 오프라인으로 통과하는가?
3. `phases/0-mvp/index.json`의 step 6 상태 업데이트.

## 금지사항

- socket.io로 바꾸지 마라. 이유: 브라우저 기본 `WebSocket`/`wscat` 호환을 위해 raw `ws`를 쓴다.
- collector 코드를 import하지 마라.
- 실 Redis에 접속하는 테스트를 작성하지 마라.
- 기존 테스트(step 5 REST 포함)를 깨뜨리지 마라.
