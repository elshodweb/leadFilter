export interface AiResponseDto {
  reply: string;
  collectedData: Record<string, any>;
  isComplete: boolean;
}
