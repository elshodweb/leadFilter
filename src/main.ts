import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // CORS
  app.enableCors({ origin: '*' });

  // Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('LeadFilter with ai API')
    .setDescription(
      `Multi-tenant AI-powered lead qualification backend.
      
**Authentication**: All endpoints require a JWT Bearer token except \`POST /auth/login\` and \`GET|POST /webhook/instagram\`.

**WebSocket** events are documented in \`/docs/WEBSOCKET_API.md\`.`,
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Login, logout, refresh token, current user')
    .addTag('Users', 'User management within an organization')
    .addTag('Organizations', 'Organization CRUD')
    .addTag(
      'Knowledge',
      'Lead questions, company info, and additional info per organization',
    )
    .addTag('Webhook', 'Instagram webhook integration (public)')
    .addTag('Leads', 'Lead management (admin)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'LeadFilter API Docs',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📖 Swagger UI: http://localhost:${port}/api`);
  console.log(`🔌 WebSocket:  ws://localhost:${port}`);
}

bootstrap();
