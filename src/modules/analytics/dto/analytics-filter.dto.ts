import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AnalyticsFilterDto {
  @ApiPropertyOptional({
    description: 'Organization ID (Optional for ADMIN, defaults to authenticated user organization)',
    example: '6a857f6067d93ffb53da3179',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Start date of the period (ISO string or YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date of the period (ISO string or YYYY-MM-DD)',
    example: '2026-08-25',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}
