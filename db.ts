import { Pool } from "pg";

// Fallback to local Docker postgres during development if DATABASE_URL is not set
const connectionString = process.env.DATABASE_URL || "postgresql://root:secret_sandbox_vault_key@localhost:5432/supportnexus";

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // Optional log in development
  if (process.env.NODE_ENV !== "production") {
    console.log("Executed query:", { text, duration, rows: res.rowCount });
  }
  return res;
};
