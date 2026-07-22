# Step 2: market-bus

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙(collector·distribution은 `MarketBus` 인터페이스로만 통신)
- `docs/ARCHITECTURE.md` — "MarketBus 계약 (인메모리)" 섹션
- `docs/ADR.md` — ADR-003(인메모리 버스, Redis는 phase 1)
- `packages/shared/src/` — `NormalizedTick` 타입(그대로 import)
- `apps/server/src/` — step 0 뼈대(`app.module.ts` 등)

## 작업

collector와 distribution이 공유하는 **중심 계약**인 인메모리 버스를 구현한다. 이 step은 **버스만** 다룬다 — 커넥터·매퍼·소켓은 step 3(collector)의 범위다. 버스를 먼저 확정·테스트해 두면 이후 step들이 안정된다.

### 1. `src/collector/bus/market-bus.ts`
`docs/ARCHITECTURE.md`의 계약을 그대로 구현:
```ts
export interface MarketBus {
  publish(tick: NormalizedTick): void;
  getLatest(): NormalizedTick[];
  getLatestBySymbol(symbol: string): NormalizedTick | undefined;
  subscribe(symbols: string[]): Observable<NormalizedTick>;
}
```
- `InMemoryMarketBus` (Nest `@Injectable`): 내부에 `Map<string, NormalizedTick>`(최신값) + RxJS `Subject<NormalizedTick>`. `publish`는 Map 갱신 + `Subject.next`. `subscribe(symbols)`는 Subject를 심볼 필터한 Observable(`symbols`가 빈 배열이면 전체 스트림).
- `MARKET_BUS`라는 Nest DI 토큰을 export한다(인터페이스 주입용). collector·distribution은 이 토큰으로만 버스를 주입받는다.

### 2. `src/collector/collector.module.ts`
- `InMemoryMarketBus`를 `MARKET_BUS` 토큰으로 `provide` + **`export`**(다른 모듈이 주입받도록). 커넥터·`CollectorService` provider는 step 3에서 이 모듈에 추가된다.

### 3. 테스트 (`src/collector/bus/market-bus.spec.ts`)
- `publish` 후 `getLatestBySymbol('BTC/KRW')`·`getLatest()`가 올바른 값을 반환.
- `subscribe(['BTC/KRW'])`가 해당 심볼 tick만 흘리고 다른 심볼은 걸러내는지. 빈 배열이면 전체 수신.
- 최신값 덮어쓰기(같은 심볼 재publish 시 최신 tick 유지).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

버스 단위 테스트가 통과해야 한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트: `MarketBus`가 `docs/ARCHITECTURE.md` 계약과 일치하는가? `MARKET_BUS` 토큰으로 주입 가능한가?
3. `phases/0-mvp/index.json`의 step 2를 업데이트:
   - 성공 → `"completed"` + `"summary"`(`MARKET_BUS` 토큰명·`InMemoryMarketBus` 클래스명·`CollectorModule`이 export하는 심벌 — step 3·4가 재사용할 정보).
   - 실패 → `"error"` + `"error_message"`.

## 금지사항

- 커넥터·매퍼·소켓 코드를 이 step에 넣지 마라. 이유: 이 step은 버스 계약만. 통합 로직은 step 3.
- Redis/ioredis를 도입하지 마라. 이유: MVP는 인메모리. Redis는 phase 1에서 동일 인터페이스로 교체.
- 기존 테스트를 깨뜨리지 마라.
