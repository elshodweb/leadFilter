import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ChatStatus } from '../schemas/chat.schema';

export class ListChatsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ enum: ChatStatus })
  @IsOptional()
  @IsEnum(ChatStatus)
  status?: ChatStatus;
}
