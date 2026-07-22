// 시세 배포 REST 컨트롤러.
// 데이터는 MARKET_BUS(MarketBus 인터페이스)로만 읽는다 — 커넥터·정규화 내부를
// 직접 참조하지 않는다(CLAUDE.md CRITICAL: 버스 디커플링). 응답은 항상 NormalizedTick
// 표준 스키마이며 raw 포맷을 노출하지 않는다.

import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
} from '@nestjs/common';
import type { NormalizedTick } from '@market/shared';
import { MARKET_BUS } from '../collector/bus/market-bus';
import type { MarketBus } from '../collector/bus/market-bus';

@Controller('v1')
export class MarketController {
  constructor(@Inject(MARKET_BUS) private readonly bus: MarketBus) {}

  // 활성 심볼 목록 — 버스에 최신값이 있는 심볼.
  @Get('symbols')
  symbols(): string[] {
    return this.bus.getLatest().map((tick) => tick.symbol);
  }

  // 전체 최신 스냅샷.
  @Get('ticks')
  ticks(): NormalizedTick[] {
    return this.bus.getLatest();
  }

  // 단일 심볼 스냅샷. URL 인코딩('BTC/KRW' → BTC%2FKRW)을 디코드해 조회한다.
  @Get('ticks/:symbol')
  tickBySymbol(@Param('symbol') symbol: string): NormalizedTick {
    const decoded = decodeURIComponent(symbol);
    const tick = this.bus.getLatestBySymbol(decoded);
    if (!tick) {
      throw new NotFoundException(`No tick for symbol '${decoded}'`);
    }
    return tick;
  }
}
