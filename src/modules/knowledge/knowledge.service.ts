import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadQuestionRepository } from './repositories/lead-question.repository';
import { CompanyInformationRepository } from './repositories/company-information.repository';
import { AdditionalInformationRepository } from './repositories/additional-information.repository';
import { CreateLeadQuestionDto } from './dto/create-lead-question.dto';
import { UpdateLeadQuestionDto } from './dto/update-lead-question.dto';
import { CreateCompanyInfoDto } from './dto/create-company-info.dto';
import { UpdateCompanyInfoDto } from './dto/update-company-info.dto';
import { CreateAdditionalInfoDto } from './dto/create-additional-info.dto';
import { UpdateAdditionalInfoDto } from './dto/update-additional-info.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly leadQuestionRepo: LeadQuestionRepository,
    private readonly companyInfoRepo: CompanyInformationRepository,
    private readonly additionalInfoRepo: AdditionalInformationRepository,
  ) {}

  // ── Lead Questions ────────────────────────────────────────────
  createLeadQuestion(orgId: string, dto: CreateLeadQuestionDto) {
    return this.leadQuestionRepo.create(orgId, dto);
  }

  getLeadQuestions(orgId: string, pagination?: PaginationDto) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    return this.leadQuestionRepo.findPaginatedByOrg(orgId, page, limit);
  }

  async updateLeadQuestion(id: string, dto: UpdateLeadQuestionDto) {
    const item = await this.leadQuestionRepo.update(id, dto);
    if (!item) throw new NotFoundException(`LeadQuestion ${id} not found`);
    return item;
  }

  async deleteLeadQuestion(id: string) {
    const item = await this.leadQuestionRepo.delete(id);
    if (!item) throw new NotFoundException(`LeadQuestion ${id} not found`);
    return item;
  }

  // ── Company Information ───────────────────────────────────────
  createCompanyInfo(orgId: string, dto: CreateCompanyInfoDto) {
    return this.companyInfoRepo.create(orgId, dto);
  }

  getCompanyInfo(orgId: string, pagination?: PaginationDto) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    return this.companyInfoRepo.findPaginatedByOrg(orgId, page, limit);
  }

  async updateCompanyInfo(id: string, dto: UpdateCompanyInfoDto) {
    const item = await this.companyInfoRepo.update(id, dto);
    if (!item)
      throw new NotFoundException(`CompanyInformation ${id} not found`);
    return item;
  }

  async deleteCompanyInfo(id: string) {
    const item = await this.companyInfoRepo.delete(id);
    if (!item)
      throw new NotFoundException(`CompanyInformation ${id} not found`);
    return item;
  }

  // ── Additional Information ────────────────────────────────────
  createAdditionalInfo(orgId: string, dto: CreateAdditionalInfoDto) {
    return this.additionalInfoRepo.create(orgId, dto);
  }

  getAdditionalInfo(orgId: string, pagination?: PaginationDto) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    return this.additionalInfoRepo.findPaginatedByOrg(orgId, page, limit);
  }

  async updateAdditionalInfo(id: string, dto: UpdateAdditionalInfoDto) {
    const item = await this.additionalInfoRepo.update(id, dto);
    if (!item)
      throw new NotFoundException(`AdditionalInformation ${id} not found`);
    return item;
  }

  async deleteAdditionalInfo(id: string) {
    const item = await this.additionalInfoRepo.delete(id);
    if (!item)
      throw new NotFoundException(`AdditionalInformation ${id} not found`);
    return item;
  }

  // ── AI Context Loader (used by ChatsService) ──────────────────
  async loadAiContext(organizationId: string) {
    const [leadQuestions, companyInfo, additionalInfo] = await Promise.all([
      this.leadQuestionRepo.findByOrg(organizationId),
      this.companyInfoRepo.findByOrg(organizationId),
      this.additionalInfoRepo.findByOrg(organizationId),
    ]);
    return { leadQuestions, companyInfo, additionalInfo };
  }
}
