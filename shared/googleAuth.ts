/** Probe whether Supabase Auth has the Google provider switched on. */
export async function probeGoogleAuthEnabled(
  supabaseUrl: string,
  anonKey: string
): Promise<boolean> {
  if (!supabaseUrl || !anonKey) return false;
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/authorize?provider=google`, {
      method: 'GET',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      redirect: 'manual',
    });
    if (res.status >= 300 && res.status < 400) return true;
    if (res.status === 0 && res.type === 'opaqueredirect') return true;
    const text = await res.text();
    if (/provider is not enabled|Unsupported provider/i.test(text)) return false;
    return res.ok;
  } catch {
    return false;
  }
}
