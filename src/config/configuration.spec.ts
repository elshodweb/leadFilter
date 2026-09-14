import configuration from './configuration';

describe('JWT configuration', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it.each([
    ['', 'b'.repeat(32)],
    ['short', 'b'.repeat(32)],
    ['a'.repeat(32), 'a'.repeat(32)],
  ])('rejects missing, short or shared secrets', (access, refresh) => {
    process.env.JWT_ACCESS_SECRET = access;
    process.env.JWT_REFRESH_SECRET = refresh;
    expect(configuration).toThrow('Set distinct');
  });

  it('accepts separate secrets and uses a short default access lifetime', () => {
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    delete process.env.JWT_ACCESS_EXPIRES_IN;
    expect(configuration().jwt.accessExpiresIn).toBe('15m');
  });
});
