import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Chat, ChatSchema } from '../chats/schemas/chat.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Message, MessageSchema } from '../messages/schemas/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
