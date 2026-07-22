# Step 5: rest-api

## 읽어야 할 파일

- `/CLAUDE.md` (수집·배포 디커플링: api는 collector를 import 금지)
- `/docs/ARCHITECTURE.md` (데이터 흐름의 api 부분, Redis 키 규칙, 심볼 wire 표기)
- `/docs/ADR.md` (ADR-002, ADR-003)
- `packages/shared/src/` — `NormalizedTick`, `fromWireSymbol`/`toWireSymbol`
- `apps/api/src/` — step 0의 api 뼈대(health)
- `apps/collector/src/bus/redis-bus.ts` — **참고만** (키/채널 규칙 확인용). import 하지 마라.

## 작업

`apps/api`에 Redis 스냅샷 조회 버스와 REST 컨트롤러를 구현한다. api는 `market:latest` 해시를 **읽기만** 한다.

### 1. RedisBus (reader) (`src/bus/redis-bus.ts`)
- collector와 별개의 자체 구현(코드 공유 금지 — 두 서비스는 `@market/shared`만 공유). `ioredis` dependency, `ioredis-mock` devDep 추가.
- Redis 클라이언트 주입 가능하게. 실행 시 `REDIS_URL`(기본 `redis://localhost:6379`).
- 메서드:
  - `async getSymbols(): Promise<string[]>` → `HKEYS market:latest` (내부 표준 심볼 배열, 예: `['BTC/KRW', ...]`).
  - `async getSnapshot(symbol: string): Promise<NormalizedTick | null>` → `HGET market:latest {symbol}` 후 JSON 파싱(없으면 null).

### 2. Market 컨트롤러 (`src/market/market.controller.ts`)
- `GET /v1/symbols` → `{ symbols: string[] }` (wire 표기로 변환: `toWireSymbol`, 예: `['BTC-KRW', ...]`).
- `GET /v1/ticks/:symbol` → 경로의 `:symbol`은 wire 표기(`BTC-KRW`). `fromWireSymbol`로 내부 표준(`BTC/KRW`)으로 바꿔 `getSnapshot` 조회.
  - 존재하면 `NormalizedTick` 반환, 없으면 `404 Not Found`.
- `GET /health`는 step 0의 것을 유지.

### 3. 테스트 (TDD — Nest Testing + supertest + ioredis-mock)
- `Test.createTestingModule`로 앱 구성, RedisBus에 `ioredis-mock` 주입.
- mock의 `market:latest` 해시에 샘플 tick 2개를 미리 `HSET`.
- 검증:
  - `GET /v1/symbols` → wire 심볼 목록 포함.
  - `GET /v1/ticks/BTC-KRW` → 200 + 해당 tick.
  - `GET /v1/ticks/UNKNOWN-KRW` → 404.

## Acceptance Criteria

```bash
npm install
npm run lint
npm run build
npm run test
```
모두 exit 0.

## 검증 절차

1. 위 AC 실행.
2. 체크리스트:
   - api가 `apps/collector`의 어떤 것도 import하지 않는가(CLAUDE.md CRITICAL)?
   - Redis 키/채널이 ARCHITECTURE.md와 일치하는가?
   - 경로 심볼이 wire 표기(`BTC-KRW`)이고 내부에서 `fromWireSymbol`로 변환하는가?
   - 테스트가 `ioredis-mock`으로 오프라인 통과하는가?
3. `phases/0-mvp/index.json`의 step 5 상태 업데이트.

## 금지사항

- WebSocket 게이트웨이를 여기서 구현하지 마라. 이유: step 6 소관.
- collector 코드를 import하거나 재사용하지 마라. 이유: 디커플링 규칙. Redis 계약(키/채널)으로만 연결.
- 실 Redis에 접속하는 테스트를 작성하지 마라.
- 기존 테스트를 깨뜨리지 마라.
