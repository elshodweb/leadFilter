import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '../../../common/dto/pagination.dto';

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(User.name) private readonly model: Model<UserDocument>,
  ) {}

  async create(data: Partial<User>): Promise<UserDocument> {
    return this.model.create(data);
  }

  async findByEmail(
    email: string,
    withPassword = false,
  ): Promise<UserDocument | null> {
    const q = this.model.findOne({ email: email.toLowerCase() });
    if (withPassword) q.select('+password +refreshToken');
    return q.lean() as Promise<UserDocument | null>;
  }

  async findById(
    id: string,
    withSensitive = false,
  ): Promise<UserDocument | null> {
    const q = this.model.findById(id);
    if (withSensitive) q.select('+password +refreshToken');
    return q.lean() as Promise<UserDocument | null>;
  }

  async findAllByOrg(
    organizationId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<UserDocument>> {
    const [data, total] = await Promise.all([
      this.model
        .find({ organizationId })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      this.model.countDocuments({ organizationId }),
    ]);
    return createPaginatedResponse(data as UserDocument[], total, page, limit);
  }

  async update(id: string, data: Partial<User>): Promise<UserDocument | null> {
    return this.model
      .findByIdAndUpdate(id, data, { returnDocument: 'after' })
      .lean() as Promise<UserDocument | null>;
  }

  async setRefreshToken(id: string, token: string | null): Promise<void> {
    await this.model.findByIdAndUpdate(id, { refreshToken: token });
  }

  async delete(id: string): Promise<UserDocument | null> {
    return this.model
      .findByIdAndDelete(id)
      .lean() as Promise<UserDocument | null>;
  }
}
