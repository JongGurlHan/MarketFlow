"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidTick = exports.parseTick = exports.NormalizedTickSchema = void 0;
const zod_1 = require("zod");
// NormalizedTick 인터페이스와 1:1 대응하는 zod 스키마.
// 정규화 매퍼는 이 스키마 검증을 통과한 객체만 버스로 내보낸다.
exports.NormalizedTickSchema = zod_1.z.object({
    source: zod_1.z.enum(['upbit', 'binance']),
    symbol: zod_1.z.string().min(1),
    assetClass: zod_1.z.literal('crypto'),
    price: zod_1.z.number().finite(),
    changeRate24h: zod_1.z.number().finite().optional(),
    volume24h: zod_1.z.number().finite().optional(),
    sourceTimestamp: zod_1.z.number().finite(),
    ingestTimestamp: zod_1.z.number().finite(),
    sequence: zod_1.z.number().finite().optional(),
});
/** 검증 후 NormalizedTick 반환. 실패 시 ZodError throw. */
function parseTick(input) {
    return exports.NormalizedTickSchema.parse(input);
}
exports.parseTick = parseTick;
/** 검증 성공 여부만 반환(throw 하지 않음). */
function isValidTick(input) {
    return exports.NormalizedTickSchema.safeParse(input).success;
}
exports.isValidTick = isValidTick;
