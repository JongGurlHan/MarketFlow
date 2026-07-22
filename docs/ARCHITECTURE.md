# 아키텍처

## 모노레포 구조 (npm workspaces)
```
apps/
├── collector/       # NestJS — 수집·가공 서비스
│   └── src/
│       ├── collectors/    # SourceConnector 인터페이스 + 공급처별 커넥터 (upbit.connector.ts)
│       ├── normalizer/    # raw payload → NormalizedTick 매퍼
│       ├── bus/           # RedisBus (publish + 최신값 캐시)
│       └── main.ts        # 파이프라인 부트스트랩
├── api/             # NestJS — 배포 서비스
│   └── src/
│       ├── market/        # REST 컨트롤러 + WebSocket 게이트웨이
│       ├── bus/           # RedisBus (subscribe + 스냅샷 조회)
│       ├── health/        # health 컨트롤러
│       └── main.ts
└── web/             # Next.js 15 App Router — 실시간 대시보드
    └── src/app/
packages/
└── shared/          # @market/shared — NormalizedTick 타입/스키마, 심볼 유틸
    └── src/
infra/
└── docker-compose.yml   # redis + collector + api + web
scripts/             # Harness (execute.py) + 헬스체크 셸
package.json         # workspaces 루트 + lint/build/test/dev 스크립트
```

## 패턴
- **수집·배포 분리**: `collector`와 `api`는 서로를 import하지 않는다. 오직 Redis(pub/sub + 해시)로만 연결된다.
- **소스-무관 수집**: 모든 공급처 커넥터는 `SourceConnector` 인터페이스를 구현한다. 파이프라인은 커넥터 종류를 모른다.
- **표준 스키마 게이트**: 정규화를 통과하지 않은 데이터는 버스로 나갈 수 없다.
- **공용 타입**: `@market/shared`를 tsconfig path alias(`@market/shared` → `packages/shared/src`)로 참조한다. Next.js는 `transpilePackages`, Nest/ts-jest는 tsconfig paths로 소스를 직접 소비한다(빌드 순서 의존 최소화). `npm run build`는 `packages/shared`를 workspaces 배열 첫 번째로 두어 먼저 빌드한다.

## 데이터 흐름
```
Upbit WS ─▶ collector: SourceConnector.stream()
                        └─▶ Normalizer.normalize(raw) ─▶ NormalizedTick
                                                          └─▶ RedisBus.publish(tick)
                                                                ├─ HSET market:latest {symbol} {json}   (스냅샷 캐시)
                                                                └─ PUBLISH market:ticks:{symbol} {json}  (스트리밍)
api: RedisBus.subscribe(pattern market:ticks:*)
     ├─ REST  GET /v1/symbols            → 구독 심볼 목록
     ├─ REST  GET /v1/ticks/:symbol      → market:latest 해시에서 스냅샷
     ├─ REST  GET /health                → 상태
     └─ WS    /stream (게이트웨이)        → 클라이언트 구독 심볼로 Redis 메시지 팬아웃
web: 최초 REST 스냅샷 로드 → WS 구독으로 실시간 갱신
```

## 표준 스키마 (`@market/shared`)
```ts
type Source = 'upbit' | 'binance';        // phase 1에서 'binance' 추가
type AssetClass = 'crypto';               // 자산군 확장 대비

interface NormalizedTick {
  source: Source;
  symbol: string;            // 표준 심볼. 예: 'BTC/KRW' (내부 표준: BASE/QUOTE 대문자)
  assetClass: AssetClass;
  price: number;             // 체결가
  bid?: number;
  ask?: number;
  volume24h?: number;
  changeRate24h?: number;
  sourceTimestamp: number;   // 공급처 타임스탬프 (epoch ms)
  ingestTimestamp: number;   // 수집 시각 (epoch ms) — 레이턴시 측정용
  sequence?: number;         // 갭 감지용 (있으면)
}
```
- zod 스키마로 런타임 검증한다. 정규화 매퍼는 이 스키마 검증을 통과한 객체만 반환한다.
- 심볼 규칙: 내부 표준은 `BASE/QUOTE`(예: `BTC/KRW`). 공급처 원본 심볼(Upbit `KRW-BTC`)은 정규화 단계에서 변환한다.

## Redis 키 규칙
| 용도 | 키/채널 | 자료구조 |
|------|---------|----------|
| 최신값 스냅샷 | `market:latest` | HASH (field=symbol, value=NormalizedTick JSON) |
| 실시간 스트림 | `market:ticks:{symbol}` | PUB/SUB 채널 |

## 상태 관리
- 서버: 상태는 Redis에만 둔다. collector/api 프로세스는 상태를 로컬에 저장하지 않는다(재시작 안전).
- 웹: 서버 스냅샷은 최초 REST 페치, 이후 실시간은 WebSocket 수신 → React 상태(useState/useReducer)로 갱신.
