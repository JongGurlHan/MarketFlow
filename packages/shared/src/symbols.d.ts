/** base·quote를 내부 표준 심볼로 조합. 예: ('btc','krw') → 'BTC/KRW' */
export declare function toStandardSymbol(base: string, quote: string): string;
/** 표준 심볼을 base·quote로 분해. 예: 'BTC/KRW' → { base: 'BTC', quote: 'KRW' } */
export declare function splitSymbol(symbol: string): {
    base: string;
    quote: string;
};
export interface MarketEntry {
    raw: string;
    symbol: string;
}
export declare const UPBIT_MARKETS: MarketEntry[];
export declare const BINANCE_MARKETS: MarketEntry[];
