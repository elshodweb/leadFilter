import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';

describe('AuthService', () => {
  let service: AuthService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmailWithPassword: jest.fn(),
            create: jest.fn(),
            setRefreshToken: jest.fn(),
          },
        },
        {
          provide: OrganizationsService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('test_token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.accessSecret') return 'test_secret';
              if (key === 'jwt.refreshSecret') return 'test_refresh_secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register organization and admin with Instagram settings', async () => {
    const orgsService = module.get<OrganizationsService>(OrganizationsService);
    const usersService = module.get<UsersService>(UsersService);

    const mockOrg = { _id: 'org_123', name: 'Air Ticket' };
    const mockUser = {
      _id: 'user_123',
      fullName: 'Ali Valiyev',
      email: 'admin@airticket.uz',
      role: 'ADMIN',
      organizationId: 'org_123',
    };

    (orgsService.create as jest.Mock).mockResolvedValue(mockOrg);
    (usersService.create as jest.Mock).mockResolvedValue(mockUser);
    (usersService.setRefreshToken as jest.Mock).mockResolvedValue(true);

    const result = await service.register({
      organizationName: 'Air Ticket',
      adminFullName: 'Ali Valiyev',
      adminEmail: 'admin@airticket.uz',
      adminPassword: 'Password123!',
      instagramAccessToken: 'token_123',
      instagramBusinessAccountId: '17841480623895283',
      instagramVerifyToken: 'verify_123',
    });

    expect(orgsService.create).toHaveBeenCalledWith({
      name: 'Air Ticket',
      instagramAccessToken: 'token_123',
      instagramBusinessAccountId: '17841480623895283',
      instagramVerifyToken: 'verify_123',
      instagramApiBaseUrl: undefined,
      metaGraphApiVersion: undefined,
    });
    expect(result.accessToken).toBe('test_token');
    expect(result.user.organizationId).toBe('org_123');
  });
});
