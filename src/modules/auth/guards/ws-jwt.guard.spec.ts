import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsJwtGuard } from './ws-jwt.guard';
import { UsersService } from '../../users/users.service';
import { UserRepository } from '../../users/repositories/user.repository';

describe('WebSocket authentication', () => {
  const secret = 'a'.repeat(32);
  const jwt = new JwtService();
  let account: any;
  let client: any;
  let guard: WsJwtGuard;
  const context = () =>
    ({ switchToWs: () => ({ getClient: () => client }) }) as ExecutionContext;

  beforeEach(() => {
    account = {
      _id: '507f1f77bcf86cd799439011',
      organizationId: '507f1f77bcf86cd799439012',
      email: 'user@example.com',
      role: 'OPERATOR',
      status: 'ACTIVE',
    };
    const users = new UsersService({
      findById: async () => account,
    } as unknown as UserRepository);
    guard = new WsJwtGuard(
      jwt,
      new ConfigService({ jwt: { accessSecret: secret } }),
      users,
    );
    client = {
      handshake: {
        auth: {
          token: jwt.sign({ sub: account._id, role: 'ADMIN' }, { secret }),
        },
      },
    };
  });

  it('loads current identity and maps userId consistently with HTTP', async () => {
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(client.user).toEqual({
      userId: account._id,
      email: account.email,
      role: 'OPERATOR',
      organizationId: account.organizationId,
    });
  });

  it.each(['INACTIVE', 'DELETED'])(
    'denies an unavailable account: %s',
    async (status) => {
      if (status === 'DELETED') account = null;
      else account.status = status;
      await expect(guard.canActivate(context())).rejects.toThrow(
        'Invalid or expired token',
      );
    },
  );

  it('rejects an expired token', async () => {
    client.handshake.auth.token = jwt.sign(
      { sub: account._id },
      { secret, expiresIn: -1 },
    );
    await expect(guard.canActivate(context())).rejects.toThrow(
      'Invalid or expired token',
    );
  });
});
