import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const rawAuth =
      client.handshake?.auth?.token ||
      client.handshake?.auth?.authorization ||
      client.handshake?.headers?.authorization ||
      client.handshake?.headers?.['access_token'] ||
      client.handshake?.query?.token ||
      client.handshake?.query?.accessToken;

    const token =
      typeof rawAuth === 'string' && rawAuth.startsWith('Bearer ')
        ? rawAuth.replace('Bearer ', '')
        : rawAuth;

    const socketId = client?.id || 'unknown';

    if (!token) {
      this.logger.warn(
        `[Socket ${socketId}] WS Auth failed: No token provided`,
      );
      throw new WsException('No token provided');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
      if (!payload.sub) throw new Error('Missing subject');
      client.user = await this.usersService.findForAuthentication(payload.sub);
      this.logger.debug(
        `[Socket ${socketId}] WS Auth verified for User: ${payload.email} (Org: ${payload.organizationId}, Role: ${payload.role})`,
      );
      return true;
    } catch (err: any) {
      this.logger.warn(
        `[Socket ${socketId}] WS Auth failed: ${err.message || 'Invalid or expired token'}`,
      );
      throw new WsException('Invalid or expired token');
    }
  }
}
