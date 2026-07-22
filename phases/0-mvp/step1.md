# Step 1: shared-schema

## 읽어야 할 파일

- `docs/ARCHITECTURE.md` — "표준 스키마" 섹션(NormalizedTick 필드·심볼 규칙)
- `CLAUDE.md` — NormalizedTick 정규화 규칙
- `packages/shared/src/index.ts` (step 0에서 만든 뼈대)

이전 step에서 만들어진 코드를 읽고 일관성을 유지하라.

## 작업

`packages/shared`에 표준 스키마와 심볼 유틸을 구현한다. 이것은 BE·FE 공용 타입의 단일 출처(single source of truth)다.

### 1. `src/types.ts`
`docs/ARCHITECTURE.md`의 정의를 그대로 구현한다:
```ts
export type Source = 'upbit' | 'binance';
export type AssetClass = 'crypto';

export interface NormalizedTick {
  source: Source;
  symbol: string;            // 내부 표준: BASE/QUOTE 대문자. 예: 'BTC/KRW'
  assetClass: AssetClass;
  price: number;
  changeRate24h?: number;
  volume24h?: number;
  sourceTimestamp: number;   // epoch ms
  ingestTimestamp: number;   // epoch ms
  sequence?: number;
}
```

### 2. `src/schema.ts` (zod)
- `NormalizedTickSchema`: 위 인터페이스와 1:1 대응하는 zod 스키마. `price`·`sourceTimestamp`·`ingestTimestamp`는 필수 유한수, optional 필드는 `.optional()`.
- 헬퍼: `export function parseTick(input: unknown): NormalizedTick` — 검증 실패 시 throw. `export function isValidTick(input: unknown): boolean`.
- 타입-스키마 일치 보장: `z.infer<typeof NormalizedTickSchema>`가 `NormalizedTick`과 호환되게 작성.

### 3. `src/symbols.ts` (심볼 유틸)
- `export function toStandardSymbol(base: string, quote: string): string` → `` `${base.toUpperCase()}/${quote.toUpperCase()}` ``.
- `export function splitSymbol(symbol: string): { base: string; quote: string }`.
- MVP 대상 심볼 레지스트리(공급처 원본 → 표준 매핑). 커넥터가 구독 목록으로 사용한다:
```ts
export const UPBIT_MARKETS = [
  { raw: 'KRW-BTC', symbol: 'BTC/KRW' },
  { raw: 'KRW-ETH', symbol: 'ETH/KRW' },
  { raw: 'KRW-XRP', symbol: 'XRP/KRW' },
  { raw: 'KRW-SOL', symbol: 'SOL/KRW' },
];
export const BINANCE_MARKETS = [
  { raw: 'BTCUSDT', symbol: 'BTC/USDT' },
  { raw: 'ETHUSDT', symbol: 'ETH/USDT' },
  { raw: 'XRPUSDT', symbol: 'XRP/USDT' },
  { raw: 'SOLUSDT', symbol: 'SOL/USDT' },
];
```

### 4. `src/index.ts`
- `types.ts`, `schema.ts`, `symbols.ts`를 전부 re-export. 임시 `SHARED_READY`는 제거.

### 5. 테스트 (`src/*.spec.ts`)
- 스키마: 유효한 tick 통과, 필수 필드 누락/타입 오류 시 `parseTick` throw.
- 심볼: `toStandardSymbol('btc','krw') === 'BTC/KRW'`, `splitSymbol('BTC/KRW')` 왕복, 레지스트리 매핑 정확성.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

`@market/shared`가 빌드되고(`dist/` 생성) 단위 테스트가 통과해야 한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트: NormalizedTick이 `docs/ARCHITECTURE.md` 정의와 정확히 일치하는가? zod 스키마와 TS 타입이 어긋나지 않는가?
3. `phases/0-mvp/index.json`의 step 1을 업데이트한다:
   - 성공 → `"completed"` + `"summary"`(export한 타입·스키마·심볼 유틸·레지스트리 요약, 다음 step이 import할 심벌명 포함).
   - 실패 → `"error"` + `"error_message"`.

## 금지사항

- 공급처별 raw 파싱 로직을 여기 넣지 마라. 이유: 정규화·매핑은 step 2(collector)의 책임. 여기는 타입·스키마·심볼 규칙만.
- NestJS/React 등 앱 의존성을 `@market/shared`에 추가하지 마라. 이유: 순수 공용 패키지여야 BE·FE 양쪽에서 안전하게 쓰인다. 의존성은 `zod`만.
- 기존 테스트를 깨뜨리지 마라.
