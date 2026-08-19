import { Injectable, Logger } from '@nestjs/common';
import type { LeadDocument } from '../leads/schemas/lead.schema';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ChatRepository } from './repositories/chat.repository';
import { ChatChannel, ChatStatus } from './schemas/chat.schema';
import { MessagesService } from '../messages/messages.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AiService } from '../ai/ai.service';
import { LeadsService } from '../leads/leads.service';
import { ListChatsDto } from './dto/list-chats.dto';
import { UpdateChatDto } from './dto/update-chat.dto';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    private readonly chatRepo: ChatRepository,
    private readonly messagesService: MessagesService,
    private readonly knowledgeService: KnowledgeService,
    private readonly aiService: AiService,
    private readonly leadsService: LeadsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  findAll(dto: ListChatsDto) {
    const filter: Record<string, any> = {};
    if (dto.organizationId) filter.organizationId = dto.organizationId;
    if (dto.status) filter.status = dto.status;
    return this.chatRepo.findAll(filter, dto.page, dto.limit);
  }

  findOne(id: string) {
    return this.chatRepo.findById(id);
  }

  async update(id: string, dto: UpdateChatDto) {
    const chat = await this.chatRepo.update(id, dto);
    if (chat) this.eventEmitter.emit('chat.updated', chat);
    return chat;
  }

  async updateLastMessage(chatId: string, text: string, sentTime = new Date()) {
    const chat = await this.chatRepo.updateLastMessage(chatId, text, sentTime);
    if (chat) this.eventEmitter.emit('chat.updated', chat);
    return chat;
  }

  @OnEvent('message.human')
  async handleHumanMessageEvent(payload: {
    chatId: string;
    content: string;
    organizationId: string;
  }) {
    await this.updateLastMessage(payload.chatId, payload.content);
  }

  /**
   * Main entry point: called by webhook or WebSocket when a new customer message arrives.
   */
  async handleIncomingMessage(params: {
    organizationId: string;
    channel: ChatChannel;
    externalChatId: string;
    externalUserId: string;
    content: string;
    externalMessageId?: string;
  }) {
    const {
      organizationId,
      channel,
      externalChatId,
      externalUserId,
      content,
      externalMessageId,
    } = params;

    // 1. Find or create chat
    const { doc: chat, created } = await this.chatRepo.findOrCreate(
      organizationId,
      externalChatId,
      { channel, externalUserId, status: ChatStatus.AI_PROCESSING },
    );

    if (created) this.eventEmitter.emit('chat.new', chat);

    // 2. Save incoming message
    const incomingMsg = await this.messagesService.saveIncoming(
      organizationId,
      chat._id.toString(),
      content,
      externalMessageId,
    );
    this.eventEmitter.emit('message.new', incomingMsg);

    // 3. Update chat lastMessage with incoming message and emit chat.updated
    const updatedAfterIncoming = await this.chatRepo.updateLastMessage(
      chat._id.toString(),
      content,
      new Date(),
    );
    if (updatedAfterIncoming) {
      this.eventEmitter.emit('chat.updated', updatedAfterIncoming);
    }

    // 4. If returned to human, skip AI
    if (chat.status === ChatStatus.RETURNED_HUMAN) {
      this.logger.log(`Chat ${chat._id} is RETURNED_HUMAN — skipping AI`);
      return {
        chat: updatedAfterIncoming || chat,
        message: incomingMsg,
        aiReply: null,
        lead: null,
      };
    }

    // 5. Load org knowledge context
    const { leadQuestions, companyInfo, additionalInfo } =
      await this.knowledgeService.loadAiContext(organizationId);

    // 6. Load chat history (last 20 messages)
    const recentMessages = await this.messagesService.getLastN(
      chat._id.toString(),
      20,
    );
    const chatHistory = recentMessages.reverse().map((m) => ({
      role:
        m.senderType === 'CUSTOMER'
          ? ('user' as const)
          : ('assistant' as const),
      content: m.content,
    }));

    // 7. Call AI
    const aiResponse = await this.aiService.processMessage({
      organizationId,
      chatId: chat._id.toString(),
      companyInfo: companyInfo.map((c) => ({
        title: c.title,
        description: c.description,
      })),
      additionalInfo: additionalInfo.map((a) => ({
        title: a.title,
        description: a.description,
      })),
      leadQuestions: leadQuestions.map((q) => ({
        title: q.title,
        description: q.description,
        order: q.order,
      })),
      chatHistory,
      collectedData: chat.collectedData || {},
      incomingMessage: content,
    });

    // 8. Save AI reply
    const aiMsg = await this.messagesService.saveAiReply(
      organizationId,
      chat._id.toString(),
      aiResponse.reply,
    );
    this.eventEmitter.emit('message.ai', aiMsg);

    // 9. Update lastMessage with AI reply and collectedData
    await this.chatRepo.updateLastMessage(
      chat._id.toString(),
      aiResponse.reply,
      new Date(),
    );
    const updatedChat = await this.chatRepo.updateCollectedData(
      chat._id.toString(),
      aiResponse.collectedData,
    );
    if (updatedChat) {
      this.eventEmitter.emit('chat.updated', updatedChat);
    }

    // 10. Create Lead if all questions answered
    let lead: LeadDocument | null = null;
    if (aiResponse.isComplete) {
      const existingLead = await this.leadsService.findByChatId(
        chat._id.toString(),
      );
      if (!existingLead) {
        lead = await this.leadsService.createFromChat(
          organizationId,
          chat._id.toString(),
          aiResponse.collectedData,
        );
        this.eventEmitter.emit('lead.new', lead);
        this.logger.log(`Lead created for chat ${chat._id}`);
      }
    }

    return { chat: updatedChat, message: incomingMsg, aiReply: aiMsg, lead };
  }
}
