import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListMessagesDto extends PaginationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  chatId: string;
}
