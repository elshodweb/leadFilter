import { Injectable, Logger } from '@nestjs/common';
import type { LeadDocument } from '../leads/schemas/lead.schema';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ChatRepository } from './repositories/chat.repository';
import { ChatChannel, ChatStatus } from './schemas/chat.schema';
import { MessagesService } from '../messages/messages.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AiService } from '../ai/ai.service';
import { LeadsService } from '../leads/leads.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { InstagramService } from '../instagram/instagram.service';
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
    private readonly orgsService: OrganizationsService,
    private readonly instagramService: InstagramService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(dto: ListChatsDto) {
    this.logger.debug(
      `Listing chats with filter: org=${dto.organizationId || 'all'}, status=${dto.status || 'all'}, page=${dto.page || 1}`,
    );
    const filter: Record<string, any> = {};
    if (dto.organizationId) filter.organizationId = dto.organizationId;
    if (dto.status) filter.status = dto.status;
    return this.chatRepo.findAll(filter, dto.page, dto.limit);
  }

  findOne(id: string) {
    this.logger.debug(`Fetching chat by id: ${id}`);
    return this.chatRepo.findById(id);
  }

  async update(id: string, dto: UpdateChatDto) {
    this.logger.log(`Updating chat ${id}: ${JSON.stringify(dto)}`);
    const chat = await this.chatRepo.update(id, dto);
    if (chat) {
      this.logger.debug(`Emitting chat.updated for chat ${id}`);
      this.eventEmitter.emit('chat.updated', chat);
    }
    return chat;
  }

  async updateLastMessage(chatId: string, text: string, sentTime = new Date()) {
    this.logger.debug(`Updating last message for chat ${chatId}: "${text.substring(0, 30)}..."`);
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
    this.logger.log(`[Event message.human] Agent sent message to chat ${payload.chatId}`);
    await this.updateLastMessage(payload.chatId, payload.content);

    const chat = await this.chatRepo.findById(payload.chatId);
    if (chat && chat.channel === ChatChannel.INSTAGRAM) {
      const org = await this.orgsService.findOne(payload.organizationId);
      if (org?.instagramAccessToken) {
        this.logger.debug(
          `[Event message.human] Delivering human operator message to Instagram user ${chat.externalChatId}...`,
        );
        this.instagramService
          .sendTextMessage({
            accessToken: org.instagramAccessToken,
            businessAccountId: org.instagramBusinessAccountId,
            apiBaseUrl: org.instagramApiBaseUrl,
            apiVersion: org.metaGraphApiVersion,
            recipientId: chat.externalChatId,
            text: payload.content,
          })
          .catch((err) => {
            this.logger.error(
              `[Event message.human] Failed to send human message to Instagram: ${err.message}`,
            );
          });
      }
    }
  }

  /**
   * Called by WebhookController when an echo message arrives from Meta
   * (e.g. human manager typed a reply directly in the Instagram app).
   */
  async handleEchoMessage(params: {
    organizationId: string;
    channel: ChatChannel;
    externalChatId: string;
    content: string;
    externalMessageId?: string;
  }) {
    const {
      organizationId,
      channel,
      externalChatId,
      content,
      externalMessageId,
    } = params;

    this.logger.log(
      `[Echo Message Pipeline] Org: ${organizationId} | ExternalChat: ${externalChatId} | Operator sent text via Instagram App: "${content.substring(0, 35)}..."`,
    );

    // 1. Find or create chat
    const { doc: chat, created } = await this.chatRepo.findOrCreate(
      organizationId,
      externalChatId,
      { channel, externalUserId: externalChatId, status: ChatStatus.RETURNED_HUMAN },
    );

    if (created) {
      this.logger.log(`[Echo Pipeline] New Chat created: ${chat._id}`);
      this.eventEmitter.emit('chat.new', chat);
    }

    // 2. Set chat status to RETURNED_HUMAN so AI stops automatically replying
    if (chat.status !== ChatStatus.RETURNED_HUMAN) {
      await this.chatRepo.update(chat._id.toString(), {
        status: ChatStatus.RETURNED_HUMAN,
      });
      chat.status = ChatStatus.RETURNED_HUMAN;
    }

    // 3. Save as HUMAN message
    const humanMsg = await this.messagesService.saveHumanMessage(
      organizationId,
      chat._id.toString(),
      content,
    );
    this.logger.debug(`[Echo Pipeline] Operator message saved: ${humanMsg._id}`);
    this.eventEmitter.emit('message.new', humanMsg);

    // 4. Update last message & broadcast chat update to web platform
    const updatedChat = await this.chatRepo.updateLastMessage(
      chat._id.toString(),
      content,
      new Date(),
    );
    if (updatedChat) {
      this.eventEmitter.emit('chat.updated', updatedChat);
    }

    return { chat: updatedChat || chat, message: humanMsg };
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

    this.logger.log(
      `[Incoming Message Pipeline] Org: ${organizationId} | Channel: ${channel} | ExternalChat: ${externalChatId} | User: ${externalUserId}`,
    );

    // 1. Find or create chat
    const { doc: chat, created } = await this.chatRepo.findOrCreate(
      organizationId,
      externalChatId,
      { channel, externalUserId, status: ChatStatus.AI_PROCESSING },
    );

    if (created) {
      this.logger.log(`[Pipeline] New Chat created: ${chat._id}`);
      this.eventEmitter.emit('chat.new', chat);
    } else {
      this.logger.debug(`[Pipeline] Existing Chat matched: ${chat._id} (status: ${chat.status})`);
    }

    // 2. Save incoming message
    const incomingMsg = await this.messagesService.saveIncoming(
      organizationId,
      chat._id.toString(),
      content,
      externalMessageId,
    );
    this.logger.debug(`[Pipeline] Incoming message saved: ${incomingMsg._id}`);
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
      this.logger.log(`[Pipeline] Chat ${chat._id} is RETURNED_HUMAN — skipping AI response`);
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
    this.logger.debug(
      `[Pipeline] Loaded AI context: ${leadQuestions.length} questions, ${companyInfo.length} company info, ${additionalInfo.length} additional info`,
    );

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
    this.logger.debug(`[Pipeline] Loaded ${chatHistory.length} chat history items`);

    // 7. Call AI
    this.logger.log(`[Pipeline] Invoking AI for chat ${chat._id}...`);
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
    this.logger.debug(`[Pipeline] AI message saved: ${aiMsg._id}`);
    this.eventEmitter.emit('message.ai', aiMsg);

    // 8.1 Deliver AI message to customer on Instagram
    if (chat.channel === ChatChannel.INSTAGRAM) {
      const org = await this.orgsService.findOne(organizationId);
      if (org?.instagramAccessToken) {
        this.logger.debug(
          `[Pipeline] Delivering AI response to Instagram user ${chat.externalChatId}...`,
        );
        this.instagramService
          .sendTextMessage({
            accessToken: org.instagramAccessToken,
            businessAccountId: org.instagramBusinessAccountId,
            apiBaseUrl: org.instagramApiBaseUrl,
            apiVersion: org.metaGraphApiVersion,
            recipientId: chat.externalChatId,
            text: aiResponse.reply,
          })
          .catch((err) => {
            this.logger.error(
              `[Pipeline] Failed to send AI response to Instagram: ${err.message}`,
            );
          });
      } else {
        this.logger.warn(
          `[Pipeline] Organization ${organizationId} has no instagramAccessToken configured!`,
        );
      }
    }

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
      this.logger.log(
        `[Pipeline] All lead questions answered for chat ${chat._id}! Checking for existing lead...`,
      );
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
        this.logger.log(`[Pipeline] 🎉 New Lead created: ${lead._id} for chat ${chat._id}`);
      } else {
        this.logger.debug(`[Pipeline] Lead already exists for chat ${chat._id} (${existingLead._id})`);
      }
    }

    return { chat: updatedChat, message: incomingMsg, aiReply: aiMsg, lead };
  }
}
