import { model } from 'mongoose';
import { UserSchema } from './user.schema';

describe('User responses', () => {
  it('omits credentials even from a newly created document', () => {
    const UserModel = model('UserSerializationTest', UserSchema);
    const user = new UserModel({
      email: 'user@example.com',
      password: 'password-hash',
      refreshToken: 'refresh-hash',
    });
    const response = JSON.parse(JSON.stringify(user));
    expect(response.email).toBe('user@example.com');
    expect(response).not.toHaveProperty('password');
    expect(response).not.toHaveProperty('refreshToken');
  });
});
