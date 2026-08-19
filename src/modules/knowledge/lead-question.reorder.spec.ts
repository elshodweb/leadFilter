import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { LeadQuestionRepository } from './repositories/lead-question.repository';
import { LeadQuestion } from './schemas/lead-question.schema';

describe('LeadQuestion Swipe Reordering & Auto-Counter', () => {
  let repository: LeadQuestionRepository;
  let mockQuestions: any[] = [];

  const mockModel: any = {
    findOne: jest.fn().mockImplementation(() => ({
      sort: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockImplementation(() => ({
          lean: jest.fn().mockImplementation(async () => {
            if (mockQuestions.length === 0) return null;
            const sorted = [...mockQuestions].sort((a, b) => b.order - a.order);
            return sorted[0];
          }),
        })),
      })),
    })),
    countDocuments: jest
      .fn()
      .mockImplementation(async () => mockQuestions.length),
    create: jest.fn().mockImplementation(async (doc) => {
      const newDoc = {
        _id: `id_${Date.now()}_${Math.random()}`,
        ...doc,
        save: jest.fn().mockImplementation(async function () {
          return this;
        }),
      };
      mockQuestions.push(newDoc);
      return newDoc;
    }),
    findById: jest.fn().mockImplementation(async (id) => {
      return mockQuestions.find((q) => q._id === id) || null;
    }),
    findByIdAndDelete: jest.fn().mockImplementation(async (id) => {
      const idx = mockQuestions.findIndex((q) => q._id === id);
      if (idx !== -1) {
        const [deleted] = mockQuestions.splice(idx, 1);
        return deleted;
      }
      return null;
    }),
    updateMany: jest.fn().mockImplementation(async (filter, update) => {
      const inc = update?.$inc?.order || 0;
      mockQuestions.forEach((q) => {
        if (filter._id?.$ne && q._id === filter._id.$ne) return;
        if (filter.order?.$gte !== undefined && q.order < filter.order.$gte)
          return;
        if (filter.order?.$lt !== undefined && q.order >= filter.order.$lt)
          return;
        if (filter.order?.$gt !== undefined && q.order <= filter.order.$gt)
          return;
        if (filter.order?.$lte !== undefined && q.order > filter.order.$lte)
          return;
        q.order += inc;
      });
      return { modifiedCount: 1 };
    }),
  };

  beforeEach(async () => {
    mockQuestions = [];
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadQuestionRepository,
        {
          provide: getModelToken(LeadQuestion.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    repository = module.get<LeadQuestionRepository>(LeadQuestionRepository);
  });

  it('should auto-assign orders 1, 2, 3 on create', async () => {
    const q1 = await repository.create('org_1', {
      title: 'a',
      description: 'desc',
    });
    const q2 = await repository.create('org_1', {
      title: 'b',
      description: 'desc',
    });
    const q3 = await repository.create('org_1', {
      title: 'c',
      description: 'desc',
    });

    expect(q1.order).toBe(1);
    expect(q2.order).toBe(2);
    expect(q3.order).toBe(3);
  });

  it('should shift items correctly when moving down (5 -> 3)', async () => {
    // Populate 1: a, 2: b, 3: c, 4: d, 5: e
    const qa = await repository.create('org_1', {
      title: 'a',
      description: 'desc',
    });
    const qb = await repository.create('org_1', {
      title: 'b',
      description: 'desc',
    });
    const qc = await repository.create('org_1', {
      title: 'c',
      description: 'desc',
    });
    const qd = await repository.create('org_1', {
      title: 'd',
      description: 'desc',
    });
    const qe = await repository.create('org_1', {
      title: 'e',
      description: 'desc',
    });

    // Move e (5) to order 3
    await repository.update(qe._id.toString(), { order: 3 });

    expect(qa.order).toBe(1);
    expect(qb.order).toBe(2);
    expect(qe.order).toBe(3); // e is now 3
    expect(qc.order).toBe(4); // c shifted 3 -> 4
    expect(qd.order).toBe(5); // d shifted 4 -> 5
  });

  it('should shift items correctly when moving up (2 -> 4)', async () => {
    const qa = await repository.create('org_1', {
      title: 'a',
      description: 'desc',
    });
    const qb = await repository.create('org_1', {
      title: 'b',
      description: 'desc',
    });
    const qc = await repository.create('org_1', {
      title: 'c',
      description: 'desc',
    });
    const qd = await repository.create('org_1', {
      title: 'd',
      description: 'desc',
    });
    const qe = await repository.create('org_1', {
      title: 'e',
      description: 'desc',
    });

    // Move b (2) to order 4
    await repository.update(qb._id.toString(), { order: 4 });

    expect(qa.order).toBe(1);
    expect(qc.order).toBe(2); // c shifted 3 -> 2
    expect(qd.order).toBe(3); // d shifted 4 -> 3
    expect(qb.order).toBe(4); // b is now 4
    expect(qe.order).toBe(5);
  });

  it('should eliminate gaps when deleting an item', async () => {
    const qa = await repository.create('org_1', {
      title: 'a',
      description: 'desc',
    });
    const qb = await repository.create('org_1', {
      title: 'b',
      description: 'desc',
    });
    const qc = await repository.create('org_1', {
      title: 'c',
      description: 'desc',
    });

    // Delete b (2)
    await repository.delete(qb._id.toString());

    expect(qa.order).toBe(1);
    expect(qc.order).toBe(2); // c shifted 3 -> 2
  });
});
