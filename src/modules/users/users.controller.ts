import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './schemas/user.schema';
import type { AuthenticatedRequest } from '../../common/interfaces/auth.interface';

@ApiTags('Users')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user in the organization' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateUserDto) {
    return this.svc.create(req.user.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all users in the organization' })
  @ApiQuery({ name: 'organizationId', required: false })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() pagination: PaginationDto,
    @Query('organizationId') orgId?: string,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const targetOrgId = orgId || req.user.organizationId;
    return this.svc.findAll(targetOrgId, +page, +limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id' })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.svc.findOne(id, req.user.organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.svc.update(id, req.user.organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.svc.remove(id, req.user.organizationId);
  }
}
