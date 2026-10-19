import pg from "pg";

const { Pool } = pg;

const DIRECT_URL = process.env.DIRECT_URL;
if (!DIRECT_URL) throw new Error("DIRECT_URL env var is required");

const cleanUrl = DIRECT_URL
  .replace(/[?&]sslmode=[^&]*/g, "")
  .replace(/[?&]sslaccept=[^&]*/g, "");

export const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
  max: 5,
  // A stalled Supabase connection must not leave /chat waiting forever before
  // it can even open the SSE stream. These limits turn a dead socket into a
  // fast error, which callers can degrade gracefully from.
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  query_timeout: 10_000,
  statement_timeout: 10_000,
});
