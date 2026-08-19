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

      const raw = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw) as AiResponseDto;

      return {
        reply: parsed.reply || '',
        collectedData: parsed.collectedData || ctx.collectedData,
        isComplete: parsed.isComplete ?? false,
      };
    } catch (error) {
      this.logger.error('OpenAI call failed', error);
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
      .map((q) => `- Key: "${q.title}" | Instruction: ${q.description}`)
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
2. Naturally guide the conversation to collect missing lead fields. Do NOT ask for data already collected.
3. Collect one piece of information at a time — do not bombard the customer with multiple questions.
4. When ALL lead fields have non-null values, set isComplete to true.
5. Always respond in the SAME LANGUAGE the customer is using.
6. Return ONLY valid JSON in this exact format:
{
  "reply": "<your reply to the customer>",
  "collectedData": { "<fieldKey>": "<value or null>" },
  "isComplete": <true|false>
}
- "collectedData" must include ALL lead keys (previously collected + newly collected).
- Set a field to null if not yet collected.
- "isComplete" is true ONLY when every field has a non-null value.`;
  }
}
