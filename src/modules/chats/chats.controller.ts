import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ChatsService } from './chats.service';
import { MessagesService } from '../messages/messages.service';
import { ListChatsDto } from './dto/list-chats.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UserRole } from '../users/schemas/user.schema';
import type { AuthenticatedRequest } from '../../common/interfaces/auth.interface';

@ApiTags('Chats')
@ApiBearerAuth()
@Controller('chats')
export class ChatsController {
  private readonly logger = new Logger(ChatsController.name);

  constructor(
    private readonly chatsService: ChatsService,
    private readonly messagesService: MessagesService,
  ) {}

  
  @Get()
  @ApiOperation({
    summary: 'List chats (Admin can filter by organizationId or view all)',
  })
  findAll(@Req() req: AuthenticatedRequest, @Query() dto: ListChatsDto) {
    const isAdmin = req.user.role === UserRole.ADMIN;
    if (!isAdmin) {
      dto.organizationId = req.user.organizationId;
    }
    return this.chatsService.findAll(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single chat by ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.chatsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update chat status or data' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateChatDto) {
    return this.chatsService.update(id, dto);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get message history for a chat' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMessages(
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    return this.messagesService.getChatHistory(id, +page, +limit);
  }
}
