import fs from 'node:fs';
export function databaseSchema(env: NodeJS.ProcessEnv = process.env) {
  const value = env.DATABASE_SCHEMA?.trim() || 'public';
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(value)) throw new Error('Invalid DATABASE_SCHEMA');
  return value;
}
export function postgresOptions(env: NodeJS.ProcessEnv = process.env) {
  const schema = databaseSchema(env);
  const max = Number(env.DATABASE_POOL_MAX || 5);
  if (!Number.isInteger(max) || max < 1 || max > 20) throw new Error('Invalid DATABASE_POOL_MAX');
  const tls = env.DATABASE_SSL_MODE === 'verify-full';
  if (env.NODE_ENV === 'production' && !tls) throw new Error('PostgreSQL production requires DATABASE_SSL_MODE=verify-full');
  const connectionString = env.DATABASE_URL!;
  const url = new URL(connectionString);
  if (tls && ['sslmode','sslcert','sslkey','sslrootcert'].some(key=>url.searchParams.has(key))) throw new Error('Use DATABASE_SSL_CA_FILE instead of URL SSL parameters');
  return { connectionString, max, options: `-c search_path=${schema}`, connectionTimeoutMillis:15000,
    ssl: tls ? { rejectUnauthorized:true, ...(env.DATABASE_SSL_CA_FILE ? {ca:fs.readFileSync(env.DATABASE_SSL_CA_FILE,'utf8')} : {}) } : false };
}
