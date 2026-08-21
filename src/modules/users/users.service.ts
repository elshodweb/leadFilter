import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from './repositories/user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly repo: UserRepository) {}

  async create(organizationId: string, dto: CreateUserDto) {
    this.logger.log(
      `Creating user ${dto.email} (Role: ${dto.role}) in Org: ${organizationId}`,
    );
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      this.logger.warn(`User creation failed: email ${dto.email} already exists`);
      throw new ConflictException('Email already in use');
    }

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
    this.logger.debug(`Listing users for org ${organizationId} (page=${page}, limit=${limit})`);
    return this.repo.findAllByOrg(organizationId, page, limit);
  }

  async findOne(id: string, organizationId: string) {
    this.logger.debug(`Fetching user ${id} in org ${organizationId}`);
    const user = await this.repo.findById(id);
    if (!user || user.organizationId.toString() !== organizationId) {
      this.logger.warn(`User ${id} not found in org ${organizationId}`);
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async update(id: string, organizationId: string, dto: UpdateUserDto) {
    this.logger.log(`Updating user ${id} in org ${organizationId}`);
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
    this.logger.log(`Deleting user ${id} from org ${organizationId}`);
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
