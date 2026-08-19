import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

@Catch(WsException, HttpException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
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

    client.emit('error', {
      statusCode: status,
      data: null,
      error: errorMessage,
    });
  }
}
