import { Injectable, Logger } from '@nestjs/common';
import { MessageRepository } from './repositories/message.repository';
import {
  MessageDirection,
  MessageSenderType,
  MessageStatus,
  MessageType,
} from './schemas/message.schema';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly repo: MessageRepository) {}

  async saveIncoming(
    organizationId: string,
    chatId: string,
    content: string,
    externalMessageId?: string,
  ) {
    if (externalMessageId) {
      const existing = await this.repo.findByExternalMessageId(externalMessageId);
      if (existing) {
        this.logger.warn(
          `[saveIncoming] Message with externalMessageId "${externalMessageId}" already exists. Skipping duplicate.`,
        );
        return { doc: existing, isDuplicate: true };
      }
    }

    this.logger.debug(
      `Saving incoming message for chat ${chatId}: "${content.substring(0, 30)}..."`,
    );
    try {
      const doc = await this.repo.create({
        organizationId: organizationId as any,
        chatId: chatId as any,
        direction: MessageDirection.INCOMING,
        senderType: MessageSenderType.CUSTOMER,
        type: MessageType.TEXT,
        content,
        status: MessageStatus.RECEIVED,
        externalMessageId,
        sentAt: new Date(),
      });
      return { doc, isDuplicate: false };
    } catch (err: any) {
      if (err?.code === 11000 && externalMessageId) {
        // Mongo duplicate key error on externalMessageId
        this.logger.warn(
          `[saveIncoming] Concurrent duplicate insert caught for externalMessageId "${externalMessageId}".`,
        );
        const existing = await this.repo.findByExternalMessageId(externalMessageId);
        return { doc: existing!, isDuplicate: true };
      }
      throw err;
    }
  }

  findByExternalMessageId(externalMessageId: string) {
    return this.repo.findByExternalMessageId(externalMessageId);
  }

  saveAiReply(organizationId: string, chatId: string, content: string) {
    this.logger.debug(
      `Saving AI reply for chat ${chatId}: "${content.substring(0, 30)}..."`,
    );
    return this.repo.create({
      organizationId: organizationId as any,
      chatId: chatId as any,
      direction: MessageDirection.OUTGOING,
      senderType: MessageSenderType.ASSISTENT,
      type: MessageType.TEXT,
      content,
      status: MessageStatus.SENT,
      sentAt: new Date(),
    });
  }

  saveHumanMessage(organizationId: string, chatId: string, content: string) {
    this.logger.log(
      `Saving Human message for chat ${chatId}: "${content.substring(0, 30)}..."`,
    );
    return this.repo.create({
      organizationId: organizationId as any,
      chatId: chatId as any,
      direction: MessageDirection.OUTGOING,
      senderType: MessageSenderType.HUMAN,
      type: MessageType.TEXT,
      content,
      status: MessageStatus.SENT,
      sentAt: new Date(),
    });
  }

  getChatHistory(chatId: string, page: number, limit: number) {
    this.logger.debug(`Fetching chat history for chat ${chatId} (page=${page}, limit=${limit})`);
    return this.repo.findByChatId(chatId, page, limit);
  }

  getLastN(chatId: string, n = 20) {
    return this.repo.findLastN(chatId, n);
  }

  deleteByChatId(chatId: string) {
    this.logger.log(`Deleting all messages for chat ${chatId}`);
    return this.repo.deleteByChatId(chatId);
  }
}
