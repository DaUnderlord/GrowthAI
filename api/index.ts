import type { VercelRequest, VercelResponse } from '@vercel/node';
import '../server/loadEnv';

type ExpressHandler = (req: VercelRequest, res: VercelResponse) => unknown;

let app: ExpressHandler | null = null;
let bootError: Error | null = null;

async function loadApp(): Promise<ExpressHandler> {
  if (app) return app;
  if (bootError) throw bootError;
  try {
    console.info('[api] booting Express app');
    const { createApp } = await import('../server/app');
    app = createApp() as unknown as ExpressHandler;
    console.info('[api] Express app ready');
    return app;
  } catch (err: any) {
    bootError = err instanceof Error ? err : new Error(String(err));
    console.error('[api] Express boot failed', err);
    throw bootError;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const expressApp = await loadApp();
    return expressApp(req, res);
  } catch (err: any) {
    console.error('[api] invocation failed', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: err?.message || 'API failed to start',
      });
    }
  }
}
