import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lead, LeadSchema } from './schemas/lead.schema';
import { LeadRepository } from './repositories/lead.repository';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadsGateway } from './leads.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
  ],
  providers: [LeadRepository, LeadsService, LeadsGateway],
  controllers: [LeadsController],
  exports: [LeadsService],
})
export class LeadsModule {}
