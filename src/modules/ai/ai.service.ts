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
      this.configService.get<string>('openai.model') || 'gpt-4o-mini';
  }

  async processMessage(ctx: AiContextDto): Promise<AiResponseDto> {
    const startTime = Date.now();
    this.logger.debug(
      `[AI Request] Chat: ${ctx.chatId} (Org: ${ctx.organizationId}) | Model: ${this.model} | History: ${ctx.chatHistory.length} msgs | Questions: ${ctx.leadQuestions.length}`,
    );
    this.logger.debug(
      `[AI Incoming Customer Message] "${ctx.incomingMessage}"`,
    );

    const systemPrompt = this.buildSystemPrompt(ctx);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(ctx.chatHistory || []).map((m) => ({
        role: m.role as any,
        content: String(m.content || ''),
      })),
      ...(ctx.incomingMessage
        ? [{ role: 'user' as const, content: String(ctx.incomingMessage) }]
        : []),
    ];

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 300,
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

      // Direct refusal fallback safety net
      const lastUserMsg =
        [...ctx.chatHistory]
          .reverse()
          .find((m) => m.role === 'user')?.content || '';

      const isDirectRefusal =
        /\b(bermiman|bermayman|aytmiman|aytmayman|yo'q|yoq|ne skaju|ne hochu|ne xochu|otkazivayus)\b/i.test(
          lastUserMsg.trim(),
        );

      if (isDirectRefusal) {
        // If OpenAI didn't set "ignored", find the question that was pending and mark it "ignored"
        const hasIgnored = mergedCollectedData.some(
          (item) => item.value === 'ignored',
        );
        if (!hasIgnored) {
          const firstPendingIdx = mergedCollectedData.findIndex(
            (item, idx) =>
              item.value === null &&
              (!ctx.collectedData ||
                !ctx.collectedData[idx] ||
                ctx.collectedData[idx].value === null),
          );
          if (firstPendingIdx !== -1) {
            mergedCollectedData[firstPendingIdx].value = 'ignored';
            this.logger.log(
              `[AI Refusal Safety Net] Marked question "${mergedCollectedData[firstPendingIdx].title}" as "ignored" due to user refusal ("${lastUserMsg}").`,
            );
          }
        }
      }

      const isComplete =
        mergedCollectedData.length > 0 &&
        mergedCollectedData.every((item) => item.value !== null && item.value !== undefined && item.value !== '');

      const handoverToOperator = Boolean(parsed.handoverToOperator);
      const handoverReason = parsed.handoverReason || null;

      this.logger.log(
        `[AI Response] Chat: ${ctx.chatId} | +${duration}ms${usage} | isComplete: ${isComplete} | handoverToOperator: ${handoverToOperator}${handoverReason ? ` (${handoverReason})` : ''}`,
      );
      this.logger.debug(`[AI Reply Generated] "${parsed.reply}"`);
      this.logger.debug(
        `[AI Collected Data State] ${JSON.stringify(mergedCollectedData)}`,
      );

      return {
        reply: parsed.reply || '',
        collectedData: mergedCollectedData,
        isComplete,
        handoverToOperator,
        handoverReason,
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

    return `You are a modern, friendly, and energetic AI Sales Assistant chatting on Instagram Direct / messaging app.

== ⚡️ CRITICAL INSTRUCTION: ULTRA-SHORT, SIMPLE & READABLE (MUTLAQO QISQA VA SODDA MATN) ==
- YOUR REPLIES MUST BE VERY SHORT: MAXIMUM 1 TO 2 BRIEF SENTENCES (Under 25 words total)!
- NEVER write long paragraphs, essays, repetitive apologies, or robotic corporate templates.
- People on Instagram / mobile chats read fast. Your text must be simple, natural, punchy, and instantly understandable. Also, You can joke a little.
- Structure of EVERY reply:
  • Part 1: Brief direct answer or reaction (under 10 words).
  • Part 2: Quick, friendly question to collect the next lead field or guide them.
- BAD EXAMPLE: "Kechirasiz, Elshod, biz sayohat va aviabiletlar xizmatlarini taqdim etamiz, ammo pul berish imkoniyatimiz yo'q. Sizga sayohat rejalaringizni amalga oshirishda yordam berishim mumkin..." (TOO LONG, BORING, ROBOTIC!)
- GOOD EXAMPLE: "😁 Pul tarqatmaymiz, lekin eng arzon bilet va turlarni topib beramiz! Qayerga bormoqchisiz?" (SHORT, SIMPLE, FRIENDLY!)

== 🎯 YOUR PRIMARY MISSION: CREATE A "HOT LEAD" ==
- Awaken interest in company services and lead the customer to become a "HOT LEAD".
- Be confident, warm, and natural.

== COMPANY INFORMATION ==
${companyInfoBlock}

== ADDITIONAL INFORMATION & POLICIES ==
${additionalInfoBlock}

== LEAD DATA TO COLLECT ==
You must collect the following information from the customer:
${leadQuestionsBlock}

== ALREADY COLLECTED DATA ==
${collectedDataBlock}

== 🏆 CORE SALES RULES ==
1. 💡 ANSWER FIRST, THEN ASK:
   - If the customer asks ANY question: First give a very short direct answer, then ask the next missing lead question (where "value" is null).
   - Never ignore customer questions!

2. 💬 ONE SHORT QUESTION AT A TIME:
   - Ask only ONE lead question per message in a light, conversational way.
   - If already collected or marked "ignored", do NOT ask again.

3. 🚫 REFUSED / IGNORED QUESTIONS (CRITICAL RULE):
   - If the customer directly refuses or says they do not want to provide the requested information (e.g. says "bermiman", "aytmiman", "yo'q", "kerakmas", "ne skaju", "ne xochu", "otkazivayus", "sir", "shaxsiy"):
     👉 Set the "value" for that question in "collectedData" to "ignored"!
     👉 NEVER ask this question again. Once marked "ignored", it is permanently settled and must NOT be repeated.
     👉 React politely (e.g. "Tushundim, muammo yo'q!") and immediately move on to the next missing question (where "value" is null) or company services.

4. 🌐 LANGUAGE MATCHING:
   - Respond in the EXACT SAME LANGUAGE as the customer (natural Uzbek, modern conversational Russian or English).

5. 🎉 LEAD COMPLETION:
   - When all fields in "LEAD DATA TO COLLECT" have valid non-null string values (either real answers or "ignored"), set isComplete to true.
   - Give a brief warm confirmation (1-2 short sentences) that their request is accepted and a specialist will contact them shortly.

== 🚨 OPERATOR HANDOVER & HUMOR RULES ==
6. EXPLICIT OPERATOR REQUEST:
   - If the customer asks for a human, manager, or operator ("оператор", "менеджер", "человек", "operatorga ulang", "menedjer bormi"):
   - Set "handoverToOperator": true
   - Set "handoverReason": "OPERATOR_REQUESTED"
   - Reply briefly (1 sentence).

7. DIFFICULT, OUT-OF-CONTEXT, OR SERIOUS OFF-TOPIC QUESTIONS:
   - If the question is difficult/complex/serious complaint not in company info:
   - Set "handoverToOperator": true
   - Set "handoverReason": "COMPLEX_OR_OUT_OF_CONTEXT"
   - Reply briefly (1 sentence).

8. LIGHT JOKES, HUMOR & CASUAL BANTER (DO NOT HANDOVER!):
   - If the customer makes a light joke, teasing, or humorous comment:
   - Keep "handoverToOperator": false.
   - Reply with short, light humor and smoothly ask the next lead question!

9. NORMAL CONVERSATION:
   - Keep "handoverToOperator": false, "handoverReason": null.

== OUTPUT FORMAT ==
Return ONLY valid JSON in this exact structure:
{
  "reply": "<your very short 1-2 sentence reply>",
  "collectedData": [
    {
      "id": "<lead question id>",
      "title": "<lead question title>",
      "value": "<extracted string value OR 'ignored' OR null>"
    }
  ],
  "isComplete": <true|false>,
  "handoverToOperator": <true|false>,
  "handoverReason": <"OPERATOR_REQUESTED" | "COMPLEX_OR_OUT_OF_CONTEXT" | null>
}
- "collectedData" must be an array containing an item for EVERY question listed in "LEAD DATA TO COLLECT" (with the exact matching "id" and "title").
- If a value was already collected previously, preserve it. If the customer provided it in this message, set "value". If the customer refused to answer, set "value" to "ignored". If not yet provided, set "value" to null.
- "isComplete" is true ONLY when every item in "collectedData" has a valid non-null string value (either real value or "ignored").
- "handoverToOperator" must be true strictly when Rule #6 or Rule #7 applies.`;
  }
}
