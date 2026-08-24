import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AiContextDto } from './dto/ai-context.dto';
import { AiResponseDto } from './dto/ai-response.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('openai.apiKey'),
    });
    this.model =
      this.configService.get<string>('openai.model') || 'gpt-4.1-mini';
  }

  async processMessage(ctx: AiContextDto): Promise<AiResponseDto> {
    const startTime = Date.now();
    this.logger.debug(
      `[AI Request] Chat: ${ctx.chatId} (Org: ${ctx.organizationId}) | Model: ${this.model} | History: ${ctx.chatHistory.length} msgs | Questions: ${ctx.leadQuestions.length}`,
    );
    this.logger.debug(`[AI Incoming Customer Message] "${ctx.incomingMessage}"`);

    const systemPrompt = this.buildSystemPrompt(ctx);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...ctx.chatHistory,
      { role: 'user', content: ctx.incomingMessage },
    ];

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.4,
      });

      const duration = Date.now() - startTime;
      const raw = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw) as AiResponseDto;

      const usage = completion.usage
        ? ` | Tokens: prompt=${completion.usage.prompt_tokens}, completion=${completion.usage.completion_tokens}, total=${completion.usage.total_tokens}`
        : '';

      // Normalize and merge collectedData so all lead questions are cleanly represented
      const mergedCollectedData = ctx.leadQuestions
        .sort((a, b) => a.order - b.order)
        .map((q) => {
          const foundInAi = Array.isArray(parsed.collectedData)
            ? parsed.collectedData.find(
                (c: any) =>
                  (c.id && String(c.id) === String(q.id)) ||
                  (c.title && c.title.toLowerCase() === q.title.toLowerCase()),
              )
            : null;
          const foundInPrev = Array.isArray(ctx.collectedData)
            ? ctx.collectedData.find(
                (c: any) =>
                  (c.id && String(c.id) === String(q.id)) ||
                  (c.title && c.title.toLowerCase() === q.title.toLowerCase()),
              )
            : null;

          const val = foundInAi?.value ?? foundInPrev?.value ?? null;
          return {
            id: q.id,
            title: q.title,
            value:
              val !== null && val !== undefined && val !== ''
                ? String(val)
                : null,
          };
        });

      const isComplete =
        mergedCollectedData.length > 0 &&
        mergedCollectedData.every((item) => item.value !== null);

      this.logger.log(
        `[AI Response] Chat: ${ctx.chatId} | +${duration}ms${usage} | isComplete: ${isComplete}`,
      );
      this.logger.debug(`[AI Reply Generated] "${parsed.reply}"`);
      this.logger.debug(
        `[AI Collected Data State] ${JSON.stringify(mergedCollectedData)}`,
      );

      return {
        reply: parsed.reply || '',
        collectedData: mergedCollectedData,
        isComplete,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[AI Error] Chat: ${ctx.chatId} failed after +${duration}ms: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private buildSystemPrompt(ctx: AiContextDto): string {
    const companyInfoBlock = ctx.companyInfo
      .map((c) => `- ${c.title}: ${c.description}`)
      .join('\n');

    const additionalInfoBlock = ctx.additionalInfo
      .map((a) => `- ${a.title}: ${a.description}`)
      .join('\n');

    const leadQuestionsBlock = ctx.leadQuestions
      .sort((a, b) => a.order - b.order)
      .map(
        (q) =>
          `- ID: "${q.id}" | Title: "${q.title}" | Instruction: ${q.description}`,
      )
      .join('\n');

    const collectedDataBlock = JSON.stringify(ctx.collectedData, null, 2);

    return `You are a professional AI sales assistant. Your job is to help customers and collect lead information.

== COMPANY INFORMATION ==
${companyInfoBlock}

== ADDITIONAL INFORMATION & POLICIES ==
${additionalInfoBlock}

== LEAD DATA TO COLLECT ==
You must collect the following information from the customer (in a natural, conversational way):
${leadQuestionsBlock}

== ALREADY COLLECTED DATA ==
${collectedDataBlock}

== INSTRUCTIONS ==
1. Answer customer questions using Company Information and Additional Information.
2. Naturally guide the conversation to collect missing lead fields (where "value" is null). Do NOT ask again for data already collected.
3. Collect one piece of information at a time — do not bombard the customer with multiple questions.
4. When ALL lead fields have non-null string values, set isComplete to true.
5. Always respond in the SAME LANGUAGE the customer is using.
6. Return ONLY valid JSON in this exact format:
{
  "reply": "<your reply to the customer>",
  "collectedData": [
    {
      "id": "<lead question id>",
      "title": "<lead question title>",
      "value": "<extracted string value or null>"
    }
  ],
  "isComplete": <true|false>
}
- "collectedData" must be an array containing an item for EVERY question listed in "LEAD DATA TO COLLECT" (with the exact matching "id" and "title").
- If a value was already collected previously, preserve it. If the customer provided it in this message, set "value". If not yet provided, set "value" to null.
- "isComplete" is true ONLY when every item in "collectedData" has a valid non-null string value.`;
  }
}
