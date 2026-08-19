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
import { OrganizationsService } from './organizations.service';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import type { AuthenticatedSocket } from '../../common/interfaces/auth.interface';

@WebSocketGateway({ cors: { origin: '*' } })
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
export class OrganizationsGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(OrganizationsGateway.name);

  constructor(private readonly orgsService: OrganizationsService) {}

  @SubscribeMessage('org:get')
  async handleOrgGet(
    @MessageBody() _data: { organizationId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const orgId = client.user.organizationId;
    return this.orgsService.findOne(orgId);
  }

  @OnEvent('org.updated')
  broadcastOrgUpdated(org: any) {
    this.server.to(`org:${org._id.toString()}`).emit('org:updated', org);
  }
}
