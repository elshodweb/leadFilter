import { SeederService } from './seeder.service';

describe('Demo seeding', () => {
  const original = { ...process.env };
  const service = () =>
    new SeederService({} as any, {} as any, {} as any, {} as any, {} as any);
  afterEach(() => {
    process.env = { ...original };
  });

  it('does not seed on a normal startup', async () => {
    delete process.env.SEED_DEMO_DATA;
    const seeder = service();
    const seed = jest.spyOn(seeder, 'seed').mockResolvedValue(undefined);
    await seeder.onApplicationBootstrap();
    expect(seed).not.toHaveBeenCalled();
  });

  it('allows explicitly requested local demo data', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SEED_DEMO_DATA = 'true';
    const seeder = service();
    const seed = jest.spyOn(seeder, 'seed').mockResolvedValue(undefined);
    await seeder.onApplicationBootstrap();
    expect(seed).toHaveBeenCalledWith(false);
  });

  it('rejects even forced demo seeding in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SEED_DEMO_DATA = 'true';
    const seeder = service();
    await expect(seeder.seed(true)).rejects.toThrow('Demo seeding is disabled');
    await expect(seeder.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
