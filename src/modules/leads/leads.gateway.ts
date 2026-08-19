import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LeadsService } from './leads.service';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { WsValidationPipe } from '../../common/pipes/ws-validation.pipe';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { WsException } from '@nestjs/websockets';
import type { AuthenticatedSocket } from '../../common/interfaces/auth.interface';

@WebSocketGateway({ cors: { origin: '*' } })
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
export class LeadsGateway {
  @WebSocketServer() server: Server;

  constructor(private readonly leadsService: LeadsService) {}

  @SubscribeMessage('lead:list')
  @UsePipes(WsValidationPipe)
  handleLeadList(
    @MessageBody() dto: ListLeadsDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    dto.organizationId = client.user.organizationId;
    return this.leadsService.findAll(dto);
  }

  @SubscribeMessage('lead:get')
  async handleLeadGet(
    @MessageBody() data: { leadId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const lead = await this.leadsService.findOne(data.leadId);
    if (
      !lead ||
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
    const lead = await this.leadsService.findOne(data.leadId);
    if (
      !lead ||
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
    this.server.to(`org:${lead.organizationId}`).emit('lead:new', lead);
  }

  @OnEvent('lead.updated')
  broadcastLeadUpdated(lead: any) {
    this.server.to(`org:${lead.organizationId}`).emit('lead:updated', lead);
  }
}
