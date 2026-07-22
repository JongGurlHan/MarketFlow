// 표준 스키마(NormalizedTick) — BE·FE 공용 타입의 단일 출처.
// docs/ARCHITECTURE.md "표준 스키마" 정의를 그대로 구현한다.

export type Source = 'upbit' | 'binance';
export type AssetClass = 'crypto'; // 자산군 확장 대비

export interface NormalizedTick {
  source: Source;
  symbol: string; // 내부 표준: BASE/QUOTE 대문자. 예: 'BTC/KRW'
  assetClass: AssetClass;
  price: number; // 체결가
  changeRate24h?: number; // 24h 등락률
  volume24h?: number;
  sourceTimestamp: number; // 공급처 타임스탬프 (epoch ms)
  ingestTimestamp: number; // 수집 시각 (epoch ms)
  sequence?: number; // 갭 감지용(phase 1)
}
