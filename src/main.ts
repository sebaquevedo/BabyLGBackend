// Must be the first import: `PrismaService` and the JWT signing read `process.env` at
// module-evaluation time, which happens before Nest's ConfigModule has had a chance to load
// a `.env` file. Without this line the app silently falls back to the compose defaults.
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Fail here, with a readable message, instead of 500ing inside the first query or JWT sign.
  const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Copy env.example to .env and fill them in.`,
    );
  }

  // Without this the class-validator decorators on the DTOs are inert: `@Body()` would hand
  // the service whatever JSON the caller sent, including unknown keys.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // `docs/api-contract.md` fixes the base path; the Angular client is generated from the
  // OpenAPI document, so the prefix has to live here and not in every controller.
  app.setGlobalPrefix('api/v1');

  const openApiConfig = new DocumentBuilder()
    .setTitle('Citera API')
    .setDescription('Backend for the Citera SEO + GEO engine.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);
  // The machine-readable document is what the front generates its client from.
  SwaggerModule.setup('api-docs', app, document, {
    jsonDocumentUrl: 'api-docs-json',
  });

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
