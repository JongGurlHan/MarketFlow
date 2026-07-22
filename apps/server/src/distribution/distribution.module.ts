import { Module } from '@nestjs/common';
import { CollectorModule } from '../collector/collector.module';
import { HealthController } from './health.controller';
import { MarketController } from './market.controller';
import { MarketGateway } from './market.gateway';

// 배포 모듈(REST + WS). CollectorModule을 import 해 MARKET_BUS provider를 가져온다
// (버스로만 데이터를 읽는다 — 커넥터 내부를 import 하지 않는다).
@Module({
  imports: [CollectorModule],
  controllers: [MarketController, HealthController],
  providers: [MarketGateway],
})
export class DistributionModule {}
