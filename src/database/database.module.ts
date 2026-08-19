import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SeederService } from './seeder.service';
import { User, UserSchema } from '../modules/users/schemas/user.schema';
import {
  Organization,
  OrganizationSchema,
} from '../modules/organizations/schemas/organization.schema';
import {
  LeadQuestion,
  LeadQuestionSchema,
} from '../modules/knowledge/schemas/lead-question.schema';
import {
  CompanyInformation,
  CompanyInformationSchema,
} from '../modules/knowledge/schemas/company-information.schema';
import {
  AdditionalInformation,
  AdditionalInformationSchema,
} from '../modules/knowledge/schemas/additional-information.schema';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
        dbName: configService.get<string>('mongodb.dbName'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: LeadQuestion.name, schema: LeadQuestionSchema },
      { name: CompanyInformation.name, schema: CompanyInformationSchema },
      { name: AdditionalInformation.name, schema: AdditionalInformationSchema },
    ]),
  ],
  providers: [SeederService],
  exports: [SeederService],
})
export class DatabaseModule {}
