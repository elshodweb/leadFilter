import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatDocument = Chat & Document;

export enum ChatChannel {
  INSTAGRAM = 'INSTAGRAM',
  TELEGRAM = 'TELEGRAM',
  WHATSAPP = 'WHATSAPP',
}

export enum ChatStatus {
  COLD = 'COLD',
  WARM = 'WARM',
  HOT = 'HOT',
}

@Schema({ _id: false })
export class CollectedDataItem {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ type: String, default: null })
  value: string | null;
}

export const CollectedDataItemSchema =
  SchemaFactory.createForClass(CollectedDataItem);

@Schema({ _id: false })
class LastMessage {
  @Prop() text: string;
  @Prop() sentTime: Date;
}

@Schema({ timestamps: true })
export class Chat {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ enum: ChatChannel, required: true })
  channel: ChatChannel;

  @Prop({ required: true })
  externalChatId: string;

  @Prop({ required: true })
  externalUserId: string;

  @Prop({ type: String, default: null })
  customerName?: string;

  @Prop({ type: String, default: null })
  customerUsername?: string;

  @Prop({ type: String, default: null })
  customerAvatar?: string;

  @Prop({ enum: ChatStatus, default: ChatStatus.COLD })
  status: ChatStatus;

  @Prop({ type: Boolean, default: true })
  ai_enabled: boolean;

  @Prop({ type: [CollectedDataItemSchema], default: [] })
  collectedData: CollectedDataItem[];

  @Prop({ type: LastMessage })
  lastMessage: LastMessage;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
ChatSchema.index({ organizationId: 1, externalChatId: 1 }, { unique: true });
ChatSchema.index({ organizationId: 1, status: 1 });
ChatSchema.index({ organizationId: 1, ai_enabled: 1 });
ChatSchema.index({ organizationId: 1, updatedAt: -1 });

