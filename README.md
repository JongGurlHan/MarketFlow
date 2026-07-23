# MarketStream — 실시간 시장 데이터 플랫폼

여러 이종 공급처(Upbit·Binance)의 실시간 시세를 **하나의 표준 스키마(`NormalizedTick`)로 정규화**하고,
인메모리 버스로 팬아웃하여 **REST/WebSocket으로 배포**하는 시장 데이터 플랫폼입니다.
가상자산 거래·투자 서비스가 아니라, **"수집 → 가공(정규화) → 배포"** 파이프라인의 안정성·확장성을 보여주는 엔지니어링 프로젝트입니다.

## 왜 크립토인가 — 도메인 프레이밍

금융정보 벤더의 본업은 채권·외환·금리 등 **전통 금융 시세의 실시간 수집·가공·배포**입니다.
이 프로젝트가 Upbit·Binance(크립토)를 소재로 삼는 이유는 다음과 같습니다.

- **자산군과 무관하게 엔지니어링 구조는 동일하다.** 실시간 틱을 수집하고, 이종 원본 포맷을 하나의 표준으로 정규화하고, 저지연으로 배포하는 파이프라인의 기술적 난제는 채권이든 크립토든 다르지 않습니다.
- **검증 가능한 공개 실시간 피드가 필요하다.** 실 금융 데이터는 유료·폐쇄망인 반면, 크립토 거래소는 동일 아키텍처를 검증할 수 있는 **공개 실시간 WebSocket 피드**를 무료로 제공합니다.
- **"이종 소스 정규화"를 주장이 아니라 시연으로.** 서로 다른 원본 포맷(Upbit `KRW-BTC` 스냅샷형 vs Binance `BTCUSDT` 스트림형)을 하나의 표준으로 통일하는 것을 실제로 보여줍니다.
- **확장 대비.** 표준 스키마에 `assetClass` 필드를 두어 전통 금융 자산군으로의 확장을 구조적으로 대비합니다.

## 아키텍처

```
  공급처 (외부 WebSocket)          collector (수집·가공)                    distribution (배포)         단말
  ┌─────────────┐         ┌──────────────────────────────────┐      ┌───────────────────────┐
  │  Upbit  WS  │──raw──▶ │ UpbitConnector ─┐                │      │ REST  GET /v1/symbols │
  │  KRW-BTC…   │         │                 ▼                │      │       GET /v1/ticks   │──▶ curl /
  └─────────────┘         │  Normalizer (raw → NormalizedTick)│      │       GET /v1/ticks/… │    외부 소비자
                          │            │ (zod 검증)          │      │       GET /health     │
  ┌─────────────┐         │            ▼                     │      │                       │
  │ Binance WS  │──raw──▶ │ BinanceConnector                 │      │ WS   /  (게이트웨이)  │──▶ 웹 대시보드
  │  BTCUSDT…   │         │                 │                │      │      subscribe/tick   │    (localhost:3000)
  └─────────────┘         │                 ▼                │      └───────────▲───────────┘
                          │   ┌──────────────────────────┐   │                  │
                          │   │  MarketBus (인메모리)     │◀──┼── publish        │ subscribe / getLatest
                          │   │  · Map<symbol, tick> 최신값│──┼──────────────────┘
                          │   │  · RxJS Subject 스트림     │   │
                          │   └──────────────────────────┘   │
                          └──────────────────────────────────┘
                                     └─ SourceConnector 인터페이스로만 소스 추가 ─┘
```

- **collector와 distribution은 `MarketBus` 인터페이스를 통해서만 통신**합니다. distribution은 커넥터·정규화 내부를 직접 import 하지 않습니다.
- 웹 대시보드는 **최초 REST 스냅샷 로드 → WS 구독으로 실시간 갱신**합니다.

## 핵심 설계 포인트

