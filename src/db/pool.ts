import { Pool } from "pg";
import { ENV } from "../config/env";

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL
});

// helper per query
export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params);