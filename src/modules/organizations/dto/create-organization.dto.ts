import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrganizationStatus } from '../schemas/organization.schema';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Air Ticket Tour' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    enum: OrganizationStatus,
    default: OrganizationStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @ApiProperty({
    example: 'EAABsbCS1iHgBO...',
    description: 'Instagram Graph API access token',
  })
  @IsString()
  @IsNotEmpty()
  instagramAccessToken: string;

  @ApiProperty({
    example: '17841480623895283',
    description: 'Instagram Business Account ID',
  })
  @IsString()
  @IsNotEmpty()
  instagramBusinessAccountId: string;

  @ApiProperty({
    example: '17bc20a31da65e4138562e4b48e4eb48c10c7cb3547998b37efd03cbf8e4624c',
    description: 'Instagram Webhook verification token',
  })
  @IsString()
  @IsNotEmpty()
  instagramVerifyToken: string;

  @ApiPropertyOptional({
    example: 'https://graph.instagram.com',
    default: 'https://graph.instagram.com',
    description: 'Instagram API Base URL',
  })
  @IsOptional()
  @IsString()
  instagramApiBaseUrl?: string;

  @ApiPropertyOptional({
    example: 'v23.0',
    default: 'v23.0',
    description: 'Meta Graph API Version',
  })
  @IsOptional()
  @IsString()
  metaGraphApiVersion?: string;
}
