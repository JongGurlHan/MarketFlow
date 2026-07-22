# Step 3: distribution-api

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙(버스 인터페이스로만 통신, NormalizedTick 게이트)
- `docs/ARCHITECTURE.md` — 데이터 흐름의 distribution 부분, REST/WS 엔드포인트
- `packages/shared/src/` — NormalizedTick 타입
- `apps/server/src/collector/` 전체 — `MARKET_BUS` 토큰, `InMemoryMarketBus`, `MarketBus` 인터페이스, 커넥터 클래스, 심볼 레지스트리

## 작업

`apps/server`의 `distribution` 모듈(REST + WebSocket 배포)을 구현하고, 런타임에 실 커넥터를 기동하도록 `main.ts`를 배선한다. distribution은 **`MARKET_BUS` 토큰으로 주입받은 `MarketBus`로만** 데이터를 읽는다(커넥터 직접 참조 금지).

### 1. `src/distribution/market.controller.ts` (REST)
- `GET /v1/symbols` → 활성 심볼 목록(`bus.getLatest().map(t => t.symbol)` 또는 레지스트리 기반 전체 목록).
- `GET /v1/ticks` → 전체 최신 스냅샷 `NormalizedTick[]` (`bus.getLatest()`).
- `GET /v1/ticks/:symbol` → 해당 심볼 스냅샷. 심볼 경로는 URL 인코딩('BTC/KRW' → `BTC%2FKRW`)을 디코드해 조회. 없으면 404.

### 2. `src/distribution/health.controller.ts`
- 기존 `src/health/`가 있으면 distribution으로 옮기거나 그대로 두되, `GET /health` → `{ status: 'ok', sources: ['upbit','binance'] }`.

### 3. `src/distribution/market.gateway.ts` (WebSocket)
- `@nestjs/websockets` + `@nestjs/platform-ws`(`ws`) 사용. `@WebSocketGateway()`.
- 클라이언트 메시지 규약(WsAdapter, JSON): `{ "event": "subscribe", "data": { "symbols": ["BTC/KRW", "BTC/USDT"] } }`.
- 구독 시 `bus.subscribe(symbols)`를 client별로 구독해 tick 수신마다 `client.send(JSON.stringify({ event: 'tick', data: tick }))`로 push.
- client `close` 시 해당 RxJS 구독 해제(메모리 누수 방지).

### 4. `src/distribution/distribution.module.ts`
- `CollectorModule`을 import(버스 provider를 가져오기 위함). 컨트롤러·게이트웨이 등록.

### 5. `src/app.module.ts` + `src/main.ts` 배선
- `AppModule`: `CollectorModule` + `DistributionModule` import.
- `main.ts`:
  - `app.useWebSocketAdapter(new WsAdapter(app))` 설정(REST와 WS가 같은 포트 `4000` 공유).
  - CORS 허용(`app.enableCors()`) — web(3000)에서 접근.
  - **런타임에만** 실 소켓 팩토리(`ws` 패키지)로 Upbit·Binance 커넥터를 생성해 `CollectorService.start()` 호출. 이 실 기동 코드는 `main.ts`(부트스트랩)에만 둔다 — 모듈 초기화 훅에 넣지 마라.

### 6. 테스트 (오프라인)
- REST: `@nestjs/testing` `Test.createTestingModule` + `supertest`. `MARKET_BUS`를 시드된 `InMemoryMarketBus`(또는 목)로 오버라이드 → `/v1/symbols`, `/v1/ticks`, `/v1/ticks/BTC%2FKRW`, 없는 심볼 404 검증.
- WS: 테스트 앱을 실제 포트로 listen → `ws` 클라이언트로 접속 → `subscribe` 메시지 전송 → 버스에 tick을 `publish` → 클라이언트가 `{event:'tick'}` 수신하는지 검증. 외부망 접속 없음.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

REST(supertest) + WS(ws 클라이언트) e2e가 외부망 없이 통과해야 한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - distribution이 커넥터·매퍼를 직접 import하지 않고 `MARKET_BUS`만 사용하는가?
   - 실 소켓 기동이 `main.ts`에만 있는가?(테스트가 외부망에 안 붙는가)
   - REST 응답이 `NormalizedTick` 형태인가?(raw 노출 없음)
3. `phases/0-mvp/index.json`의 step 3을 업데이트:
   - 성공 → `"completed"` + `"summary"`(엔드포인트 목록, WS 메시지 규약, 포트 — step 4 web이 사용할 계약 포함).
   - 실패 → `"error"` + `"error_message"`.

## 금지사항

- distribution에서 커넥터/매퍼/소켓을 직접 import하지 마라. 이유: 버스 인터페이스 디커플링(CLAUDE.md CRITICAL). 이걸 어기면 Redis 전환·프로세스 분리가 막힌다.
- 테스트에서 실 거래소에 접속하지 마라. 이유: 오프라인 AC 위반.
- WS 게이트웨이에서 client 종료 시 구독 해제를 빠뜨리지 마라. 이유: 구독 누수.
- 기존 테스트를 깨뜨리지 마라.
