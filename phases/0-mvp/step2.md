# Step 2: collector

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙(SourceConnector, NormalizedTick 게이트, MarketBus 인터페이스, 오프라인 테스트)
- `docs/ARCHITECTURE.md` — 데이터 흐름, MarketBus 계약, 심볼 규칙
- `docs/ADR.md` — ADR-003(인메모리 버스), ADR-004(오프라인 테스트), ADR-005(소스 2개)
- `packages/shared/src/` 전체 — 사용할 타입·스키마·심볼 레지스트리(`UPBIT_MARKETS`, `BINANCE_MARKETS`)

## 작업

`apps/server`의 `collector` 모듈을 구현한다: 두 거래소 WebSocket을 받아 → `NormalizedTick`으로 정규화 → `MarketBus`에 publish. **모든 외부 소켓은 주입식 팩토리로 추상화**하여 테스트가 오프라인에서 돌게 한다.

### 1. `src/collector/bus/market-bus.ts`
`docs/ARCHITECTURE.md`의 계약을 구현:
```ts
export interface MarketBus {
  publish(tick: NormalizedTick): void;
  getLatest(): NormalizedTick[];
  getLatestBySymbol(symbol: string): NormalizedTick | undefined;
  subscribe(symbols: string[]): Observable<NormalizedTick>;
}
```
- `InMemoryMarketBus` (Nest `@Injectable`): 내부에 `Map<string, NormalizedTick>`(최신값) + RxJS `Subject<NormalizedTick>`. `publish`는 Map 갱신 + Subject.next. `subscribe(symbols)`는 Subject를 `filter(symbols 포함)`한 Observable. `symbols`가 빈 배열이면 전체 스트림.
- `MARKET_BUS`라는 Nest DI 토큰으로 제공(인터페이스 주입용). distribution은 이 토큰으로만 버스를 받는다.

### 2. `src/collector/connectors/source-connector.ts`
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

### 3. `src/collector/connectors/upbit.connector.ts` + `binance.connector.ts`
각 커넥터는 `SourceConnector` 구현. 생성자에 `SocketFactory` 주입. `connect()`에서 소켓 생성·구독 메시지 전송, `message` 수신 시 raw→정규화 매퍼를 통과시켜 `ticks$`로 emit.

**Upbit** (`wss://api.upbit.com/websocket/v1`):
- 구독 메시지(JSON 배열): `[{ ticket: 'marketstream' }, { type: 'ticker', codes: UPBIT_MARKETS.map(m=>m.raw) }]`. 바이너리로 올 수 있으니 message를 문자열로 파싱.
- raw ticker 필드 → NormalizedTick 매핑:
  | raw | NormalizedTick |
  |-----|----------------|
  | `code` ('KRW-BTC') | `symbol` (레지스트리로 'BTC/KRW') |
  | `trade_price` | `price` |
  | `signed_change_rate` (예 0.012) | `changeRate24h` (× 100 → 퍼센트, 1.2) |
  | `acc_trade_volume_24h` | `volume24h` |
  | `trade_timestamp` 또는 `timestamp` (ms) | `sourceTimestamp` |
  - `source: 'upbit'`, `assetClass: 'crypto'`, `ingestTimestamp: Date.now()`.

**Binance** (`wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker/...`):
- combined stream이면 message는 `{ stream, data }` 래핑. `data`가 `24hrTicker` 페이로드.
- raw ticker 필드 → NormalizedTick 매핑:
  | raw | NormalizedTick |
  |-----|----------------|
  | `s` ('BTCUSDT') | `symbol` (레지스트리로 'BTC/USDT') |
  | `c` (문자열 종가) | `price` (Number) |
  | `P` (문자열 변동률 %) | `changeRate24h` (Number) |
  | `v` (문자열 거래량) | `volume24h` (Number) |
  | `E` (이벤트 시각 ms) | `sourceTimestamp` |
  - `source: 'binance'`, `assetClass: 'crypto'`, `ingestTimestamp: Date.now()`.
- 매퍼는 **반드시 `parseTick`(zod)으로 검증한 객체만 emit**. 매핑 함수는 순수 함수로 분리해(예: `mapUpbitRaw(raw): NormalizedTick`) 단위 테스트가 fixture로 직접 호출할 수 있게 한다.

### 4. `src/collector/collector.service.ts` + `collector.module.ts`
- `CollectorService`(`@Injectable`): 주입된 커넥터 배열을 받아 각 `ticks$`를 구독해 `bus.publish(tick)`. `start()`/`stop()` 메서드.
- `CollectorModule`: `InMemoryMarketBus`를 `MARKET_BUS` 토큰으로 provide + export(distribution이 사용). 커넥터·서비스 provider 등록.
- **실 소켓 연결은 이 step에서 자동 기동하지 않는다** — 런타임 기동은 step 3의 `main.ts`에서 처리. `OnModuleInit`에서 무조건 실 소켓을 열면 테스트가 외부망에 붙으니 금지.

### 5. fixtures + 테스트 (오프라인)
- `src/collector/__fixtures__/`에 Upbit·Binance 각 raw ticker 샘플 JSON을 손으로 작성(위 필드 형식 그대로, 실 네트워크 접속 금지).
- 테스트:
  - 매퍼 단위: fixture raw → `mapUpbitRaw`/`mapBinanceRaw` → 기대 NormalizedTick(심볼 변환·필드·타입) 검증.
  - 커넥터: fake `SocketFactory` 주입 → `connect()` → fake 소켓에 fixture message를 `emit` → 커넥터의 `ticks$`가 정규화 tick을 내보내는지 검증.
  - 버스: `publish` 후 `getLatestBySymbol`·`subscribe(['BTC/KRW'])`가 올바른 tick을 반환하는지 검증.

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
   - 파이프라인 코어에 `if (source === 'upbit')` 같은 공급처 분기가 없는가?(커넥터 구현으로만 분리)
   - raw 포맷이 버스로 새지 않는가?(정규화·zod 검증 통과분만 publish)
   - 테스트가 실 WebSocket에 접속하지 않는가?(주입 fake 소켓만)
3. `phases/0-mvp/index.json`의 step 2를 업데이트:
   - 성공 → `"completed"` + `"summary"`(MarketBus DI 토큰명, 커넥터 클래스명, 매퍼 함수명, fixture 경로 — step 3이 import·재사용할 정보 포함).
   - 실패 → `"error"` + `"error_message"`.

## 금지사항

- 테스트에서 실제 Upbit/Binance 서버에 접속하지 마라. 이유: 오프라인 AC 위반·비결정론. 반드시 주입 fake 소켓 사용.
- `OnModuleInit`/생성자에서 실 소켓을 자동으로 열지 마라. 이유: `npm test`가 외부망에 붙는다. 런타임 기동은 step 3 `main.ts`가 담당.
- distribution/web이 커넥터·매퍼를 import하게 만들지 마라. 이유: 버스 인터페이스로만 통신(CLAUDE.md CRITICAL).
- 기존 테스트를 깨뜨리지 마라.
