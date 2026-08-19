import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ChatsService } from './chats.service';
import { ChatChannel } from './schemas/chat.schema';
import { Public } from '../auth/decorators/public.decorator';
import { OrganizationsService } from '../organizations/organizations.service';
import { OrganizationStatus } from '../organizations/schemas/organization.schema';

@ApiTags('Webhook')
@Public()
@Controller('webhook')
export class ChatsController {
  private readonly logger = new Logger(ChatsController.name);

  constructor(
    private readonly chatsService: ChatsService,
    private readonly orgsService: OrganizationsService,
  ) {}

  /** Instagram webhook verification (GET) */
  @Get('instagram')
  @ApiOperation({ summary: 'Instagram webhook verification' })
  @ApiQuery({ name: 'hub.mode', required: false })
  @ApiQuery({ name: 'hub.challenge', required: false })
  @ApiQuery({ name: 'hub.verify_token', required: false })
  async verifyInstagram(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') verifyToken: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && verifyToken) {
      const org = await this.orgsService.findByVerifyToken(verifyToken);
      if (org && org.status === OrganizationStatus.ACTIVE) {
        return res.status(200).send(challenge);
      }
    }
    return res.status(403).json({ message: 'Forbidden' });
  }

  /** Instagram webhook event receiver (POST) */
  @Post('instagram')
  @ApiOperation({ summary: 'Receive Instagram messages' })
  async receiveInstagram(@Body() body: any) {
    if (body?.object !== 'instagram') return { status: 'ignored' };

    for (const entry of body.entry || []) {
      const businessAccountId = entry.id;
      const org =
        await this.orgsService.findByBusinessAccountId(businessAccountId);

      if (!org) {
        this.logger.warn(
          `No organization found for Instagram Business Account ID: ${businessAccountId}`,
        );
        continue;
      }

      const organizationId = org._id.toString();

      for (const messaging of entry.messaging || []) {
        const externalChatId = messaging.sender?.id;
        const externalUserId = messaging.sender?.id;
        const text = messaging.message?.text;
        const externalMessageId = messaging.message?.mid;

        if (!externalChatId || !text) continue;

        await this.chatsService.handleIncomingMessage({
          organizationId,
          channel: ChatChannel.INSTAGRAM,
          externalChatId,
          externalUserId,
          content: text,
          externalMessageId,
        });
      }
    }
    return { status: 'ok' };
  }
}
