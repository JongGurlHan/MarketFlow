# Architecture Decision Records

## 철학
포트폴리오 MVP(마감 4일). 실무 시장 데이터 인프라의 **핵심 난제(이종 소스 정규화, 실시간 팬아웃, 수집·배포 디커플링)**를
작동하는 최소 구현으로 보여주는 것을 최우선한다. 외부 의존성은 목적이 명확한 것만, 필요한 phase에 도입한다.

---

### ADR-001: 백엔드 프레임워크 NestJS (단일 앱)
**결정**: 백엔드를 NestJS 10 단일 앱 `apps/server`로 구현하고, 수집·배포를 내부 모듈로 분리.
**이유**: 프론트가 Next.js(TS)라 전 스택 TypeScript 단일화. NestJS는 REST 컨트롤러 + WebSocket 게이트웨이 + DI + 모듈 구조를 표준 제공해 "대외 API 서비스"를 관용적으로 표현. JD의 "Python 또는 Node.js" 충족.
**트레이드오프**: Python 역량은 드러나지 않음. 경량 서버 대비 보일러플레이트 존재.

### ADR-002: 단일 프로세스 + 모듈 분리 (프로세스 분리는 유보)
**결정**: collector·distribution을 별도 프로세스가 아니라 한 앱 안의 두 모듈로 두고 `MarketBus` 인터페이스로만 연결.
**이유**: 4일 MVP 범위. 프로세스를 나누면 실행·디버그 복잡도가 2배(별도 부트스트랩·compose 필요). 모듈 경계 + 버스 인터페이스로 **분리성은 유지**하되 지금은 한 프로세스로 단순하게 간다.
**트레이드오프**: "독립 배포·스케일"은 아직 미시연. phase 1에서 버스를 Redis로 바꾸면 프로세스 분리가 자연스러워짐.

### ADR-003: 인메모리 MarketBus (Redis는 phase 1)
**결정**: 실시간 팬아웃·스냅샷을 인메모리 `MarketBus`(RxJS Subject + Map)로 구현. Redis는 phase 1에서 동일 인터페이스로 교체.
**이유**: 외부 의존성 0 → `npm run dev` 한 번으로 즉시 실행·데모. Docker 불필요. 인터페이스를 고정해 Redis 전환 시 publisher/subscriber 무수정.
**트레이드오프**: 멀티 인스턴스 팬아웃·프로세스 재시작 안전성은 아직 없음(단일 프로세스라 무방). phase 1에서 확보.

### ADR-004: 오프라인 테스트 (주입식 소켓 목 + 녹화 fixture)
**결정**: 외부 WebSocket은 소켓 팩토리 주입으로 대체하고, 녹화된 raw 메시지 fixture로 매핑·파이프라인을 검증.
**이유**: execute.py의 AC와 CI가 외부망 없이 통과해야 함(자율 실행 안정성). 결정론적 테스트. 인메모리 버스라 Redis 목도 불필요.
**트레이드오프**: 실 연동 검증은 테스트가 아니라 `npm run dev` 수동 스모크로 분리.

### ADR-005: 소스 2개(Upbit + Binance)를 MVP부터
**결정**: phase 0부터 Upbit·Binance 두 공급처를 넣는다. 공급처는 `SourceConnector` 구현으로만 추가.
**이유**: "이종 소스 정규화"가 이 포트폴리오의 핵심 어필인데, 단일 소스로는 어필이 '주장'에 그친다. 두 거래소의 다른 포맷(예: Upbit `KRW-BTC` 스냅샷형 vs Binance `BTCUSDT` 스트림형)을 하나로 통일해 **실제로 시연**. 소스-무관 인터페이스라 두 번째 소스 비용은 커넥터+매퍼 하나.
**트레이드오프**: 초기 추상화·매퍼 작업 약간 증가. 공급처별 특수 필드는 표준 스키마 optional로 흡수.

### ADR-006: phase별 확장
**결정**: phase 0은 위 범위. phase 1: 재접속·지수 백오프, 시퀀스 갭 감지, **버스 Redis 교체**, API 키+rate limit+`@nestjs/swagger`. phase 2: Elasticsearch 이력·조회, Prometheus/Grafana, 부하 테스트 p50/p99.
**이유**: 각 기술을 목적이 생길 때 도입해 résumé-driven 남용을 피하고 MVP 범위를 지킴.
**트레이드오프**: 자격요건의 Redis/MySQL/Elasticsearch는 phase 0 완료 시점엔 일부 미노출(후속 phase에서 충족).
