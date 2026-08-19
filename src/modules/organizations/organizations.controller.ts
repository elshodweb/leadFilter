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
  ApiTags,
} from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import type { AuthenticatedRequest } from '../../common/interfaces/auth.interface';

@ApiTags('Organizations')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly svc: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all organizations (Admin)' })
  findAll(@Query() pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    return this.svc.findAll(+page, +limit);
  }

  @Get('my')
  @ApiOperation({ summary: "Get current user's organization" })
  getMyOrganization(@Req() req: AuthenticatedRequest) {
    return this.svc.findOne(req.user.organizationId);
  }

  @Patch('my')
  @ApiOperation({ summary: "Update current user's organization" })
  updateMyOrganization(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.svc.update(req.user.organizationId, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new organization (Admin)' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.svc.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID (Admin)' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update organization by ID (Admin)' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete organization by ID (Admin)' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
