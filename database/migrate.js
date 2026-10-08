"use strict";

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { Pool } = require("pg");

const localEnvPath = join(__dirname, "..", ".env.local");
const env = require("node:fs").readFileSync(localEnvPath, "utf8");
for (const line of env.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
  if (match && !(match[1] in process.env))
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is not configured");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

const sql = readFileSync(join(__dirname, "schema.sql"), "utf8");

async function main() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("Neon database schema is ready.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
