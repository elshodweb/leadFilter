import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AdditionalInformation,
  AdditionalInformationDocument,
} from '../schemas/additional-information.schema';
import { CreateAdditionalInfoDto } from '../dto/create-additional-info.dto';
import { UpdateAdditionalInfoDto } from '../dto/update-additional-info.dto';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '../../../common/dto/pagination.dto';

@Injectable()
export class AdditionalInformationRepository {
  constructor(
    @InjectModel(AdditionalInformation.name)
    private readonly model: Model<AdditionalInformationDocument>,
  ) {}

  async create(
    organizationId: string,
    dto: CreateAdditionalInfoDto,
  ): Promise<AdditionalInformationDocument> {
    return this.model.create({ ...dto, organizationId });
  }

  async findPaginatedByOrg(
    organizationId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<AdditionalInformationDocument>> {
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
      data as AdditionalInformationDocument[],
      total,
      page,
      limit,
    );
  }

  async findByOrg(
    organizationId: string,
  ): Promise<AdditionalInformationDocument[]> {
    return this.model.find({ organizationId }).lean() as Promise<
      AdditionalInformationDocument[]
    >;
  }

  async findById(id: string): Promise<AdditionalInformationDocument | null> {
    return this.model
      .findById(id)
      .lean() as Promise<AdditionalInformationDocument | null>;
  }

  async update(
    id: string,
    dto: UpdateAdditionalInfoDto,
  ): Promise<AdditionalInformationDocument | null> {
    return this.model
      .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
      .lean() as Promise<AdditionalInformationDocument | null>;
  }

  async delete(id: string): Promise<AdditionalInformationDocument | null> {
    return this.model
      .findByIdAndDelete(id)
      .lean() as Promise<AdditionalInformationDocument | null>;
  }
}
