import { z } from 'zod';
import type { NormalizedTick } from './types';
export declare const NormalizedTickSchema: z.ZodObject<{
    source: z.ZodEnum<["upbit", "binance"]>;
    symbol: z.ZodString;
    assetClass: z.ZodLiteral<"crypto">;
    price: z.ZodNumber;
    changeRate24h: z.ZodOptional<z.ZodNumber>;
    volume24h: z.ZodOptional<z.ZodNumber>;
    sourceTimestamp: z.ZodNumber;
    ingestTimestamp: z.ZodNumber;
    sequence: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    source: "upbit" | "binance";
    assetClass: "crypto";
    price: number;
    sourceTimestamp: number;
    ingestTimestamp: number;
    changeRate24h?: number | undefined;
    volume24h?: number | undefined;
    sequence?: number | undefined;
}, {
    symbol: string;
    source: "upbit" | "binance";
    assetClass: "crypto";
    price: number;
    sourceTimestamp: number;
    ingestTimestamp: number;
    changeRate24h?: number | undefined;
    volume24h?: number | undefined;
    sequence?: number | undefined;
}>;
/** 검증 후 NormalizedTick 반환. 실패 시 ZodError throw. */
export declare function parseTick(input: unknown): NormalizedTick;
/** 검증 성공 여부만 반환(throw 하지 않음). */
export declare function isValidTick(input: unknown): boolean;
