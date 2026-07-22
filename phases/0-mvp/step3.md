# Step 3: upbit-collector

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (데이터 흐름)
- `/docs/ADR.md` (ADR-004 오프라인 테스트, ADR-006)
- `apps/collector/src/collectors/source-connector.ts` — step 2의 `SourceConnector` 인터페이스
- `apps/collector/src/normalizer/upbit.normalizer.ts` — step 2의 `normalizeUpbit`
- `packages/shared/src/` — 심볼 유틸, 타입

## 작업

`apps/collector`에 Upbit WebSocket 커넥터를 구현한다. **핵심 제약: 테스트는 실제 네트워크 없이 통과해야 한다.** 따라서 소켓 생성을 주입 가능하게 만든다.

### 1. 소켓 추상화 (`src/collectors/socket.ts`)
- 최소 인터페이스 정의:
```ts
export interface SocketLike {
  on(event: 'open' | 'message' | 'close' | 'error', cb: (arg?: any) => void): void;
  send(data: string): void;
  close(): void;
}
export type SocketFactory = (url: string) => SocketLike;
```
- 기본 팩토리는 `ws` 패키지의 `WebSocket`을 감싼다. `ws`를 collector의 dependency로 추가하라(^8), `@types/ws`는 devDep.

### 2. UpbitConnector (`src/collectors/upbit.connector.ts`)
- `class UpbitConnector implements SourceConnector`:
  - 생성자: `(markets: string[], socketFactory: SocketFactory)`. `markets`는 Upbit 코드 배열(예: `['KRW-BTC','KRW-ETH']`).
  - `readonly source = 'upbit'`.
  - `connect(onTick)`:
    - `wss://api.upbit.com/websocket/v1`에 팩토리로 소켓 생성.
    - `open` 시 구독 프레임 전송: `JSON.stringify([{ ticket: <uuid/문자열> }, { type: 'ticker', codes: markets }, { format: 'DEFAULT' }])`.
    - `message` 수신 시: Upbit는 Buffer로 보냄 → `JSON.parse(data.toString())` → `normalizeUpbit(parsed)` → 결과가 non-null이면 `onTick(tick)`.
    - `error`/`close`는 로깅만(재접속·백오프는 phase 1, 여기서 넣지 마라).
  - `disconnect()`: 소켓 close.
- 환경변수: 마켓 목록은 `UPBIT_MARKETS`(콤마구분, 기본 `'KRW-BTC,KRW-ETH,KRW-XRP'`)에서 읽는 헬퍼를 두되, 커넥터 자체는 주입받은 `markets`만 사용(테스트 용이성).

### 3. 테스트 (TDD — 실 네트워크 금지)
- 가짜 `SocketLike`를 만들어 `SocketFactory`로 주입한다. `open` 이벤트를 발화시키고, step 2의 fixture 프레임(들)을 `message`로 흘려 넣어라.
- 검증: (a) open 시 올바른 구독 프레임이 `send`되었는지, (b) fixture 메시지 → `onTick`이 기대 `NormalizedTick`으로 호출되는지, (c) 비-ticker 메시지는 `onTick`을 호출하지 않는지.

## Acceptance Criteria

```bash
npm install
npm run lint
npm run build
npm run test
```
모두 exit 0.

## 검증 절차

1. 위 AC 실행.
2. 체크리스트:
   - 커넥터가 `SourceConnector`를 구현하는가?
   - 테스트가 주입식 가짜 소켓만 쓰고 실제 `api.upbit.com`에 접속하지 않는가?
   - 정규화는 step 2의 `normalizeUpbit`을 재사용하는가?
3. `phases/0-mvp/index.json`의 step 3 상태 업데이트. summary에 "UpbitConnector 구현/주입식 소켓 테스트" 등 기록.

## 금지사항

- 재접속/지수 백오프/헬스체크를 구현하지 마라. 이유: phase 1 소관. 지금 넣으면 스코프 초과.
- Redis publish를 여기서 하지 마라. 이유: step 4에서 배선한다.
- 테스트에서 실제 WebSocket 서버에 연결하지 마라. 이유: ADR-004(오프라인 테스트) 위반.
- 기존 테스트를 깨뜨리지 마라.
