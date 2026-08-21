import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chat, ChatSchema } from './schemas/chat.schema';
import { ChatRepository } from './repositories/chat.repository';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { WebhookController } from './webhook.controller';
import { ChatsGateway } from './chats.gateway';
import { MessagesModule } from '../messages/messages.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AiModule } from '../ai/ai.module';
import { LeadsModule } from '../leads/leads.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { InstagramModule } from '../instagram/instagram.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Chat.name, schema: ChatSchema }]),
    MessagesModule,
    KnowledgeModule,
    AiModule,
    LeadsModule,
    OrganizationsModule,
    InstagramModule,
  ],
  providers: [ChatRepository, ChatsService, ChatsGateway],
  controllers: [ChatsController, WebhookController],
  exports: [ChatsService],
})
export class ChatsModule {}
