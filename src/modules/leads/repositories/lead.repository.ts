import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lead, LeadDocument, LeadStatus } from '../schemas/lead.schema';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '../../../common/dto/pagination.dto';
import { UpdateLeadDto } from '../dto/update-lead.dto';

@Injectable()
export class LeadRepository {
  constructor(
    @InjectModel(Lead.name)
    private readonly model: Model<LeadDocument>,
  ) {}

  async getNextOrder(organizationId: string, status: LeadStatus): Promise<number> {
    const highest = await this.model
      .findOne({ organizationId, status })
      .sort({ order: -1 })
      .select('order')
      .lean();
    return highest && typeof highest.order === 'number' ? highest.order + 1 : 1;
  }

  async create(data: Partial<Lead>): Promise<LeadDocument> {
    const status = data.status || LeadStatus.NEW;
    const nextOrder =
      data.order ||
      (await this.getNextOrder(data.organizationId!.toString(), status));
    return this.model.create({
      ...data,
      status,
      order: nextOrder,
    });
  }

  async findAll(
    filter: Record<string, any>,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<LeadDocument>> {
    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.model.countDocuments(filter),
    ]);
    return createPaginatedResponse(data as LeadDocument[], total, page, limit);
  }

  async findById(id: string): Promise<LeadDocument | null> {
    return this.model.findById(id).lean() as Promise<LeadDocument | null>;
  }

  async findByChatId(chatId: string): Promise<LeadDocument | null> {
    return this.model
      .findOne({ chatId })
      .lean() as Promise<LeadDocument | null>;
  }

  async update(
    id: string,
    dto: UpdateLeadDto,
  ): Promise<LeadDocument | null> {
    const target = await this.model.findById(id);
    if (!target) return null;

    const orgId = target.organizationId.toString();
    const oldStatus = target.status;
    const oldOrder = target.order || 1;

    // 1. Update data if provided
    if (dto.data !== undefined) {
      target.data = dto.data;
    }

    const hasStatusChange =
      dto.status !== undefined && dto.status !== oldStatus;
    const hasOrderChange = dto.order !== undefined && dto.order !== oldOrder;

    if (hasStatusChange) {
      const newStatus = dto.status!;
      const countNewStatus = await this.model.countDocuments({
        organizationId: orgId,
        status: newStatus,
      });

      // Destination order in the new status column
      const targetOrder =
        dto.order !== undefined
          ? Math.max(1, Math.min(dto.order, countNewStatus + 1))
          : countNewStatus + 1;

      // 1. Close the gap in source column (shift down)
      await this.model.updateMany(
        {
          organizationId: orgId,
          status: oldStatus,
          _id: { $ne: target._id },
          order: { $gt: oldOrder },
        },
        { $inc: { order: -1 } },
      );

      // 2. Make room in destination column (shift up)
      await this.model.updateMany(
        {
          organizationId: orgId,
          status: newStatus,
          _id: { $ne: target._id },
          order: { $gte: targetOrder },
        },
        { $inc: { order: 1 } },
      );

      target.status = newStatus;
      target.order = targetOrder;
    } else if (hasOrderChange) {
      // Reordering within the SAME status column
      const countSameStatus = await this.model.countDocuments({
        organizationId: orgId,
        status: oldStatus,
      });
      const targetOrder = Math.max(1, Math.min(dto.order!, countSameStatus));

      if (targetOrder < oldOrder) {
        // Moving UP (e.g. from 4 to 2): shift items in [targetOrder, oldOrder - 1] by +1
        await this.model.updateMany(
          {
            organizationId: orgId,
            status: oldStatus,
            _id: { $ne: target._id },
            order: { $gte: targetOrder, $lt: oldOrder },
          },
          { $inc: { order: 1 } },
        );
      } else if (targetOrder > oldOrder) {
        // Moving DOWN (e.g. from 2 to 4): shift items in [oldOrder + 1, targetOrder] by -1
        await this.model.updateMany(
          {
            organizationId: orgId,
            status: oldStatus,
            _id: { $ne: target._id },
            order: { $gt: oldOrder, $lte: targetOrder },
          },
          { $inc: { order: -1 } },
        );
      }
      target.order = targetOrder;
    }

    await target.save();
    return target.toObject ? (target.toObject() as LeadDocument) : target;
  }

  async delete(id: string): Promise<LeadDocument | null> {
    const target = await this.model.findById(id);
    if (!target) return null;

    const orgId = target.organizationId.toString();
    const deletedStatus = target.status;
    const deletedOrder = target.order || 1;

    await this.model.findByIdAndDelete(id);

    // Shift subsequent leads in the same status column to eliminate gap
    await this.model.updateMany(
      {
        organizationId: orgId,
        status: deletedStatus,
        order: { $gt: deletedOrder },
      },
      { $inc: { order: -1 } },
    );

    return target.toObject ? (target.toObject() as LeadDocument) : target;
  }

  async deleteByChatId(chatId: string): Promise<any> {
    const leads = await this.model.find({ chatId });
    for (const lead of leads) {
      await this.delete(lead._id.toString());
    }
    return { deletedCount: leads.length };
  }

  async findRawAll(): Promise<any[]> {
    return this.model.find({}).lean();
  }

  async updateRaw(id: string, data: Record<string, any>): Promise<any> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' })
      .lean();
  }
}
