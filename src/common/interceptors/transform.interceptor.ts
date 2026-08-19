import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | any
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T> | any> {
    const http = context.switchToHttp();
    const response = http.getResponse();

    return next.handle().pipe(
      map((data) => {
        // If response is null or undefined, return data as null
        const statusCode = response?.statusCode || 200;

        // If the response is already in { statusCode, data, error } format, return as is
        if (
          data &&
          typeof data === 'object' &&
          'statusCode' in data &&
          'error' in data &&
          'data' in data
        ) {
          return data;
        }

        return {
          statusCode,
          data: data ?? null,
          error: null,
        };
      }),
    );
  }
}
