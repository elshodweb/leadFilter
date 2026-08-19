import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from './repositories/user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly repo: UserRepository) {}

  async create(organizationId: string, dto: CreateUserDto) {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(dto.password, SALT_ROUNDS);
    return this.repo.create({
      organizationId: organizationId as any,
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      password: hashed,
      role: dto.role,
    });
  }

  async findAll(organizationId: string, page = 1, limit = 20) {
    return this.repo.findAllByOrg(organizationId, page, limit);
  }

  async findOne(id: string, organizationId: string) {
    const user = await this.repo.findById(id);
    if (!user || user.organizationId.toString() !== organizationId) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async update(id: string, organizationId: string, dto: UpdateUserDto) {
    await this.findOne(id, organizationId); // validates ownership

    const updateData: Partial<any> = { ...dto };
    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }

    const updated = await this.repo.update(id, updateData);
    if (!updated) throw new NotFoundException(`User ${id} not found`);
    return updated;
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundException(`User ${id} not found`);
    return deleted;
  }

  /** Used internally by AuthService */
  async findByEmailWithPassword(email: string) {
    return this.repo.findByEmail(email, true);
  }

  async findByIdWithRefreshToken(id: string) {
    return this.repo.findById(id, true);
  }

  async setRefreshToken(id: string, token: string | null) {
    return this.repo.setRefreshToken(id, token);
  }
}
