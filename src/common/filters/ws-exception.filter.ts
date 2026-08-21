import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

@Catch(WsException, HttpException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: WsException | HttpException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    let status = HttpStatus.BAD_REQUEST;
    let errorMessage: any = 'WebSocket error';

    if (exception instanceof WsException) {
      const err = exception.getError();
      errorMessage =
        typeof err === 'string' ? err : (err as any)?.message || err;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      errorMessage =
        typeof res === 'string'
          ? res
          : (res as any)?.message || (res as any)?.error || res;
    }

    const socketId = client?.id || 'unknown';
    const user = client?.user;
    const userContext = user
      ? ` [User: ${user.sub || user.userId}, Org: ${user.organizationId}]`
      : '';

    this.logger.warn(
      `[WS Socket: ${socketId}]${userContext} - WS Error (status ${status}): ${JSON.stringify(errorMessage)}`,
    );

    client.emit('error', {
      statusCode: status,
      data: null,
      error: errorMessage,
    });
  }
}
