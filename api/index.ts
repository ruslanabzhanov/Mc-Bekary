// Vercel serverless entrypoint: same Express app as local dev (src/server/apiApp.ts),
// just without the Vite middleware / static file serving, which Vercel handles by
// serving the Vite-built `dist/` output directly as static assets.
import 'dotenv/config';
import { createApiApp } from '../src/server/apiApp.js';

const app = createApiApp();

export default app;
