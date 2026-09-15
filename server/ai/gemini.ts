import type { GoogleGenAI } from '@google/genai';

const MAX_PROMPT_CHARS = 24_000;
const DEFAULT_TIMEOUT_MS = 55_000;
/** gemini-2.5-flash is blocked for new API keys; prefer 3.x Flash. */
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];

type GenAiSdk = typeof import('@google/genai');

let genAiSdk: GenAiSdk | null = null;

async function loadGenAiSdk(): Promise<GenAiSdk> {
  if (!genAiSdk) {
    console.info('[AI] loading @google/genai');
    genAiSdk = await import('@google/genai');
  }
  return genAiSdk;
}

function isLegacyGemini25(model: string): boolean {
  return /^gemini-2\.[05]/i.test(model);
}

function modelCandidates(preferred?: string): string[] {
  const ordered = [preferred, process.env.GEMINI_MODEL, ...FALLBACK_MODELS]
    .map((m) => (m || '').trim())
    .filter(Boolean)
    .filter((m) => !isLegacyGemini25(m));
  const unique = [...new Set(ordered)];
  return unique.length ? unique : ['gemini-3.6-flash'];
}

function isUnavailableModelError(err: any): boolean {
  const message = `${err?.message || ''} ${JSON.stringify(err?.error || err || '')}`;
  return /404|NOT_FOUND|no longer available|not found for API version/i.test(message);
}

let aiClient: GoogleGenAI | null = null;
let initError: string | null = null;

function getApiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

export function isAiConfigured(): boolean {
  return Boolean(getApiKey()) && !initError;
}

export function getAiStatus() {
  return {
    configured: isAiConfigured(),
    model: DEFAULT_MODEL,
    initError,
  };
}

export async function getAiClient(): Promise<GoogleGenAI | null> {
  if (aiClient) return aiClient;
  const apiKey = getApiKey();
  if (!apiKey) {
    initError = 'GEMINI_API_KEY is not set';
    return null;
  }
  try {
    const { GoogleGenAI } = await loadGenAiSdk();
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'growthos-ai' },
      },
    });
    initError = null;
    return aiClient;
  } catch (err: any) {
    initError = err?.message || 'Failed to initialize Gemini client';
    console.error('Failed to initialize GoogleGenAI:', err);
    return null;
  }
}

function truncate(input: string, max = MAX_PROMPT_CHARS): string {
  if (!input) return '';
  if (input.length <= max) return input;
  console.warn('[AI] prompt truncated', { from: input.length, to: max, hadLivePrefix: input.startsWith('LIVE_CONNECTED_ACCOUNT_DATA') });
  return `${input.slice(0, max)}\n\n[truncated]`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class AiServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'ai_error') {
    super(message);
    this.name = 'AiServiceError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Production Gemini text generation with truncation, timeout, and one retry.
 */
export async function generateGrowthAI(
  prompt: string,
  systemInstruction?: string,
  options?: { temperature?: number; timeoutMs?: number; model?: string; tools?: unknown[] }
): Promise<string> {
  const client = await getAiClient();
  if (!client) {
    throw new AiServiceError(
      'Gemini is not configured. Set GEMINI_API_KEY on the server and restart.',
      503,
      'ai_not_configured'
    );
  }

  const temperature = options?.temperature ?? 0.7;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const contents = truncate(prompt);
  const system = systemInstruction ? truncate(systemInstruction, 8_000) : undefined;

  return generateGeminiContent({
    client,
    contents,
    systemInstruction: system,
    temperature,
    timeoutMs,
    model: options?.model,
    tools: options?.tools,
  });
}

export async function generateGeminiContent(opts: {
  client: GoogleGenAI;
  contents: unknown;
  systemInstruction?: string;
  temperature?: number;
  timeoutMs?: number;
  model?: string;
  tools?: unknown[];
}): Promise<string> {
  const temperature = opts.temperature ?? 0.7;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { ThinkingLevel } = await loadGenAiSdk();
  const models = modelCandidates(opts.model);
  let lastErr: unknown;

  for (const model of models) {
    const run = async () => {
      const response = await opts.client.models.generateContent({
        model,
        contents: opts.contents as any,
        config: {
          temperature,
          ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          ...(opts.tools?.length ? { tools: opts.tools as any } : {}),
        },
      });
      const text = (response.text || '').trim();
      if (!text) {
        throw new AiServiceError('Gemini returned an empty response.', 502, 'ai_empty');
      }
      return text;
    };

    try {
      return await withTimeout(run(), timeoutMs);
    } catch (err: any) {
      lastErr = err;
      if (isUnavailableModelError(err)) {
        console.warn(`[AI] model ${model} unavailable, trying fallback`);
        continue;
      }
      const message = String(err?.message || err);
      if (/timeout|429|503|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(message)) {
        try {
          return await withTimeout(run(), timeoutMs);
        } catch (retryErr: any) {
          lastErr = retryErr;
          throw normalizeAiError(retryErr);
        }
      }
      throw normalizeAiError(err);
    }
  }

  throw normalizeAiError(lastErr);
}

function normalizeAiError(err: any): AiServiceError {
  if (err instanceof AiServiceError) return err;
  const message = String(err?.message || 'AI request failed');
  if (/API key|PERMISSION|401|UNAUTHENTICATED/i.test(message)) {
    return new AiServiceError('Gemini API key is invalid or unauthorized.', 401, 'ai_auth');
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(message)) {
    return new AiServiceError('Gemini rate limit or quota exceeded. Try again shortly.', 429, 'ai_quota');
  }
  if (/timeout/i.test(message)) {
    return new AiServiceError(message, 504, 'ai_timeout');
  }
  if (/404|NOT_FOUND|no longer available/i.test(message)) {
    return new AiServiceError(
      'Gemini model is unavailable. Set GEMINI_MODEL to gemini-3.6-flash (or another current Flash model).',
      502,
      'ai_model'
    );
  }
  return new AiServiceError(message, 500, 'ai_error');
}

export function parseJsonFromModel<T = any>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  let clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  // Extract outermost JSON object/array if model added prose
  const objStart = clean.indexOf('{');
  const arrStart = clean.indexOf('[');
  let start = -1;
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) start = objStart;
  else if (arrStart >= 0) start = arrStart;
  if (start > 0) clean = clean.slice(start);
  const endObj = clean.lastIndexOf('}');
  const endArr = clean.lastIndexOf(']');
  const end = Math.max(endObj, endArr);
  if (end > 0) clean = clean.slice(0, end + 1);
  try {
    return JSON.parse(clean) as T;
  } catch {
    return fallback;
  }
}

export function sendAiError(res: any, err: any) {
  const normalized = normalizeAiError(err);
  console.error(`[AI] ${normalized.code}:`, normalized.message);
  res.status(normalized.status).json({
    success: false,
    error: normalized.message,
    code: normalized.code,
  });
}
