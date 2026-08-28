import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { LeadStatus, LeadType } from '../schemas/lead.schema';

export class UpdateLeadDto {
  @ApiPropertyOptional({ enum: LeadType, description: 'Lead type (WARM or HOT)' })
  @IsOptional()
  @IsEnum(LeadType)
  type?: LeadType;

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({
    description: 'Order position within the status column (1-based)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({ description: 'Lead collected data array or object' })
  @IsOptional()
  data?: any;
}
