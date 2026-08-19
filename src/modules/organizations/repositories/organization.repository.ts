import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Organization,
  OrganizationDocument,
} from '../schemas/organization.schema';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '../../../common/dto/pagination.dto';

@Injectable()
export class OrganizationRepository {
  constructor(
    @InjectModel(Organization.name)
    private readonly model: Model<OrganizationDocument>,
  ) {}

  async create(dto: CreateOrganizationDto): Promise<OrganizationDocument> {
    return this.model.create(dto);
  }

  async findAll(
    filter: Record<string, any> = {},
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<OrganizationDocument>> {
    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      this.model.countDocuments(filter),
    ]);
    return createPaginatedResponse(
      data as OrganizationDocument[],
      total,
      page,
      limit,
    );
  }

  async findById(id: string): Promise<OrganizationDocument | null> {
    return this.model
      .findById(id)
      .lean() as Promise<OrganizationDocument | null>;
  }

  async findByVerifyToken(
    verifyToken: string,
  ): Promise<OrganizationDocument | null> {
    return this.model
      .findOne({ instagramVerifyToken: verifyToken })
      .lean() as Promise<OrganizationDocument | null>;
  }

  async findByBusinessAccountId(
    businessAccountId: string,
  ): Promise<OrganizationDocument | null> {
    return this.model
      .findOne({ instagramBusinessAccountId: businessAccountId })
      .lean() as Promise<OrganizationDocument | null>;
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
  ): Promise<OrganizationDocument | null> {
    return this.model
      .findByIdAndUpdate(id, dto, { new: true })
      .lean() as Promise<OrganizationDocument | null>;
  }

  async delete(id: string): Promise<OrganizationDocument | null> {
    return this.model
      .findByIdAndDelete(id)
      .lean() as Promise<OrganizationDocument | null>;
  }
}
