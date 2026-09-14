import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { UsersModule } from '../users/users.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.register({ global: true }),
    UsersModule,
    OrganizationsModule,
  ],
  providers: [
    AuthService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    RolesGuard,
    WsJwtGuard,
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    WsJwtGuard,
    JwtModule,
    UsersModule,
  ],
})
export class AuthModule {}
