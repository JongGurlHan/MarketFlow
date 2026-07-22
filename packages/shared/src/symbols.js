"use strict";
// 심볼 유틸 — 내부 표준은 BASE/QUOTE 대문자(예: 'BTC/KRW').
// 공급처 원본 심볼은 정규화 단계(step 2)에서 이 유틸로 변환한다.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BINANCE_MARKETS = exports.UPBIT_MARKETS = exports.splitSymbol = exports.toStandardSymbol = void 0;
/** base·quote를 내부 표준 심볼로 조합. 예: ('btc','krw') → 'BTC/KRW' */
function toStandardSymbol(base, quote) {
    return `${base.toUpperCase()}/${quote.toUpperCase()}`;
}
exports.toStandardSymbol = toStandardSymbol;
/** 표준 심볼을 base·quote로 분해. 예: 'BTC/KRW' → { base: 'BTC', quote: 'KRW' } */
function splitSymbol(symbol) {
    const [base, quote] = symbol.split('/');
    if (!base || !quote) {
        throw new Error(`Invalid standard symbol: '${symbol}' (expected 'BASE/QUOTE')`);
    }
    return { base, quote };
}
exports.splitSymbol = splitSymbol;
exports.UPBIT_MARKETS = [
    { raw: 'KRW-BTC', symbol: 'BTC/KRW' },
    { raw: 'KRW-ETH', symbol: 'ETH/KRW' },
];
exports.BINANCE_MARKETS = [
    { raw: 'BTCUSDT', symbol: 'BTC/USDT' },
    { raw: 'ETHUSDT', symbol: 'ETH/USDT' },
];
