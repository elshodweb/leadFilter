import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UsePipes, UseFilters, UseGuards, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatsService } from './chats.service';
import { ListChatsDto } from './dto/list-chats.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { WsValidationPipe } from '../../common/pipes/ws-validation.pipe';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { WsException } from '@nestjs/websockets';
import type { AuthenticatedSocket } from '../../common/interfaces/auth.interface';

@WebSocketGateway({ cors: { origin: '*' } })
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
export class ChatsGateway implements OnGatewayInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatsGateway.name);

  constructor(private readonly chatsService: ChatsService) {}

  afterInit() {
    this.logger.log('ChatsGateway initialized');
  }

  /** Join an organization room to receive all org-level events */
  @SubscribeMessage('join:org')
  handleJoinOrg(
    @MessageBody() data: { organizationId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const orgId = client.user.organizationId;
    if (data?.organizationId && data.organizationId !== orgId) {
      throw new WsException('Access denied to other organization room');
    }
    client.join(`org:${orgId}`);
    return { event: 'joined', data: `org:${orgId}` };
  }

  /** Join a specific chat room */
  @SubscribeMessage('join:chat')
  async handleJoinChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const chat = await this.chatsService.findOne(data.chatId);
    if (
      !chat ||
      chat.organizationId.toString() !== client.user.organizationId
    ) {
      throw new WsException('Access denied to chat from another organization');
    }
    client.join(`chat:${data.chatId}`);
    return { event: 'joined', data: `chat:${data.chatId}` };
  }

  /** Get paginated chat list for the authenticated organization */
  @SubscribeMessage('chat:list')
  @UsePipes(WsValidationPipe)
  async handleChatList(
    @MessageBody() dto: ListChatsDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    dto.organizationId = client.user.organizationId;
    return this.chatsService.findAll(dto);
  }

  /** Get single chat */
  @SubscribeMessage('chat:get')
  async handleChatGet(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const chat = await this.chatsService.findOne(data.chatId);
    if (
      !chat ||
      chat.organizationId.toString() !== client.user.organizationId
    ) {
      throw new WsException('Access denied to chat from another organization');
    }
    return chat;
  }

  /** Update chat status (e.g. return to human) */
  @SubscribeMessage('chat:update')
  @UsePipes(WsValidationPipe)
  async handleChatUpdate(
    @MessageBody() data: { chatId: string; dto: UpdateChatDto },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const chat = await this.chatsService.findOne(data.chatId);
    if (
      !chat ||
      chat.organizationId.toString() !== client.user.organizationId
    ) {
      throw new WsException('Access denied to chat from another organization');
    }
    return this.chatsService.update(data.chatId, data.dto);
  }

  // ── Event-driven broadcasts ───────────────────────────────────

  @OnEvent('chat.new')
  broadcastNewChat(chat: any) {
    this.server.to(`org:${chat.organizationId}`).emit('chat:new', chat);
  }

  @OnEvent('chat.updated')
  broadcastChatUpdated(chat: any) {
    this.server.to(`org:${chat.organizationId}`).emit('chat:updated', chat);
  }
}
