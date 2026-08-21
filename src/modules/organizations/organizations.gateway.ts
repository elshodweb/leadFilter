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

import { UserRole } from '../users/schemas/user.schema';

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
    const isAdmin = client.user.role === UserRole.ADMIN;
    const orgId =
      isAdmin && _data?.organizationId
        ? _data.organizationId
        : client.user.organizationId;

    this.logger.debug(`[WS org:get] User ${client.user.email} requesting Org ${orgId}`);
    return this.orgsService.findOne(orgId);
  }

  @OnEvent('org.updated')
  broadcastOrgUpdated(org: any) {
    this.logger.debug(
      `[WS Broadcast org.updated] Emitting to room "org:${org._id.toString()}"`,
    );
    this.server.to(`org:${org._id.toString()}`).emit('org:updated', org);
  }
}
