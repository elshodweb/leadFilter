import { CollectedDataItem } from './ai-context.dto';

export interface AiResponseDto {
  reply: string;
  collectedData: CollectedDataItem[];
  isComplete: boolean;
}
