import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export enum MessageDirection {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
}

export enum MessageSenderType {
  CUSTOMER = 'CUSTOMER',
  ASSISTENT = 'ASSISTENT',
  HUMAN = 'HUMAN',
}

export enum MessageType {
  TEXT = 'TEXT',
}

export enum MessageStatus {
  RECEIVED = 'RECEIVED',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Chat', required: true })
  chatId: Types.ObjectId;

  @Prop()
  externalMessageId: string;

  @Prop({ enum: MessageDirection, required: true })
  direction: MessageDirection;

  @Prop({ enum: MessageSenderType, required: true })
  senderType: MessageSenderType;

  @Prop({ enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ required: true })
  content: string;

  @Prop({ enum: MessageStatus, default: MessageStatus.RECEIVED })
  status: MessageStatus;

  @Prop({ default: () => new Date() })
  sentAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ chatId: 1, sentAt: 1 });
MessageSchema.index({ organizationId: 1 });
MessageSchema.index({ externalMessageId: 1 }, { unique: true, sparse: true });
