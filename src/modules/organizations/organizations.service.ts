import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrganizationRepository } from './repositories/organization.repository';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly repo: OrganizationRepository) {}

  create(dto: CreateOrganizationDto) {
    this.logger.log(`Creating organization "${dto.name}"`);
    return this.repo.create(dto);
  }

  findAll(page = 1, limit = 20) {
    this.logger.debug(`Listing organizations (page=${page}, limit=${limit})`);
    return this.repo.findAll({}, page, limit);
  }

  async findOne(id: string) {
    this.logger.debug(`Fetching organization ${id}`);
    const org = await this.repo.findById(id);
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  async findByVerifyToken(token: string) {
    this.logger.debug(`Finding organization by verify token`);
    return this.repo.findByVerifyToken(token);
  }

  async findByBusinessAccountId(businessAccountId: string) {
    this.logger.debug(`Finding organization by Instagram businessAccountId: ${businessAccountId}`);
    return this.repo.findByBusinessAccountId(businessAccountId);
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    this.logger.log(`Updating organization ${id}: ${JSON.stringify(dto)}`);
    const org = await this.repo.update(id, dto);
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  async remove(id: string) {
    this.logger.log(`Deleting organization ${id}`);
    const org = await this.repo.delete(id);
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }
}
