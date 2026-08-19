import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LeadQuestion,
  LeadQuestionDocument,
} from '../schemas/lead-question.schema';
import { CreateLeadQuestionDto } from '../dto/create-lead-question.dto';
import { UpdateLeadQuestionDto } from '../dto/update-lead-question.dto';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '../../../common/dto/pagination.dto';

@Injectable()
export class LeadQuestionRepository {
  constructor(
    @InjectModel(LeadQuestion.name)
    private readonly model: Model<LeadQuestionDocument>,
  ) {}

  async getNextOrder(organizationId: string): Promise<number> {
    const highest = await this.model
      .findOne({ organizationId })
      .sort({ order: -1 })
      .select('order')
      .lean();
    return highest ? highest.order + 1 : 1;
  }

  async create(
    organizationId: string,
    dto: CreateLeadQuestionDto,
  ): Promise<LeadQuestionDocument> {
    const nextOrder = await this.getNextOrder(organizationId);
    return this.model.create({
      title: dto.title,
      description: dto.description,
      organizationId,
      order: nextOrder,
    });
  }

  async findPaginatedByOrg(
    organizationId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<LeadQuestionDocument>> {
    const [data, total] = await Promise.all([
      this.model
        .find({ organizationId })
        .sort({ order: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.model.countDocuments({ organizationId }),
    ]);
    return createPaginatedResponse(
      data as LeadQuestionDocument[],
      total,
      page,
      limit,
    );
  }

  async findByOrg(organizationId: string): Promise<LeadQuestionDocument[]> {
    return this.model
      .find({ organizationId })
      .sort({ order: 1 })
      .lean() as Promise<LeadQuestionDocument[]>;
  }

  async findById(id: string): Promise<LeadQuestionDocument | null> {
    return this.model.findById(id);
  }

  async update(
    id: string,
    dto: UpdateLeadQuestionDto,
  ): Promise<LeadQuestionDocument | null> {
    const target = await this.model.findById(id);
    if (!target) return null;

    const orgId = target.organizationId.toString();

    // 1. Update text fields if provided
    if (dto.title !== undefined) target.title = dto.title;
    if (dto.description !== undefined) target.description = dto.description;

    // 2. Handle swipe reordering if order is provided and changed
    if (dto.order !== undefined && dto.order !== target.order) {
      const oldOrder = target.order;
      const count = await this.model.countDocuments({ organizationId: orgId });
      const targetOrder = Math.max(1, Math.min(dto.order, count));

      if (targetOrder < oldOrder) {
        // Moving DOWN (e.g. from 5 to 3): shift elements in [targetOrder, oldOrder - 1] up (+1)
        await this.model.updateMany(
          {
            organizationId: orgId,
            _id: { $ne: target._id },
            order: { $gte: targetOrder, $lt: oldOrder },
          },
          { $inc: { order: 1 } },
        );
      } else if (targetOrder > oldOrder) {
        // Moving UP (e.g. from 2 to 4): shift elements in [oldOrder + 1, targetOrder] down (-1)
        await this.model.updateMany(
          {
            organizationId: orgId,
            _id: { $ne: target._id },
            order: { $gt: oldOrder, $lte: targetOrder },
          },
          { $inc: { order: -1 } },
        );
      }
      target.order = targetOrder;
    }

    await target.save();
    return target;
  }

  async delete(id: string): Promise<LeadQuestionDocument | null> {
    const target = await this.model.findById(id);
    if (!target) return null;

    const deletedOrder = target.order;
    const orgId = target.organizationId.toString();

    await this.model.findByIdAndDelete(id);

    // Shift all subsequent questions down by 1 to eliminate gap
    await this.model.updateMany(
      { organizationId: orgId, order: { $gt: deletedOrder } },
      { $inc: { order: -1 } },
    );

    return target;
  }
}
