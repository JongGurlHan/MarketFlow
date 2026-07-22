import { Module } from '@nestjs/common';
import { CollectorModule } from './collector/collector.module';
import { DistributionModule } from './distribution/distribution.module';

// 수집(collector) + 배포(distribution) 두 모듈을 합성한다. 둘은 MARKET_BUS
// 인터페이스로만 연결된다 — CollectorModule이 버스를 단일 인스턴스로 제공한다.
@Module({
  imports: [CollectorModule, DistributionModule],
})
export class AppModule {}
