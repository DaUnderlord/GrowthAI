import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from './app';

console.info('[api] creating Express app');
const app = createApp();
console.info('[api] Express app ready');

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return app(req as any, res as any);
  } catch (err: any) {
    console.error('[api] invocation failed', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: err?.message || 'API request failed',
      });
    }
  }
}
