import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { LeadDocument } from '../leads/schemas/lead.schema';
import type { LeadQuestionDocument } from '../knowledge/schemas/lead-question.schema';
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
export class ChatsService implements OnModuleInit {
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

  async onModuleInit() {
    this.migrateOldChats().catch((err) => {
      this.logger.warn(`Migration of old chats failed: ${err.message}`);
    });
  }

  private async migrateOldChats() {
    const rawChats = await this.chatRepo.findRawAll();
    let migratedCount = 0;
    for (const chat of rawChats) {
      let needsUpdate = false;
      const updateData: Record<string, any> = {};

      if (chat.status === 'AI_PROCESSING' || chat.status === 'RETURNED_HUMAN') {
        updateData.status = ChatStatus.COLD;
        if (chat.status === 'RETURNED_HUMAN') {
          updateData.ai_enabled = false;
        }
        needsUpdate = true;
      }

      if (chat.ai_enabled === undefined || chat.ai_enabled === null) {
        updateData.ai_enabled =
          chat.status === 'RETURNED_HUMAN' ? false : true;
        needsUpdate = true;
      }

      if (
        chat.collectedData &&
        !Array.isArray(chat.collectedData) &&
        typeof chat.collectedData === 'object'
      ) {
        const leadQuestions = await this.knowledgeService
          .loadAiContext(chat.organizationId?.toString())
          .then((ctx) => ctx.leadQuestions)
          .catch(() => [] as LeadQuestionDocument[]);

        updateData.collectedData = Object.entries(chat.collectedData).map(
          ([title, val]) => {
            const matchedQ = leadQuestions.find(
              (q) =>
                q.title.trim().toLowerCase() === title.trim().toLowerCase(),
            );
            return {
              id: matchedQ ? matchedQ._id.toString() : '',
              title,
              value: val !== null && val !== undefined ? String(val) : null,
            };
          },
        );
        needsUpdate = true;
      }

      if (needsUpdate) {
        await this.chatRepo.updateRaw(chat._id.toString(), updateData);
        migratedCount++;
      }

      // Enrich Instagram profile if missing
      if (
        chat.channel === ChatChannel.INSTAGRAM &&
        (!chat.customerUsername || !chat.customerName)
      ) {
        this.enrichInstagramProfile(chat.organizationId.toString(), chat);
      }
    }
    if (migratedCount > 0) {
      this.logger.log(
        `[Migration] Successfully migrated ${migratedCount} old chats in database to new schema.`,
      );
    }
  }

  async findAll(dto: ListChatsDto) {
    this.logger.debug(
      `Listing chats with filter: org=${dto.organizationId || 'all'}, status=${dto.status || 'all'}, ai_enabled=${dto.ai_enabled ?? 'all'}, page=${dto.page || 1}`,
    );
    const conditions: any[] = [];
    if (dto.organizationId) {
      conditions.push({ organizationId: dto.organizationId });
    }

    if (dto.status) {
      if (dto.status === ChatStatus.COLD) {
        conditions.push({
          $or: [
            { status: ChatStatus.COLD },
            { status: 'AI_PROCESSING' },
            { status: { $exists: false } },
            { status: null },
          ],
        });
      } else {
        conditions.push({ status: dto.status });
      }
    }

    if (dto.ai_enabled !== undefined) {
      if (dto.ai_enabled === true) {
        conditions.push({
          $or: [
            { ai_enabled: true },
            { ai_enabled: { $exists: false } },
            { ai_enabled: null },
          ],
        });
      } else {
        conditions.push({ ai_enabled: false });
      }
    }

    const filter =
      conditions.length === 1
        ? conditions[0]
        : conditions.length > 1
          ? { $and: conditions }
          : {};

    return this.chatRepo.findAll(filter, dto.page, dto.limit);
  }

