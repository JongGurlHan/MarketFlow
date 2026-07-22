import { Module } from '@nestjs/common';
import { InMemoryMarketBus, MARKET_BUS } from './bus/market-bus';
import { SOURCE_CONNECTORS } from './connectors/source-connector';
import { UpbitConnector } from './connectors/upbit.connector';
import { BinanceConnector } from './connectors/binance.connector';
import { wsSocketFactory } from './connectors/ws-socket.factory';
import { CollectorService } from './collector.service';

// 버스(step 2)는 그대로 재사용하고, step 3에서 커넥터 배열·CollectorService를 추가한다.
// 커넥터는 실 ws 팩토리로 배선되지만 소켓은 start()가 호출될 때만 열린다(런타임=step 4).
// CollectorService를 export 해 step 4(distribution/main)가 주입·기동할 수 있게 한다.
@Module({
  providers: [
    { provide: MARKET_BUS, useClass: InMemoryMarketBus },
    {
      provide: SOURCE_CONNECTORS,
      useValue: [
        new UpbitConnector(wsSocketFactory),
        new BinanceConnector(wsSocketFactory),
      ],
    },
    CollectorService,
  ],
  exports: [MARKET_BUS, CollectorService],
})
export class CollectorModule {}
