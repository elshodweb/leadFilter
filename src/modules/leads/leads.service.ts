import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeadRepository } from './repositories/lead.repository';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly repo: LeadRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createFromChat(
    organizationId: string,
    chatId: string,
    data: any,
  ) {
    this.logger.log(
      `Creating Lead for Chat ${chatId} (Org: ${organizationId}) with ${Array.isArray(data) ? data.length : Object.keys(data || {}).length} collected items`,
    );
    return this.repo.create({
      organizationId: organizationId as any,
      chatId: chatId as any,
      data,
    });
  }

  findAll(dto: ListLeadsDto) {
    this.logger.debug(
      `Listing leads for org ${dto.organizationId || 'all'}, status ${dto.status || 'all'}, page ${dto.page || 1}`,
    );
    const filter: Record<string, any> = {};
    if (dto.organizationId) filter.organizationId = dto.organizationId;
    if (dto.status) filter.status = dto.status;
    return this.repo.findAll(filter, dto.page, dto.limit);
  }

  async findOne(id: string) {
    this.logger.debug(`Fetching lead by id: ${id}`);
    const lead = await this.repo.findById(id);
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async findByChatId(chatId: string) {
    this.logger.debug(`Finding lead by chatId: ${chatId}`);
    return this.repo.findByChatId(chatId);
  }

  async update(id: string, dto: UpdateLeadDto) {
    this.logger.log(`Updating lead ${id}: ${JSON.stringify(dto)}`);
    const lead = await this.repo.update(id, dto);
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    this.eventEmitter.emit('lead.updated', lead);
    return lead;
  }

  deleteByChatId(chatId: string) {
    this.logger.log(`Deleting lead for chat ${chatId}`);
    return this.repo.deleteByChatId(chatId);
  }
}