  async getStats(organizationId?: string) {
    this.logger.debug(`Getting chat stats for org=${organizationId || 'all'}`);
    const baseFilter: Record<string, any> = {};
    if (organizationId) baseFilter.organizationId = organizationId;

    const [all, cold, warm, hot, aiEnabled, aiDisabled] =
      await Promise.all([
        this.chatRepo.count(baseFilter),
        this.chatRepo.count({
          ...baseFilter,
          $or: [
            { status: ChatStatus.COLD },
            { status: 'AI_PROCESSING' },
            { status: { $exists: false } },
            { status: null },
          ],
        }),
        this.chatRepo.count({ ...baseFilter, status: ChatStatus.WARM }),
        this.chatRepo.count({ ...baseFilter, status: ChatStatus.HOT }),
        this.chatRepo.count({
          ...baseFilter,
          $or: [
            { ai_enabled: true },
            { ai_enabled: { $exists: false } },
            { ai_enabled: null },
          ],
        }),
        this.chatRepo.count({ ...baseFilter, ai_enabled: false }),
      ]);

    return {
      ALL: all,
      COLD: cold,
      WARM: warm,
      HOT: hot,
      AI_ENABLED: aiEnabled,
      AI_DISABLED: aiDisabled,
    };
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

      // If AI is turned ON (ai_enabled === true), check if customer is waiting for a response
      if (dto.ai_enabled === true) {
        this.triggerAiForChat(id, chat.organizationId.toString()).catch(
          (err) => {
            this.logger.error(
              `[triggerAiForChat] Error for chat ${id}: ${err.message}`,
            );
          },
        );
      }
    }
    return chat;
  }

  async delete(id: string, organizationId?: string) {
    this.logger.log(`Deleting chat ${id} (org: ${organizationId || 'any'})`);
    const chat = await this.chatRepo.findById(id);
    if (!chat) throw new NotFoundException(`Chat ${id} not found`);

    if (organizationId && chat.organizationId.toString() !== organizationId) {
      throw new NotFoundException(`Chat ${id} not found in this organization`);
    }

    await Promise.all([
      this.chatRepo.delete(id),
      this.messagesService.deleteByChatId(id),
      this.leadsService.deleteByChatId(id),
    ]);

    this.eventEmitter.emit('chat.deleted', {
      chatId: id,
      organizationId: chat.organizationId.toString(),
    });

    return {
      success: true,
      message: `Chat ${id} and all related messages and leads deleted.`,
    };
  }

  async updateLastMessage(chatId: string, text: string, sentTime = new Date()) {
    this.logger.debug(
      `Updating last message for chat ${chatId}: "${text.substring(0, 30)}..."`,
    );
    const chat = await this.chatRepo.updateLastMessage(chatId, text, sentTime);
    if (chat) this.eventEmitter.emit('chat.updated', chat);
    return chat;
  }

  // In-memory tracker of messages sent from platform to prevent echo duplicate echoes
  private readonly sentPlatformMessageKeys = new Map<string, number>();

  private markPlatformMessageSent(chatId: string, content: string) {
    const key = `${chatId}:${content.trim()}`;
    this.sentPlatformMessageKeys.set(key, Date.now());
    setTimeout(() => this.sentPlatformMessageKeys.delete(key), 60000);
  }

  private isRecentlySentByPlatform(chatId: string, content: string): boolean {
    const key = `${chatId}:${content.trim()}`;
    const timestamp = this.sentPlatformMessageKeys.get(key);
    if (!timestamp) return false;
    if (Date.now() - timestamp < 45000) {
      this.sentPlatformMessageKeys.delete(key);
      return true;
    }
    return false;
  }

  @OnEvent('message.human')
  async handleHumanMessageEvent(payload: {
    chatId: string;
    content: string;
    organizationId: string;
    message?: any;
  }) {
    this.logger.log(
      `[Event message.human] Agent sent message to chat ${payload.chatId}`,
    );
    this.markPlatformMessageSent(payload.chatId, payload.content);

    await this.updateLastMessage(payload.chatId, payload.content);

    // Auto turn off AI for this chat when human agent replies
    await this.chatRepo.update(payload.chatId, { ai_enabled: false });

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
          .then(async (result) => {
            if (result.success && result.messageId && payload.message?._id) {
              await this.messagesService.updateExternalMessageId(
                payload.message._id.toString(),
                result.messageId,
              );
            }
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

    // 1. Load lead questions to initialize collectedData for new chats
    const { leadQuestions: echoQuestions } = await this.knowledgeService
      .loadAiContext(organizationId)
      .catch(() => ({ leadQuestions: [] as LeadQuestionDocument[] }));

    const initialEchoCollectedData = (echoQuestions || [])
      .sort((a, b) => a.order - b.order)
      .map((q) => ({
        id: q._id.toString(),
        title: q.title,
        value: null,
      }));

    // 1. Find or create chat
    const { doc: chat, created } = await this.chatRepo.findOrCreate(
      organizationId,
      externalChatId,
      {
        channel,
        externalUserId: externalChatId,
        status: ChatStatus.COLD,
        ai_enabled: false,
        collectedData: initialEchoCollectedData,
      },
    );

    if (created) {
      this.logger.log(`[Echo Pipeline] New Chat created: ${chat._id}`);
      this.eventEmitter.emit('chat.new', chat);
    }

    // 2. Enrich Instagram customer profile if missing
    this.enrichInstagramProfile(organizationId, chat);

    // 3. Set ai_enabled to false so AI stops automatically replying
    if (chat.ai_enabled !== false) {
      await this.chatRepo.update(chat._id.toString(), {
        ai_enabled: false,
      });
      chat.ai_enabled = false;
    }

    // 4. Check if this echo is a reflection of a message sent by our platform agent
    if (this.isRecentlySentByPlatform(chat._id.toString(), content)) {
      this.logger.log(
        `[Echo Pipeline] Ignored echo message because it was already sent from our platform: "${content.substring(0, 35)}..."`,
      );
      if (externalMessageId) {
        const recentHuman = await this.messagesService.getLastN(
          chat._id.toString(),
          3,
        );
        const match = recentHuman.find(
          (m) =>
            m.senderType === 'HUMAN' &&
            m.content === content &&
            !m.externalMessageId,
        );
        if (match) {
          await this.messagesService.updateExternalMessageId(
            match._id.toString(),
            externalMessageId,
          );
        }
      }
      return { chat, message: null };
    }

    // 5. Save as HUMAN message (with deduplication check)
    if (externalMessageId) {
      const existingMsg =
        await this.messagesService.findByExternalMessageId(externalMessageId);
      if (existingMsg) {
        this.logger.warn(
          `[Echo Pipeline] Duplicate echo message with MID "${externalMessageId}". Skipping.`,
        );
        return { chat, message: existingMsg };
      }
    }

    const humanMsg = await this.messagesService.saveHumanMessage(
      organizationId,
      chat._id.toString(),
      content,
    );
    this.logger.debug(`[Echo Pipeline] Operator message saved: ${humanMsg._id}`);
    this.eventEmitter.emit('message.new', humanMsg);

    // 6. Update last message & broadcast chat update to web platform
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

    // 1. Load lead questions to initialize collectedData for new chats
    const { leadQuestions, companyInfo, additionalInfo } =
      await this.knowledgeService.loadAiContext(organizationId);

    const initialCollectedData = (leadQuestions || [])
      .sort((a, b) => a.order - b.order)
      .map((q) => ({
        id: q._id.toString(),
        title: q.title,
        value: null,
      }));

    // 1. Find or create chat
    const { doc: chat, created } = await this.chatRepo.findOrCreate(
      organizationId,
      externalChatId,
      {
        channel,
        externalUserId,
        status: ChatStatus.COLD,
        ai_enabled: true,
        collectedData: initialCollectedData,
      },
    );

    if (created) {
      this.logger.log(`[Pipeline] New Chat created: ${chat._id}`);
      this.eventEmitter.emit('chat.new', chat);
    } else {
      this.logger.debug(
        `[Pipeline] Existing Chat matched: ${chat._id} (status: ${chat.status}, ai_enabled: ${chat.ai_enabled})`,
      );
    }

    // 1.1 Enrich Instagram customer profile if missing
    this.enrichInstagramProfile(organizationId, chat);

    // 2. Save incoming message (with deduplication check)
    const { doc: incomingMsg, isDuplicate } =
      await this.messagesService.saveIncoming(
        organizationId,
        chat._id.toString(),
        content,
        externalMessageId,
      );

    if (isDuplicate) {
      this.logger.warn(
        `[Pipeline] Duplicate message received from Meta webhook (MID: ${externalMessageId}). Skipping duplicate emit and AI processing.`,
      );
      return {
        chat,
        message: incomingMsg,
        aiReply: null,
        lead: null,
      };
    }

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

    // 4. If AI is disabled (ai_enabled === false), skip AI
    if (chat.ai_enabled === false) {
      this.logger.log(
        `[Pipeline] Chat ${chat._id} has ai_enabled: false — skipping AI response`,
      );
      return {
        chat: updatedAfterIncoming || chat,
        message: incomingMsg,
        aiReply: null,
        lead: null,
      };
    }

    // 5. Context is already loaded in Step 1
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
    this.logger.debug(
      `[Pipeline] Loaded ${chatHistory.length} chat history items`,
    );

    // 7. Call AI
    let aiResponse;
    try {
      this.logger.log(`[Pipeline] Invoking AI for chat ${chat._id}...`);
      aiResponse = await this.aiService.processMessage({
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
          id: q._id.toString(),
          title: q.title,
          description: q.description,
          order: q.order,
        })),
        chatHistory,
        collectedData: chat.collectedData || [],
        incomingMessage: content,
      });
    } catch (err: any) {
      this.logger.error(
        `[Pipeline] AI response generation failed for chat ${chat._id}: ${err.message}`,
      );
      return {
        chat: updatedAfterIncoming || chat,
        message: incomingMsg,
        aiReply: null,
        lead: null,
      };
    }

    // 8. Save AI reply
    const aiMsg = await this.messagesService.saveAiReply(
      organizationId,
      chat._id.toString(),
      aiResponse.reply,
    );
    this.logger.debug(`[Pipeline] AI message saved: ${aiMsg._id}`);
    this.eventEmitter.emit('message.new', aiMsg);

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
        this.logger.log(
          `[Pipeline] 🎉 New Lead created: ${lead._id} for chat ${chat._id}`,
        );
      } else {
        this.logger.debug(
          `[Pipeline] Lead already exists for chat ${chat._id} (${existingLead._id})`,
        );
      }
    }

    return { chat: updatedChat, message: incomingMsg, aiReply: aiMsg, lead };
  }

  /**
   * Triggers AI response for a chat when AI is turned back ON (ai_enabled: true)
   * if the latest message is an unanswered customer message.
   */
  async triggerAiForChat(chatId: string, organizationId: string) {
    this.logger.log(`[triggerAiForChat] Checking chat ${chatId} (org: ${organizationId})...`);
    const chat = await this.chatRepo.findById(chatId);
    if (!chat) {
      this.logger.warn(`[triggerAiForChat] Chat ${chatId} not found.`);
      return;
    }
    if (chat.ai_enabled === false) {
      this.logger.debug(
        `[triggerAiForChat] Chat ${chatId} has ai_enabled === false. Skipping.`,
      );
      return;
    }

    const recentMessages = await this.messagesService.getLastN(chatId, 20);
    if (!recentMessages || recentMessages.length === 0) {
      this.logger.debug(
        `[triggerAiForChat] Chat ${chatId} has no messages. No need to auto-reply.`,
      );
      return;
    }

    const lastMsg = recentMessages[0]; // newest message
    if (lastMsg.senderType !== 'CUSTOMER') {
      this.logger.log(
        `[triggerAiForChat] Chat ${chatId} latest message is from ${lastMsg.senderType} ("${lastMsg.content}"). No unanswered customer message.`,
      );
      return;
    }

    this.logger.log(
      `[triggerAiForChat] Chat ${chatId} re-enabled AI! Generating automated response to customer's unanswered question: "${lastMsg.content.substring(0, 35)}..."`,
    );

    // 1. Load context & history
    const { leadQuestions, companyInfo, additionalInfo } =
      await this.knowledgeService.loadAiContext(organizationId);

    const chatHistory = [...recentMessages].reverse().map((m) => ({
      role:
        m.senderType === 'CUSTOMER'
          ? ('user' as const)
          : ('assistant' as const),
      content: m.content,
    }));

    // 2. Call AI
    let aiResponse;
    try {
      aiResponse = await this.aiService.processMessage({
        organizationId,
        chatId,
        companyInfo: companyInfo.map((c) => ({
          title: c.title,
          description: c.description,
        })),
        additionalInfo: additionalInfo.map((a) => ({
          title: a.title,
          description: a.description,
        })),
        leadQuestions: leadQuestions.map((q) => ({
          id: q._id.toString(),
          title: q.title,
          description: q.description,
          order: q.order,
        })),
        chatHistory: chatHistory.slice(0, -1),
        collectedData: chat.collectedData || [],
        incomingMessage: lastMsg.content,
      });
    } catch (err: any) {
      this.logger.error(
        `[triggerAiForChat] AI response generation failed for chat ${chatId}: ${err.message}`,
      );
      return;
    }

    // 3. Save AI reply
    const aiMsg = await this.messagesService.saveAiReply(
      organizationId,
      chatId,
      aiResponse.reply,
    );
    this.eventEmitter.emit('message.new', aiMsg);

    // 4. Deliver to Instagram
    if (chat.channel === ChatChannel.INSTAGRAM) {
      const org = await this.orgsService.findOne(organizationId);
      if (org?.instagramAccessToken) {
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
              `[triggerAiForChat] Failed to send AI response to Instagram: ${err.message}`,
            );
          });
      }
    }

    // 5. Update lastMessage and collectedData
    await this.chatRepo.updateLastMessage(
      chatId,
      aiResponse.reply,
      new Date(),
    );
    const updatedChat = await this.chatRepo.updateCollectedData(
      chatId,
      aiResponse.collectedData,
    );
    if (updatedChat) {
      this.eventEmitter.emit('chat.updated', updatedChat);
    }

    // 6. Create Lead if complete
    if (aiResponse.isComplete) {
      const existingLead = await this.leadsService.findByChatId(chatId);
      if (!existingLead) {
        const lead = await this.leadsService.createFromChat(
          organizationId,
          chatId,
          aiResponse.collectedData,
        );
        this.eventEmitter.emit('lead.new', lead);
      }
    }
  }

  /**
   * Helper to enrich chat with Instagram user name, username, and profile_pic
   */
  private enrichInstagramProfile(organizationId: string, chat: any) {
    if (
      chat.channel === ChatChannel.INSTAGRAM &&
      (!chat.customerUsername || !chat.customerName || !chat.customerAvatar)
    ) {
      this.orgsService
        .findOne(organizationId)
        .then((org) => {
          if (org?.instagramAccessToken) {
            this.instagramService
              .getUserProfile({
                userId: chat.externalChatId,
                accessToken: org.instagramAccessToken,
                apiVersion: org.metaGraphApiVersion,
                apiBaseUrl: org.instagramApiBaseUrl,
              })
              .then((profile) => {
                if (
                  profile &&
                  (profile.username || profile.name || profile.profile_pic)
                ) {
                  this.chatRepo
                    .update(chat._id.toString(), {
                      customerName: profile.name,
                      customerUsername: profile.username,
                      customerAvatar: profile.profile_pic,
                    })
                    .then((up) => {
                      if (up) this.eventEmitter.emit('chat.updated', up);
                    })
                    .catch(() => {});
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
  }
}
