export type JsonReadResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number };

/** Safely parse fetch responses that may be HTML/plain text (e.g. Vercel errors). */
export async function readJsonResponse<T = unknown>(res: Response): Promise<JsonReadResult<T>> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      ok: false,
      error: res.ok ? 'Empty response from server' : `Request failed (${res.status})`,
      status: res.status,
    };
  }

  try {
    return { ok: true, data: JSON.parse(text) as T, status: res.status };
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 140);
    if (/a server error occurred|internal server error|function_invocation_failed/i.test(snippet)) {
      return {
        ok: false,
        error: `Server error (${res.status}). Check Vercel env vars and function logs, then redeploy.`,
        status: res.status,
      };
    }
    return {
      ok: false,
      error: res.ok
        ? `Unexpected response format: ${snippet}`
        : `Request failed (${res.status}): ${snippet}`,
      status: res.status,
    };
  }
}
