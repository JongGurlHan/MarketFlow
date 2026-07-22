# Step 4: redis-bus

## 읽어야 할 파일

- `/CLAUDE.md` (CRITICAL: 정규화 후에만 버스로, 수집·배포 디커플링)
- `/docs/ARCHITECTURE.md` ("Redis 키 규칙", 데이터 흐름)
- `/docs/ADR.md` (ADR-003 pub/sub, ADR-004 ioredis-mock)
- `apps/collector/src/collectors/upbit.connector.ts` — step 3
- `apps/collector/src/collectors/source-connector.ts`, `apps/collector/src/normalizer/upbit.normalizer.ts` — step 2

## 작업

`apps/collector`에 Redis 발행(publisher) 버스를 만들고, 수집 파이프라인을 배선한다. **collector 측만** 다룬다(구독은 step 5/6의 api).

### 1. RedisBus (publisher) (`src/bus/redis-bus.ts`)
- `ioredis`를 collector의 dependency로, `ioredis-mock`을 devDep로 추가하라.
- Redis 클라이언트는 **주입 가능**하게 한다(테스트에서 `ioredis-mock` 주입). 예: `class RedisBus { constructor(private readonly redis: Redis) {} }` — 실행 시엔 `new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')`를 주입.
- `async publish(tick: NormalizedTick): Promise<void>`:
  - `HSET market:latest {tick.symbol} {JSON.stringify(tick)}` (스냅샷 캐시)
  - `PUBLISH market:ticks:{tick.symbol} {JSON.stringify(tick)}` (스트리밍)
  - 키/채널 문자열은 ARCHITECTURE.md "Redis 키 규칙"과 정확히 일치시켜라.

### 2. 파이프라인 배선 (`src/collector.service.ts` 또는 모듈)
- Nest 서비스로 구성. `onModuleInit`(또는 명시적 start)에서:
  - `UPBIT_MARKETS` env를 파싱해 `UpbitConnector` 생성(기본 소켓 팩토리 사용).
  - `connector.connect(tick => redisBus.publish(tick))` 호출.
- collector `main.ts`가 이 서비스를 부트스트랩하도록 모듈에 등록.
- **CRITICAL: 정규화되지 않은 raw 데이터를 publish하지 마라.** 오직 `NormalizedTick`만 버스로.

### 3. 테스트 (TDD — ioredis-mock)
- `RedisBus`에 `ioredis-mock` 인스턴스를 주입하고 `publish(tick)` 호출 후:
  - `HGET market:latest 'BTC/KRW'`가 직렬화된 tick과 일치하는지.
  - `market:ticks:BTC/KRW` 채널에 대해 별도 mock 구독자를 붙여 메시지 수신을 검증(가능하면). 최소한 HSET 결과는 반드시 검증.
- 파이프라인: 가짜 커넥터(주입식 소켓)로 fixture tick을 흘려 `RedisBus.publish`가 호출되는지 검증(스파이).

## Acceptance Criteria

```bash
npm install
npm run lint
npm run build
npm run test
```
모두 exit 0. Redis 없이(ioredis-mock으로) 테스트가 통과해야 한다.

## 검증 절차

1. 위 AC 실행.
2. 체크리스트:
   - Redis 키/채널이 ARCHITECTURE.md 규칙과 일치하는가?
   - Redis 클라이언트가 주입 가능하고, 테스트가 `ioredis-mock`을 쓰는가?
   - 오직 `NormalizedTick`만 publish되는가(CLAUDE.md CRITICAL)?
   - collector가 api를 import하지 않는가?
3. `phases/0-mvp/index.json`의 step 4 상태 업데이트.

## 금지사항

- api(배포) 측 구독/REST/WS를 여기서 구현하지 마라. 이유: step 5/6 소관. 지금은 collector publisher만.
- 테스트에서 실제 Redis에 접속하지 마라. 이유: ADR-004 위반.
- raw payload를 Redis로 보내지 마라. 이유: CLAUDE.md CRITICAL(표준 스키마 게이트).
- 기존 테스트를 깨뜨리지 마라.
