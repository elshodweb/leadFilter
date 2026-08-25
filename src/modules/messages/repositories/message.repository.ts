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
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ sentAt: 1 })
        .lean(),
      this.model.countDocuments({ chatId }),
    ]);
    return createPaginatedResponse(
      data as MessageDocument[],
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

  async deleteByChatId(chatId: string): Promise<any> {
    return this.model.deleteMany({ chatId });
  }
}
