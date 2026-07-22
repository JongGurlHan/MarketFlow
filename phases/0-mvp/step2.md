# Step 2: normalizer

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (데이터 흐름, 표준 스키마, 심볼 규칙)
- `/docs/ADR.md` (ADR-006)
- `packages/shared/src/` — step 1의 `NormalizedTick`, `normalizedTickSchema`, 심볼 유틸(`upbitMarketToSymbol` 등)
- `apps/collector/src/` — step 0의 collector 뼈대

`@market/shared`의 export를 확인하고 그대로 사용하라.

## 작업

`apps/collector`에 **소스-무관 커넥터 인터페이스**와 **Upbit 정규화 매퍼**를 구현한다. 실제 WebSocket 연결은 하지 않는다(step 3).

### 1. SourceConnector 인터페이스 (`src/collectors/source-connector.ts`)
```ts
import { NormalizedTick, Source } from '@market/shared';

export interface SourceConnector {
  readonly source: Source;
  /** 스트림 시작. 각 정규화된 tick마다 onTick 호출. */
  connect(onTick: (tick: NormalizedTick) => void): Promise<void>;
  disconnect(): Promise<void>;
}
```

### 2. Upbit 정규화 매퍼 (`src/normalizer/upbit.normalizer.ts`)
- `normalizeUpbit(raw: unknown): NormalizedTick | null`
  - `raw`가 Upbit ticker 메시지(`type === 'ticker'`)가 아니면 `null` 반환(orderbook/trade 등 무시).
  - 매핑:
    - `source`: `'upbit'`, `assetClass`: `'crypto'`
    - `symbol`: `upbitMarketToSymbol(raw.code)`  (예: `'KRW-BTC'` → `'BTC/KRW'`)
    - `price`: `raw.trade_price`
    - `volume24h`: `raw.acc_trade_volume_24h`
    - `changeRate24h`: `raw.signed_change_rate`
    - `sourceTimestamp`: `raw.trade_timestamp` (ms)
    - `ingestTimestamp`: `Date.now()`
  - 반환 전 `parseNormalizedTick`으로 검증한다. (Upbit ticker에는 best bid/ask가 없으므로 `bid/ask`는 생략.)

### 3. 참고 — Upbit ticker(DEFAULT 포맷) 실제 메시지 예시 (fixture로 사용)
`src/normalizer/__fixtures__/upbit-ticker.json`:
```json
{
  "type": "ticker",
  "code": "KRW-BTC",
  "trade_price": 159500000,
  "signed_change_rate": 0.0082,
  "acc_trade_volume_24h": 3456.78,
  "trade_timestamp": 1784790900000,
  "timestamp": 1784790900123,
  "stream_type": "REALTIME"
}
```
비-ticker 예시도 하나 두라(`{"type":"orderbook","code":"KRW-BTC", ...}`) → `null` 검증용.

### 4. 테스트 (TDD)
- fixture 입력 → 기대 `NormalizedTick`(symbol `'BTC/KRW'`, price `159500000` 등) 반환.
- 비-ticker 입력 → `null`.
- 필드 누락 등 잘못된 입력 → `null` 또는 검증 예외를 안전하게 처리(코어가 죽지 않도록).

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
   - 매퍼가 `@market/shared`의 스키마/심볼 유틸을 사용하는가(자체 재구현 금지)?
   - `SourceConnector`가 특정 공급처에 의존하지 않는(제네릭한) 형태인가?
3. `phases/0-mvp/index.json`의 step 2 상태 업데이트.

## 금지사항

- 실제 WebSocket 연결/`ws` 사용 코드를 넣지 마라. 이유: step 3 소관.
- Redis 관련 코드를 넣지 마라. 이유: step 4 소관.
- 파이프라인 코어에 `if (source === 'upbit')` 같은 분기를 넣지 마라. 이유: ADR-006 위반. 공급처 특화 로직은 커넥터/매퍼 안에만.
- 기존 테스트를 깨뜨리지 마라.
