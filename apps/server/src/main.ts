import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { CollectorService } from './collector/collector.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // REST와 WS 게이트웨이가 같은 포트(4000)를 공유하도록 ws 어댑터를 쓴다.
  app.useWebSocketAdapter(new WsAdapter(app));
  // web(3000)에서 접근할 수 있게 CORS 허용.
  app.enableCors();

  // 실 소켓 커넥터 기동은 부트스트랩에서만 한다(모듈 초기화 훅 아님).
  // CollectorService.start()가 커넥터를 connect()해 실 'ws' 소켓을 연다 —
  // 테스트는 이 경로를 타지 않으므로 오프라인으로 통과한다(ADR-004).
  app.get(CollectorService).start();

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
}

void bootstrap();
