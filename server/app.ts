import "./loadEnv";
import express, { type Express } from "express";
import { registerMetaWebhookRoutes } from "./meta/webhook";
import { registerWhatsAppStaffRoutes, requireSupabaseUser } from "./meta/staffRoutes";
import { registerSocialRoutes } from "./social/routes";
import { registerPublishRoutes } from "./social/publishRoutes";
import { registerCommerceRoutes } from "./commerceRoutes";
import { isEmailConfigured } from "./email";
import { isStripeConfigured } from "./stripeBilling";
import { providerConfig } from "./social/providers";
import {
  AiServiceError,
  generateGeminiContent,
  generateGrowthAI,
  getAiClient,
  getAiStatus,
  parseJsonFromModel,
  sendAiError,
} from "./ai/gemini";
import { getAppUrl } from "./appUrl";
import { probeGoogleAuthEnabled } from "../shared/googleAuth";
import { authOf } from "./authMiddleware";
import {
  constrainPrediction,
  loadLiveAccountContext,
  slimCalendarForAi,
  withLiveAccountRules,
  withLiveAccountUser,
  type LiveAccountContext,
} from "./ai/liveContext";

export function createApp(): Express {
  const app = express();

  app.use((req, _res, next) => {
    const original = String(
      req.headers['x-vercel-original-path'] ||
        req.headers['x-invoke-path'] ||
        req.headers['x-forwarded-uri'] ||
        ''
    ).split('?')[0];
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const stripped = req.path === '/api' || req.path === '/';
    if (stripped && (original.startsWith('/auth/') || (original.startsWith('/api/') && original !== '/api'))) {
      console.info('[api] restored vercel path', { from: req.path, to: original, method: req.method });
      req.url = `${original}${qs}`;
    }
    next();
  });

  app.use((req, res, next) => {
    if (req.method === "POST" && (req.path === "/api/meta/webhook" || req.path === "/api/stripe/webhook")) {
      return next();
    }
    return express.json({ limit: "2mb" })(req, res, next);
  });

  app.get("/api/health", (_req, res) => {
    const ai = getAiStatus();
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey =
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    res.json({
      status: "ok",
      hasApiKey: ai.configured,
      ai,
      hasWhatsAppConfig: Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
      emailConfigured: isEmailConfigured(),
      stripeConfigured: isStripeConfigured(),
      socialProviders: {
        meta: (() => { try { return providerConfig('instagram').configured; } catch { return false; } })(),
        google: (() => { try { return providerConfig('youtube').configured; } catch { return false; } })(),
        tiktok: (() => { try { return providerConfig('tiktok').configured; } catch { return false; } })(),
        linkedin: (() => { try { return providerConfig('linkedin').configured; } catch { return false; } })(),
      },
      supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
      appUrl: getAppUrl(),
      timestamp: new Date().toISOString(),
    });
  });

  // Public browser-safe Supabase config (anon key is publishable).
  app.get("/api/public-config", async (_req, res) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey =
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    const googleAuthEnabled = await probeGoogleAuthEnabled(supabaseUrl, supabaseAnonKey);
    res.json({
      configured: Boolean(supabaseUrl && supabaseAnonKey),
      supabaseUrl,
      supabaseAnonKey,
      googleAuthEnabled,
    });
  });

  registerMetaWebhookRoutes(app, generateGrowthAI);
  registerWhatsAppStaffRoutes(app, generateGrowthAI);
  registerSocialRoutes(app);
  registerPublishRoutes(app);
  registerCommerceRoutes(app);

  const growthAi = [requireSupabaseUser];

  async function liveFor(req: express.Request): Promise<LiveAccountContext> {
    const auth = authOf(req);
    const clientId = String(req.body?.clientId || req.body?.client_id || '');
    const ctx = await loadLiveAccountContext(auth.orgId, clientId);
    console.info('[ai] live context', {
      path: req.path,
      orgId: auth.orgId,
      clientId: clientId || null,
      hasLive: ctx.hasLive,
      accounts: ctx.accounts.length,
      realPosts: ctx.realPosts.length,
      source: ctx.source,
      dataGaps: ctx.dataGaps,
      updatedAt: ctx.updatedAt,
    });
    return ctx;
  }

  app.post("/api/growth/multi-agent", ...growthAi, async (req, res) => {
    try {
      const { clientName, industry, targetGoal, inputPrompt } = req.body;
      const live = await liveFor(req);

      const systemPrompt = withLiveAccountRules(`You are GrowthOS AI, an autonomous multi-agent growth council consisting of:
1. Data Analyst Agent
2. Social Growth Agent
3. Content Strategist Agent
4. Conversion Agent
5. Competitor Research Agent
6. Campaign Optimization Agent
7. Executive Reporting Agent

Context: Client Name: "${clientName || 'General Client'}", Industry: "${industry || 'E-commerce'}", Target Goal: "${targetGoal || '3x Followers & Sales'}".

The Data Analyst must open with last-sync totals and named recent posts. Other agents may only cite those facts. Predicted ROI is a projection, not a guarantee. If hasLive is false, do not produce a fake 90-day scorecard. Respond in Markdown with agent headers.`);

      const userPrompt = withLiveAccountUser(
        inputPrompt || `Run a complete growth audit and strategic roadmap for ${clientName || 'our brand'} to achieve predictable growth in reach, engagement, and conversion revenue over the next 90 days.`,
        live
      );

      const resultText = await generateGrowthAI(userPrompt, systemPrompt);
      res.json({ success: true, analysis: resultText, liveContext: live.publicSummary });
    } catch (err: any) {
      sendAiError(res, err);
    }
  });

  app.post("/api/growth/predict", ...growthAi, async (req, res) => {
    try {
      const { platform, contentType, hookText, targetAudience, industry } = req.body || {};
      if (!String(hookText || '').trim()) {
        res.status(400).json({ success: false, error: 'hookText is required', code: 'validation' });
        return;
      }
      const live = await liveFor(req);

      const systemPrompt = withLiveAccountRules(`You are the AI Prediction Engine of GrowthOS AI.
Compare the hook to last-sync posts and totals. Output JSON:
{
  "estimatedReach": "unknown, or a cautious range that does not exceed ~2x followers or ~14x last-sync 24h reach",
  "viralityScore": 0,
  "engagementScore": 0,
  "conversionProbability": "unknown unless last-sync conversions exist",
  "optimalPostingTime": "unknown — we do not have hour-of-day Insights",
  "confidenceScore": 0,
  "reasoning": "Cite named posts, followers, 24h reach, and saves. If hasLive is false, say connect + Sync first.",
  "recommendedTweaks": ["tactics that reuse winning last-sync posts"]
}
Never invent 35,000-style reach. optimalPostingTime must be unknown. Return ONLY JSON.`);

      const prompt = withLiveAccountUser(
        `Platform: ${platform || 'Instagram'}, Content Type: ${contentType || 'Reel'}, Hook: "${hookText}", Target Audience: "${targetAudience || 'Core buyers'}", Industry: "${industry || 'General'}".
Compare this hook to recentProviderPosts. Do not pick a posting hour. Conversion probability is unknown unless last-sync conversions exist.`,
        live
      );

      const resultText = await generateGrowthAI(prompt, systemPrompt, { temperature: 0.4 });

      const unknownFallback = {
        estimatedReach: 'unknown',
        viralityScore: 0,
        engagementScore: 0,
        conversionProbability: 'unknown',
        optimalPostingTime: 'unknown — last sync has no hour-of-day Insights',
        confidenceScore: 0,
        reasoning: resultText,
        recommendedTweaks: live.hasLive
          ? ['Reuse the highest-save last-sync post pattern before inventing a new format']
          : ['Connect the brand on Social accounts and tap Sync before predicting reach'],
      };

      const parsedData: any = constrainPrediction(parseJsonFromModel(resultText, unknownFallback), live);

      res.json({ success: true, prediction: parsedData, liveContext: live.publicSummary });
    } catch (err: any) {
      sendAiError(res, err);
    }
  });

  app.post("/api/growth/optimize-content", ...growthAi, async (req, res) => {
    try {
      const { topic, channel, goal, audience, hook, postType, metrics } = req.body || {};
      if (!String(topic || '').trim()) {
        res.status(400).json({ success: false, error: 'topic is required', code: 'validation' });
        return;
      }
      const live = await liveFor(req);

      const systemPrompt = withLiveAccountRules(`You are GrowthOS AI Content Optimization Agent.
Generate 3 hooks, 2 captions, 15 hashtags, and 3 CTAs for the connected platforms.
Each hook/caption must say which last-sync post or metric it is copying (saves, reach, caption pattern). If there are no recent posts, write process advice and do not fake winning examples. Markdown.`);

      const prompt = withLiveAccountUser(
        `Topic: "${topic}", Target Channel: "${channel}", Main Goal: "${goal}", Audience: "${audience}".
Hook: "${hook || ''}". Post type: "${postType || ''}".
Selected post metrics (from last sync, may be empty): ${JSON.stringify(metrics || {})}
Optimize this content for the connected account — do not invent reach or follower counts.`,
        live
      );

      const resultText = await generateGrowthAI(prompt, systemPrompt);
      res.json({ success: true, optimization: resultText, liveContext: live.publicSummary });
    } catch (err: any) {
      sendAiError(res, err);
    }
  });

  app.post("/api/growth/competitor-scan", ...growthAi, async (req, res) => {
    try {
      const { competitorName, industry, channel, website } = req.body || {};
      if (!String(competitorName || '').trim()) {
        res.status(400).json({ success: false, error: 'competitorName is required', code: 'validation' });
        return;
      }
      const live = await liveFor(req);

      const target = String(website || competitorName).trim();
      let fetched = '';
      const urlGuess = target.startsWith('http') ? target : `https://${target.replace(/^@/, '')}`;
      try {
        const page = await fetch(urlGuess, {
          headers: { 'User-Agent': 'GrowthOS-Research/1.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (page.ok) {
          const html = await page.text();
          fetched = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000);
        }
      } catch {
        fetched = '';
      }

      const systemPrompt = withLiveAccountRules(`You are GrowthOS AI Competitor Intelligence Engine.
Use live web search plus any fetched page text for the COMPETITOR only. Cite public sources. Do not invent follower counts for the competitor or for this brand.
This brand's numbers come only from LIVE_CONNECTED_ACCOUNT_DATA.
Identify positioning gaps vs this brand's connected accounts, content themes, engagement triggers, and 3 counter-strategies. Markdown.`);

      const prompt = withLiveAccountUser(
        `Competitor: "${competitorName}", Industry: "${industry}", Channel: "${channel}", Website/handle: "${target}".
Fetched public page text (may be empty): ${fetched || '[none]'}
Search the public web for this competitor and compare only against this brand's last-sync metrics.`,
        live
      );

      const resultText = await generateGrowthAI(prompt, systemPrompt, {
        tools: [{ googleSearch: {} }],
      });
      res.json({ success: true, report: resultText, fetchedPage: Boolean(fetched), liveContext: live.publicSummary });
    } catch (err: any) {
      sendAiError(res, err);
    }
  });

  app.post("/api/growth/analyze-calendar", ...growthAi, async (req, res) => {
    try {
      const { calendarData, campaignGoal, clientName } = req.body;
      const live = await liveFor(req);

      const systemPrompt = withLiveAccountRules(`You are GrowthOS AI Content Calendar Audit Engine.
Analyze the calendar for "${clientName || 'Client'}" against goal: "${campaignGoal || 'Drive engagement and sales'}".
Ground format advice in last-sync platforms and recent provider posts. Do not invent a best posting hour.
Evaluate:
1. Overall Quality Score (0-100)
2. Content Pillar Balance
3. Top 3 Strengths (cite calendar rows)
4. Top 3 Gaps vs last-sync winning posts
5. Format suggestions (Reel vs carousel etc.) from last-sync posts
6. Specific rewrites for weak hooks.

Markdown.`);

      const slim = slimCalendarForAi(calendarData);
      const userPrompt = withLiveAccountUser(`Content Calendar Data: ${JSON.stringify(slim)}`, live);

      const resultText = await generateGrowthAI(userPrompt, systemPrompt);
      res.json({ success: true, auditReport: resultText, liveContext: live.publicSummary });
    } catch (err: any) {
      sendAiError(res, err);
    }
  });

  app.post("/api/growth/generate-campaign-funnel", ...growthAi, async (req, res) => {
    try {
      const { campaignName, primaryGoal, targetAudience, budget } = req.body;
      const live = await liveFor(req);

      const systemPrompt = withLiveAccountRules(`You are GrowthOS AI Sales Funnel & Retargeting Strategy Engine.
Build a 5-stage funnel for "${campaignName}" using connected platforms and last-sync posts/spend.
If spend or conversions are 0, ROAS is unknown — do not invent it. Reuse winning last-sync post captions in TOFU/MOFU copy.
Include stages 1–5 (hook, saver content, DM lead, retargeting, conversion CTA). Markdown.`);

      const prompt = withLiveAccountUser(
        `Campaign: "${campaignName}", Goal: "${primaryGoal}", Audience: "${targetAudience}", Monthly Ad Budget: "${budget ?? 'unknown'}".`,
        live
      );

      const resultText = await generateGrowthAI(prompt, systemPrompt);
      res.json({ success: true, funnelStrategy: resultText, liveContext: live.publicSummary });
    } catch (err: any) {
      sendAiError(res, err);
    }
  });

  app.post("/api/growth/analyze-creative-multimodal", ...growthAi, async (req, res) => {
    try {
      const { visualAssetUrl, visualAssetType, calendarTopic, hookText, captionText, campaignGoal, platform, contentType } = req.body;
      const live = await liveFor(req);

      const systemPrompt = withLiveAccountRules(`You are GrowthOS AI Multimodal Creative Director & Visual Analyst.
Score the image for hook power and match to the calendar topic. Compare on-image text to last-sync winning posts when present.
predictedSuccessRate must be 0 if hasLive is false. Do not invent posting times.
Return ONLY JSON:
{
  "visualScore": 0,
  "campaignGoalMatchPct": 0,
  "predictedSuccessRate": 0,
  "visualHookAudit": "What the image actually shows vs last-sync posts.",
  "relevanceAnalysis": "Calendar topic / hook match.",
  "designTweaks": ["...", "...", "..."]
}`);

      const promptText = withLiveAccountUser(`
Platform: ${platform || 'Instagram'}, Content Format: ${contentType || 'Reel/Graphic'}
Scheduled Calendar Topic: "${calendarTopic || ''}"
Hook Text: "${hookText || ''}"
Caption Preview: "${captionText || ''}"
Target Campaign Goal: "${campaignGoal || ''}"
Visual Asset URL/Data: ${visualAssetUrl ? visualAssetUrl.substring(0, 100) + '...' : 'Provided Graphic Asset'}
Asset Type: ${visualAssetType || 'image'}
    `, live);

      const aiClient = await getAiClient();
      if (!aiClient) {
        throw new AiServiceError(
          'Gemini is not configured. Set GEMINI_API_KEY on the server and restart.',
          503,
          'ai_not_configured'
        );
      }

      let contentsPayload: any = promptText;

      if (visualAssetUrl && visualAssetUrl.startsWith("data:image")) {
        const base64Parts = visualAssetUrl.split(",");
        const mimeMatch = visualAssetUrl.match(/data:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const base64Data = base64Parts[1];

        contentsPayload = {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: promptText,
            },
          ],
        };
      }

      const resultText = await generateGeminiContent({
        client: aiClient,
        contents: contentsPayload,
        systemInstruction: systemPrompt,
        temperature: 0.4,
      });
      const parsed: any = parseJsonFromModel(resultText, {
        visualScore: 0,
        campaignGoalMatchPct: 0,
        predictedSuccessRate: 0,
        visualHookAudit: resultText || 'Model did not return JSON.',
        relevanceAnalysis: live.hasLive
          ? 'Could not parse structured analysis; see visualHookAudit for raw model text.'
          : 'No live sync for this brand — connect and Sync before treating success rate as real.',
        designTweaks: live.hasLive
          ? ['Re-run analysis after confirming the image uploaded']
          : ['Connect this brand on Social accounts and tap Sync'],
      });
      parsed.analyzedAt = new Date().toISOString();
      parsed.liveDataUsed = live.hasLive;

      res.json({ success: true, analysis: parsed, liveContext: live.publicSummary });
    } catch (err: any) {
      sendAiError(res, err);
    }
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[api] unhandled', err);
    if (res.headersSent) return;
    res.status(500).json({ success: false, error: err?.message || 'Internal server error' });
  });

  return app;
}
