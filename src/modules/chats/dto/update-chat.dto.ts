import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ChatStatus } from '../schemas/chat.schema';

export class UpdateChatDto {
  @ApiPropertyOptional({ enum: ChatStatus, description: 'Lead temperature: COLD, WARM, HOT' })
  @IsOptional()
  @IsEnum(ChatStatus)
  status?: ChatStatus;

  @ApiPropertyOptional({ type: Boolean, description: 'Enable/Disable AI: true (ON), false (OFF)' })
  @IsOptional()
  @IsBoolean()
  ai_enabled?: boolean;
}
