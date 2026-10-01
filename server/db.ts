import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import pg from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";
import { postgresOptions } from './databaseConfig';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const tcp = process.env.DATABASE_DRIVER === 'pg';
export const pool = (tcp
  ? new pg.Pool(postgresOptions())
  : new NeonPool({ connectionString: process.env.DATABASE_URL })) as unknown as pg.Pool;
export const db = (tcp ? pgDrizzle({ client: pool as pg.Pool, schema })
  : neonDrizzle({ client: pool as unknown as NeonPool, schema })) as ReturnType<typeof pgDrizzle<typeof schema>>;
