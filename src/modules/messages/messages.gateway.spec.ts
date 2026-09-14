import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';
import { ChatDocument } from '../chats/schemas/chat.schema';
import { AuthenticatedSocket } from '../../common/interfaces/auth.interface';

describe('Message access', () => {
  const ownOrg = '507f1f77bcf86cd799439011';
  const otherOrg = '507f1f77bcf86cd799439012';
  const chatId = '507f1f77bcf86cd799439013';
  let gateway: MessagesGateway;
  let service: any;
  let events: EventEmitter2;
  let chat: any;
  const client = (role = 'OPERATOR') =>
    ({ user: { role, organizationId: ownOrg } }) as AuthenticatedSocket;

  beforeEach(() => {
    chat = { _id: chatId, organizationId: ownOrg };
    const model = {
      findOne: jest.fn((filter) => ({
        lean: () => ({
          exec: async () =>
            chat &&
            chat._id === filter._id &&
            (!filter.organizationId ||
              filter.organizationId === chat.organizationId)
              ? chat
              : null,
        }),
      })),
    };
    service = {
      getChatHistory: jest.fn().mockResolvedValue([]),
      saveHumanMessage: jest.fn().mockResolvedValue({ _id: 'message' }),
    };
    events = new EventEmitter2();
    jest.spyOn(events, 'emit');
    gateway = new MessagesGateway(
      service as MessagesService,
      events,
      model as unknown as Model<ChatDocument>,
    );
  });

  it('lists messages in the operator organization', async () => {
    await gateway.handleMessageList({ chatId }, client());
    expect(service.getChatHistory).toHaveBeenCalledWith(chatId, 1, 20);
  });

  it('denies reading another organization chat', async () => {
    chat.organizationId = otherOrg;
    await expect(
      gateway.handleMessageList({ chatId }, client()),
    ).rejects.toThrow('Chat not found');
    expect(service.getChatHistory).not.toHaveBeenCalled();
  });

  it('denies sending to another organization without saving or emitting', async () => {
    chat.organizationId = otherOrg;
    await expect(
      gateway.handleSendMessage({ chatId, content: 'hello' }, client()),
    ).rejects.toThrow('Chat not found');
    expect(service.saveHumanMessage).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('uses the chat organization when a global admin sends a message', async () => {
    chat.organizationId = otherOrg;
    await gateway.handleSendMessage(
      { chatId, content: 'hello' },
      client('ADMIN'),
    );
    expect(service.saveHumanMessage).toHaveBeenCalledWith(
      otherOrg,
      chatId,
      'hello',
    );
    expect(events.emit).toHaveBeenCalledWith(
      'message.human',
      expect.objectContaining({ organizationId: otherOrg }),
    );
  });

  it('rejects a missing chat without creating a message', async () => {
    chat = null;
    await expect(
      gateway.handleSendMessage({ chatId, content: 'hello' }, client('ADMIN')),
    ).rejects.toThrow('Chat not found');
    expect(service.saveHumanMessage).not.toHaveBeenCalled();
  });

  it('rejects malformed identifiers', async () => {
    await expect(
      gateway.handleMessageList({ chatId: 'bad-id' }, client()),
    ).rejects.toThrow('Invalid chatId');
    expect(service.getChatHistory).not.toHaveBeenCalled();
  });
});
