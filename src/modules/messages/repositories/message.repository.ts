import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '../../../common/dto/pagination.dto';

@Injectable()
export class MessageRepository {
  constructor(
    @InjectModel(Message.name)
    private readonly model: Model<MessageDocument>,
  ) {}

  async create(data: Partial<Message>): Promise<MessageDocument> {
    return this.model.create(data);
  }

  async findByChatId(
    chatId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<MessageDocument>> {
    const [data, total] = await Promise.all([
      this.model
        .find({ chatId })
        .sort({ sentAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.model.countDocuments({ chatId }),
    ]);

    // Reverse so messages in the batch are in chronological order (oldest -> newest, with items[items.length - 1] being the latest message)
    const chronologicalData = (data as MessageDocument[]).reverse();

    return createPaginatedResponse(
      chronologicalData,
      total,
      page,
      limit,
    );
  }

  async findLastN(chatId: string, n = 20): Promise<MessageDocument[]> {
    return this.model
      .find({ chatId })
      .sort({ sentAt: -1, createdAt: -1 })
      .limit(n)
      .lean() as Promise<MessageDocument[]>;
  }

  async findByExternalMessageId(
    externalMessageId: string,
  ): Promise<MessageDocument | null> {
    if (!externalMessageId) return null;
    return this.model
      .findOne({ externalMessageId })
      .lean() as Promise<MessageDocument | null>;
  }

  async updateExternalMessageId(
    id: string,
    externalMessageId: string,
  ): Promise<MessageDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: { externalMessageId } }, { new: true })
      .lean() as Promise<MessageDocument | null>;
  }

  async deleteByChatId(chatId: string): Promise<any> {
    return this.model.deleteMany({ chatId });
  }
}
