import { isProviderOAuthState } from '../../shared/providerOAuth';

export function isProviderOAuthReturn() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get('code') && isProviderOAuthState(params.get('state')));
}

/** If the SPA received a Facebook/Google return URL, send it to Express instead of Supabase Auth. */
export function handoverProviderOAuthToApi() {
  if (!isProviderOAuthReturn()) return;
  const path = window.location.pathname.replace(/\/$/, '');
  if (path === '/api/auth/callback') return;
  const next = `/api/auth/callback${window.location.search}`;
  console.info('[oauth] spa handing provider return to api', { from: path, hasCode: true });
  window.location.replace(next);
}
