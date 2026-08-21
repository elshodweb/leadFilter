import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly leadQuestionRepo: LeadQuestionRepository,
    private readonly companyInfoRepo: CompanyInformationRepository,
    private readonly additionalInfoRepo: AdditionalInformationRepository,
  ) {}

  // ── Lead Questions ────────────────────────────────────────────
  createLeadQuestion(orgId: string, dto: CreateLeadQuestionDto) {
    this.logger.log(`[Org ${orgId}] Creating lead question: "${dto.title}"`);
    return this.leadQuestionRepo.create(orgId, dto);
  }

  getLeadQuestions(orgId: string, pagination?: PaginationDto) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    this.logger.debug(`[Org ${orgId}] Listing lead questions (page=${page}, limit=${limit})`);
    return this.leadQuestionRepo.findPaginatedByOrg(orgId, page, limit);
  }

  async updateLeadQuestion(id: string, dto: UpdateLeadQuestionDto) {
    this.logger.log(`Updating lead question ${id}: ${JSON.stringify(dto)}`);
    const item = await this.leadQuestionRepo.update(id, dto);
    if (!item) throw new NotFoundException(`LeadQuestion ${id} not found`);
    return item;
  }

  async deleteLeadQuestion(id: string) {
    this.logger.log(`Deleting lead question ${id}`);
    const item = await this.leadQuestionRepo.delete(id);
    if (!item) throw new NotFoundException(`LeadQuestion ${id} not found`);
    return item;
  }

  // ── Company Information ───────────────────────────────────────
  createCompanyInfo(orgId: string, dto: CreateCompanyInfoDto) {
    this.logger.log(`[Org ${orgId}] Creating company info: "${dto.title}"`);
    return this.companyInfoRepo.create(orgId, dto);
  }

  getCompanyInfo(orgId: string, pagination?: PaginationDto) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    this.logger.debug(`[Org ${orgId}] Listing company info (page=${page}, limit=${limit})`);
    return this.companyInfoRepo.findPaginatedByOrg(orgId, page, limit);
  }

  async updateCompanyInfo(id: string, dto: UpdateCompanyInfoDto) {
    this.logger.log(`Updating company info ${id}: ${JSON.stringify(dto)}`);
    const item = await this.companyInfoRepo.update(id, dto);
    if (!item)
      throw new NotFoundException(`CompanyInformation ${id} not found`);
    return item;
  }

  async deleteCompanyInfo(id: string) {
    this.logger.log(`Deleting company info ${id}`);
    const item = await this.companyInfoRepo.delete(id);
    if (!item)
      throw new NotFoundException(`CompanyInformation ${id} not found`);
    return item;
  }

  // ── Additional Information ────────────────────────────────────
  createAdditionalInfo(orgId: string, dto: CreateAdditionalInfoDto) {
    this.logger.log(`[Org ${orgId}] Creating additional info: "${dto.title}"`);
    return this.additionalInfoRepo.create(orgId, dto);
  }

  getAdditionalInfo(orgId: string, pagination?: PaginationDto) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    this.logger.debug(`[Org ${orgId}] Listing additional info (page=${page}, limit=${limit})`);
    return this.additionalInfoRepo.findPaginatedByOrg(orgId, page, limit);
  }

  async updateAdditionalInfo(id: string, dto: UpdateAdditionalInfoDto) {
    this.logger.log(`Updating additional info ${id}: ${JSON.stringify(dto)}`);
    const item = await this.additionalInfoRepo.update(id, dto);
    if (!item)
      throw new NotFoundException(`AdditionalInformation ${id} not found`);
    return item;
  }

  async deleteAdditionalInfo(id: string) {
    this.logger.log(`Deleting additional info ${id}`);
    const item = await this.additionalInfoRepo.delete(id);
    if (!item)
      throw new NotFoundException(`AdditionalInformation ${id} not found`);
    return item;
  }

  // ── AI Context Loader (used by ChatsService) ──────────────────
  async loadAiContext(organizationId: string) {
    this.logger.debug(`Loading AI knowledge context for organization: ${organizationId}`);
    const [leadQuestions, companyInfo, additionalInfo] = await Promise.all([
      this.leadQuestionRepo.findByOrg(organizationId),
      this.companyInfoRepo.findByOrg(organizationId),
      this.additionalInfoRepo.findByOrg(organizationId),
    ]);
    return { leadQuestions, companyInfo, additionalInfo };
  }
}
