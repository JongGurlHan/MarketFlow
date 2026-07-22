# 프로젝트: MarketStream — 실시간 시장 데이터 플랫폼

여러 이종 공급처(현재 Upbit)의 실시간 시세를 하나의 표준 스키마로 정규화하고, Redis로 처리한 뒤
REST/WebSocket으로 배포하는 시장 데이터 플랫폼. **가상자산 거래·투자 서비스가 아니다.** 핵심은
"수집 → 가공(정규화) → 배포" 파이프라인의 안정성·확장성이다.

## 기술 스택
- **런타임**: Node.js 20 LTS, TypeScript strict mode
- **모노레포**: npm workspaces (`apps/*`, `packages/*`)
- **백엔드**: NestJS 10 — `apps/collector`(수집·가공), `apps/api`(배포)
- **프론트**: Next.js 15 App Router — `apps/web`(실시간 대시보드)
- **데이터스토어**: Redis (ioredis). 테스트는 `ioredis-mock`
- **테스트**: Jest(`--passWithNoTests`), supertest, ws 클라이언트
- **공용 패키지**: `@market/shared` — NormalizedTick 타입·스키마·심볼 유틸

## 아키텍처 규칙
- CRITICAL: **수집(collector)과 배포(api)는 Redis를 통해서만 통신한다.** collector가 api를, api가 collector를 직접 import 하지 마라. 이유: 두 서비스를 독립 배포·스케일하기 위한 디커플링이 이 프로젝트의 핵심 설계다.
- CRITICAL: **모든 외부 공급처 데이터는 반드시 `@market/shared`의 `NormalizedTick`으로 정규화한 뒤에만 버스/Redis로 흐른다.** raw 포맷(거래소 원본 JSON)을 api·web으로 흘리지 마라. 이유: 표준 스키마 통합이 이 플랫폼의 존재 이유다.
- CRITICAL: **새 공급처는 `SourceConnector` 인터페이스 구현으로만 추가한다.** 파이프라인 코어에 `if (source === 'upbit')` 같은 공급처 분기를 넣지 마라. 이유: phase 1에서 Binance를 최소 비용으로 추가하기 위함.
- CRITICAL: **테스트는 외부망·실 Redis 없이 통과해야 한다.** 외부 WebSocket/HTTP는 주입식(팩토리) 목으로, Redis는 `ioredis-mock`으로 대체하라. 실 네트워크에 의존하는 테스트를 작성하지 마라. 이유: execute.py의 AC와 CI가 오프라인에서 돌아야 한다.
- 도메인 코드는 서비스/모듈 단위로 분리한다. 커넥터는 `collectors/`, 정규화는 `normalizer/`, 버스는 `bus/`, 배포는 컨트롤러/게이트웨이에.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)
- 각 step 종료 시 저장소는 반드시 green이어야 한다 — 루트에서 `npm run lint && npm run build && npm run test`가 모두 통과해야 한다.

## 명령어
```
npm install                 # 루트에서 1회 — 전체 workspace 설치
npm run dev                 # 전체 개발 서버 (workspaces)
npm run build               # 전체 빌드 (packages/shared 먼저)
npm run lint                # 전체 ESLint
npm run test                # 전체 Jest (--passWithNoTests)
python scripts/execute.py 0-mvp   # Harness 순차 실행
```
