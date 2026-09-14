import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chat, ChatSchema } from '../chats/schemas/chat.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { MessageRepository } from './repositories/message.repository';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Chat.name, schema: ChatSchema },
    ]),
  ],
  providers: [MessageRepository, MessagesService, MessagesGateway],
  exports: [MessagesService],
})
export class MessagesModule {}
