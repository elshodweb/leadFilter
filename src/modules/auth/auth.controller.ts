import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { Public } from './decorators/public.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/auth.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Post('register')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Provision an organization and global admin (existing admin only)',
  })
  register(@Body() dto: RegisterOrganizationDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Login with email + password → returns access & refresh tokens',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Exchange refresh token for new access + refresh tokens',
  })
  refresh(@Req() req: any, @Body() _dto: RefreshTokenDto) {
    return this.authService.refresh(req.user.sub, req.user.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — invalidates refresh token' })
  logout(@Req() req: AuthenticatedRequest) {
    return this.authService.logout(req.user.userId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current logged-in user' })
  me(@Req() req: AuthenticatedRequest) {
    return this.authService.me(req.user.userId);
  }
}
