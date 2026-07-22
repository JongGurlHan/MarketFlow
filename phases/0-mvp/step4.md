# Step 4: web-dashboard

## 읽어야 할 파일

- `docs/UI_GUIDE.md` — 색상·타이포·컴포넌트·애니메이션 규칙(반드시 준수)
- `docs/ARCHITECTURE.md` — web 데이터 흐름(최초 REST 스냅샷 → WS 실시간)
- `packages/shared/src/` — `NormalizedTick` 타입(그대로 import)
- `apps/server/src/distribution/` — REST 엔드포인트·WS 메시지 규약(step 3 summary 참조)
- `apps/web/` 전체 — step 0의 Next 뼈대

## 작업

`apps/web`에 실시간 시세 대시보드를 구현한다. 최초 REST 스냅샷을 로드하고 WebSocket 구독으로 실시간 갱신한다. **UI_GUIDE.md를 엄격히 준수**한다(금융 단말 미학, AI 슬롭 안티패턴 금지).

### 1. 설정
- `src/lib/config.ts`: `API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'`, `WS_URL`은 API_URL을 ws로 변환.
- 구독 대상 심볼: shared의 레지스트리(`UPBIT_MARKETS`, `BINANCE_MARKETS`)에서 표준 심볼 목록을 만든다.

### 2. `src/lib/useMarketStream.ts` (client hook)
- 최초: `GET /v1/ticks`로 스냅샷 로드 → 상태 초기화.
- WS: `WS_URL` 접속, open 시 `{ event: 'subscribe', data: { symbols } }` 전송. `{ event: 'tick' }` 수신 시 해당 심볼 상태 갱신.
- 연결 상태(`connecting|open|closed`)를 반환. 언마운트 시 소켓 정리.
- 반환: `{ ticks: Record<string, NormalizedTick>, status }`.

### 3. 컴포넌트
- `src/components/TickTable.tsx` (핵심, `'use client'`): props `ticks: NormalizedTick[]`. 열 = 심볼 · 현재가 · 24h 변동률 · 소스 · 최종 갱신. 숫자는 `font-mono tabular-nums` 우측 정렬. 변동률 부호에 따라 상승 초록(`#22c55e`)/하락 빨강(`#ef4444`). 가격 갱신 시 셀을 150ms 플래시 후 원복(그 외 애니메이션 금지). **순수 컴포넌트로 작성**(props만으로 렌더)해 테스트가 쉽도록.
- `src/components/SourceStatus.tsx`: 소스별/연결 상태를 작은 원형 점(초록/노랑/빨강) + 레이블로. 글로우·펄스 금지.
- `src/app/page.tsx`: `useMarketStream` 사용, 상단에 제목 + `SourceStatus`, 본문에 `TickTable`. `max-w-6xl` 좌측 정렬.

### 4. 테스트
- `TickTable`에 대한 React Testing Library 렌더 테스트: 샘플 `NormalizedTick[]` props로 렌더 → 심볼 문자열과 가격이 문서에 나타나는지, 상승/하락 색 클래스가 적용되는지 검증.
- jest 환경은 `jest-environment-jsdom`. Next 컴포넌트 테스트용 jest 설정을 추가한다(step 0에서 `--passWithNoTests`였다면 실제 테스트로 대체).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

`next build`가 통과하고 `TickTable` 렌더 테스트가 통과해야 한다. (전체 루트에서도 `npm run build && npm run test` green)

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. UI_GUIDE 체크리스트:
   - 금지된 AI 슬롭 패턴(blur/glass, gradient-text, 보라색 브랜드, gradient orb, 글로우 애니메이션)이 없는가?
   - 숫자가 모노스페이스·우측정렬, 상승/하락 색이 적용됐는가?
   - 허용된 애니메이션(가격 플래시 150ms) 외에 애니메이션이 없는가?
3. `phases/0-mvp/index.json`의 step 4를 업데이트:
   - 성공 → `"completed"` + `"summary"`(대시보드 컴포넌트·훅 구조, 사용한 엔드포인트 요약).
   - 실패 → `"error"` + `"error_message"`.

## 금지사항

- `docs/UI_GUIDE.md`의 "AI 슬롭 안티패턴"을 위반하지 마라. 이유: 포트폴리오 심사자가 가장 먼저 감점하는 지점.
- 테스트를 실 백엔드/외부망에 의존시키지 마라. 이유: 오프라인 AC 위반. `TickTable`은 props만으로 테스트한다.
- 서버가 안 떠 있어도 `next build`가 실패하지 않게 하라(빌드 타임에 백엔드 fetch 금지 — 데이터는 client에서 로드).
- 기존 테스트를 깨뜨리지 마라.
