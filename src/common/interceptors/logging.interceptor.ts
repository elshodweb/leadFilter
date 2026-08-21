import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

const SENSITIVE_KEYS = new Set([
  'password',
  'refreshtoken',
  'token',
  'accesstoken',
  'authorization',
  'secret',
  'apikey',
  'instagramaccesstoken',
  'instagramverifytoken',
  'adminpassword',
]);

function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // Skip non-HTTP contexts (e.g. WebSockets handled separately)
    if (!req || !res) {
      return next.handle();
    }

    const { method, originalUrl, ip, query, body } = req;
    const user = (req as any).user;
    const userContext = user
      ? ` [User: ${user.userId || user.sub || user.email}, Org: ${user.organizationId || 'none'}]`
      : '';

    const startTime = Date.now();

    const sanitizedQuery = Object.keys(query || {}).length
      ? ` Query: ${JSON.stringify(sanitizeData(query))}`
      : '';
    const sanitizedBody =
      body && Object.keys(body).length && method !== 'GET'
        ? ` Body: ${JSON.stringify(sanitizeData(body))}`
        : '';

    this.logger.debug(
      `--> [${method}] ${originalUrl}${userContext} - IP: ${ip}${sanitizedQuery}${sanitizedBody}`,
    );

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        const logMsg = `<-- [${method}] ${originalUrl} ${statusCode} +${duration}ms${userContext}`;

        if (statusCode >= 500) {
          this.logger.error(logMsg);
        } else if (statusCode >= 400) {
          this.logger.warn(logMsg);
        } else {
          this.logger.log(logMsg);
        }
      }),
      catchError((err) => {
        const duration = Date.now() - startTime;
        const statusCode = err?.status || err?.statusCode || 500;
        const message = err?.message || 'Unknown error';

        this.logger.error(
          `<-- [${method}] ${originalUrl} ${statusCode} +${duration}ms${userContext} - Error: ${message}`,
        );
        return throwError(() => err);
      }),
    );
  }
}
