import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';

export type OrganizationDocument = Organization & Document;

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Schema({ timestamps: true })
export class Organization {
  @ApiProperty({ example: 'Air Ticket Tour' })
  @Prop({ required: true })
  name: string;

  @ApiProperty({ enum: OrganizationStatus, default: OrganizationStatus.ACTIVE })
  @Prop({ enum: OrganizationStatus, default: OrganizationStatus.ACTIVE })
  status: OrganizationStatus;

  @ApiProperty({ description: 'Instagram Graph API access token' })
  @Prop({ required: true })
  instagramAccessToken: string;

  @ApiProperty({
    description: 'Instagram Business Account ID (e.g. 17841480623895283)',
  })
  @Prop({ required: true })
  instagramBusinessAccountId: string;

  @ApiProperty({ description: 'Instagram Webhook verification token' })
  @Prop({ required: true })
  instagramVerifyToken: string;

  @ApiProperty({
    description: 'Instagram API Base URL',
    default: 'https://graph.instagram.com',
  })
  @Prop({ default: 'https://graph.instagram.com' })
  instagramApiBaseUrl: string;

  @ApiProperty({
    description: 'Meta Graph API Version',
    default: 'v23.0',
  })
  @Prop({ default: 'v23.0' })
  metaGraphApiVersion: string;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
OrganizationSchema.index({ instagramBusinessAccountId: 1 });
OrganizationSchema.index({ instagramVerifyToken: 1 });
