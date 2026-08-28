import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeadRepository } from './repositories/lead.repository';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { LeadType } from './schemas/lead.schema';

@Injectable()
export class LeadsService implements OnModuleInit {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly repo: LeadRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.migrateOldLeads().catch((err) => {
      this.logger.warn(`Migration of old leads failed: ${err.message}`);
    });
  }

  private async migrateOldLeads() {
    const rawLeads = await this.repo.findRawAll();
    const grouped: Record<string, any[]> = {};

    for (const lead of rawLeads) {
      if (!lead.type) {
        await this.repo.updateRaw(lead._id.toString(), {
          type: LeadType.HOT,
        });
      }

      if (lead.order === undefined || lead.order === null) {
        const leadType = lead.type || LeadType.HOT;
        const key = `${lead.organizationId?.toString()}:${leadType}:${lead.status || 'NEW'}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(lead);
      }
    }

    let count = 0;
    for (const [, leads] of Object.entries(grouped)) {
      let currentOrder = 1;
      for (const lead of leads) {
        await this.repo.updateRaw(lead._id.toString(), {
          order: currentOrder++,
        });
        count++;
      }
    }

    if (count > 0) {
      this.logger.log(
        `[Migration] Successfully assigned sequential order to ${count} existing leads.`,
      );
    }
  }

  async createFromChat(
    organizationId: string,
    chatId: string,
    data: any,
    type: LeadType = LeadType.HOT,
  ) {
    this.logger.log(
      `Creating ${type} Lead for Chat ${chatId} (Org: ${organizationId}) with ${Array.isArray(data) ? data.length : Object.keys(data || {}).length} collected items`,
    );
    return this.repo.create({
      organizationId: organizationId as any,
      chatId: chatId as any,
      type,
      data,
    });
  }

  findAll(dto: ListLeadsDto) {
    this.logger.debug(
      `Listing leads for org ${dto.organizationId || 'all'}, type ${dto.type || 'all'}, status ${dto.status || 'all'}, page ${dto.page || 1}`,
    );
    const filter: Record<string, any> = {};
    if (dto.organizationId) filter.organizationId = dto.organizationId;
    if (dto.type) filter.type = dto.type;
    if (dto.status) filter.status = dto.status;
    return this.repo.findAll(filter, dto.page, dto.limit);
  }

  async getKanban(organizationId: string, type: LeadType) {
    this.logger.log(
      `[Kanban] Fetching ${type} leads for Kanban board (Org: ${organizationId})`,
    );
    return this.repo.findKanban(organizationId, type);
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

  async delete(id: string, organizationId?: string) {
    this.logger.log(`Deleting lead ${id} (org: ${organizationId || 'any'})`);
    const lead = await this.repo.findById(id);
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);

    if (organizationId && lead.organizationId.toString() !== organizationId) {
      throw new NotFoundException(`Lead ${id} not found in this organization`);
    }

    const deleted = await this.repo.delete(id);
    this.eventEmitter.emit('lead.deleted', {
      leadId: id,
      organizationId: lead.organizationId.toString(),
      status: lead.status,
      type: lead.type,
    });

    return {
      success: true,
      message: `Lead ${id} deleted successfully.`,
      lead: deleted,
    };
  }

  deleteByChatId(chatId: string) {
    this.logger.log(`Deleting lead for chat ${chatId}`);
    return this.repo.deleteByChatId(chatId);
  }
}
