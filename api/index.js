// api/index.js — Vercel serverless entry point.
//
// An Express app instance is itself a (req, res) handler, so the whole API can be
// served by re-exporting it. vercel.json rewrites every /api/* request to this
// function; Express then matches its own routes (/api/vehicles, /api/matrix, …).
//
// server.js only calls listen() when run directly, so importing it here does not
// start a second listener.

import app from '../server.js';

export default app;
