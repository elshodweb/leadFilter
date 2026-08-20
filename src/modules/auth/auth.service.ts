import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { LoginDto } from './dto/login.dto';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { JwtPayload } from './strategies/jwt-access.strategy';
import { UserRole } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly orgsService: OrganizationsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterOrganizationDto) {
    const org = await this.orgsService.create({
      name: dto.organizationName,
      instagramAccessToken: dto.instagramAccessToken,
      instagramBusinessAccountId: dto.instagramBusinessAccountId,
      instagramVerifyToken: dto.instagramVerifyToken,
      instagramApiBaseUrl: dto.instagramApiBaseUrl,
      metaGraphApiVersion: dto.metaGraphApiVersion,
    });

    const user = await this.usersService.create(org._id.toString(), {
      fullName: dto.adminFullName,
      email: dto.adminEmail,
      password: dto.adminPassword,
      role: UserRole.ADMIN,
    });

    const tokens = await this.generateTokens(user);
    const hashedRefresh = await bcrypt.hash(tokens.refreshToken, 10);
    await this.usersService.setRefreshToken(user._id.toString(), hashedRefresh);

    return {
      ...tokens,
      user: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        organizationId: org._id.toString(),
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status === 'INACTIVE')
      throw new UnauthorizedException('Account is inactive');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user);

    // Store hashed refresh token
    const hashedRefresh = await bcrypt.hash(tokens.refreshToken, 10);
    await this.usersService.setRefreshToken(user._id.toString(), hashedRefresh);

    return {
      ...tokens,
      user: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId.toString(),
      },
    };
  }

  async refresh(userId: string, rawRefreshToken: string) {
    const user = await this.usersService.findByIdWithRefreshToken(userId);
    if (!user || !user.refreshToken)
      throw new UnauthorizedException('Access denied');

    const tokenMatch = await bcrypt.compare(rawRefreshToken, user.refreshToken);
    if (!tokenMatch) throw new UnauthorizedException('Access denied');

    const tokens = await this.generateTokens(user);
    const hashedRefresh = await bcrypt.hash(tokens.refreshToken, 10);
    await this.usersService.setRefreshToken(user._id.toString(), hashedRefresh);

    return tokens;
  }

  async logout(userId: string) {
    await this.usersService.setRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  async me(userId: string) {
    const user = await this.usersService.findByIdWithRefreshToken(userId);
    if (!user) throw new UnauthorizedException();
    // Strip sensitive fields
    const { password: _p, refreshToken: _r, ...safe } = user as any;
    return safe;
  }

  private async generateTokens(user: any) {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      organizationId: user.organizationId.toString(),
    };

    const accessSecret = this.configService.get<string>('jwt.accessSecret')!;
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret')!;
    const accessExpiresIn =
      this.configService.get<string>('jwt.accessExpiresIn') || '7d';
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as any, {
        secret: accessSecret,
        expiresIn: accessExpiresIn as any,
      }),
      this.jwtService.signAsync(payload as any, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
