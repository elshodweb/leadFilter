import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LeadDocument = Lead & Document;

export enum LeadType {
  WARM = 'WARM',
  HOT = 'HOT',
}

export enum LeadStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  WON = 'WON',
  LOST = 'LOST',
}

@Schema({ timestamps: true })
export class Lead {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Chat', required: true, unique: true })
  chatId: Types.ObjectId;

  @Prop({ enum: LeadType, default: LeadType.HOT, index: true })
  type: LeadType;

  @Prop({ enum: LeadStatus, default: LeadStatus.NEW })
  status: LeadStatus;

  @Prop({ default: 1 })
  order: number;

  @Prop({ type: [Object], default: [] })
  data: any[];
}

export const LeadSchema = SchemaFactory.createForClass(Lead);
LeadSchema.index({ organizationId: 1, type: 1, status: 1, order: 1 });
