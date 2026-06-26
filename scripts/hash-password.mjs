#!/usr/bin/env node
// Generate an AUTH_PASSWORD_HASH for the superuser gate.
//
//   node scripts/hash-password.mjs 'your-password'
//
// Copy the printed "salt:hash" value into AUTH_PASSWORD_HASH (Vercel env var or
// .env). This keeps the plaintext password out of your environment entirely.
// Alternatively you can set AUTH_PASSWORD to the plaintext password directly.

import crypto from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs 'your-password'");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');

console.log('\nAUTH_PASSWORD_HASH=' + salt + ':' + hash + '\n');
