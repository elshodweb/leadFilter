export default () => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (
    !accessSecret ||
    !refreshSecret ||
    accessSecret.length < 32 ||
    refreshSecret.length < 32 ||
    accessSecret === refreshSecret
  ) {
    throw new Error(
      'Set distinct JWT_ACCESS_SECRET and JWT_REFRESH_SECRET values of at least 32 characters',
    );
  }
  return {
    port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
    mongodb: {
      uri: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB_NAME || 'lead_filter',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    jwt: {
      accessSecret: accessSecret,
      refreshSecret: refreshSecret,
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
  };
};
