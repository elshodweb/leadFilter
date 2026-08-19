import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatDocument = Chat & Document;

export enum ChatChannel {
  INSTAGRAM = 'INSTAGRAM',
  TELEGRAM = 'TELEGRAM',
  WHATSAPP = 'WHATSAPP',
}

export enum ChatStatus {
  AI_PROCESSING = 'AI_PROCESSING',
  RETURNED_HUMAN = 'RETURNED_HUMAN',
}

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

  @Prop({ enum: ChatStatus, default: ChatStatus.AI_PROCESSING })
  status: ChatStatus;

  @Prop({ type: Object, default: {} })
  collectedData: Record<string, any>;

  @Prop({ type: LastMessage })
  lastMessage: LastMessage;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
ChatSchema.index({ organizationId: 1, externalChatId: 1 }, { unique: true });
ChatSchema.index({ organizationId: 1, status: 1 });
ChatSchema.index({ organizationId: 1, updatedAt: -1 });

