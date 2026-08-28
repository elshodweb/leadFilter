import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LeadType } from '../schemas/lead.schema';

export class GetKanbanLeadsDto {
  @ApiProperty({
    enum: LeadType,
    description: 'Lead type (Required: WARM or HOT)',
    example: LeadType.WARM,
    required: true,
  })
  @IsNotEmpty({ message: 'type is required (WARM or HOT)' })
  @IsEnum(LeadType, { message: 'type must be either WARM or HOT' })
  type: LeadType;

  @ApiPropertyOptional({
    description: 'Organization ID (Optional for ADMIN, defaults to user organization)',
    example: '6a857f6067d93ffb53da3179',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
