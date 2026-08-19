import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRepository } from './repositories/organization.repository';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly repo: OrganizationRepository) {}

  create(dto: CreateOrganizationDto) {
    return this.repo.create(dto);
  }

  findAll(page = 1, limit = 20) {
    return this.repo.findAll({}, page, limit);
  }

  async findOne(id: string) {
    const org = await this.repo.findById(id);
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  async findByVerifyToken(token: string) {
    return this.repo.findByVerifyToken(token);
  }

  async findByBusinessAccountId(businessAccountId: string) {
    return this.repo.findByBusinessAccountId(businessAccountId);
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const org = await this.repo.update(id, dto);
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  async remove(id: string) {
    const org = await this.repo.delete(id);
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }
}
