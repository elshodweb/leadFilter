import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UseFilters, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { KnowledgeService } from './knowledge.service';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import type { AuthenticatedSocket } from '../../common/interfaces/auth.interface';

@WebSocketGateway({ cors: { origin: '*' } })
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
export class KnowledgeGateway {
  @WebSocketServer() server: Server;

  constructor(private readonly knowledgeService: KnowledgeService) {}

  @SubscribeMessage('knowledge:get')
  async handleKnowledgeGet(
    @MessageBody() _data: { organizationId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const orgId = client.user.organizationId;
    return this.knowledgeService.loadAiContext(orgId);
  }

  @OnEvent('knowledge.updated')
  broadcastKnowledgeUpdated(payload: { organizationId: string; data: any }) {
    this.server
      .to(`org:${payload.organizationId}`)
      .emit('knowledge:updated', payload.data);
  }
}
