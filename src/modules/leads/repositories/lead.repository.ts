import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lead, LeadDocument } from '../schemas/lead.schema';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '../../../common/dto/pagination.dto';

@Injectable()
export class LeadRepository {
  constructor(
    @InjectModel(Lead.name)
    private readonly model: Model<LeadDocument>,
  ) {}

  async create(data: Partial<Lead>): Promise<LeadDocument> {
    return this.model.create(data);
  }

  async findAll(
    filter: Record<string, any>,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<LeadDocument>> {
    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      this.model.countDocuments(filter),
    ]);
    return createPaginatedResponse(data as LeadDocument[], total, page, limit);
  }

  async findById(id: string): Promise<LeadDocument | null> {
    return this.model.findById(id).lean() as Promise<LeadDocument | null>;
  }

  async findByChatId(chatId: string): Promise<LeadDocument | null> {
    return this.model
      .findOne({ chatId })
      .lean() as Promise<LeadDocument | null>;
  }

  async update(id: string, data: Partial<Lead>): Promise<LeadDocument | null> {
    return this.model
      .findByIdAndUpdate(id, data, { returnDocument: 'after' })
      .lean() as Promise<LeadDocument | null>;
  }
}
