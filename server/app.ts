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

  app.post("/api/growth/multi-agent", ...growthAi, async (req, res) => {
    try {
      const { clientName, industry, targetGoal, inputPrompt } = req.body;

      const systemPrompt = `You are GrowthOS AI, an autonomous multi-agent growth council consisting of:
1. Data Analyst Agent
2. Social Growth Agent
3. Content Strategist Agent
4. Conversion Agent
5. Competitor Research Agent
6. Campaign Optimization Agent
7. Executive Reporting Agent

Context: Client Name: "${clientName || 'General Client'}", Industry: "${industry || 'E-commerce'}", Target Goal: "${targetGoal || '3x Followers & Sales'}".

Provide a structured collaborative breakdown where each relevant agent provides specific data-backed recommendations, actionable tactics, and predicted ROI. Respond in clean Markdown with clear agent headers.`;

      const userPrompt = inputPrompt || `Run a complete growth audit and strategic roadmap for ${clientName || 'our brand'} to achieve predictable growth in reach, engagement, and conversion revenue over the next 90 days.`;

      const resultText = await generateGrowthAI(userPrompt, systemPrompt);
      res.json({ success: true, analysis: resultText });
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

      const systemPrompt = `You are the AI Prediction Engine of GrowthOS AI.
Analyze the provided content idea and output a JSON response matching this structure:
{
  "estimatedReach": "35,000 - 55,000",
  "viralityScore": 78,
  "engagementScore": 84,
  "conversionProbability": "12.4%",
  "optimalPostingTime": "Thursday at 7:30 PM",
  "confidenceScore": 89,
  "reasoning": "Detailed breakdown of why this post will perform well or underperform based on platform algorithm hooks and user behavior patterns.",
  "recommendedTweaks": [
    "Tweak 1 for higher hook retention",
    "Tweak 2 for viral share triggers",
    "Tweak 3 for CTA conversion"
  ]
}
Return ONLY valid raw JSON without markdown codeblock formatting if possible or formatted JSON string.`;

      const prompt = `Platform: ${platform || 'Instagram'}, Content Type: ${contentType || 'Reel'}, Hook: "${hookText}", Target Audience: "${targetAudience || 'Gen Z & Millennials'}", Industry: "${industry || 'FMCG'}". Predict expected reach, virality score, best time, and key recommendations.`;

      const resultText = await generateGrowthAI(prompt, systemPrompt, { temperature: 0.4 });

      const parsedData = parseJsonFromModel(resultText, {
        rawOutput: resultText,
        viralityScore: 75,
        engagementScore: 80,
        estimatedReach: "25,000 - 45,000",
        optimalPostingTime: "Wednesday at 8:00 PM",
        confidenceScore: 85,
        reasoning: resultText,
        recommendedTweaks: ["Enhance visual contrast in first 2 seconds", "Add a strong curiosity loop in the caption"],
        conversionProbability: "8%",
      });

      res.json({ success: true, prediction: parsedData });
    } catch (err: any) {
      sendAiError(res, err);
    }
  });

  app.post("/api/growth/optimize-content", ...growthAi, async (req, res) => {
    try {
      const { topic, channel, goal, audience } = req.body || {};
      if (!String(topic || '').trim()) {
        res.status(400).json({ success: false, error: 'topic is required', code: 'validation' });
        return;
      }

      const systemPrompt = `You are GrowthOS AI Content Optimization Agent. 
Generate 3 high-converting Viral Hooks, 2 Captions with high retention structure, a cluster of 15 targeted SEO Hashtags, and 3 CTA Strategies. Respond in clean structured Markdown.`;

      const prompt = `Topic: "${topic}", Target Channel: "${channel}", Main Goal: "${goal}", Audience: "${audience}". Optimize this content for maximum engagement and viral reach.`;

      const resultText = await generateGrowthAI(prompt, systemPrompt);
      res.json({ success: true, optimization: resultText });
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

      const systemPrompt = `You are GrowthOS AI Competitor Intelligence Engine.
Use live web search plus any fetched page text. Cite public sources. Do not invent follower counts. If a number is unknown, say unknown.
Identify positioning, content themes, engagement triggers, and 3 counter-strategies. Markdown.`;

      const prompt = `Competitor: "${competitorName}", Industry: "${industry}", Channel: "${channel}", Website/handle: "${target}".
Fetched public page text (may be empty): ${fetched || '[none]'}
Search the public web for this brand's social presence and summarize only what you can verify.`;

      const resultText = await generateGrowthAI(prompt, systemPrompt, {
        tools: [{ googleSearch: {} }],
      });
      res.json({ success: true, report: resultText, fetchedPage: Boolean(fetched) });
    } catch (err: any) {
      sendAiError(res, err);
    }
  });

  app.post("/api/growth/analyze-calendar", ...growthAi, async (req, res) => {
    try {
      const { calendarData, campaignGoal, clientName } = req.body;

      const systemPrompt = `You are GrowthOS AI Content Calendar Audit Engine.
Analyze the provided monthly content calendar for "${clientName || 'Client'}" against campaign goal: "${campaignGoal || 'Drive engagement and sales'}".
Evaluate:
1. Overall Quality Score (0-100)
2. Content Pillar Balance (Educational, Promotional, Social Proof, Viral Curiosity %)
3. Top 3 Strengths
4. Top 3 Critical Weaknesses & Content Gaps
5. Posting Time & Format Optimizations
6. Specific 1-Click Suggestions to improve weak posts.

Respond in structured Markdown.`;

      const userPrompt = `Content Calendar Data: ${typeof calendarData === 'string' ? calendarData : JSON.stringify(calendarData, null, 2)}`;

      const resultText = await generateGrowthAI(userPrompt, systemPrompt);
      res.json({ success: true, auditReport: resultText });
    } catch (err: any) {
      sendAiError(res, err);
    }
  });

  app.post("/api/growth/generate-campaign-funnel", ...growthAi, async (req, res) => {
    try {
      const { campaignName, primaryGoal, targetAudience, budget } = req.body;

      const systemPrompt = `You are GrowthOS AI Sales Funnel & Retargeting Strategy Engine.
Generate a complete 5-stage sales funnel and 3 high-converting audience retargeting scripts for campaign "${campaignName}".
Include:
- Stage 1: Top of Funnel (Attraction Hook)
- Stage 2: Middle of Funnel (Engagement & Reel Savers)
- Stage 3: High Intent Trigger (DM Auto-responder Lead Magnet)
- Stage 4: Retargeting Pool Script (Ad copy for abandoned warm leads)
- Stage 5: Bottom of Funnel Conversion Urgency Call-to-action.

Respond in structured Markdown.`;

      const prompt = `Campaign: "${campaignName}", Goal: "${primaryGoal}", Audience: "${targetAudience}", Monthly Ad Budget: "$${budget || 5000}".`;

      const resultText = await generateGrowthAI(prompt, systemPrompt);
      res.json({ success: true, funnelStrategy: resultText });
    } catch (err: any) {
      sendAiError(res, err);
    }
  });

  app.post("/api/growth/analyze-creative-multimodal", ...growthAi, async (req, res) => {
    try {
      const { visualAssetUrl, visualAssetType, calendarTopic, hookText, captionText, campaignGoal, platform, contentType } = req.body;

      const systemPrompt = `You are GrowthOS AI Multimodal Creative Director & Visual Analyst.
You analyze content marketing graphics and video thumbnails/frames against scheduled calendar topics and campaign goals.

Analyze the visual creative for:
1. Visual Appeal & Hook Score (0-100)
2. Topic & Calendar Relevance Match Score (0-100%)
3. Predicted Campaign Success Rate (0-100%)
4. Visual Hook Audit (Thumb-stop power, typography legibility, contrast, brand logo placement)
5. Actionable Design Tweaks for Video Editors/Designers before posting.

Return ONLY valid JSON matching this schema:
{
  "visualScore": 88,
  "campaignGoalMatchPct": 92,
  "predictedSuccessRate": 86,
  "visualHookAudit": "Text explanation of visual strengths and first 3 second hook power.",
  "relevanceAnalysis": "Explanation of how well this graphic/video relates to the calendar topic and hook.",
  "designTweaks": [
    "Increase hook headline font size by 15% for mobile feed contrast",
    "Add sub-headline in brand gold color to highlight CTA",
    "Ensure brand logo is centered in lower-right safe zone"
  ]
}`;

      const promptText = `
Platform: ${platform || 'Instagram'}, Content Format: ${contentType || 'Reel/Graphic'}
Scheduled Calendar Topic: "${calendarTopic || 'Product Showcase'}"
Hook Text: "${hookText || 'Stop doing this standard mistake'}"
Caption Preview: "${captionText || 'Learn how our framework triples reach'}"
Target Campaign Goal: "${campaignGoal || 'Scale high-intent conversions'}"
Visual Asset URL/Data: ${visualAssetUrl ? visualAssetUrl.substring(0, 100) + '...' : 'Provided Graphic Asset'}
Asset Type: ${visualAssetType || 'image'}
    `;

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
        visualScore: 85,
        campaignGoalMatchPct: 90,
        predictedSuccessRate: 84,
        visualHookAudit: resultText || "Strong visual layout matching intended hook.",
        relevanceAnalysis: "Visual elements complement the scheduled calendar topic.",
        designTweaks: [
          "Optimize color contrast for mobile OLED screens",
          "Ensure text safe zones clear native social platform UI overlays"
        ],
      });
      parsed.analyzedAt = new Date().toISOString();

      res.json({ success: true, analysis: parsed });
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
