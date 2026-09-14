import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const hasRole = requiredRoles.some((role) => user?.role === role);

    if (!hasRole) {
      this.logger.warn(
        `Access denied for user ${user?.email || user?.userId || 'unknown'} (Role: ${user?.role || 'none'}). Required: [${requiredRoles.join(', ')}]`,
      );
    } else {
      this.logger.debug(
        `Role check passed for user ${user?.email || user?.userId} (Role: ${user?.role})`,
      );
    }

    return hasRole;
  }
}