1. **이종 소스 정규화 (`NormalizedTick` · `SourceConnector`)**
   모든 외부 데이터는 반드시 `@market/shared`의 `NormalizedTick`으로 정규화(zod 런타임 검증)한 뒤에만 버스로 흐릅니다. raw 포맷은 배포단으로 새어나가지 않습니다.
   새 공급처는 파이프라인 코어를 수정하지 않고 **`SourceConnector` 인터페이스 구현 하나**로 추가합니다(`if (source === 'upbit')` 같은 분기 없음). → 소스 추가 비용이 커넥터+매퍼 하나로 고정됩니다.

2. **수집·배포 디커플링 (`MarketBus` 인터페이스)**
   publisher(collector)와 subscriber(distribution)는 `MarketBus` 인터페이스로만 연결됩니다. 지금은 인메모리 구현(RxJS Subject + 최신값 Map)이지만, **phase 1에서 동일 인터페이스의 Redis 구현으로 교체해도 양쪽 코드는 무수정**입니다. → 프로세스 분리·멀티 인스턴스 팬아웃을 위한 seam을 미리 확보했습니다.

3. **오프라인 결정론적 테스트**
   외부 WebSocket은 소켓 팩토리 주입으로 대체하고, 녹화된 raw 메시지 fixture로 매핑·파이프라인을 검증합니다. **실 네트워크 없이** `npm run test`가 통과합니다. → CI·자율 실행이 외부망에 의존하지 않습니다.

## 표준 스키마 — `NormalizedTick`

모든 공급처 데이터는 아래 표준 스키마로 정규화된 뒤에만 버스로 흐릅니다(`@market/shared`, zod로 런타임 검증).

```ts
type Source = 'upbit' | 'binance';
type AssetClass = 'crypto'; // 자산군 확장 대비

interface NormalizedTick {
  source: Source;
  symbol: string;         // 내부 표준: BASE/QUOTE 대문자. 예: 'BTC/KRW', 'BTC/USDT'
  assetClass: AssetClass;
  price: number;          // 체결가
  changeRate24h?: number; // 24h 등락률(%)
  volume24h?: number;
  sourceTimestamp: number; // 공급처 타임스탬프 (epoch ms)
  ingestTimestamp: number; // 수집 시각 (epoch ms) — 레이턴시 측정용(phase 2)
  sequence?: number;       // 갭 감지용(phase 1)
}
```

**심볼 정규화** — 공급처 원본 심볼은 정규화 단계에서 내부 표준 `BASE/QUOTE`로 변환됩니다.

| 공급처  | 원본 심볼   | 표준 심볼    |
|---------|-------------|--------------|
| Upbit   | `KRW-BTC`   | `BTC/KRW`    |
| Upbit   | `KRW-ETH`   | `ETH/KRW`    |
| Binance | `BTCUSDT`   | `BTC/USDT`   |
| Binance | `ETHUSDT`   | `ETH/USDT`   |

## API

기본 포트: **REST·WS 모두 `4000`**(같은 포트 공유), 웹 대시보드 `3000`.

### REST

| 메서드·경로 | 설명 | 응답 |
|-------------|------|------|
| `GET /health` | 상태 점검 | `{ "status": "ok", "sources": ["upbit", "binance"] }` |
| `GET /v1/symbols` | 활성 심볼 목록(버스에 최신값이 있는 심볼) | `["BTC/KRW", "BTC/USDT", …]` |
| `GET /v1/ticks` | 전체 최신 스냅샷 | `NormalizedTick[]` |
| `GET /v1/ticks/:symbol` | 단일 심볼 스냅샷(없으면 404). 심볼은 URL 인코딩(`BTC/KRW` → `BTC%2FKRW`) | `NormalizedTick` |

```bash
curl http://localhost:4000/health
curl http://localhost:4000/v1/symbols
curl http://localhost:4000/v1/ticks
curl http://localhost:4000/v1/ticks/BTC%2FKRW   # '/'는 %2F로 인코딩
```

### WebSocket

