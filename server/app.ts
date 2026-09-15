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
  loadLiveAccountContext,
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
      source: ctx.source,
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

Each agent must cite LIVE_CONNECTED_ACCOUNT_DATA when stating this brand's numbers. Predicted ROI is a projection from last-sync metrics, not a guarantee. Respond in clean Markdown with clear agent headers.`);

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
      const reach24h = live.accounts.reduce((sum, a) => sum + a.reach24h, 0);

      const systemPrompt = withLiveAccountRules(`You are the AI Prediction Engine of GrowthOS AI.
Analyze the provided content idea against LIVE_CONNECTED_ACCOUNT_DATA and output JSON:
{
  "estimatedReach": "string — a range derived from last-sync 24h reach / followers, or \\"unknown\\"",
  "viralityScore": 0,
  "engagementScore": 0,
  "conversionProbability": "string percent or \\"unknown\\"",
  "optimalPostingTime": "string or \\"unknown\\"",
  "confidenceScore": 0,
  "reasoning": "Cite the live metrics you used. If hasLive is false, say connect + Sync first.",
  "recommendedTweaks": ["...", "...", "..."]
}
If hasLive is false: estimatedReach "unknown", all scores 0, conversionProbability "unknown", confidenceScore 0.
Never invent 35,000-style reach. Return ONLY JSON.`);

      const prompt = withLiveAccountUser(
        `Platform: ${platform || 'Instagram'}, Content Type: ${contentType || 'Reel'}, Hook: "${hookText}", Target Audience: "${targetAudience || 'Core buyers'}", Industry: "${industry || 'General'}". Predict expected reach, virality score, best time, and key recommendations from last-sync data only.`,
        live
      );

      const resultText = await generateGrowthAI(prompt, systemPrompt, { temperature: 0.4 });

      const unknownFallback = {
        estimatedReach: live.hasLive
          ? `unknown — model did not return JSON (last-sync 24h reach ${reach24h || 'n/a'})`
          : 'unknown — connect this brand and tap Sync on Social accounts',
        viralityScore: 0,
        engagementScore: 0,
        conversionProbability: 'unknown',
        optimalPostingTime: 'unknown',
        confidenceScore: 0,
        reasoning: resultText,
        recommendedTweaks: live.hasLive
          ? ['Re-run after a successful Sync if metrics look stale']
          : ['Connect the brand on Social accounts and tap Sync before predicting reach'],
      };

      const parsedData: any = parseJsonFromModel(resultText, unknownFallback);
      parsedData.liveDataUsed = live.hasLive;
      parsedData.liveSource = live.source;
      parsedData.viralityScore = Number(parsedData.viralityScore) || 0;
      parsedData.engagementScore = Number(parsedData.engagementScore) || 0;
      parsedData.confidenceScore = Number(parsedData.confidenceScore) || 0;
      if (!Array.isArray(parsedData.recommendedTweaks)) parsedData.recommendedTweaks = unknownFallback.recommendedTweaks;

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
Generate 3 high-converting Viral Hooks, 2 Captions with high retention structure, a cluster of 15 targeted SEO Hashtags, and 3 CTA Strategies.
Tailor copy to the connected platforms and last-sync performance. If a selected post's metrics are provided, reference them. Respond in clean structured Markdown.`);

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
Analyze the provided monthly content calendar for "${clientName || 'Client'}" against campaign goal: "${campaignGoal || 'Drive engagement and sales'}".
Evaluate against this brand's connected platforms and last-sync performance:
1. Overall Quality Score (0-100)
2. Content Pillar Balance (Educational, Promotional, Social Proof, Viral Curiosity %)
3. Top 3 Strengths
4. Top 3 Critical Weaknesses & Content Gaps
5. Posting Time & Format Optimizations grounded in last-sync accounts
6. Specific 1-Click Suggestions to improve weak posts.

Respond in structured Markdown.`);

      const userPrompt = withLiveAccountUser(
        `Content Calendar Data: ${typeof calendarData === 'string' ? calendarData : JSON.stringify(calendarData, null, 2)}`,
        live
      );

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
Generate a complete 5-stage sales funnel and 3 high-converting audience retargeting scripts for campaign "${campaignName}".
Use this brand's connected platforms and last-sync spend/conversion numbers. If spend is 0 or unknown, do not invent ROAS.
Include:
- Stage 1: Top of Funnel (Attraction Hook)
- Stage 2: Middle of Funnel (Engagement & Reel Savers)
- Stage 3: High Intent Trigger (DM Auto-responder Lead Magnet)
- Stage 4: Retargeting Pool Script (Ad copy for abandoned warm leads)
- Stage 5: Bottom of Funnel Conversion Urgency Call-to-action.

Respond in structured Markdown.`);

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
You analyze content marketing graphics and video thumbnails/frames against scheduled calendar topics, campaign goals, and this brand's last-sync performance.

Analyze the visual creative for:
1. Visual Appeal & Hook Score (0-100)
2. Topic & Calendar Relevance Match Score (0-100%)
3. Predicted Campaign Success Rate (0-100%) — if hasLive is false, set this to 0 and explain
4. Visual Hook Audit (Thumb-stop power, typography legibility, contrast, brand logo placement)
5. Actionable Design Tweaks for Video Editors/Designers before posting.

Return ONLY valid JSON matching this schema:
{
  "visualScore": 0,
  "campaignGoalMatchPct": 0,
  "predictedSuccessRate": 0,
  "visualHookAudit": "Cite live account context if available.",
  "relevanceAnalysis": "Explanation of how well this graphic/video relates to the calendar topic and hook.",
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
