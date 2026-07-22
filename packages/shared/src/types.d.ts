export type Source = 'upbit' | 'binance';
export type AssetClass = 'crypto';
export interface NormalizedTick {
    source: Source;
    symbol: string;
    assetClass: AssetClass;
    price: number;
    changeRate24h?: number;
    volume24h?: number;
    sourceTimestamp: number;
    ingestTimestamp: number;
    sequence?: number;
}
