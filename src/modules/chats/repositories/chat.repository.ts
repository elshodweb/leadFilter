import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { Chat, ChatDocument } from '../schemas/chat.schema';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '../../../common/dto/pagination.dto';

@Injectable()
export class ChatRepository {
  constructor(
    @InjectModel(Chat.name)
    private readonly model: Model<ChatDocument>,
  ) {}

  async findOrCreate(
    organizationId: string,
    externalChatId: string,
    defaults: Partial<Chat>,
  ): Promise<{ doc: ChatDocument; created: boolean }> {
    const existing = await this.model.findOne({
      organizationId,
      externalChatId,
    });
    if (existing) return { doc: existing, created: false };
    const doc = await this.model.create({
      organizationId,
      externalChatId,
      ...defaults,
    });
    return { doc, created: true };
  }

  async findAll(
    filter: Record<string, any>,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ChatDocument>> {
    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ updatedAt: -1 })
        .lean(),
      this.model.countDocuments(filter),
    ]);
    return createPaginatedResponse(data as ChatDocument[], total, page, limit);
  }

  async findById(id: string): Promise<ChatDocument | null> {
    return this.model.findById(id).lean() as Promise<ChatDocument | null>;
  }

  async update(
    id: string,
    update: UpdateQuery<Chat>,
  ): Promise<ChatDocument | null> {
    return this.model
      .findByIdAndUpdate(id, update, { returnDocument: 'after' })
      .lean() as Promise<ChatDocument | null>;
  }

  async updateCollectedData(
    chatId: string,
    data: Record<string, any>,
  ): Promise<ChatDocument | null> {
    return this.model
      .findByIdAndUpdate(
        chatId,
        { $set: { collectedData: data } },
        { returnDocument: 'after' },
      )
      .lean() as Promise<ChatDocument | null>;
  }

  async updateLastMessage(
    chatId: string,
    text: string,
    sentTime: Date,
  ): Promise<ChatDocument | null> {
    return this.model
      .findByIdAndUpdate(
        chatId,
        {
          $set: {
            lastMessage: { text, sentTime },
            updatedAt: sentTime,
          },
        },
        { returnDocument: 'after' },
      )
      .lean() as Promise<ChatDocument | null>;
  }

  async count(filter: Record<string, any> = {}): Promise<number> {
    return this.model.countDocuments(filter);
  }
}
