import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// BigInt (tiền VND) không serialize được mặc định → toJSON = string.
// (an toàn cho VND vì client đọc dạng số nguyên trong chuỗi khi cần độ chính xác).
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const prefix = config.get<string>('apiPrefix') ?? 'api/v1';

  // Health check ở root (/healthz, /readyz) cho probe LB/K8s — 15-architecture.
  app.setGlobalPrefix(prefix, { exclude: ['healthz', 'readyz'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  const configuredOrigins = config.get<string[]>('corsOrigins') ?? [];
  app.enableCors({
    credentials: true,
    origin:
      configuredOrigins.length > 0 ? configuredOrigins : config.get<string>('env') !== 'production',
  });

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`tutor-api chạy tại http://localhost:${port}/${prefix}`);
}

void bootstrap();
