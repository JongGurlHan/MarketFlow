// 대시보드 런타임 설정. 백엔드 주소는 환경변수로 주입하고, 기본은 로컬 서버(4000).
import { UPBIT_MARKETS, BINANCE_MARKETS } from '@market/shared';

// REST 베이스 URL. distribution 컨트롤러가 붙는 포트(기본 4000).
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// WS 베이스 URL — http→ws, https→wss 로 스킴만 변환(REST와 같은 호스트·포트 공유).
export const WS_URL = API_URL.replace(/^http/, 'ws');

// 구독 대상 표준 심볼 목록 — shared 레지스트리에서 생성(현재 BTC·ETH의 KRW·USDT).
export const SYMBOLS: string[] = [...UPBIT_MARKETS, ...BINANCE_MARKETS].map(
  (market) => market.symbol,
);
