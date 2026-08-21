import { Injectable, Logger } from '@nestjs/common';

export interface SendInstagramMessageOptions {
  accessToken: string;
  businessAccountId?: string;
  apiBaseUrl?: string;
  apiVersion?: string;
  recipientId: string;
  text: string;
}

export interface InstagramSendResult {
  success: boolean;
  messageId?: string;
  error?: any;
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  /**
   * Send a text message to a user on Instagram via Meta Graph API
   */
  async sendTextMessage(
    options: SendInstagramMessageOptions,
  ): Promise<InstagramSendResult> {
    const {
      accessToken,
      businessAccountId,
      apiBaseUrl = 'https://graph.instagram.com',
      apiVersion = 'v23.0',
      recipientId,
      text,
    } = options;

    if (!accessToken) {
      this.logger.warn(
        `Cannot send Instagram message to ${recipientId}: Missing Instagram Access Token!`,
      );
      return { success: false, error: 'Missing Instagram Access Token' };
    }

    const payload = {
      recipient: { id: recipientId },
      message: { text },
    };

    // Candidates for Meta Graph API messaging endpoints
    const candidateUrls = [
      `${apiBaseUrl.replace(/\/$/, '')}/${apiVersion}/me/messages`,
      ...(businessAccountId
        ? [
            `${apiBaseUrl.replace(/\/$/, '')}/${apiVersion}/${businessAccountId}/messages`,
          ]
        : []),
      `https://graph.facebook.com/${apiVersion}/me/messages`,
      ...(businessAccountId
        ? [
            `https://graph.facebook.com/${apiVersion}/${businessAccountId}/messages`,
          ]
        : []),
    ];

    let lastError: any = null;

    for (const url of candidateUrls) {
      try {
        this.logger.debug(
          `[Instagram API] Sending message to recipient ${recipientId} via ${url}...`,
        );

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        const data: any = await response.json().catch(() => null);

        if (response.ok && (data?.message_id || data?.recipient_id)) {
          this.logger.log(
            `[Instagram API] Message sent successfully to ${recipientId} (MID: ${data.message_id || data.recipient_id})`,
          );
          return {
            success: true,
            messageId: data.message_id || data.recipient_id,
          };
        }

        // Check if Meta returned an error
        if (data?.error) {
          lastError = data.error;
          this.logger.warn(
            `[Instagram API Error] Endpoint ${url} returned error (${response.status}): [Code ${data.error.code}] ${data.error.message} (Subcode: ${data.error.error_subcode || 'none'}, Type: ${data.error.type})`,
          );
        } else {
          lastError = { status: response.status, data };
          this.logger.warn(
            `[Instagram API Error] Endpoint ${url} returned status ${response.status}: ${JSON.stringify(data)}`,
          );
        }
      } catch (err: any) {
        lastError = err;
        this.logger.warn(
          `[Instagram API Network Error] Failed to call ${url}: ${err.message}`,
        );
      }
    }

    this.logger.error(
      `[Instagram API] All endpoint attempts failed for recipient ${recipientId}. Last error: ${JSON.stringify(lastError)}`,
    );

    return {
      success: false,
      error: lastError,
    };
  }
}
