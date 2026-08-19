import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdditionalInformationDocument = AdditionalInformation & Document;

@Schema({ timestamps: true })
export class AdditionalInformation {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;
}

export const AdditionalInformationSchema = SchemaFactory.createForClass(
  AdditionalInformation,
);
AdditionalInformationSchema.index({ organizationId: 1 });
