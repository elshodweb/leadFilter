import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { Chat, ChatDocument, ChatStatus } from '../schemas/chat.schema';
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

  private normalizeChat(chat: any): any {
    if (!chat) return chat;

    // 1. Normalize legacy status
    if (chat.status === 'AI_PROCESSING' || chat.status === 'RETURNED_HUMAN') {
      if (chat.status === 'RETURNED_HUMAN') {
        chat.ai_enabled = false;
      }
      chat.status = ChatStatus.COLD;
    }

    // 2. Ensure ai_enabled boolean
    if (chat.ai_enabled === undefined) {
      chat.ai_enabled = true;
    }

    // 3. Normalize collectedData to Array of { id, title, value }
    if (
      chat.collectedData &&
      !Array.isArray(chat.collectedData) &&
      typeof chat.collectedData === 'object'
    ) {
      chat.collectedData = Object.entries(chat.collectedData).map(
        ([title, val]) => ({
          id: '',
          title,
          value: val !== null && val !== undefined ? String(val) : null,
        }),
      );
    } else if (!Array.isArray(chat.collectedData)) {
      chat.collectedData = [];
    }

    return chat;
  }

  async findOrCreate(
    organizationId: string,
    externalChatId: string,
    defaults: Partial<Chat>,
  ): Promise<{ doc: ChatDocument; created: boolean }> {
    const existing = await this.model.findOne({
      organizationId,
      externalChatId,
    });
    if (existing) {
      const normalized = this.normalizeChat(
        existing.toObject ? existing.toObject() : existing,
      );
      return { doc: normalized, created: false };
    }
    const doc = await this.model.create({
      organizationId,
      externalChatId,
      ...defaults,
    });
    return {
      doc: this.normalizeChat(doc.toObject ? doc.toObject() : doc),
      created: true,
    };
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
    const normalizedData = (data as any[]).map((c) => this.normalizeChat(c));
    return createPaginatedResponse(normalizedData, total, page, limit);
  }

  async findById(id: string): Promise<ChatDocument | null> {
    const doc = await this.model.findById(id).lean();
    return this.normalizeChat(doc);
  }

  async update(
    id: string,
    update: UpdateQuery<Chat>,
  ): Promise<ChatDocument | null> {
    const doc = await this.model
      .findByIdAndUpdate(id, update, { returnDocument: 'after' })
      .lean();
    return this.normalizeChat(doc);
  }

  async updateCollectedData(
    chatId: string,
    data: any[],
    status?: ChatStatus,
  ): Promise<ChatDocument | null> {
    const update: any = { collectedData: data };
    if (status) {
      update.status = status;
    }
    const doc = await this.model
      .findByIdAndUpdate(
        chatId,
        { $set: update },
        { returnDocument: 'after' },
      )
      .lean();
    return this.normalizeChat(doc);
  }

  async updateLastMessage(
    chatId: string,
    text: string,
    sentTime: Date,
  ): Promise<ChatDocument | null> {
    const doc = await this.model
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
      .lean();
    return this.normalizeChat(doc);
  }

  async count(filter: Record<string, any> = {}): Promise<number> {
    return this.model.countDocuments(filter);
  }

  async delete(id: string): Promise<ChatDocument | null> {
    return this.model.findByIdAndDelete(id).lean() as Promise<ChatDocument | null>;
  }

  async findRawAll(): Promise<any[]> {
    return this.model.find({}).lean();
  }

  async updateRaw(id: string, data: Record<string, any>): Promise<any> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' })
      .lean();
  }
}
