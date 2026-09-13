function config(env = process.env) {
  for (const key of ['DB_CONNECTION_STRING', 'PUBLIC_ORIGIN', 'REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USER_AGENT']) {
    if (!env[key]) throw new Error(`Missing configuration: ${key}`);
  }
  const origin = new URL(env.PUBLIC_ORIGIN);
  const production = env.NODE_ENV === 'production';
  if (origin.origin !== env.PUBLIC_ORIGIN || (production && origin.protocol !== 'https:')) throw new Error('PUBLIC_ORIGIN must be an origin, with HTTPS in production');
  function integer(key, fallback) {
    const value = Number(env[key] || fallback);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid configuration: ${key}`);
    return value;
  }
  return { connectionString: env.DB_CONNECTION_STRING, origin: origin.origin, production,
    clientId: env.REDDIT_CLIENT_ID, clientSecret: env.REDDIT_CLIENT_SECRET, userAgent: env.REDDIT_USER_AGENT,
    redirectUri: `${origin.origin}/api/auth/reddit/callback`, port: integer('PORT', 8080),
    authLimit: integer('AUTH_RATE_LIMIT', 30), mutationLimit: integer('MUTATION_RATE_LIMIT', 60), trustProxy: env.TRUST_PROXY || false };
}
module.exports = { config };
