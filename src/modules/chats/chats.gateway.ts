import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
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

import { UserRole } from '../users/schemas/user.schema';

@WebSocketGateway({ cors: { origin: '*' } })
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
export class ChatsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatsGateway.name);

  constructor(private readonly chatsService: ChatsService) {}

  afterInit() {
    this.logger.log('ChatsGateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`[WS Client Connected] Socket ID: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`[WS Client Disconnected] Socket ID: ${client.id}`);
  }

  /** Join an organization room to receive all org-level events */
  @SubscribeMessage('join:org')
  handleJoinOrg(
    @MessageBody() data: { organizationId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const isAdmin = client.user.role === UserRole.ADMIN;
    const targetOrgId =
      isAdmin && data?.organizationId
        ? data.organizationId
        : client.user.organizationId;

    if (!isAdmin && data?.organizationId && data.organizationId !== client.user.organizationId) {
      this.logger.warn(
        `[WS join:org] Access denied for User ${client.user.email} (Role: ${client.user.role}) to Org room ${data.organizationId}`,
      );
      throw new WsException('Access denied to other organization room');
    }

    client.join(`org:${targetOrgId}`);
    this.logger.log(
      `[WS join:org] User ${client.user.email} (Role: ${client.user.role}, Socket ${client.id}) joined room "org:${targetOrgId}"`,
    );
    return { event: 'joined', data: `org:${targetOrgId}` };
  }

  /** Join a specific chat room */
  @SubscribeMessage('join:chat')
  async handleJoinChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const chat = await this.chatsService.findOne(data.chatId);
    if (!chat) {
      this.logger.warn(`[WS join:chat] Chat not found: ${data.chatId}`);
      throw new WsException('Chat not found');
    }

    const isAdmin = client.user.role === UserRole.ADMIN;
    if (
      !isAdmin &&
      chat.organizationId.toString() !== client.user.organizationId
    ) {
      this.logger.warn(
        `[WS join:chat] Access denied for User ${client.user.email} to chat ${data.chatId}`,
      );
      throw new WsException('Access denied to chat from another organization');
    }

    client.join(`chat:${data.chatId}`);
    this.logger.log(
      `[WS join:chat] User ${client.user.email} (Socket ${client.id}) joined room "chat:${data.chatId}"`,
    );
    return { event: 'joined', data: `chat:${data.chatId}` };
  }

  /** Get paginated chat list for the authenticated organization */
  @SubscribeMessage('chat:list')
  @UsePipes(WsValidationPipe)
  async handleChatList(
    @MessageBody() dto: ListChatsDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    dto = dto || {};
    const isAdmin = client.user.role === UserRole.ADMIN;
    if (!isAdmin) {
      dto.organizationId = client.user.organizationId;
    }

    this.logger.debug(
      `[WS chat:list] User ${client.user.email} (Org: ${dto.organizationId || 'ALL'}, Page: ${dto.page || 1})`,
    );
    return this.chatsService.findAll(dto);
  }

  /** Get chat stats and counts per status tab */
  @SubscribeMessage('chat:stats')
  async handleChatStats(
    @MessageBody() data: { organizationId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const isAdmin = client.user.role === UserRole.ADMIN;
    const targetOrgId =
      isAdmin && data?.organizationId
        ? data.organizationId
        : client.user.organizationId;
    return this.chatsService.getStats(targetOrgId);
  }

  /** Get single chat */
  @SubscribeMessage('chat:get')
  async handleChatGet(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    this.logger.debug(`[WS chat:get] User: ${client.user.email}, ChatId: ${data.chatId}`);
    const chat = await this.chatsService.findOne(data.chatId);
    if (!chat) {
      throw new WsException('Chat not found');
    }

    const isAdmin = client.user.role === UserRole.ADMIN;
    if (
      !isAdmin &&
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
    @MessageBody()
    data: { chatId: string; dto?: UpdateChatDto } & UpdateChatDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const chatId = data?.chatId;
    if (!chatId) {
      throw new WsException('chatId is required');
    }

    const dto: UpdateChatDto = data?.dto || {
      status: data?.status,
      ai_enabled: data?.ai_enabled,
    };

    this.logger.log(
      `[WS chat:update] User: ${client.user.email}, ChatId: ${chatId}, DTO: ${JSON.stringify(dto)}`,
    );
    const chat = await this.chatsService.findOne(chatId);
    if (!chat) {
      throw new WsException('Chat not found');
    }

    const isAdmin = client.user.role === UserRole.ADMIN;
    if (
      !isAdmin &&
      chat.organizationId.toString() !== client.user.organizationId
    ) {
      throw new WsException('Access denied to chat from another organization');
    }
    return this.chatsService.update(chatId, dto);
  }

  /** Delete a chat and all its messages */
  @SubscribeMessage('chat:delete')
  async handleChatDelete(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    this.logger.log(
      `[WS chat:delete] User: ${client.user.email}, ChatId: ${data.chatId}`,
    );
    const chat = await this.chatsService.findOne(data.chatId);
    if (!chat) {
      throw new WsException('Chat not found');
    }

    const isAdmin = client.user.role === UserRole.ADMIN;
    if (
      !isAdmin &&
      chat.organizationId.toString() !== client.user.organizationId
    ) {
      throw new WsException('Access denied to chat from another organization');
    }
    return this.chatsService.delete(data.chatId, chat.organizationId.toString());
  }

  // ── Event-driven broadcasts ───────────────────────────────────

  @OnEvent('chat.new')
  broadcastNewChat(chat: any) {
    this.logger.debug(
      `[WS Broadcast chat:new] Emitting to room "org:${chat.organizationId}" for Chat ${chat._id}`,
    );
    this.server.to(`org:${chat.organizationId}`).emit('chat:new', chat);
  }

  @OnEvent('chat.updated')
  broadcastChatUpdated(chat: any) {
    this.logger.debug(
      `[WS Broadcast chat:updated] Emitting to room "org:${chat.organizationId}" for Chat ${chat._id}`,
    );
    this.server.to(`org:${chat.organizationId}`).emit('chat:updated', chat);
  }

  @OnEvent('chat.deleted')
  broadcastChatDeleted(payload: { chatId: string; organizationId: string }) {
    this.logger.debug(
      `[WS Broadcast chat:deleted] Emitting to room "org:${payload.organizationId}" for Chat ${payload.chatId}`,
    );
    this.server
      .to(`org:${payload.organizationId}`)
      .emit('chat:deleted', payload);
  }
}
