import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorMessage: string | Record<string, any> = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        errorMessage = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        errorMessage = resObj.message || resObj.error || resObj;
      }

      const user = (request as any)?.user;
      const userContext = user
        ? ` [User: ${user.userId || user.sub}, Org: ${user.organizationId}]`
        : '';

      if (status >= 500) {
        this.logger.error(
          `[${request.method}] ${request.url}${userContext} - Server Error ${status}: ${JSON.stringify(errorMessage)}`,
          (exception as any).stack,
        );
      } else if (status === 404) {
        this.logger.debug(
          `[${request.method}] ${request.url}${userContext} - Not Found 404: ${JSON.stringify(errorMessage)}`,
        );
      } else {
        this.logger.warn(
          `[${request.method}] ${request.url}${userContext} - Client Error ${status}: ${JSON.stringify(errorMessage)}`,
        );
      }
    } else if (exception instanceof Error) {
      errorMessage = exception.message;
      const user = (request as any)?.user;
      const userContext = user
        ? ` [User: ${user.userId || user.sub}, Org: ${user.organizationId}]`
        : '';
      this.logger.error(
        `[${request.method}] ${request.url}${userContext} - Unhandled Exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `[${request.method}] ${request.url} - Unknown Exception: ${JSON.stringify(exception)}`,
      );
    }

    const payload: ApiResponse<null> = {
      statusCode: status,
      data: null,
      error: errorMessage,
    };

    response.status(status).json(payload);
  }
}
