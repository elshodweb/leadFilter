import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CompanyInformationDocument = CompanyInformation & Document;

@Schema({ timestamps: true })
export class CompanyInformation {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;
}

export const CompanyInformationSchema =
  SchemaFactory.createForClass(CompanyInformation);
CompanyInformationSchema.index({ organizationId: 1 });
