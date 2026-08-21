import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CompanyInformation,
  CompanyInformationDocument,
} from '../schemas/company-information.schema';
import { CreateCompanyInfoDto } from '../dto/create-company-info.dto';
import { UpdateCompanyInfoDto } from '../dto/update-company-info.dto';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '../../../common/dto/pagination.dto';

@Injectable()
export class CompanyInformationRepository {
  constructor(
    @InjectModel(CompanyInformation.name)
    private readonly model: Model<CompanyInformationDocument>,
  ) {}

  async create(
    organizationId: string,
    dto: CreateCompanyInfoDto,
  ): Promise<CompanyInformationDocument> {
    return this.model.create({ ...dto, organizationId });
  }

  async findPaginatedByOrg(
    organizationId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<CompanyInformationDocument>> {
    const [data, total] = await Promise.all([
      this.model
        .find({ organizationId })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      this.model.countDocuments({ organizationId }),
    ]);
    return createPaginatedResponse(
      data as CompanyInformationDocument[],
      total,
      page,
      limit,
    );
  }

  async findByOrg(
    organizationId: string,
  ): Promise<CompanyInformationDocument[]> {
    return this.model.find({ organizationId }).lean() as Promise<
      CompanyInformationDocument[]
    >;
  }

  async findById(id: string): Promise<CompanyInformationDocument | null> {
    return this.model
      .findById(id)
      .lean() as Promise<CompanyInformationDocument | null>;
  }

  async update(
    id: string,
    dto: UpdateCompanyInfoDto,
  ): Promise<CompanyInformationDocument | null> {
    return this.model
      .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
      .lean() as Promise<CompanyInformationDocument | null>;
  }

  async delete(id: string): Promise<CompanyInformationDocument | null> {
    return this.model
      .findByIdAndDelete(id)
      .lean() as Promise<CompanyInformationDocument | null>;
  }
}
