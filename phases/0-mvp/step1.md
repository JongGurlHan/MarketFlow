# Step 1: shared-schema

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (특히 "표준 스키마", "Redis 키 규칙", 심볼 규칙)
- `/docs/ADR.md` (ADR-006 소스-무관 인터페이스)
- `packages/shared/` — step 0에서 만든 `@market/shared` 뼈대(`src/index.ts`, `tsconfig.json`, jest 설정)

step 0에서 만든 패키지 구조와 스크립트를 확인한 뒤 작업하라.

## 작업

`packages/shared`에 표준 시세 스키마와 심볼 유틸을 구현한다. **이 패키지는 순수(pure)해야 한다** — 외부 I/O, Redis, 네트워크 의존 금지. BE·FE 양쪽에서 import된다.

### 1. 타입/스키마 (`src/tick.ts`)
```ts
export type Source = 'upbit' | 'binance';   // 'binance'는 phase 1에서 사용
export type AssetClass = 'crypto';

export interface NormalizedTick {
  source: Source;
  symbol: string;            // 내부 표준: 'BASE/QUOTE' 대문자. 예: 'BTC/KRW'
  assetClass: AssetClass;
  price: number;
  bid?: number;
  ask?: number;
  volume24h?: number;
  changeRate24h?: number;
  sourceTimestamp: number;   // epoch ms
  ingestTimestamp: number;   // epoch ms
  sequence?: number;
}
```
- zod로 `normalizedTickSchema`를 정의하고, `parseNormalizedTick(input: unknown): NormalizedTick`(검증 실패 시 throw)와 `isNormalizedTick(input): boolean`를 제공하라.
- `price`, `sourceTimestamp`, `ingestTimestamp`는 필수/양수 검증. `symbol`은 `^[A-Z0-9]+/[A-Z0-9]+$` 패턴 검증.
- `zod`를 `packages/shared`의 dependency로 추가하라(^3).

### 2. 심볼 유틸 (`src/symbol.ts`)
- `upbitMarketToSymbol(code: string): string` — `'KRW-BTC'` → `'BTC/KRW'` (Upbit는 `QUOTE-BASE`, 내부는 `BASE/QUOTE`).
- `symbolToUpbitMarket(symbol: string): string` — 역변환.
- `toWireSymbol(symbol: string): string` — `'BTC/KRW'` → `'BTC-KRW'` (REST/WS 경로·프로토콜에서 쓰는 표기; `/`는 URL에서 문제되므로 `-` 사용).
- `fromWireSymbol(wire: string): string` — `'BTC-KRW'` → `'BTC/KRW'`.

### 3. export
- `src/index.ts`에서 위 타입·스키마·유틸을 모두 re-export하라. step 0의 `SHARED_PLACEHOLDER`는 제거해도 된다.

### 4. 테스트 (TDD — 먼저 작성)
- 스키마: 유효한 tick 통과, 필수 필드 누락/음수 price/잘못된 symbol 형식은 throw.
- 심볼 유틸: 4개 함수의 왕복(round-trip) 변환 검증.

## Acceptance Criteria

```bash
npm install
npm run lint
npm run build
npm run test
```
모두 exit 0. `packages/shared`의 테스트가 실제로 실행되어 통과해야 한다.

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - `NormalizedTick` 필드가 ARCHITECTURE.md 정의와 정확히 일치하는가?
   - 심볼 내부 표준(`BASE/QUOTE`)과 wire 표기(`BASE-QUOTE`) 규칙을 지키는가?
   - 패키지가 순수한가(외부 I/O 없음)?
3. `phases/0-mvp/index.json`의 step 1 상태를 업데이트한다(step 0과 동일 규칙).

## 금지사항

- 정규화 매퍼(공급처 raw → tick)를 여기서 구현하지 마라. 이유: step 2의 collector 소관. 여기서는 스키마·유틸만.
- Redis/네트워크/Nest 의존을 추가하지 마라. 이유: shared는 web에서도 번들되므로 순수해야 한다.
- 기존 테스트를 깨뜨리지 마라.
