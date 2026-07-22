# 아키텍처

## 모노레포 구조 (npm workspaces)
```
packages/
└── shared/          # @market/shared — NormalizedTick 타입/zod 스키마, 심볼 유틸 (BE·FE 공용)
    └── src/
apps/
├── server/          # NestJS — 단일 백엔드 (수집 + 배포)
│   └── src/
│       ├── collector/
│       │   ├── connectors/   # SourceConnector 인터페이스 + upbit.connector.ts + binance.connector.ts
│       │   ├── normalizer/   # 공급처 raw payload → NormalizedTick 매퍼
│       │   ├── bus/          # MarketBus 인터페이스 + in-memory-bus.ts (RxJS Subject + 최신값 Map)
│       │   ├── collector.service.ts   # 커넥터 → 정규화 → bus 배선
│       │   └── collector.module.ts
│       ├── distribution/
│       │   ├── market.controller.ts   # REST: /v1/symbols, /v1/ticks/:symbol
│       │   ├── health.controller.ts   # GET /health
│       │   ├── market.gateway.ts       # WebSocket 게이트웨이 (구독 심볼 팬아웃)
│       │   └── distribution.module.ts
│       ├── app.module.ts
│       └── main.ts          # 부트스트랩 + 런타임에만 실 WS 커넥터 기동
└── web/             # Next.js 15 App Router — 실시간 대시보드
    └── src/
scripts/             # Harness (execute.py)
package.json         # workspaces 루트 + lint/build/test/dev 스크립트
```

## 패턴
- **단일 프로세스·모듈 분리**: `collector`와 `distribution`은 한 Nest 앱 안의 별개 모듈이며 **`MarketBus` 인터페이스로만** 연결된다. distribution은 collector 내부(커넥터·normalizer)를 import하지 않는다. → 나중에 프로세스 분리·Redis 전환 시 무수정.
- **소스-무관 수집**: 모든 공급처 커넥터는 `SourceConnector`를 구현한다. 파이프라인은 커넥터 종류를 모른다.
- **표준 스키마 게이트**: 정규화(zod 검증)를 통과하지 않은 데이터는 버스로 나갈 수 없다.
- **공용 타입**: `@market/shared`를 tsconfig path alias(`@market/shared` → `packages/shared/src`)로 참조한다. Next.js는 `transpilePackages`, Nest/ts-jest는 tsconfig paths로 소스를 직접 소비한다. `npm run build`는 workspaces 배열에서 `packages/shared`를 먼저 두어 먼저 빌드한다.

## 데이터 흐름
```
Upbit WS  ─┐
           ├─▶ SourceConnector.ticks$ ─▶ Normalizer ─▶ NormalizedTick ─▶ MarketBus.publish(tick)
Binance WS ─┘   (커넥터별)                (raw→표준)                        ├─ 최신값 Map 갱신 (스냅샷)
                                                                          └─ 심볼별 스트림 next (스트리밍)
distribution:
     ├─ REST GET /v1/symbols        → 활성 심볼 목록
     ├─ REST GET /v1/ticks/:symbol  → MarketBus 최신값 스냅샷
     ├─ REST GET /health            → 상태
     └─ WS   /stream (게이트웨이)   → 클라이언트 구독 심볼로 MarketBus 스트림 팬아웃
web: 최초 REST 스냅샷 로드 → WS 구독으로 실시간 갱신
```

## 표준 스키마 (`@market/shared`)
```ts
type Source = 'upbit' | 'binance';
type AssetClass = 'crypto';               // 자산군 확장 대비

interface NormalizedTick {
  source: Source;
  symbol: string;            // 내부 표준: BASE/QUOTE 대문자. 예: 'BTC/KRW', 'BTC/USDT'
  assetClass: AssetClass;
  price: number;             // 체결가
  changeRate24h?: number;    // 24h 등락률
  volume24h?: number;
  sourceTimestamp: number;   // 공급처 타임스탬프 (epoch ms)
  ingestTimestamp: number;   // 수집 시각 (epoch ms) — 레이턴시 측정용(phase 2)
  sequence?: number;         // 갭 감지용(phase 1)
}
```
- zod 스키마로 런타임 검증한다. 정규화 매퍼는 이 스키마 검증을 통과한 객체만 반환한다.
- 심볼 규칙: 내부 표준은 `BASE/QUOTE`(예: `BTC/KRW`). 공급처 원본 심볼(Upbit `KRW-BTC`, Binance `BTCUSDT`)은 정규화 단계에서 변환한다.

## MarketBus 계약 (인메모리)
```ts
interface MarketBus {
  publish(tick: NormalizedTick): void;
  getLatest(): NormalizedTick[];                            // 전체 스냅샷
  getLatestBySymbol(symbol: string): NormalizedTick | undefined;
  subscribe(symbols: string[]): Observable<NormalizedTick>; // 심볼 필터 스트림
}
```
- 인메모리 구현: `Map<symbol, NormalizedTick>`(최신값) + RxJS `Subject<NormalizedTick>`(스트림). **Redis 구현이 phase 1 교체 지점 — 인터페이스 동일.**

## 상태 관리
- 서버: 상태는 `MarketBus`(인메모리 Map)에만 둔다. 컨트롤러/게이트웨이는 상태를 로컬에 따로 저장하지 않는다.
- 웹: 서버 스냅샷은 최초 REST 페치, 이후 실시간은 WebSocket 수신 → React 상태(useState/useReducer)로 갱신.
