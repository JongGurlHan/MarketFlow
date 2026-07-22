# Step 6: readme-and-demo

## 읽어야 할 파일

- `docs/PRD.md` — 도메인 프레이밍("왜 크립토냐"), 목표·사용자
- `docs/ARCHITECTURE.md` — 모노레포 구조·데이터 흐름·스키마
- `docs/ADR.md` — 핵심 결정·후속 phase 로드맵
- `apps/server/`, `apps/web/`, `packages/shared/` — 실제 구현된 스크립트·엔드포인트·포트를 확인해 README와 일치시킨다

## 작업

루트 `README.md`를 작성한다. 이것은 **포트폴리오의 첫인상**이다 — 금융정보 벤더 심사자가 도메인 이해도와 아키텍처 설계 능력을 읽는 문서다. 코드가 아니라 README에 집중하는 step이다(문서 중심).

### `README.md` 필수 섹션
1. **한 줄 소개 + 도메인 프레이밍**: MarketStream이 무엇이고, 금융정보 벤더의 "실시간 수집→가공→배포" 본업을 어떻게 재현하는지. `docs/PRD.md`의 "왜 크립토냐"를 심사자용으로 다듬어 서술(자산군은 달라도 엔지니어링 구조는 동일).
2. **아키텍처 다이어그램**(ASCII): `docs/ARCHITECTURE.md`의 데이터 흐름(Upbit·Binance WS → 커넥터 → 정규화 → MarketBus → REST/WS → 대시보드)을 그린다.
3. **핵심 설계 포인트**: ① 이종 소스 정규화(`NormalizedTick`·`SourceConnector`), ② 수집·배포 디커플링(`MarketBus` 인터페이스 — 지금 인메모리, 나중 Redis), ③ 오프라인 결정론적 테스트. 각각 "왜 이렇게 했는가"를 1–2줄로.
4. **표준 스키마**: `NormalizedTick` 코드 블록 + 심볼 정규화 예(`KRW-BTC`→`BTC/KRW`, `BTCUSDT`→`BTC/USDT`).
5. **API**: `GET /v1/symbols`, `GET /v1/ticks`, `GET /v1/ticks/:symbol`, WS 구독 메시지 규약. `curl`·`wscat` 예시 포함.
6. **실행법**: `npm install` → `npm run dev` → 대시보드 `http://localhost:3000`, API `http://localhost:4000`. 개별 스크립트(build/test/lint)도.
7. **확장 로드맵**: phase 1(재접속·백오프, 시퀀스 갭, **버스 Redis 교체**, API 키+rate limit+Swagger), phase 2(Elasticsearch 이력, Prometheus/Grafana, 부하 테스트 p50/p99). "간단히 → 확장 가능"을 코드 seam(인터페이스)으로 어떻게 준비했는지 명시.
8. **기술 스택** 요약.

### 데모 자리표시
- README에 "데모" 섹션과 GIF 삽입 자리(`docs/demo.gif`)를 마련한다(파일은 사용자가 나중에 녹화). 실제 바이너리 GIF를 생성하려 하지 마라.

## Acceptance Criteria

```bash
npm run build
npm run test
test -f README.md
grep -q "NormalizedTick" README.md
grep -q "/v1/ticks" README.md
```

루트 build/test가 여전히 green이고, README.md가 존재하며 핵심 섹션(스키마·API)을 포함해야 한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - README의 엔드포인트·포트·스크립트가 실제 구현(`apps/server`, 루트 `package.json`)과 일치하는가?
   - 도메인 프레이밍이 "가상자산 거래 서비스"가 아니라 "시장 데이터 플랫폼"으로 서술됐는가?
3. `phases/0-mvp/index.json`의 step 6을 업데이트:
   - 성공 → `"completed"` + `"summary"`(README 완성·phase 0 종료).
   - 실패 → `"error"` + `"error_message"`.

## 금지사항

- 실제 GIF 바이너리를 생성/커밋하려 하지 마라. 이유: 녹화는 사용자 몫. 삽입 자리(경로)만 마련한다.
- 구현과 다른 엔드포인트·포트·명령어를 README에 적지 마라. 이유: 거짓 문서는 심사에서 치명적. 실제 코드를 확인하고 쓴다.
- 코드(서버·웹) 동작을 이 step에서 바꾸지 마라. 이유: 문서 step. 기존 green을 유지한다.
- 기존 테스트를 깨뜨리지 마라.
