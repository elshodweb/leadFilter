import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UseFilters, UseGuards, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { KnowledgeService } from './knowledge.service';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import type { AuthenticatedSocket } from '../../common/interfaces/auth.interface';

import { UserRole } from '../users/schemas/user.schema';

@WebSocketGateway({ cors: { origin: '*' } })
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
export class KnowledgeGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(KnowledgeGateway.name);

  constructor(private readonly knowledgeService: KnowledgeService) {}

  @SubscribeMessage('knowledge:get')
  async handleKnowledgeGet(
    @MessageBody() _data: { organizationId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const isAdmin = client.user.role === UserRole.ADMIN;
    const orgId =
      isAdmin && _data?.organizationId
        ? _data.organizationId
        : client.user.organizationId;

    this.logger.debug(`[WS knowledge:get] User ${client.user.email} for Org ${orgId}`);
    return this.knowledgeService.loadAiContext(orgId);
  }

  @OnEvent('knowledge.updated')
  broadcastKnowledgeUpdated(payload: { organizationId: string; data: any }) {
    this.logger.debug(
      `[WS Broadcast knowledge:updated] Emitting to room "org:${payload.organizationId}"`,
    );
    this.server
      .to(`org:${payload.organizationId}`)
      .emit('knowledge:updated', payload.data);
  }
}
