import { Request } from 'express';
import { Socket } from 'socket.io';
import { UserRole } from '../../modules/users/schemas/user.schema';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export interface AuthenticatedSocket extends Socket {
  user: AuthenticatedUser;
}
