// SourceConnector — 모든 공급처 커넥터가 구현하는 소스-무관 인터페이스.
// 파이프라인 코어는 커넥터 종류를 모른다(공급처 분기 금지). 새 공급처는 이 인터페이스
// 구현 하나로 추가한다(CLAUDE.md CRITICAL). 외부 소켓은 SocketFactory로 주입해
// 테스트가 오프라인에서 fake 소켓을 넣을 수 있게 한다(ADR-004).

import type { Observable } from 'rxjs';
import type { NormalizedTick, Source } from '@market/shared';

// 주입 지점: 실 런타임은 'ws' WebSocket을, 테스트는 fake 소켓을 생성한다.
export type SocketFactory = (url: string) => WsLike;

export interface WsLike {
  on(event: 'open' | 'message' | 'close' | 'error', cb: (arg?: any) => void): void;
  send(data: string): void;
  close(): void;
}

export interface SourceConnector {
  readonly source: Source;
  readonly ticks$: Observable<NormalizedTick>; // 정규화된 스트림
  connect(): void;
  disconnect(): void;
}

// CollectorService가 주입받는 커넥터 배열의 DI 토큰.
export const SOURCE_CONNECTORS = Symbol('SOURCE_CONNECTORS');
