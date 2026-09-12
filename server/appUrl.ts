/** Canonical production host. OAuth apps must use this callback until a custom domain is set. */
export const PRODUCTION_APP_URL = 'https://growth-ai-alpha-puce.vercel.app';

/** Public base URL for OAuth redirects and Meta webhooks. */
export function getAppUrl(): string {
  if (process.env.APP_URL?.trim()) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '');
    return `https://${host}`;
  }
  if (process.env.VERCEL) {
    return PRODUCTION_APP_URL;
  }
  if (process.env.VERCEL_URL?.trim()) {
    const host = process.env.VERCEL_URL.replace(/^https?:\/\//, '');
    return `https://${host}`;
  }
  return 'http://localhost:3000';
}

export function allowedOAuthOrigins() {
  return new Set(
    [PRODUCTION_APP_URL, getAppUrl()].map((origin) => origin.replace(/\/$/, ''))
  );
}
