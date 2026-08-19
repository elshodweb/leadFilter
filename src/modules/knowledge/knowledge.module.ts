import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  LeadQuestion,
  LeadQuestionSchema,
} from './schemas/lead-question.schema';
import {
  CompanyInformation,
  CompanyInformationSchema,
} from './schemas/company-information.schema';
import {
  AdditionalInformation,
  AdditionalInformationSchema,
} from './schemas/additional-information.schema';
import { LeadQuestionRepository } from './repositories/lead-question.repository';
import { CompanyInformationRepository } from './repositories/company-information.repository';
import { AdditionalInformationRepository } from './repositories/additional-information.repository';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeGateway } from './knowledge.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LeadQuestion.name, schema: LeadQuestionSchema },
      { name: CompanyInformation.name, schema: CompanyInformationSchema },
      { name: AdditionalInformation.name, schema: AdditionalInformationSchema },
    ]),
  ],
  providers: [
    LeadQuestionRepository,
    CompanyInformationRepository,
    AdditionalInformationRepository,
    KnowledgeService,
    KnowledgeGateway,
  ],
  controllers: [KnowledgeController],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
