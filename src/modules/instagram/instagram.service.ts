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
    const baseUrl = apiBaseUrl.replace(/\/$/, '');
    const candidateUrls = [
      `https://graph.facebook.com/${apiVersion}/me/messages`,
      ...(businessAccountId
        ? [`https://graph.facebook.com/${apiVersion}/${businessAccountId}/messages`]
        : []),
      `${baseUrl}/${apiVersion}/me/messages`,
      ...(businessAccountId
        ? [`${baseUrl}/${apiVersion}/${businessAccountId}/messages`]
        : []),
    ];

    let lastError: any = null;

    for (const rawUrl of candidateUrls) {
      // Try with Authorization Header first, then with access_token query param
      const urlsToTry = [
        rawUrl,
        `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`,
      ];

      for (const url of urlsToTry) {
        try {
          const displayUrl = url.split('?')[0];
          this.logger.debug(
            `[Instagram API] Sending message to recipient ${recipientId} via ${displayUrl}...`,
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

          // If Meta returned an error
          if (data?.error) {
            lastError = data.error;
            this.logger.warn(
              `[Instagram API Error] Endpoint ${displayUrl} returned error (${response.status}): [Code ${data.error.code}] ${data.error.message} (Subcode: ${data.error.error_subcode || 'none'}, Type: ${data.error.type})`,
            );
          } else {
            lastError = { status: response.status, data };
            this.logger.warn(
              `[Instagram API Error] Endpoint ${displayUrl} returned status ${response.status}: ${JSON.stringify(data)}`,
            );
          }
        } catch (err: any) {
          lastError = err;
          this.logger.warn(
            `[Instagram API Network Error] Failed to call ${rawUrl}: ${err.message}`,
          );
        }
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

  /**
   * Fetch customer profile (name, username, profile_pic) from Meta Graph API
   */
  async getUserProfile(options: {
    userId: string;
    accessToken: string;
    apiVersion?: string;
    apiBaseUrl?: string;
  }): Promise<{ name?: string; username?: string; profile_pic?: string } | null> {
    const {
      userId,
      accessToken,
      apiVersion = 'v23.0',
      apiBaseUrl = 'https://graph.instagram.com',
    } = options;

    if (!userId || !accessToken) return null;

    const candidateUrls = [
      `https://graph.facebook.com/${apiVersion}/${userId}?fields=name,username,profile_pic&access_token=${encodeURIComponent(accessToken)}`,
      `${apiBaseUrl.replace(/\/$/, '')}/${apiVersion}/${userId}?fields=name,username,profile_pic&access_token=${encodeURIComponent(accessToken)}`,
    ];

    for (const url of candidateUrls) {
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const data = await response.json().catch(() => null);
        if (
          response.ok &&
          data &&
          (data.username || data.name || data.profile_pic)
        ) {
          this.logger.log(
            `[Instagram Profile] Successfully fetched profile for user ${userId}: username="${data.username || ''}", name="${data.name || ''}"`,
          );
          return {
            name: data.name || data.username || undefined,
            username: data.username || undefined,
            profile_pic: data.profile_pic || undefined,
          };
        }
      } catch (err: any) {
        this.logger.debug(
          `[Instagram Profile] Could not fetch profile from ${url}: ${err.message}`,
        );
      }
    }
    return null;
  }
}
