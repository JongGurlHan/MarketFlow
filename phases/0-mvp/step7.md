# Step 7: web-dashboard

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/UI_GUIDE.md` — **반드시 준수**(다크 금융 단말, 안티-슬롭 규칙, 색상/타이포)
- `/docs/ARCHITECTURE.md` (web의 데이터 흐름, wire 심볼)
- `packages/shared/src/` — `NormalizedTick`, `toWireSymbol`/`fromWireSymbol`
- `apps/api/src/market/market.controller.ts` (REST 계약), `apps/api/src/market/market.gateway.ts` (WS 프로토콜) — step 5/6

## 작업

`apps/web`(Next.js 15 App Router + TypeScript + Tailwind)를 새로 스캐폴드하고 실시간 시세 대시보드를 만든다. 이 워크스페이스는 이번 step에서 처음 생성된다.

### 1. 스캐폴드
- `apps/web`에 Next.js 15(App Router), TypeScript, Tailwind CSS 구성.
- `next.config`에 `transpilePackages: ['@market/shared']` 설정(shared 타입/유틸 소비).
- package scripts: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start"`, `"lint": "next lint"`, `"test": "jest --passWithNoTests"`.
- 외부 CDN·구글 폰트·원격 이미지 금지(자급식). 색상/폰트는 UI_GUIDE 값 사용.

### 2. 대시보드 (`src/app/page.tsx` + 컴포넌트)
- 클라이언트 컴포넌트에서:
  - 최초 로드: `GET {API}/v1/symbols`로 심볼 목록, 각 심볼 `GET {API}/v1/ticks/{wire}`로 스냅샷 로드. `API`는 `NEXT_PUBLIC_API_URL`(기본 `http://localhost:3002`).
  - WebSocket: `ws://` (API host)`/stream` 접속 → `{action:'subscribe', symbols:[...wire]}` 전송 → `{type:'tick', data}` 수신 시 해당 심볼 행 갱신.
- **시세 테이블**: 열 = 심볼 · 현재가 · 24h 변동률 · 소스 · 최종 갱신. 숫자는 `font-mono tabular-nums` 우측 정렬. 상승/하락은 UI_GUIDE 색상. 가격 변경 시 150ms 플래시(그 외 애니메이션 금지).
- **소스/연결 상태 인디케이터**: WebSocket 연결 상태(연결/재연결/끊김)를 색 점 + 레이블로. 글로우·펄스 금지.

### 3. 테스트
- 최소 1개 통과 테스트: 시세 테이블 컴포넌트에 mock `NormalizedTick[]`를 주입해 렌더되는지(React Testing Library) 검증. jest 설정이 어려우면 `--passWithNoTests`로 두되, 가능하면 렌더 테스트를 넣어라.

### 4. 루트 배선
- 루트 `package.json`의 `dev` 스크립트에 web을 추가(concurrently에 `npm run dev -w apps/web`). 루트 `lint/build/test`는 workspaces로 자동 포함되므로 `next build`가 green이어야 한다.

## Acceptance Criteria

```bash
npm install
npm run lint
npm run build
npm run test
```
모두 exit 0. `next build`가 네트워크 없이 통과해야 한다(데이터 페치는 런타임 클라이언트에서만).

## 검증 절차

1. 위 AC 실행.
2. 체크리스트:
   - UI_GUIDE의 안티-슬롭 규칙(glassmorphism/gradient-text/보라색/글로우 금지)을 지키는가?
   - 숫자 모노스페이스·상승/하락 색·다크 단말 톤을 따르는가?
   - 데이터 페치가 빌드타임이 아니라 런타임 클라이언트에서 일어나는가?
   - wire 심볼(`BTC-KRW`)로 REST/WS와 통신하는가?
3. `phases/0-mvp/index.json`의 step 7 상태 업데이트.

## 금지사항

- 서버 컴포넌트에서 빌드타임에 외부 API를 페치하지 마라. 이유: 빌드가 네트워크에 의존해 실패한다.
- 외부 CDN/폰트/이미지를 불러오지 마라. 이유: 자급식 요건 + AI 슬롭 방지.
- UI_GUIDE 금지 패턴(보라색, gradient-text, backdrop-blur, 글로우 애니메이션)을 쓰지 마라.
- 기존 백엔드 테스트를 깨뜨리지 마라.
