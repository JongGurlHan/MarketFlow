import { Module } from '@nestjs/common';
import { InMemoryMarketBus, MARKET_BUS } from './bus/market-bus';

// 버스를 MARKET_BUS 토큰으로 제공·export 한다. distribution 등 다른 모듈은
// 이 토큰으로만 버스를 주입받는다. 커넥터·CollectorService provider는 step 3에서 추가된다.
@Module({
  providers: [{ provide: MARKET_BUS, useClass: InMemoryMarketBus }],
  exports: [MARKET_BUS],
})
export class CollectorModule {}
