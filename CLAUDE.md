# 프로젝트: MarketStream — 실시간 시장 데이터 플랫폼

여러 이종 공급처(Upbit·Binance)의 실시간 시세를 하나의 표준 스키마(`NormalizedTick`)로 정규화하고,
인메모리 버스로 팬아웃하여 REST/WebSocket으로 배포하는 시장 데이터 플랫폼. **가상자산 거래·투자 서비스가 아니다.**
핵심은 "수집 → 가공(정규화) → 배포" 파이프라인의 안정성·확장성이다.

## 기술 스택
- **런타임**: Node.js 20+, TypeScript strict mode
- **모노레포**: npm workspaces (`packages/*`, `apps/*`) — 빌드 순서상 `packages/shared`가 먼저
- **백엔드**: NestJS 10 — 단일 앱 `apps/server`. 내부 모듈 `collector`(수집·가공) + `distribution`(REST·WS 배포)
- **프론트**: Next.js 15 App Router — `apps/web`(실시간 대시보드)
- **버스**: 인메모리 `MarketBus`(RxJS Subject + 최신값 Map). Redis 아님 — phase 1에서 동일 인터페이스로 교체
- **테스트**: Jest, supertest, ws 클라이언트. 외부 소켓은 주입식 팩토리 목 + 녹화 fixture로 대체
- **공용 패키지**: `@market/shared` — NormalizedTick 타입·zod 스키마·심볼 유틸

## 아키텍처 규칙
- CRITICAL: **모든 외부 공급처 데이터는 반드시 `@market/shared`의 `NormalizedTick`으로 정규화한 뒤에만 버스로 흐른다.** raw 포맷(거래소 원본 JSON)을 distribution·web으로 흘리지 마라. 이유: 표준 스키마 통합이 이 플랫폼의 존재 이유다.
- CRITICAL: **새 공급처는 `SourceConnector` 인터페이스 구현으로만 추가한다.** 파이프라인 코어에 `if (source === 'upbit')` 같은 공급처 분기를 넣지 마라. 이유: 소스 추가를 커넥터 1개 작성으로 끝내기 위함(이종 소스 통합이 핵심 어필).
- CRITICAL: **collector와 distribution은 `MarketBus` 인터페이스를 통해서만 통신한다.** distribution이 collector 내부(커넥터·normalizer)를 직접 import 하지 마라. `MarketBus`는 인터페이스다 — 지금은 인메모리 구현, 나중에 Redis 구현으로 교체해도 publisher/subscriber는 무수정이어야 한다. 이유: 프로세스 분리·Redis 전환을 위한 디커플링.
- CRITICAL: **테스트는 외부망·실 소켓 없이 통과해야 한다.** 외부 WebSocket은 주입식(팩토리) 목으로 대체하고, 녹화된 raw 메시지 fixture로 검증하라. 실 네트워크에 의존하는 테스트를 작성하지 마라. 이유: execute.py의 AC가 오프라인에서 돌아야 한다.
- 도메인 코드는 모듈로 분리한다: 커넥터 `collector/connectors/`, 정규화 `collector/normalizer/`, 버스 `collector/bus/`, 배포 `distribution/`(컨트롤러·게이트웨이).

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:, chore:)
- 각 step 종료 시 저장소는 반드시 green이어야 한다 — 루트에서 `npm run lint && npm run build && npm run test`가 모두 통과해야 한다.

## 명령어
```
npm install                 # 루트에서 1회 — 전체 workspace 설치
npm run dev                 # server + web 동시 실행 (concurrently)
npm run build               # 전체 빌드 (packages/shared 먼저)
npm run lint                # 전체 ESLint
npm run test                # 전체 Jest
python scripts/execute.py 0-mvp   # Harness 순차 실행
```
