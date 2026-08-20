/**
 * Shared client helper for GrowthOS AI API calls.
 */
export type AiApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  status?: number;
};

export async function callGrowthAi<T = any>(
  path: string,
  body: Record<string, unknown>
): Promise<AiApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      return {
        ok: false,
        error: data?.error || `Request failed (${res.status})`,
        code: data?.code,
        status: res.status,
      };
    }
    return { ok: true, data: data as T };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Network error talking to AI services',
      status: 0,
    };
  }
}
