import type { VercelRequest, VercelResponse } from '@vercel/node';
import { probeGoogleAuthEnabled } from '../shared/googleAuth';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  const googleAuthEnabled = await probeGoogleAuthEnabled(supabaseUrl, supabaseAnonKey);

  res.status(200).json({
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    supabaseUrl,
    supabaseAnonKey,
    googleAuthEnabled,
  });
}
