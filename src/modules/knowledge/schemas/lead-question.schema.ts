import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LeadQuestionDocument = LeadQuestion & Document;

@Schema({ timestamps: true })
export class LeadQuestion {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: 0 })
  order: number;
}

export const LeadQuestionSchema = SchemaFactory.createForClass(LeadQuestion);
LeadQuestionSchema.index({ organizationId: 1 });