`ws://localhost:4000` 에 접속한 뒤, 구독할 심볼을 담아 `subscribe` 메시지를 보냅니다.
이후 해당 심볼의 틱이 갱신될 때마다 `tick` 이벤트로 `NormalizedTick`이 push 됩니다.
`symbols`를 빈 배열로 보내면 전체 심볼을 구독합니다.

```jsonc
// client → server
{ "event": "subscribe", "data": { "symbols": ["BTC/KRW", "BTC/USDT"] } }

// server → client (틱 갱신 시마다)
{ "event": "tick", "data": { "source": "upbit", "symbol": "BTC/KRW", "price": 92000000, … } }
```

```bash
# wscat 예시 (npm i -g wscat)
wscat -c ws://localhost:4000
> {"event":"subscribe","data":{"symbols":["BTC/KRW","BTC/USDT"]}}
< {"event":"tick","data":{"source":"upbit","symbol":"BTC/KRW","price":92000000,"assetClass":"crypto", …}}
```

## 실행법

```bash
npm install     # 루트에서 1회 — 전체 workspace 설치

npm run dev      # server(4000) + web(3000) 동시 실행
```

- 대시보드: <http://localhost:3000>
- API: <http://localhost:4000>

`npm run dev`가 실행되면 서버가 Upbit·Binance 실 WebSocket에 접속해 시세를 수집하고, 대시보드가 실시간으로 갱신됩니다.

### 개별 스크립트

```bash
npm run build   # 전체 빌드 (packages/shared 먼저)
npm run lint    # 전체 ESLint
npm run test    # 전체 Jest (오프라인 — 외부망 불필요)
```

## 데모

> 아래 GIF는 대시보드 실시간 갱신 데모입니다. (녹화 예정)

![MarketStream 대시보드 데모](docs/demo.gif)

## 확장 로드맵

MVP는 **"간단히 동작하는 최소 구현"**이되, 확장 지점을 인터페이스(seam)로 미리 열어두었습니다.

- **Phase 1 — 운영 견고성**
  - 재접속·지수 백오프, 시퀀스 갭 감지(`NormalizedTick.sequence`)
  - **버스 Redis 교체** — `MarketBus` 인터페이스 그대로, 인메모리 → Redis 구현으로 교체(publisher/subscriber 무수정, 멀티 인스턴스 팬아웃·프로세스 분리 확보)
  - API 키 인증 + rate limit + `@nestjs/swagger` OpenAPI 문서
- **Phase 2 — 관측·성능**
  - Elasticsearch 이력 저장·조회
  - Prometheus/Grafana 메트릭
  - 부하 테스트 p50/p99 레이턴시(`ingestTimestamp` 기반)

각 기술은 **목적이 생기는 phase에 도입**해 MVP 범위와 데모 단순성을 지킵니다. 상세 결정 근거는 [`docs/ADR.md`](docs/ADR.md)를 참고하세요.

## 기술 스택

| 영역 | 스택 |
|------|------|
| 런타임·언어 | Node.js 20+, TypeScript (strict) |
| 모노레포 | npm workspaces (`packages/*`, `apps/*`) |
| 백엔드 | NestJS 10 (단일 앱 `apps/server` — `collector` + `distribution` 모듈) |
| 실시간 | RxJS 기반 인메모리 `MarketBus`, `@nestjs/platform-ws` WebSocket 게이트웨이 |
| 프론트 | Next.js 15 (App Router) — `apps/web` 실시간 대시보드 |
| 공용 패키지 | `@market/shared` — `NormalizedTick` 타입·zod 스키마·심볼 유틸 |
| 검증 | zod(런타임), Jest·supertest·ws 클라이언트(오프라인 결정론적 테스트) |

## 문서

- [`docs/PRD.md`](docs/PRD.md) — 목표·사용자·도메인 프레이밍
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 모노레포 구조·데이터 흐름·계약
- [`docs/ADR.md`](docs/ADR.md) — 핵심 결정과 후속 phase 로드맵
- [`docs/UI_GUIDE.md`](docs/UI_GUIDE.md) — 대시보드 디자인 가이드
