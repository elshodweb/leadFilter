export interface CollectedDataItem {
  id: string;
  title: string;
  value: string | null;
}

export interface AiContextDto {
  organizationId: string;
  chatId: string;
  companyInfo: Array<{ title: string; description: string }>;
  additionalInfo: Array<{ title: string; description: string }>;
  leadQuestions: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
  }>;
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  collectedData: CollectedDataItem[];
  incomingMessage: string;
}
