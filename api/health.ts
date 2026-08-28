import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const hasGemini = Boolean((process.env.GEMINI_API_KEY || '').trim());

  res.status(200).json({
    status: 'ok',
    hasApiKey: hasGemini,
    ai: {
      configured: hasGemini,
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    },
    supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    hasWhatsAppConfig: Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    timestamp: new Date().toISOString(),
  });
}
