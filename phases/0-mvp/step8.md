# Step 8: compose-and-readme

## 읽어야 할 파일

- `/CLAUDE.md`, `/docs/PRD.md`(도메인 프레이밍), `/docs/ARCHITECTURE.md`, `/docs/ADR.md`
- `apps/collector/`, `apps/api/`, `apps/web/` — 각 앱의 실행 스크립트·포트·env 확인
- 각 앱이 읽는 환경변수: `REDIS_URL`, `UPBIT_MARKETS`, `PORT`, `NEXT_PUBLIC_API_URL`

## 작업

전체 스택을 Docker로 묶고, 루트 README로 포트폴리오 서사를 완성한다.

### 1. Dockerfile (앱별)
- `apps/collector/Dockerfile`, `apps/api/Dockerfile`, `apps/web/Dockerfile` — `node:20-alpine` 기반 멀티스테이지(builder에서 `npm install` + `npm run build -w <app>` 및 의존 `@market/shared` 빌드, runner에서 `dist` 실행). 모노레포이므로 빌드 컨텍스트는 저장소 루트로 두고 필요한 워크스페이스만 복사.
- collector/api runner: `node dist/main`. web runner: `next start`.

### 2. docker-compose (`infra/docker-compose.yml`)
- 서비스:
  - `redis`: `redis:7-alpine`, 포트 6379.
  - `collector`: build `apps/collector`, env `REDIS_URL=redis://redis:6379`, `UPBIT_MARKETS=KRW-BTC,KRW-ETH,KRW-XRP`, `depends_on: [redis]`.
  - `api`: build `apps/api`, env `REDIS_URL=redis://redis:6379`, `PORT=3002`, 포트 `3002:3002`, `depends_on: [redis]`.
  - `web`: build `apps/web`, env `NEXT_PUBLIC_API_URL=http://localhost:3002`, 포트 `3000:3000`, `depends_on: [api]`.
- 헬스체크(가능하면 collector/api의 `/health` 활용).

### 3. 헬스체크 스크립트 (`scripts/healthcheck.sh`)
- `api`(3002)와 `collector`(3001)의 `/health`를 `curl`로 확인, 하나라도 실패면 non-zero 종료. 셸 스크립트 사용 요건 충족용.

### 4. 루트 README.md
다음 섹션을 포함:
- **개요**: 무엇을 하는 시스템인지(수집→정규화→배포 시장 데이터 플랫폼). "가상자산 거래 서비스가 아님" 명시.
- **도메인 프레이밍**: PRD.md의 "왜 크립토냐"를 요약(자산군 무관하게 실시간 틱 수집·정규화·배포의 난제는 동일, 공개 실시간 피드라 Upbit 선택, `assetClass`로 확장 대비).
- **아키텍처 다이어그램**: ARCHITECTURE.md의 데이터 흐름을 ASCII로.
- **정규화 설명**: 공급처 raw → `NormalizedTick` 표준 스키마 변환. 스키마 표.
- **실행법**: `docker compose -f infra/docker-compose.yml up --build` → 대시보드 `http://localhost:3000`, API `http://localhost:3002`.
- **API**: REST 엔드포인트 표(`/v1/symbols`, `/v1/ticks/:symbol`, `/health`)와 WS 프로토콜(`/stream` subscribe/tick 메시지).
- **기술 스택**: NestJS, Next.js, Redis, TypeScript, Docker.
- **로드맵**: phase 1(다중 소스 Binance·재접속·API키·OpenAPI), phase 2(Elasticsearch 이력·Prometheus/Grafana·부하테스트 지표).

## Acceptance Criteria

```bash
npm install
npm run lint
npm run build
npm run test
```
모두 exit 0. (Docker 이미지 빌드·`docker compose up`은 이 환경에서 실행하지 않는다 — 런타임 수동 검증. AC는 저장소 green 유지만 확인한다.)

추가 확인(파일 존재/문법, docker 미설치 시 생략 가능):
```bash
test -f infra/docker-compose.yml && test -f README.md && test -f scripts/healthcheck.sh
```

## 검증 절차

1. 위 AC 실행 — 저장소가 여전히 green인지 확인.
2. 체크리스트:
   - compose가 redis+collector+api+web 4개 서비스를 올바른 env/포트/`depends_on`으로 정의하는가?
   - README가 도메인 프레이밍·아키텍처·정규화·실행법·API를 모두 담는가?
   - Dockerfile이 모노레포 빌드(shared 포함)를 처리하는가?
3. `phases/0-mvp/index.json`의 step 8 상태 업데이트. summary에 "compose/Dockerfile/README/헬스스크립트 완성" 기록.

## 금지사항

- AC에서 `docker compose up`이나 이미지 빌드를 강제하지 마라. 이유: 실행 환경에 Docker가 없을 수 있어 불필요하게 error/blocked가 된다. 런타임 검증은 수동.
- 앱 코드(수집/배포/UI) 로직을 바꾸지 마라. 이유: 이 step은 인프라·문서 전용. 로직 변경이 필요하면 그 자체가 이전 step 결함이므로 최소 수정만.
- 기존 테스트를 깨뜨리지 마라.
