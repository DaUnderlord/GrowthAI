/** Provider OAuth `state` values this app writes: `{platform}_{uuid}`. */
export const PROVIDER_OAUTH_STATE =
  /^(instagram|facebook|meta_ads|youtube|google_analytics|google_ads|tiktok|linkedin)_/;

export function isProviderOAuthState(state?: string | null) {
  return PROVIDER_OAUTH_STATE.test(String(state || ''));
}
