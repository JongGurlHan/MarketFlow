# Architecture Decision Records

## 철학
포트폴리오 MVP. 실무 시장 데이터 인프라의 **핵심 난제(이종 소스 정규화, 저지연 팬아웃, 수집·배포 디커플링)**를
작동하는 최소 구현으로 보여주는 것을 최우선한다. 외부 의존성은 목적이 명확한 것만 도입한다.

---

### ADR-001: 백엔드 프레임워크 NestJS
**결정**: collector·api 두 백엔드 서비스를 NestJS 10으로 구현.
**이유**: 프론트가 Next.js(TS)라 전 스택 TypeScript 단일화. NestJS는 REST 컨트롤러 + WebSocket 게이트웨이 + DI + 모듈 구조를 표준 제공해 "대외 API 서비스"를 관용적으로 표현. JD의 "Python 또는 Node.js" 충족.
**트레이드오프**: Python 역량은 드러나지 않음. 순수 경량 서버 대비 보일러플레이트 존재.

### ADR-002: 수집(collector)과 배포(api) 서비스 분리
**결정**: 하나의 프로세스가 아니라 별도 Nest 앱 2개로 나누고 Redis로만 연결.
**이유**: 수집과 팬아웃을 독립 배포·스케일. JD의 "수집·가공·배포 시스템 및 대외 고객사 API 서비스" 이중 구조를 그대로 반영. 장애 격리(수집 장애가 배포를 죽이지 않음).
**트레이드오프**: 로컬 실행 복잡도↑(compose 필요), 프로세스 간 계약을 Redis 스키마로 관리해야 함.

### ADR-003: Redis pub/sub 팬아웃 + 해시 스냅샷
**결정**: 실시간 스트림은 `market:ticks:{symbol}` pub/sub, 최신값은 `market:latest` 해시.
**이유**: 다수 구독자에게 저지연 팬아웃 + REST 스냅샷 조회를 단순하게 충족. 자격요건의 Redis 활용을 핵심 경로에 배치.
**트레이드오프**: pub/sub는 at-most-once(구독 전 메시지 유실). 이력 보존은 phase 2 Elasticsearch로 분리.

### ADR-004: 오프라인 테스트 (주입식 목 + ioredis-mock)
**결정**: 외부 WebSocket은 소켓 팩토리 주입으로, Redis는 `ioredis-mock`으로 대체해 테스트.
**이유**: execute.py의 AC와 CI가 외부망·실 Redis 없이 통과해야 함(자율 실행 안정성). 결정론적 테스트.
**트레이드오프**: 실 연동 검증은 테스트가 아니라 `docker compose up` 수동 스모크로 분리.

### ADR-005: phase별 데이터스토어 확장
**결정**: phase 0은 Redis만. Elasticsearch(이력·검색)와 선택적 MySQL(API키·메타데이터)은 phase 2.
**이유**: MVP 스코프 최소화. 각 스토어를 목적이 생길 때 도입해 résumé-driven 남용을 피함.
**트레이드오프**: 자격요건의 MySQL/Elasticsearch는 phase 0 완료 시점엔 미노출(phase 2에서 충족).

### ADR-006: 소스-무관 SourceConnector 인터페이스
**결정**: 공급처는 `SourceConnector`(연결·구독·정규화 스트림) 구현으로만 추가. 파이프라인 코어에 공급처 분기 금지.
**이유**: phase 1 Binance 추가를 커넥터 1개 작성으로 끝내기 위함. "이종 소스 통합"이 이 포트폴리오의 핵심 어필.
**트레이드오프**: 초기 추상화 비용. 공급처별 특수 필드는 표준 스키마의 optional로 흡수.
