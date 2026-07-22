import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('GET /health returns { status: ok, sources }', () => {
    expect(controller.check()).toEqual({
      status: 'ok',
      sources: ['upbit', 'binance'],
    });
  });
});
