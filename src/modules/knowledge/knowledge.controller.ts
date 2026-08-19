import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { CreateLeadQuestionDto } from './dto/create-lead-question.dto';
import { UpdateLeadQuestionDto } from './dto/update-lead-question.dto';
import { CreateCompanyInfoDto } from './dto/create-company-info.dto';
import { UpdateCompanyInfoDto } from './dto/update-company-info.dto';
import { CreateAdditionalInfoDto } from './dto/create-additional-info.dto';
import { UpdateAdditionalInfoDto } from './dto/update-additional-info.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Knowledge')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('organizations/:orgId')
export class KnowledgeController {
  constructor(private readonly svc: KnowledgeService) {}

  // ── Lead Questions ──────────────────────────────────────
  @Post('lead-questions')
  @ApiOperation({ summary: 'Add a lead question for an organization (Admin)' })
  @ApiParam({ name: 'orgId' })
  createLeadQuestion(
    @Param('orgId') orgId: string,
    @Body() dto: CreateLeadQuestionDto,
  ) {
    return this.svc.createLeadQuestion(orgId, dto);
  }

  @Get('lead-questions')
  @ApiOperation({
    summary: 'Get all lead questions for an organization (Admin)',
  })
  @ApiParam({ name: 'orgId' })
  getLeadQuestions(
    @Param('orgId') orgId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.svc.getLeadQuestions(orgId, pagination);
  }

  @Patch('lead-questions/:id')
  @ApiOperation({ summary: 'Update a lead question (Admin)' })
  updateLeadQuestion(
    @Param('id') id: string,
    @Body() dto: UpdateLeadQuestionDto,
  ) {
    return this.svc.updateLeadQuestion(id, dto);
  }

  @Delete('lead-questions/:id')
  @ApiOperation({ summary: 'Delete a lead question (Admin)' })
  deleteLeadQuestion(@Param('id') id: string) {
    return this.svc.deleteLeadQuestion(id);
  }

  // ── Company Information ─────────────────────────────────
  @Post('company-information')
  @ApiOperation({ summary: 'Add company information (Admin)' })
  @ApiParam({ name: 'orgId' })
  createCompanyInfo(
    @Param('orgId') orgId: string,
    @Body() dto: CreateCompanyInfoDto,
  ) {
    return this.svc.createCompanyInfo(orgId, dto);
  }

  @Get('company-information')
  @ApiOperation({ summary: 'Get all company information (Admin)' })
  @ApiParam({ name: 'orgId' })
  getCompanyInfo(
    @Param('orgId') orgId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.svc.getCompanyInfo(orgId, pagination);
  }

  @Patch('company-information/:id')
  @ApiOperation({ summary: 'Update company information item (Admin)' })
  updateCompanyInfo(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyInfoDto,
  ) {
    return this.svc.updateCompanyInfo(id, dto);
  }

  @Delete('company-information/:id')
  @ApiOperation({ summary: 'Delete company information item (Admin)' })
  deleteCompanyInfo(@Param('id') id: string) {
    return this.svc.deleteCompanyInfo(id);
  }

  // ── Additional Information ──────────────────────────────
  @Post('additional-information')
  @ApiOperation({ summary: 'Add additional information (Admin)' })
  @ApiParam({ name: 'orgId' })
  createAdditionalInfo(
    @Param('orgId') orgId: string,
    @Body() dto: CreateAdditionalInfoDto,
  ) {
    return this.svc.createAdditionalInfo(orgId, dto);
  }

  @Get('additional-information')
  @ApiOperation({ summary: 'Get all additional information (Admin)' })
  @ApiParam({ name: 'orgId' })
  getAdditionalInfo(
    @Param('orgId') orgId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.svc.getAdditionalInfo(orgId, pagination);
  }

  @Patch('additional-information/:id')
  @ApiOperation({ summary: 'Update additional information item (Admin)' })
  updateAdditionalInfo(
    @Param('id') id: string,
    @Body() dto: UpdateAdditionalInfoDto,
  ) {
    return this.svc.updateAdditionalInfo(id, dto);
  }

  @Delete('additional-information/:id')
  @ApiOperation({ summary: 'Delete additional information item (Admin)' })
  deleteAdditionalInfo(@Param('id') id: string) {
    return this.svc.deleteAdditionalInfo(id);
  }
}
