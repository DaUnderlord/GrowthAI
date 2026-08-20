/** Public base URL for OAuth redirects and Meta webhooks. */
export function getAppUrl(): string {
  if (process.env.APP_URL?.trim()) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '');
    return `https://${host}`;
  }
  if (process.env.VERCEL_URL?.trim()) {
    const host = process.env.VERCEL_URL.replace(/^https?:\/\//, '');
    return `https://${host}`;
  }
  return 'http://localhost:3000';
}
