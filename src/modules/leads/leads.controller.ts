import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import type { AuthenticatedRequest } from '../../common/interfaces/auth.interface';

@ApiTags('Leads')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('leads')
export class LeadsController {
  constructor(private readonly svc: LeadsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List leads (Admin can filter by organizationId or view all)',
  })
  findAll(@Req() req: AuthenticatedRequest, @Query() dto: ListLeadsDto) {
    const isAdmin = req.user.role === UserRole.ADMIN;
    if (!isAdmin) {
      dto.organizationId = req.user.organizationId;
    }
    return this.svc.findAll(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by ID (Admin)' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead status or data (Admin)' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.svc.update(id, dto);
  }
}
