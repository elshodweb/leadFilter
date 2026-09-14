import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';

describe('Refresh token rotation', () => {
  const jwt = new JwtService();
  let user: any;
  let users: any;
  let auth: AuthService;

  beforeEach(async () => {
    user = {
      _id: '507f1f77bcf86cd799439011',
      organizationId: '507f1f77bcf86cd799439012',
      email: 'operator@example.com',
      role: 'OPERATOR',
      status: 'ACTIVE',
      password: await bcrypt.hash('test-password', 4),
      refreshToken: null,
    };
    users = {
      findByEmailWithPassword: jest.fn(async () => ({ ...user })),
      findByIdWithRefreshToken: jest.fn(async () => ({ ...user })),
      setRefreshToken: jest.fn(async (_id, token) => {
        user.refreshToken = token;
      }),
      rotateRefreshToken: jest.fn(async (_id, previous, next) => {
        if (user.refreshToken !== previous) return false;
        user.refreshToken = next;
        return true;
      }),
    };
    auth = new AuthService(
      users as UsersService,
      {} as OrganizationsService,
      jwt,
      new ConfigService({
        jwt: { accessSecret: 'a'.repeat(32), refreshSecret: 'b'.repeat(32) },
      }),
    );
  });

  async function login() {
    return auth.login({ email: user.email, password: 'test-password' });
  }

  it('rotates tokens issued in the same second and rejects the previous token', async () => {
    const original = await login();
    const next = await auth.refresh(user._id, original.refreshToken);
    expect(next.refreshToken).not.toBe(original.refreshToken);
    // These tokens share more than bcrypt's 72-byte input limit.
    expect(next.refreshToken.slice(0, 72)).toBe(
      original.refreshToken.slice(0, 72),
    );
    await expect(auth.refresh(user._id, original.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(
      auth.refresh(user._id, next.refreshToken),
    ).resolves.toHaveProperty('accessToken');
  });

  it('allows only one concurrent refresh to consume the stored token', async () => {
    const original = await login();
    const results = await Promise.allSettled([
      auth.refresh(user._id, original.refreshToken),
      auth.refresh(user._id, original.refreshToken),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('denies refresh after the account is disabled', async () => {
    const original = await login();
    user.status = 'INACTIVE';
    await expect(auth.refresh(user._id, original.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(users.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('denies refresh after logout', async () => {
    const original = await login();
    await auth.logout(user._id);
    await expect(auth.refresh(user._id, original.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('defaults access tokens to fifteen minutes', async () => {
    const { accessToken } = await login();
    const payload = jwt.verify(accessToken, { secret: 'a'.repeat(32) });
    expect(payload.exp - payload.iat).toBe(900);
  });
});
