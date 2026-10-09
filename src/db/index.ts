import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu biến môi trường DATABASE_URL");
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  return new Pool({
    connectionString: url,
    // Neon / Supabase yêu cầu SSL
    ssl: isLocal || url.includes("sslmode=disable") ? undefined : { rejectUnauthorized: false },
    max: 5,
  });
}

const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export * from "./schema";
