import { Controller, Get } from '@nestjs/common';
import type { Source } from '@market/shared';

// 상태 점검 엔드포인트. distribution 모듈로 옮겨 배포 관련 컨트롤러를 한곳에 모은다.
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; sources: Source[] } {
    return { status: 'ok', sources: ['upbit', 'binance'] };
  }
}
