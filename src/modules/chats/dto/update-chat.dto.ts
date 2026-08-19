import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ChatStatus } from '../schemas/chat.schema';

export class UpdateChatDto {
  @ApiPropertyOptional({ enum: ChatStatus })
  @IsOptional()
  @IsEnum(ChatStatus)
  status?: ChatStatus;
}
