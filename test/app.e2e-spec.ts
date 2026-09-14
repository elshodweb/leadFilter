import {
  Controller,
  Get,
  INestApplication,
  InternalServerErrorException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtAccessStrategy } from '../src/modules/auth/strategies/jwt-access.strategy';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { UsersService } from '../src/modules/users/users.service';
import { UserRepository } from '../src/modules/users/repositories/user.repository';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

@Controller('test-errors')
class ErrorController {
  @Get('unexpected')
  unexpected() {
    throw new Error('private database connection details');
  }

  @Get('http')
  http() {
    throw new InternalServerErrorException('private upstream details');
  }
}

describe('HTTP authentication boundary', () => {
  let app: INestApplication;
  let account: any;
  const secret = 'a'.repeat(32);
  const jwt = new JwtService();
  const auth = {
    register: jest.fn().mockResolvedValue({ created: true }),
    login: jest.fn(),
  };
  const registration = {
    organizationName: 'Test organization',
    adminFullName: 'Test Admin',
    adminEmail: 'admin@example.com',
    adminPassword: 'test-password',
    instagramAccessToken: 'test-token',
    instagramBusinessAccountId: '123',
    instagramVerifyToken: 'test-verify-token',
  };
  const token = () =>
    jwt.sign(
      {
        sub: account._id,
        role: 'ADMIN',
        organizationId: account.organizationId,
      },
      { secret },
    );

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AuthController, ErrorController],
      providers: [
        JwtAccessStrategy,
        UsersService,
        {
          provide: UserRepository,
          useValue: { findById: async () => account },
        },
        { provide: AuthService, useValue: auth },
        {
          provide: ConfigService,
          useValue: new ConfigService({ jwt: { accessSecret: secret } }),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.useGlobalGuards(
      new JwtAuthGuard(app.get(Reflector)),
      new RolesGuard(app.get(Reflector)),
    );
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    account = {
      _id: '507f1f77bcf86cd799439011',
      organizationId: '507f1f77bcf86cd799439012',
      email: 'admin@example.com',
      role: 'ADMIN',
      status: 'ACTIVE',
    };
  });
  afterAll(async () => {
    await app.close();
  });

  it('denies anonymous organization provisioning', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(registration)
      .expect(401);
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('allows an active global administrator to provision an organization', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .auth(token(), { type: 'bearer' })
      .send(registration)
      .expect(201);
    expect(auth.register).toHaveBeenCalledWith(registration);
  });

  it('uses current permissions when an old token still claims ADMIN', async () => {
    const oldToken = token();
    account.role = 'OPERATOR';
    await request(app.getHttpServer())
      .post('/auth/register')
      .auth(oldToken, { type: 'bearer' })
      .send(registration)
      .expect(403);
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('denies a disabled account with an unexpired token', async () => {
    const oldToken = token();
    account.status = 'INACTIVE';
    await request(app.getHttpServer())
      .post('/auth/register')
      .auth(oldToken, { type: 'bearer' })
      .send(registration)
      .expect(401);
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('preserves validation errors on the public login endpoint', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({})
      .expect(400);
    expect(res.body).toEqual({
      statusCode: 400,
      data: null,
      error: expect.any(Array),
    });
    expect(auth.login).not.toHaveBeenCalled();
  });

  it.each(['unexpected', 'http'])(
    'hides internal error details: %s',
    async (route) => {
      const res = await request(app.getHttpServer())
        .get(`/test-errors/${route}`)
        .auth(token(), { type: 'bearer' })
        .expect(500);
      expect(res.body).toEqual({
        statusCode: 500,
        data: null,
        error: 'Internal server error',
      });
    },
  );
});
