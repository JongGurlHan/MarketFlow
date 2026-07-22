# Step 3: collector

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙(SourceConnector, NormalizedTick 게이트, 버스 인터페이스, 오프라인 테스트)
- `docs/ARCHITECTURE.md` — 데이터 흐름, 심볼 규칙
- `docs/ADR.md` — ADR-004(오프라인 테스트), ADR-005(소스 2개)
- `packages/shared/src/` — 타입·스키마·심볼 레지스트리(`UPBIT_MARKETS`, `BINANCE_MARKETS`) 및 `parseTick`
- `apps/server/src/collector/bus/market-bus.ts` + `collector.module.ts` — step 2에서 만든 `MarketBus`·`MARKET_BUS` 토큰(재사용, 새로 만들지 마라)

## 작업

두 거래소 WebSocket을 받아 → `NormalizedTick`으로 정규화 → **step 2의 `MarketBus`에 publish**하는 수집 파이프라인을 구현한다. **모든 외부 소켓은 주입식 팩토리로 추상화**하여 테스트가 오프라인에서 돌게 한다. 대상 심볼은 `@market/shared`의 레지스트리(현재 BTC·ETH)를 따른다.

### 1. `src/collector/connectors/source-connector.ts`
```ts
export type SocketFactory = (url: string) => WsLike;   // 주입 지점
export interface WsLike {
  on(event: 'open' | 'message' | 'close' | 'error', cb: (arg?: any) => void): void;
  send(data: string): void;
  close(): void;
}
export interface SourceConnector {
  readonly source: Source;
  readonly ticks$: Observable<NormalizedTick>;   // 정규화된 스트림
  connect(): void;
  disconnect(): void;
}
```
- 실 런타임에서는 `SocketFactory`가 `ws` 패키지의 `WebSocket`을 생성. 테스트에서는 fake 소켓을 주입.

### 2. `src/collector/normalizer/` 매퍼 (순수 함수)
공급처 raw ticker → `NormalizedTick`. **반드시 `parseTick`(zod)으로 검증한 객체만 반환**. 순수 함수로 분리(`mapUpbitRaw(raw)`, `mapBinanceRaw(raw)`)해 fixture로 직접 단위 테스트.

**Upbit** 매핑:
| raw | NormalizedTick |
|-----|----------------|
| `code` ('KRW-BTC') | `symbol` (레지스트리로 'BTC/KRW') |
| `trade_price` | `price` |
| `signed_change_rate` (예 0.012) | `changeRate24h` (× 100 → 1.2) |
| `acc_trade_volume_24h` | `volume24h` |
| `trade_timestamp`\|`timestamp` (ms) | `sourceTimestamp` |
`source:'upbit'`, `assetClass:'crypto'`, `ingestTimestamp: Date.now()`.

**Binance** 매핑:
| raw | NormalizedTick |
|-----|----------------|
| `s` ('BTCUSDT') | `symbol` (레지스트리로 'BTC/USDT') |
| `c` (문자열 종가) | `price` (Number) |
| `P` (문자열 변동률 %) | `changeRate24h` (Number) |
| `v` (문자열 거래량) | `volume24h` (Number) |
| `E` (이벤트 시각 ms) | `sourceTimestamp` |
`source:'binance'`, `assetClass:'crypto'`, `ingestTimestamp: Date.now()`.

### 3. `src/collector/connectors/upbit.connector.ts` + `binance.connector.ts`
각 커넥터는 `SourceConnector` 구현. 생성자에 `SocketFactory` 주입. `connect()`에서 소켓 생성·구독 메시지 전송, `message` 수신 시 매퍼를 통과시켜 `ticks$`로 emit.
- **Upbit** (`wss://api.upbit.com/websocket/v1`): 구독 메시지 `[{ ticket:'marketstream' }, { type:'ticker', codes: UPBIT_MARKETS.map(m=>m.raw) }]`. 메시지가 바이너리로 올 수 있으니 문자열로 파싱.
- **Binance** (`wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker`): combined stream이면 message가 `{ stream, data }` 래핑. `data`가 `24hrTicker` 페이로드.

### 4. `src/collector/collector.service.ts` (+ `collector.module.ts` 확장)
- `CollectorService`(`@Injectable`): 주입된 커넥터 배열의 각 `ticks$`를 구독해 `bus.publish(tick)`. `start()`/`stop()` 메서드.
- step 2의 `collector.module.ts`에 커넥터·`CollectorService` provider를 추가(버스는 그대로 재사용).
- **실 소켓 연결은 이 step에서 자동 기동하지 않는다.** 런타임 기동은 step 4(distribution)의 `main.ts`가 담당한다. `OnModuleInit`/생성자에서 실 소켓을 열면 테스트가 외부망에 붙으니 금지.

### 5. fixtures + 테스트 (오프라인)
- `src/collector/__fixtures__/`에 Upbit·Binance 각 **BTC·ETH** raw ticker 샘플 JSON을 손으로 작성(위 필드 형식 그대로, 실 네트워크 접속 금지).
- 테스트:
  - 매퍼 단위: fixture raw → `mapUpbitRaw`/`mapBinanceRaw` → 기대 `NormalizedTick`(심볼 변환·필드·타입) 검증.
  - 커넥터: fake `SocketFactory` 주입 → `connect()` → fake 소켓에 fixture message emit → 커넥터 `ticks$`가 정규화 tick을 내보내는지 검증.
  - 서비스: `CollectorService.start()` 후 fake 커넥터의 tick이 `MarketBus`에 publish되어 `getLatestBySymbol`로 조회되는지.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

fake 소켓 + fixture 기반 테스트가 외부망 없이 통과해야 한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - 파이프라인 코어에 `if (source === 'upbit')` 같은 공급처 분기가 없는가?
   - raw 포맷이 버스로 새지 않는가?(정규화·zod 검증 통과분만 publish)
   - 테스트가 실 WebSocket에 접속하지 않는가?(주입 fake 소켓만)
   - step 2의 버스·모듈을 재사용했는가?(중복 생성 금지)
3. `phases/0-mvp/index.json`의 step 3을 업데이트:
   - 성공 → `"completed"` + `"summary"`(커넥터 클래스명·매퍼 함수명·`CollectorService`·fixture 경로 — step 4가 런타임 기동에 사용할 정보).
   - 실패 → `"error"` + `"error_message"`.

## 금지사항

- 테스트에서 실제 Upbit/Binance 서버에 접속하지 마라. 이유: 오프라인 AC 위반·비결정론. 주입 fake 소켓 사용.
- `OnModuleInit`/생성자에서 실 소켓을 자동으로 열지 마라. 이유: `npm test`가 외부망에 붙는다. 런타임 기동은 step 4 `main.ts`.
- step 2의 `MarketBus`를 다시 만들지 마라. 이유: 중복·계약 분기. 기존 `MARKET_BUS` 토큰을 주입해 사용.
- 기존 테스트를 깨뜨리지 마라.
