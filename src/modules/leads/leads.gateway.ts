import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UseFilters, UseGuards, UsePipes, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LeadsService } from './leads.service';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { WsValidationPipe } from '../../common/pipes/ws-validation.pipe';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { WsException } from '@nestjs/websockets';
import type { AuthenticatedSocket } from '../../common/interfaces/auth.interface';

import { UserRole } from '../users/schemas/user.schema';

@WebSocketGateway({ cors: { origin: '*' } })
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
export class LeadsGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(LeadsGateway.name);

  constructor(private readonly leadsService: LeadsService) {}

  @SubscribeMessage('lead:list')
  @UsePipes(WsValidationPipe)
  handleLeadList(
    @MessageBody() dto: ListLeadsDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    dto = dto || {};
    const isAdmin = client.user.role === UserRole.ADMIN;
    if (!isAdmin) {
      dto.organizationId = client.user.organizationId;
    }

    this.logger.debug(
      `[WS lead:list] User ${client.user.email} (Org: ${dto.organizationId || 'ALL'}, Page: ${dto.page || 1})`,
    );
    return this.leadsService.findAll(dto);
  }

  @SubscribeMessage('lead:get')
  async handleLeadGet(
    @MessageBody() data: { leadId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    this.logger.debug(`[WS lead:get] User ${client.user.email}, LeadId: ${data.leadId}`);
    const lead = await this.leadsService.findOne(data.leadId);
    if (!lead) {
      throw new WsException('Lead not found');
    }

    const isAdmin = client.user.role === UserRole.ADMIN;
    if (
      !isAdmin &&
      lead.organizationId.toString() !== client.user.organizationId
    ) {
      throw new WsException('Access denied to lead from another organization');
    }
    return lead;
  }

  @SubscribeMessage('lead:update')
  @UsePipes(WsValidationPipe)
  async handleLeadUpdate(
    @MessageBody() data: { leadId: string; dto: UpdateLeadDto },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    this.logger.log(
      `[WS lead:update] User ${client.user.email} -> Lead ${data.leadId}, DTO: ${JSON.stringify(data.dto)}`,
    );
    const lead = await this.leadsService.findOne(data.leadId);
    if (!lead) {
      throw new WsException('Lead not found');
    }

    const isAdmin = client.user.role === UserRole.ADMIN;
    if (
      !isAdmin &&
      lead.organizationId.toString() !== client.user.organizationId
    ) {
      throw new WsException('Access denied to lead from another organization');
    }
    const updated = await this.leadsService.update(data.leadId, data.dto);
    return updated;
  }

  // ── Event-driven broadcasts ───────────────────────────────────

  @OnEvent('lead.new')
  broadcastNewLead(lead: any) {
    this.logger.log(
      `[WS Broadcast lead:new] Emitting to room "org:${lead.organizationId}" for Lead ${lead._id}`,
    );
    this.server.to(`org:${lead.organizationId}`).emit('lead:new', lead);
  }

  @OnEvent('lead.updated')
  broadcastLeadUpdated(lead: any) {
    this.logger.debug(
      `[WS Broadcast lead:updated] Emitting to room "org:${lead.organizationId}" for Lead ${lead._id}`,
    );
    this.server.to(`org:${lead.organizationId}`).emit('lead:updated', lead);
  }
}
