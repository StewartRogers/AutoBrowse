// db.js — libSQL/Turso client shared by the local dev server and (later) Vercel functions.
//
// Local dev: no env needed. Defaults to a local SQLite file (file:garage.db), so existing
// data and the fully-offline workflow keep working exactly as before.
//
// Production (Vercel): set TURSO_DATABASE_URL (libsql://…turso.io) and TURSO_AUTH_TOKEN to
// point at a hosted Turso database. The same query code runs against either backend.

import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:garage.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const isLocalFile = url.startsWith('file:');
export const db = createClient(authToken ? { url, authToken } : { url });

// Create the schema once per process. Cached so repeated calls (e.g. per serverless
// invocation) don't re-run the DDL.
let schemaReady;
export function initSchema() {
  schemaReady ??= db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id         TEXT    PRIMARY KEY,
      data       TEXT    NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS matrix (
      id   INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT    NOT NULL
    );
  `);
  return schemaReady;
}
