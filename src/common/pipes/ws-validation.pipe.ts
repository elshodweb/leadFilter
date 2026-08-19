import { ArgumentMetadata, Injectable, ValidationPipe } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsValidationPipe extends ValidationPipe {
  constructor() {
    super({ whitelist: true, transform: true });
  }

  async transform(value: any, metadata: ArgumentMetadata) {
    try {
      return await super.transform(value, metadata);
    } catch (err: any) {
      throw new WsException(err.message || 'Validation failed');
    }
  }
}
