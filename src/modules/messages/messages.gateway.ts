import {
  WsException,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { InjectModel } from '@nestjs/mongoose';
import { isMongoId } from 'class-validator';
import { Model } from 'mongoose';
import { Chat, ChatDocument } from '../chats/schemas/chat.schema';
import { UserRole } from '../users/schemas/user.schema';
import { Server } from 'socket.io';
import { UseFilters, UseGuards, UsePipes, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { MessagesService } from './messages.service';
import { ListMessagesDto } from './dto/list-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { WsValidationPipe } from '../../common/pipes/ws-validation.pipe';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import type { AuthenticatedSocket } from '../../common/interfaces/auth.interface';

@WebSocketGateway({ cors: { origin: '*' } })
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
export class MessagesGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly eventEmitter: EventEmitter2,
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
  ) {}

  /** Get paginated messages for a chat */
  @SubscribeMessage('messages:list')
  @UsePipes(WsValidationPipe)
  async handleMessageList(
    @MessageBody() dto: ListMessagesDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    await this.requireChat(dto.chatId, client);
    this.logger.debug(
      `[WS messages:list] ChatId: ${dto.chatId}, Page: ${dto.page || 1}, Limit: ${dto.limit || 20}`,
    );
    return this.messagesService.getChatHistory(
      dto.chatId,
      dto.page ?? 1,
      dto.limit ?? 20,
    );
  }

  /** Human agent sends a message into a chat */
  @SubscribeMessage('message:send')
  @UsePipes(WsValidationPipe)
  async handleSendMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const chat = await this.requireChat(dto.chatId, client);
    const orgId = chat.organizationId.toString();
    this.logger.log(
      `[WS message:send] Agent ${client.user.email} -> Chat ${dto.chatId}: "${dto.content.substring(0, 40)}..."`,
    );

    const msg = await this.messagesService.saveHumanMessage(
      orgId,
      dto.chatId,
      dto.content,
    );
    this.eventEmitter.emit('message.human', {
      chatId: dto.chatId,
      organizationId: orgId,
      content: dto.content,
      message: msg,
    });
    this.eventEmitter.emit('message.new', msg);
    return msg;
  }

  private async requireChat(chatId: string, client: AuthenticatedSocket) {
    if (!isMongoId(chatId)) throw new WsException('Invalid chatId');
    const filter: Record<string, string> = { _id: chatId };
    if (client.user.role !== UserRole.ADMIN) {
      filter.organizationId = client.user.organizationId;
    }
    const chat = await this.chatModel.findOne(filter).lean().exec();
    if (!chat) throw new WsException('Chat not found');
    return chat;
  }

  // ── Event-driven broadcasts (fired by ChatsService) ───────────

  @OnEvent('message.new')
  broadcastNewMessage(message: any) {
    const chatId = message.chatId?.toString();
    const orgId = message.organizationId?.toString();
    this.logger.debug(
      `[WS Broadcast message:new] Emitting to room "chat:${chatId}" and "org:${orgId}"`,
    );
    this.server
      .to([`chat:${chatId}`, `org:${orgId}`])
      .emit('message:new', message);
  }

  @OnEvent('message.ai')
  broadcastAiMessage(message: any) {
    const chatId = message.chatId?.toString();
    const orgId = message.organizationId?.toString();
    this.logger.debug(
      `[WS Broadcast message:ai] Emitting AI reply to room "chat:${chatId}" and "org:${orgId}"`,
    );
    this.server
      .to([`chat:${chatId}`, `org:${orgId}`])
      .emit('message:ai', message);
  }
}
