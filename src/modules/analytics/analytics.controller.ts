import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import type { AuthenticatedRequest } from '../../common/interfaces/auth.interface';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get AI KPI statistics and cost savings for an organization with optional date filters',
  })
  @ApiResponse({
    status: 200,
    description: 'KPI statistics retrieved successfully',
  })
  async getAnalytics(
    @Query() filterDto: AnalyticsFilterDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const isAdmin = req.user.role === UserRole.ADMIN;
    const orgId =
      isAdmin && filterDto.organizationId
        ? filterDto.organizationId
        : req.user.organizationId;
    return this.analyticsService.getKpi(filterDto, orgId);
  }
}
