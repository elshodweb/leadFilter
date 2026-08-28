import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { LeadStatus, LeadType } from '../schemas/lead.schema';

export class ListLeadsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ enum: LeadType, description: 'Filter by lead type (WARM or HOT)' })
  @IsOptional()
  @IsEnum(LeadType)
  type?: LeadType;

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;
}
