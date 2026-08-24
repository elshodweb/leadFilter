import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
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
  ) {}

  /** Get paginated messages for a chat */
  @SubscribeMessage('messages:list')
  @UsePipes(WsValidationPipe)
  async handleMessageList(@MessageBody() dto: ListMessagesDto) {
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
    const orgId = client.user.organizationId;
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
