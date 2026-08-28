/**
 * Live probe of GrowthOS AI routes + Gemini. Prints no secrets.
 * Usage: node scripts/probe-ai.mjs [baseUrl]
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env') });

const BASE = process.argv[2] || 'http://localhost:3000';
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function env(name) {
  return (process.env[name] || '').trim();
}

async function readJson(res) {
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text), raw: text.slice(0, 240) };
  } catch {
    return { status: res.status, json: null, raw: text.slice(0, 240) };
  }
}

function previewAi(parsed) {
  return (
    parsed.json?.error ||
    parsed.json?.code ||
    (typeof parsed.json?.analysis === 'string'
      ? `analysis_chars=${parsed.json.analysis.length}`
      : typeof parsed.json?.optimization === 'string'
        ? `opt_chars=${parsed.json.optimization.length}`
        : typeof parsed.json?.report === 'string'
          ? `report_chars=${parsed.json.report.length}`
          : typeof parsed.json?.auditReport === 'string'
            ? `audit_chars=${parsed.json.auditReport.length}`
            : typeof parsed.json?.funnelStrategy === 'string'
              ? `funnel_chars=${parsed.json.funnelStrategy.length}`
              : parsed.json?.prediction
                ? `virality=${parsed.json.prediction.viralityScore}`
                : parsed.raw)
  );
}

async function runAuthenticatedCases(base, token) {
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const cases = [
    {
      name: 'predict',
      path: '/api/growth/predict',
      body: {
        platform: 'instagram',
        contentType: 'Reel',
        hookText: '3 growth plays that booked 12 consults last week',
        targetAudience: 'SaaS founders',
        industry: 'saas',
      },
      expect: (j) => j?.success && j?.prediction,
    },
    {
      name: 'optimize-content',
      path: '/api/growth/optimize-content',
      body: {
        topic: 'Book more discovery calls',
        channel: 'Instagram',
        goal: 'Lead generation',
        audience: 'SaaS founders',
      },
      expect: (j) => j?.success && typeof j?.optimization === 'string' && j.optimization.length > 40,
    },
    {
      name: 'multi-agent',
      path: '/api/growth/multi-agent',
      body: {
        clientName: 'Probe Brand',
        industry: 'saas',
        targetGoal: 'Lead generation',
        inputPrompt: 'Give a 5-bullet 30-day growth plan. Keep it short.',
      },
      expect: (j) => j?.success && typeof j?.analysis === 'string' && j.analysis.length > 40,
    },
    {
      name: 'competitor-scan',
      path: '/api/growth/competitor-scan',
      body: { competitorName: 'HubSpot', industry: 'saas', channel: 'Instagram' },
      expect: (j) => j?.success && typeof j?.report === 'string' && j.report.length > 40,
    },
    {
      name: 'analyze-calendar',
      path: '/api/growth/analyze-calendar',
      body: {
        clientName: 'Probe Brand',
        campaignGoal: 'Leads',
        calendarData: [{ day: 'Mon', topic: 'Case study reel', format: 'Reel' }],
      },
      expect: (j) => j?.success && typeof j?.auditReport === 'string' && j.auditReport.length > 40,
    },
    {
      name: 'generate-campaign-funnel',
      path: '/api/growth/generate-campaign-funnel',
      body: {
        campaignName: 'Q3 Consult Sprint',
        primaryGoal: 'Booked calls',
        targetAudience: 'SaaS founders',
        budget: 3000,
      },
      expect: (j) => j?.success && typeof j?.funnelStrategy === 'string' && j.funnelStrategy.length > 40,
    },
    {
      name: 'analyze-creative-multimodal (text-only)',
      path: '/api/growth/analyze-creative-multimodal',
      body: {
        calendarTopic: 'Founder story',
        hookText: 'I almost shut the company down',
        captionText: 'Here is what changed',
        campaignGoal: 'Leads',
        platform: 'Instagram',
        contentType: 'Reel',
      },
      expect: (j) => j?.success && j?.analysis,
    },
    {
      name: 'predict validation (empty hook)',
      path: '/api/growth/predict',
      body: { hookText: '   ' },
      expect: (j, status) => status === 400 && j?.code === 'validation',
    },
  ];

  for (const test of cases) {
    const started = Date.now();
    try {
      const res = await fetch(`${base}${test.path}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(test.body),
      });
      const parsed = await readJson(res);
      const ms = Date.now() - started;
      record(
        `POST ${test.path} (${test.name})`,
        Boolean(test.expect(parsed.json, parsed.status)),
        `status=${parsed.status} ms=${ms} ${previewAi(parsed)}`
      );
    } catch (err) {
      record(`POST ${test.path} (${test.name})`, false, String(err.message || err).slice(0, 300));
    }
  }
}

async function main() {
  console.log(`Probing ${BASE}`);

  const geminiKey = env('GEMINI_API_KEY');
  const model = env('GEMINI_MODEL') || 'gemini-3.6-flash';
  record('env.GEMINI_API_KEY', Boolean(geminiKey), geminiKey ? `set (${geminiKey.length} chars)` : 'missing');
  record('env.GEMINI_MODEL', true, env('GEMINI_MODEL') ? model : `${model} (code default)`);

  const supabaseUrl = env('VITE_SUPABASE_URL') || env('SUPABASE_URL');
  const anonKey = env('VITE_SUPABASE_ANON_KEY') || env('SUPABASE_ANON_KEY');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  record('env.Supabase URL', Boolean(supabaseUrl), supabaseUrl ? 'set' : 'missing');
  record('env.anon key', Boolean(anonKey), anonKey ? 'set' : 'missing');
  record('env.service role', true, serviceKey ? 'set' : 'missing (probe will try public sign-up)');

  try {
    const health = await readJson(await fetch(`${BASE}/api/health`));
    const configured = Boolean(health.json?.hasApiKey || health.json?.ai?.configured);
    record(
      'GET /api/health',
      health.status === 200,
      `status=${health.status} hasApiKey=${health.json?.hasApiKey} model=${health.json?.ai?.model || 'n/a'}`
    );
    record(
      'Gemini configured (health)',
      configured,
      configured ? 'yes' : 'no — GEMINI_API_KEY not loaded on server'
    );
  } catch (err) {
    record('GET /api/health', false, String(err.message || err));
  }

  try {
    const unauth = await readJson(
      await fetch(`${BASE}/api/growth/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hookText: 'test hook' }),
      })
    );
    record(
      'POST /api/growth/predict without JWT',
      unauth.status === 401,
      `status=${unauth.status} error=${unauth.json?.error || unauth.raw}`
    );
  } catch (err) {
    record('POST /api/growth/predict without JWT', false, String(err.message || err));
  }

  if (geminiKey) {
    const candidates = [...new Set([model, 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'])].filter(
      (m) => !/^gemini-2\.[05]/i.test(m)
    );
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    let worked = false;
    for (const candidate of candidates) {
      try {
        const started = Date.now();
        const response = await ai.models.generateContent({
          model: candidate,
          contents: 'Reply with exactly: GROWTHOS_OK',
          config: { temperature: 0 },
        });
        const text = (response.text || '').trim();
        const ms = Date.now() - started;
        record(
          `Direct Gemini generateContent (${candidate})`,
          Boolean(text),
          `ms=${ms} chars=${text.length} preview=${JSON.stringify(text.slice(0, 80))}`
        );
        if (text) {
          worked = true;
          break;
        }
      } catch (err) {
        record(
          `Direct Gemini generateContent (${candidate})`,
          false,
          String(err.message || err).slice(0, 220)
        );
      }
    }
    if (!worked) record('Direct Gemini any model', false, 'all model candidates failed');
  } else {
    record('Direct Gemini generateContent', false, 'skipped — no GEMINI_API_KEY');
  }

  if (!supabaseUrl || !anonKey) {
    record('Authenticated AI routes', false, 'skipped — need Supabase URL + anon key');
    finish();
    return;
  }

  const admin = serviceKey
    ? createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `ai-probe-${Date.now()}@growthos.test`;
  const password = `Probe-${Math.random().toString(36).slice(2)}A1!`;
  let userId = null;

  try {
    let token = null;

    if (admin) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: 'AI Probe' },
      });
      if (created.error || !created.data.user) {
        throw new Error(created.error?.message || 'createUser failed');
      }
      userId = created.data.user.id;
      record('Mint probe user', true, `id=${userId.slice(0, 8)}…`);
      const signed = await anon.auth.signInWithPassword({ email, password });
      if (signed.error || !signed.data.session?.access_token) {
        throw new Error(signed.error?.message || 'signIn failed');
      }
      token = signed.data.session.access_token;
      record('Sign-in JWT', true, `token_len=${token.length}`);
    } else {
      const signedUp = await anon.auth.signUp({
        email,
        password,
        options: { data: { name: 'AI Probe' } },
      });
      if (signedUp.error) throw new Error(signedUp.error.message);
      userId = signedUp.data.user?.id || null;
      token = signedUp.data.session?.access_token || null;
      record(
        'Sign-up JWT (no service role)',
        Boolean(token),
        token
          ? `token_len=${token.length}`
          : 'no session returned — confirm-email is on and service role is missing'
      );
    }

    if (token) {
      await runAuthenticatedCases(BASE, token);
    } else {
      record('Authenticated AI routes', false, 'could not mint a JWT');
    }
  } catch (err) {
    record('Authenticated AI setup', false, String(err.message || err).slice(0, 300));
  } finally {
    if (userId && admin) {
      const del = await admin.auth.admin.deleteUser(userId);
      record('Cleanup probe user', !del.error, del.error?.message || 'deleted');
    } else if (userId && !admin) {
      record('Cleanup probe user', true, 'skipped — no service role (probe user may remain in Auth)');
    }
  }

  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log('\n---');
  console.log(`Passed ${results.filter((r) => r.ok).length}/${results.length}`);
  if (failed.length) {
    console.log('Failures:');
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
