import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App Endpoints & Response Formatting (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    await app.init();
  });

  it('/webhook/instagram (GET) unauthorized without proper token', () => {
    return request(app.getHttpServer())
      .get('/webhook/instagram?hub.mode=subscribe&hub.verify_token=wrong')
      .expect(403);
  });

  it('/auth/login (POST) with empty body returns unified error format', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({})
      .expect(400);

    expect(res.body).toHaveProperty('statusCode', 400);
    expect(res.body).toHaveProperty('data', null);
    expect(res.body).toHaveProperty('error');
  });

  it('/auth/login (POST) with invalid credentials returns unified 401 error format', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'wrongpassword' })
      .expect(401);

    expect(res.body).toHaveProperty('statusCode', 401);
    expect(res.body).toHaveProperty('data', null);
    expect(res.body).toHaveProperty('error');
  });

  afterEach(async () => {
    await app.close();
  });
});
