import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AnalyticsFilterDto {
  @ApiPropertyOptional({
    description: 'Organization ID (Optional for ADMIN, default to authenticated user organization)',
    example: '6a857f6067d93ffb53da3179',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Start date of the period (ISO string or YYYY-MM-DD)',
    example: '2026-08-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Alias for startDate (e.g. 2026-08-01)',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsString()
  start?: string;

  @ApiPropertyOptional({
    description: 'End date of the period (ISO string or YYYY-MM-DD)',
    example: '2026-08-25T23:59:59.999Z',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Alias for endDate (e.g. 2026-08-25)',
    example: '2026-08-25',
  })
  @IsOptional()
  @IsString()
  end?: string;
}
