import { z } from 'zod';
import type { NormalizedTick } from './types';

// NormalizedTick 인터페이스와 1:1 대응하는 zod 스키마.
// 정규화 매퍼는 이 스키마 검증을 통과한 객체만 버스로 내보낸다.
export const NormalizedTickSchema = z.object({
  source: z.enum(['upbit', 'binance']),
  symbol: z.string().min(1),
  assetClass: z.literal('crypto'),
  price: z.number().finite(),
  changeRate24h: z.number().finite().optional(),
  volume24h: z.number().finite().optional(),
  sourceTimestamp: z.number().finite(),
  ingestTimestamp: z.number().finite(),
  sequence: z.number().finite().optional(),
});

// 타입-스키마 일치 보장 (컴파일 타임). 어느 한쪽만 바뀌면 타입 에러로 드러난다.
type Inferred = z.infer<typeof NormalizedTickSchema>;
type AssertExtends<A extends B, B> = A;
type _SchemaMatchesType = AssertExtends<Inferred, NormalizedTick>;
type _TypeMatchesSchema = AssertExtends<NormalizedTick, Inferred>;

/** 검증 후 NormalizedTick 반환. 실패 시 ZodError throw. */
export function parseTick(input: unknown): NormalizedTick {
  return NormalizedTickSchema.parse(input);
}

/** 검증 성공 여부만 반환(throw 하지 않음). */
export function isValidTick(input: unknown): boolean {
  return NormalizedTickSchema.safeParse(input).success;
}
