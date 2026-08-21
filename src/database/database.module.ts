import { Logger, Module } from '@nestjs/common';
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
        connectionFactory: (connection) => {
          const logger = new Logger('Database');
          const dbName = configService.get<string>('mongodb.dbName') || 'default';
          connection.on('connected', () => {
            logger.log(`🍃 Connected to MongoDB database: [${dbName}]`);
          });
          connection.on('error', (err: any) => {
            logger.error(`❌ MongoDB connection error: ${err.message}`, err.stack);
          });
          connection.on('disconnected', () => {
            logger.warn('⚠️  MongoDB disconnected');
          });
          connection.on('reconnected', () => {
            logger.log('🔄 MongoDB reconnected');
          });
          return connection;
        },
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
