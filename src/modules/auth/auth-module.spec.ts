import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { AuthModule } from './auth.module';
import { MessagesModule } from '../messages/messages.module';
import { MessagesGateway } from '../messages/messages.gateway';

describe('Authentication module integration', () => {
  it('resolves WebSocket guards in modules that consume global authentication', async () => {
    const builder = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              jwt: {
                accessSecret: 'a'.repeat(32),
                refreshSecret: 'b'.repeat(32),
              },
            }),
          ],
        }),
        EventEmitterModule.forRoot(),
        AuthModule,
        MessagesModule,
      ],
    });
    for (const name of ['User', 'Organization', 'Message', 'Chat']) {
      builder.overrideProvider(getModelToken(name)).useValue({});
    }
    const module = await builder.compile();
    expect(module.get(MessagesGateway)).toBeInstanceOf(MessagesGateway);
    await module.close();
  });
});
