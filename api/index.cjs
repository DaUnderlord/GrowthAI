var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/vercel.ts
var vercel_exports = {};
__export(vercel_exports, {
  default: () => handler
});
module.exports = __toCommonJS(vercel_exports);

// server/loadEnv.ts
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();

// server/app.ts
var import_express3 = __toESM(require("express"), 1);

// server/meta/webhook.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_express = __toESM(require("express"), 1);

// server/supabaseAdmin.ts
var import_supabase_js = require("@supabase/supabase-js");
var admin = null;
function getSupabaseAdmin() {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY for WhatsApp server operations."
    );
  }
  admin = (0, import_supabase_js.createClient)(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return admin;
}
function getSupabaseAnonForJwt(jwt) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing Supabase URL/anon key for JWT verification.");
  }
  return (0, import_supabase_js.createClient)(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// server/meta/aiLead.ts
function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function heuristicLeadAnalysis(text) {
  const t = (text || "").toLowerCase();
  let score = 20;
  let urgency = "low";
  let intent = "enquiry";
  let classification = "low_intent";
  const purchaseWords = ["buy", "price", "cost", "how much", "order", "purchase", "wholesale", "quote", "invoice", "payment"];
  const urgentWords = ["today", "tomorrow", "urgent", "asap", "immediately", "now"];
  const qtyMatch = t.match(/(\d+)\s*(pieces?|units?|pcs|qty|quantity)?/);
  const purchaseHits = purchaseWords.filter((w) => t.includes(w)).length;
  score += purchaseHits * 12;
  if (purchaseHits >= 2) intent = "purchase";
  if (urgentWords.some((w) => t.includes(w))) {
    urgency = "high";
    score += 15;
  } else if (t.includes("this week") || t.includes("soon")) {
    urgency = "medium";
    score += 8;
  }
  let quantity = null;
  if (qtyMatch) {
    quantity = Number(qtyMatch[1]);
    if (quantity >= 10) score += 20;
    else if (quantity >= 2) score += 8;
    intent = intent === "enquiry" ? "bulk_interest" : intent;
  }
  if (t.includes("deliver") || t.includes("shipping") || t.includes("abuja") || t.includes("lagos")) {
    score += 10;
  }
  score = clampScore(score);
  if (score >= 75) classification = "high_intent";
  else if (score >= 45) classification = "medium_intent";
  const recommendedAction = classification === "high_intent" ? "assign_sales_manager" : classification === "medium_intent" ? "follow_up_with_pricing" : "nurture_with_info";
  return {
    score,
    classification,
    intent,
    sentiment: t.includes("angry") || t.includes("disappointed") ? "negative" : "positive",
    urgency,
    product: null,
    quantity,
    location: t.includes("abuja") ? "Abuja" : t.includes("lagos") ? "Lagos" : null,
    budget: null,
    objection: t.includes("expensive") || t.includes("too much") ? "price" : null,
    conversionProbability: Number((score / 100).toFixed(2)),
    recommendedAction,
    summary: `Detected ${classification.replace("_", " ")} (${intent}), urgency ${urgency}, score ${score}.`
  };
}
async function analyzeLeadWithGemini(text, generateGrowthAI2) {
  const fallback = heuristicLeadAnalysis(text);
  try {
    const raw = await generateGrowthAI2(
      `Analyze this WhatsApp customer message and return ONLY valid JSON with keys:
score (0-100 number), classification (low_intent|medium_intent|high_intent), intent, sentiment,
urgency (low|medium|high), product, quantity (number|null), location, budget, objection,
conversionProbability (0-1), recommendedAction, summary.

Message:
"""${text}"""`,
      "You are a CRM lead-scoring engine. Respond with pure JSON only. No markdown."
    );
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      score: clampScore(Number(parsed.score) || fallback.score),
      classification: parsed.classification || fallback.classification,
      intent: String(parsed.intent || fallback.intent),
      sentiment: String(parsed.sentiment || fallback.sentiment),
      urgency: parsed.urgency || fallback.urgency,
      product: parsed.product ?? null,
      quantity: parsed.quantity == null ? null : Number(parsed.quantity),
      location: parsed.location ?? null,
      budget: parsed.budget ?? null,
      objection: parsed.objection ?? null,
      conversionProbability: Number(parsed.conversionProbability ?? fallback.conversionProbability),
      recommendedAction: String(parsed.recommendedAction || fallback.recommendedAction),
      summary: String(parsed.summary || fallback.summary)
    };
  } catch {
    return fallback;
  }
}
async function suggestReplyWithGemini(params, generateGrowthAI2) {
  const fallback = `Thanks for your message. I'll confirm the details and get back to you shortly.`;
  try {
    const text = await generateGrowthAI2(
      `Draft one short professional WhatsApp reply (max 2 sentences) for a sales rep.
Brand: ${params.clientName || "our company"}
Latest customer message: ${params.customerMessage}
Recent context: ${params.history || "n/a"}
Return plain text only.`,
      "You write concise WhatsApp sales replies. No emojis unless useful. No markdown."
    );
    return (text || fallback).trim();
  } catch {
    return fallback;
  }
}

// server/meta/ingest.ts
function normalizePhone(phone) {
  return (phone || "").replace(/\D/g, "");
}
function extractText(message) {
  const type = message?.type || "text";
  if (type === "text") {
    return { type, text: message?.text?.body || null, payload: message };
  }
  if (type === "button") {
    return { type, text: message?.button?.text || message?.button?.payload || null, payload: message };
  }
  if (type === "interactive") {
    const reply = message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || null;
    return { type, text: reply, payload: message };
  }
  if (type === "image") {
    return { type, text: message?.image?.caption || "[Image]", payload: message };
  }
  if (type === "audio") return { type, text: "[Audio]", payload: message };
  if (type === "video") return { type, text: message?.video?.caption || "[Video]", payload: message };
  if (type === "document") return { type, text: message?.document?.filename || "[Document]", payload: message };
  if (type === "location") return { type, text: "[Location]", payload: message };
  return { type, text: `[${type}]`, payload: message };
}
function extractReferral(message) {
  const referral = message?.referral;
  if (!referral) return {};
  return {
    source_url: referral.source_url,
    source_type: referral.source_type,
    source_id: referral.source_id,
    headline: referral.headline,
    body: referral.body,
    media_type: referral.media_type,
    ctwa_clid: referral.ctwa_clid,
    image_url: referral.image_url
  };
}
async function resolveAccessToken(accountId) {
  const db = getSupabaseAdmin();
  const { data } = await db.from("whatsapp_account_secrets").select("access_token").eq("account_id", accountId).maybeSingle();
  if (data?.access_token) return data.access_token;
  return process.env.WHATSAPP_ACCESS_TOKEN || null;
}
async function findAccountByPhoneNumberId(phoneNumberId) {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("whatsapp_accounts").select("*").eq("phone_number_id", phoneNumberId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const bootstrapClientId = process.env.WHATSAPP_BOOTSTRAP_CLIENT_ID;
  if (envPhoneId && phoneNumberId === envPhoneId && bootstrapClientId) {
    const { data: client } = await db.from("clients").select("id, org_id, name").eq("id", bootstrapClientId).maybeSingle();
    if (!client?.org_id) return null;
    const { data: created, error: createErr } = await db.from("whatsapp_accounts").upsert(
      {
        org_id: client.org_id,
        client_id: client.id,
        phone_number_id: phoneNumberId,
        display_phone_number: process.env.WHATSAPP_DISPLAY_NUMBER || "",
        status: "connected",
        webhook_subscribed: true
      },
      { onConflict: "phone_number_id" }
    ).select("*").single();
    if (createErr) throw new Error(createErr.message);
    if (process.env.WHATSAPP_ACCESS_TOKEN) {
      await db.from("whatsapp_account_secrets").upsert({
        account_id: created.id,
        access_token: process.env.WHATSAPP_ACCESS_TOKEN,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return created;
  }
  return null;
}
async function persistAnalysis(orgId, conversationId, messageId, analysis) {
  const db = getSupabaseAdmin();
  await db.from("conversation_ai_analyses").insert({
    org_id: orgId,
    conversation_id: conversationId,
    message_id: messageId,
    analysis
  });
  const priority = analysis.classification === "high_intent" ? "high" : analysis.classification === "medium_intent" ? "normal" : "low";
  await db.from("conversations").update({
    lead_score: analysis.score,
    priority,
    ai_summary: analysis.summary,
    recommended_action: analysis.recommendedAction,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", conversationId);
}
async function ingestWhatsAppWebhookPayload(body, generateGrowthAI2) {
  const db = getSupabaseAdmin();
  let processed = 0;
  const entries = body?.entry || [];
  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      if (change?.field && change.field !== "messages") continue;
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const account = await findAccountByPhoneNumberId(phoneNumberId);
      if (!account) {
        console.warn("No WhatsApp account mapped for phone_number_id", phoneNumberId);
        continue;
      }
      for (const status of value?.statuses || []) {
        const waId = status?.id;
        if (!waId) continue;
        const mapped = status.status === "sent" ? "sent" : status.status === "delivered" ? "delivered" : status.status === "read" ? "read" : status.status === "failed" ? "failed" : null;
        if (!mapped) continue;
        await db.from("messages").update({
          status: mapped,
          error_message: status?.errors?.[0]?.title || null
        }).eq("whatsapp_message_id", waId);
        processed += 1;
      }
      for (const message of value?.messages || []) {
        const from = normalizePhone(message?.from);
        if (!from) continue;
        const contactProfile = (value?.contacts || []).find(
          (c) => normalizePhone(c?.wa_id) === from
        );
        const displayName = contactProfile?.profile?.name || from;
        const { type, text, payload } = extractText(message);
        const referral = extractReferral(message);
        const waMessageId = message?.id;
        const ts = message?.timestamp ? new Date(Number(message.timestamp) * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
        if (waMessageId) {
          const { data: existing } = await db.from("messages").select("id").eq("whatsapp_message_id", waMessageId).maybeSingle();
          if (existing) continue;
        }
        const { data: contact, error: contactErr } = await db.from("contacts").upsert(
          {
            org_id: account.org_id,
            client_id: account.client_id,
            phone: from,
            whatsapp_id: from,
            name: displayName,
            source: referral.source_type || "whatsapp",
            meta_referral: referral,
            last_interaction_at: ts,
            updated_at: ts
          },
          { onConflict: "org_id,phone" }
        ).select("*").single();
        if (contactErr) throw new Error(contactErr.message);
        let conversationId = null;
        const { data: openConv } = await db.from("conversations").select("*").eq("org_id", account.org_id).eq("contact_id", contact.id).eq("channel", "whatsapp").in("status", ["open", "pending"]).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (openConv) {
          conversationId = openConv.id;
          await db.from("conversations").update({
            last_message: text || `[${type}]`,
            last_message_at: ts,
            unread_count: (openConv.unread_count || 0) + 1,
            whatsapp_account_id: account.id,
            meta_attribution: Object.keys(referral).length ? { ...openConv.meta_attribution || {}, ...referral } : openConv.meta_attribution,
            updated_at: ts
          }).eq("id", openConv.id);
        } else {
          const { data: createdConv, error: convErr } = await db.from("conversations").insert({
            org_id: account.org_id,
            client_id: account.client_id,
            contact_id: contact.id,
            whatsapp_account_id: account.id,
            channel: "whatsapp",
            status: "open",
            lead_status: "new",
            last_message: text || `[${type}]`,
            last_message_at: ts,
            unread_count: 1,
            meta_attribution: referral
          }).select("*").single();
          if (convErr) throw new Error(convErr.message);
          conversationId = createdConv.id;
          if (Object.keys(referral).length) {
            await db.from("campaign_leads").insert({
              org_id: account.org_id,
              client_id: account.client_id,
              contact_id: contact.id,
              conversation_id: conversationId,
              source: String(referral.source_type || "whatsapp"),
              meta_source_id: referral.source_id ? String(referral.source_id) : null,
              meta_attribution: referral,
              status: "new"
            });
          }
        }
        const { data: savedMsg, error: msgErr } = await db.from("messages").insert({
          org_id: account.org_id,
          conversation_id: conversationId,
          direction: "incoming",
          type,
          text,
          payload,
          whatsapp_message_id: waMessageId,
          status: "received",
          sender_type: "customer",
          timestamp: ts
        }).select("*").single();
        if (msgErr) throw new Error(msgErr.message);
        if (text) {
          const analysis = generateGrowthAI2 ? await analyzeLeadWithGemini(text, generateGrowthAI2) : heuristicLeadAnalysis(text);
          await persistAnalysis(account.org_id, conversationId, savedMsg.id, analysis);
        }
        processed += 1;
      }
    }
  }
  return { processed };
}

// server/orgIntegrations.ts
function familyForPlatform(platform) {
  if (platform === "tiktok") return "tiktok";
  if (platform === "linkedin") return "linkedin";
  if (platform === "youtube" || platform === "google_analytics" || platform === "google_ads") return "google";
  return "meta";
}
async function loadOrgRow(orgId) {
  if (!orgId) return null;
  try {
    const admin2 = getSupabaseAdmin();
    const { data } = await admin2.from("org_provider_secrets").select("*").eq("org_id", orgId).maybeSingle();
    return data;
  } catch {
    return null;
  }
}
async function getOrgFamilyCreds(orgId, family) {
  const row = await loadOrgRow(orgId);
  if (family === "meta") {
    if (row?.meta_app_id && row?.meta_app_secret) {
      return {
        family,
        clientId: row.meta_app_id,
        secret: row.meta_app_secret,
        configured: true,
        source: "org",
        verifyToken: row.meta_webhook_verify_token || ""
      };
    }
    const appId = process.env.META_CLIENT_ID || process.env.META_APP_ID || "";
    const appSecret = process.env.META_APP_SECRET || "";
    if (appId && appSecret) {
      return {
        family,
        clientId: appId,
        secret: appSecret,
        configured: true,
        source: "env",
        verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || ""
      };
    }
    return { family, clientId: "", secret: "", configured: false, source: "none", verifyToken: "" };
  }
  if (family === "google") {
    if (row?.google_client_id && row?.google_client_secret) {
      return {
        family,
        clientId: row.google_client_id,
        secret: row.google_client_secret,
        extra: {
          developerToken: row.google_ads_developer_token || "",
          customerId: row.google_ads_customer_id || ""
        },
        configured: true,
        source: "org"
      };
    }
    const clientId2 = process.env.GOOGLE_CLIENT_ID || "";
    const secret2 = process.env.GOOGLE_CLIENT_SECRET || "";
    if (clientId2 && secret2) {
      return {
        family,
        clientId: clientId2,
        secret: secret2,
        extra: {
          developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
          customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || ""
        },
        configured: true,
        source: "env"
      };
    }
    return { family, clientId: "", secret: "", configured: false, source: "none" };
  }
  if (family === "tiktok") {
    if (row?.tiktok_client_key && row?.tiktok_client_secret) {
      return { family, clientId: row.tiktok_client_key, secret: row.tiktok_client_secret, configured: true, source: "org" };
    }
    const clientId2 = process.env.TIKTOK_CLIENT_KEY || "";
    const secret2 = process.env.TIKTOK_CLIENT_SECRET || "";
    if (clientId2 && secret2) {
      return { family, clientId: clientId2, secret: secret2, configured: true, source: "env" };
    }
    return { family, clientId: "", secret: "", configured: false, source: "none" };
  }
  if (row?.linkedin_client_id && row?.linkedin_client_secret) {
    return { family, clientId: row.linkedin_client_id, secret: row.linkedin_client_secret, configured: true, source: "org" };
  }
  const clientId = process.env.LINKEDIN_CLIENT_ID || "";
  const secret = process.env.LINKEDIN_CLIENT_SECRET || "";
  if (clientId && secret) {
    return { family, clientId, secret, configured: true, source: "env" };
  }
  return { family, clientId: "", secret: "", configured: false, source: "none" };
}
async function getAllOrgProviderStatus(orgId) {
  const families = ["meta", "google", "tiktok", "linkedin"];
  const entries = await Promise.all(families.map((family) => getOrgFamilyCreds(orgId, family)));
  return Object.fromEntries(
    entries.map((creds) => [
      creds.family,
      {
        configured: creds.configured,
        source: creds.source,
        clientId: creds.clientId ? `${creds.clientId.slice(0, 4)}\u2026` : "",
        verifyToken: creds.verifyToken || ""
      }
    ])
  );
}
async function getOrgMetaCreds(orgId) {
  const creds = await getOrgFamilyCreds(orgId, "meta");
  return {
    appId: creds.clientId,
    appSecret: creds.secret,
    verifyToken: creds.verifyToken || "",
    configured: creds.configured,
    source: creds.source
  };
}
async function saveOrgMetaCreds(orgId, input) {
  return saveOrgFamilyCreds(orgId, "meta", {
    clientId: input.appId,
    clientSecret: input.appSecret,
    verifyToken: input.verifyToken
  });
}
async function saveOrgFamilyCreds(orgId, family, input) {
  const admin2 = getSupabaseAdmin();
  const { data: existing } = await admin2.from("org_provider_secrets").select("*").eq("org_id", orgId).maybeSingle();
  const row = {
    org_id: orgId,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (family === "meta") {
    row.meta_app_id = (input.clientId || existing?.meta_app_id || "").trim();
    row.meta_app_secret = input.clientSecret?.trim() || existing?.meta_app_secret || null;
    row.meta_webhook_verify_token = input.verifyToken?.trim() || existing?.meta_webhook_verify_token || `gos_${orgId.slice(0, 8)}`;
    if (!row.meta_app_id) throw new Error("Meta App ID is required.");
  } else if (family === "google") {
    row.google_client_id = (input.clientId || existing?.google_client_id || "").trim();
    row.google_client_secret = input.clientSecret?.trim() || existing?.google_client_secret || null;
    if (input.developerToken !== void 0) row.google_ads_developer_token = input.developerToken.trim() || null;
    if (input.customerId !== void 0) row.google_ads_customer_id = input.customerId.replace(/-/g, "").trim() || null;
    if (!row.google_client_id) throw new Error("Google Client ID is required.");
  } else if (family === "tiktok") {
    row.tiktok_client_key = (input.clientId || existing?.tiktok_client_key || "").trim();
    row.tiktok_client_secret = input.clientSecret?.trim() || existing?.tiktok_client_secret || null;
    if (!row.tiktok_client_key) throw new Error("TikTok Client Key is required.");
  } else {
    row.linkedin_client_id = (input.clientId || existing?.linkedin_client_id || "").trim();
    row.linkedin_client_secret = input.clientSecret?.trim() || existing?.linkedin_client_secret || null;
    if (!row.linkedin_client_id) throw new Error("LinkedIn Client ID is required.");
  }
  const { error } = await admin2.from("org_provider_secrets").upsert(row);
  if (error) throw new Error(error.message);
  const saved = await getOrgFamilyCreds(orgId, family);
  return {
    family,
    configured: saved.configured,
    verifyToken: saved.verifyToken,
    clientId: saved.clientId ? `${saved.clientId.slice(0, 4)}\u2026` : ""
  };
}
async function listOrgWebhookTokens() {
  try {
    const admin2 = getSupabaseAdmin();
    const { data } = await admin2.from("org_provider_secrets").select("meta_webhook_verify_token, meta_app_secret");
    return data || [];
  } catch {
    return [];
  }
}

// server/meta/webhook.ts
function requireSignature() {
  if (process.env.META_REQUIRE_SIGNATURE === "true") return true;
  if (process.env.META_REQUIRE_SIGNATURE === "false") return false;
  return process.env.NODE_ENV === "production";
}
function hmacValid(secret, rawBody, provided) {
  const expected = import_crypto.default.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return import_crypto.default.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}
function verifyMetaSignature(rawBody, signatureHeader) {
  if (!signatureHeader?.startsWith("sha256=")) {
    return !requireSignature() && !process.env.META_APP_SECRET;
  }
  const provided = signatureHeader.slice("sha256=".length);
  const envSecret = process.env.META_APP_SECRET;
  if (envSecret && hmacValid(envSecret, rawBody, provided)) return true;
  return !requireSignature() && !envSecret;
}
async function verifyMetaSignatureAsync(rawBody, signatureHeader) {
  if (verifyMetaSignature(rawBody, signatureHeader)) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);
  const rows = await listOrgWebhookTokens();
  return rows.some((row) => row.meta_app_secret && hmacValid(row.meta_app_secret, rawBody, provided));
}
function registerMetaWebhookRoutes(app2, generateGrowthAI2) {
  app2.get("/api/meta/webhook", async (req, res) => {
    const mode = req.query["hub.mode"];
    const token = String(req.query["hub.verify_token"] || "");
    const challenge = req.query["hub.challenge"];
    const envToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    const orgTokens = await listOrgWebhookTokens();
    const matched = envToken && token === envToken || orgTokens.some((row) => row.meta_webhook_verify_token && row.meta_webhook_verify_token === token);
    if (mode === "subscribe" && token && matched) {
      res.status(200).send(String(challenge || ""));
      return;
    }
    res.status(403).send("Forbidden");
  });
  app2.post(
    "/api/meta/webhook",
    import_express.default.raw({ type: "application/json" }),
    async (req, res) => {
      try {
        const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
        const signature = req.header("x-hub-signature-256") || void 0;
        if (!await verifyMetaSignatureAsync(raw, signature)) {
          res.status(401).json({ success: false, error: "Invalid signature" });
          return;
        }
        const payload = JSON.parse(raw.toString("utf8"));
        const result = await ingestWhatsAppWebhookPayload(payload, generateGrowthAI2);
        res.status(200).json({ success: true, ...result });
      } catch (err) {
        console.error("WhatsApp webhook error:", err);
        res.status(500).json({ success: false, error: err.message || "Webhook processing failed" });
      }
    }
  );
}

// server/authMiddleware.ts
function canManageCalendar(auth) {
  if (auth.role && ["admin", "super_admin", "manager"].includes(auth.role)) return true;
  return Boolean(auth.privileges?.can_manage_calendar);
}
async function requireSupabaseUser(req, res, next) {
  try {
    const header = req.header("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ success: false, error: "Missing Authorization bearer token" });
      return;
    }
    const anon = getSupabaseAnonForJwt(token);
    const { data: userData, error } = await anon.auth.getUser();
    if (error || !userData.user) {
      res.status(401).json({ success: false, error: "Invalid session" });
      return;
    }
    const { data: profile } = await anon.from("profiles").select("id, email, org_id, role, privileges").eq("id", userData.user.id).maybeSingle();
    req.auth = {
      userId: userData.user.id,
      email: userData.user.email,
      orgId: profile?.org_id || null,
      role: profile?.role,
      privileges: profile?.privileges || null
    };
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: err.message || "Auth failed" });
  }
}
function authOf(req) {
  return req.auth;
}

// server/meta/cloudApi.ts
var GRAPH_BASE = "https://graph.facebook.com/v21.0";
async function verifyWhatsAppNumber(phoneNumberId, accessToken) {
  const res = await fetch(
    `${GRAPH_BASE}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,id`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const raw = await res.json();
  if (!res.ok) {
    console.error("[whatsapp] Meta rejected phone/token", raw?.error || raw);
    throw new Error(
      raw?.error?.message || "WhatsApp token or Phone Number ID was rejected by Meta. Use a Cloud API permanent token for that number."
    );
  }
  console.info("[whatsapp] Meta accepted phone number", { id: raw.id, display: raw.display_phone_number });
  return {
    id: String(raw.id || phoneNumberId),
    displayPhoneNumber: String(raw.display_phone_number || ""),
    verifiedName: String(raw.verified_name || "")
  };
}
async function sendWhatsAppText(params) {
  const to = params.to.replace(/\D/g, "");
  const res = await fetch(`${GRAPH_BASE}/${params.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: params.text }
    })
  });
  const raw = await res.json();
  if (!res.ok) {
    const msg = raw?.error?.message || `WhatsApp send failed with status ${res.status}`;
    throw new Error(msg);
  }
  const messageId = raw?.messages?.[0]?.id;
  if (!messageId) throw new Error("WhatsApp API returned no message id.");
  return { messageId, raw };
}

// server/appUrl.ts
var PRODUCTION_APP_URL = "https://growth-ai-alpha-puce.vercel.app";
function getAppUrl() {
  if (process.env.APP_URL?.trim()) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  if (process.env.VERCEL) {
    return PRODUCTION_APP_URL;
  }
  if (process.env.VERCEL_URL?.trim()) {
    const host = process.env.VERCEL_URL.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return "http://localhost:3000";
}
function allowedOAuthOrigins() {
  return new Set(
    [PRODUCTION_APP_URL, getAppUrl()].map((origin) => origin.replace(/\/$/, ""))
  );
}

// server/meta/staffRoutes.ts
function registerWhatsAppStaffRoutes(app2, generateGrowthAI2) {
  app2.get("/api/whatsapp/accounts", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.json({ success: true, accounts: [] });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const { data, error } = await admin2.from("whatsapp_accounts").select("id, org_id, client_id, phone_number_id, waba_id, display_phone_number, verified_name, status, webhook_subscribed, created_at").eq("org_id", auth.orgId).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      res.json({
        success: true,
        accounts: data || [],
        webhookUrl: `${getAppUrl()}/api/meta/webhook`
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/whatsapp/accounts", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Your profile has no organization. Complete onboarding first." });
        return;
      }
      if (auth.role && !["admin", "super_admin", "manager"].includes(auth.role)) {
        res.status(403).json({ success: false, error: "Only admins/managers can connect WhatsApp accounts." });
        return;
      }
      const {
        clientId,
        phoneNumberId,
        accessToken,
        wabaId,
        displayPhoneNumber,
        verifiedName
      } = req.body || {};
      if (!clientId || !phoneNumberId || !accessToken) {
        res.status(400).json({ success: false, error: "clientId, phoneNumberId, and accessToken are required." });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const { data: client } = await admin2.from("clients").select("id, org_id").eq("id", clientId).maybeSingle();
      if (!client || client.org_id !== auth.orgId) {
        res.status(403).json({ success: false, error: "Client not found in your organization." });
        return;
      }
      let verified;
      try {
        verified = await verifyWhatsAppNumber(String(phoneNumberId).trim(), String(accessToken).trim());
      } catch (err) {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      const { data: account, error } = await admin2.from("whatsapp_accounts").upsert(
        {
          org_id: auth.orgId,
          client_id: clientId,
          phone_number_id: verified.id,
          waba_id: wabaId || null,
          display_phone_number: displayPhoneNumber || verified.displayPhoneNumber,
          verified_name: verifiedName || verified.verifiedName || null,
          status: "connected",
          webhook_subscribed: true,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        { onConflict: "phone_number_id" }
      ).select("id, org_id, client_id, phone_number_id, waba_id, display_phone_number, verified_name, status, webhook_subscribed, created_at").single();
      if (error) throw new Error(error.message);
      const { error: secretErr } = await admin2.from("whatsapp_account_secrets").upsert({
        account_id: account.id,
        access_token: String(accessToken).trim(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (secretErr) throw new Error(secretErr.message);
      res.json({
        success: true,
        account,
        webhookUrl: `${getAppUrl()}/api/meta/webhook`
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/whatsapp/send", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "No organization on profile." });
        return;
      }
      const { conversationId, text } = req.body || {};
      if (!conversationId || !text?.trim()) {
        res.status(400).json({ success: false, error: "conversationId and text are required." });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const { data: conversation, error: convErr } = await admin2.from("conversations").select("*, contacts:contact_id(id, phone, name), whatsapp_accounts:whatsapp_account_id(id, phone_number_id)").eq("id", conversationId).eq("org_id", auth.orgId).maybeSingle();
      if (convErr) throw new Error(convErr.message);
      if (!conversation) {
        res.status(404).json({ success: false, error: "Conversation not found." });
        return;
      }
      const phone = normalizePhone(conversation.contacts?.phone || "");
      const accountId = conversation.whatsapp_account_id;
      const phoneNumberId = conversation.whatsapp_accounts?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!phone || !phoneNumberId || !accountId) {
        res.status(400).json({ success: false, error: "Conversation is missing WhatsApp account or contact phone." });
        return;
      }
      const token = await resolveAccessToken(accountId) || process.env.WHATSAPP_ACCESS_TOKEN;
      if (!token) {
        res.status(400).json({ success: false, error: "No WhatsApp access token configured for this account." });
        return;
      }
      const { data: pendingMsg, error: pendingErr } = await admin2.from("messages").insert({
        org_id: auth.orgId,
        conversation_id: conversationId,
        direction: "outgoing",
        type: "text",
        text: text.trim(),
        status: "pending",
        sender_type: "agent",
        sender_user_id: auth.userId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }).select("*").single();
      if (pendingErr) throw new Error(pendingErr.message);
      try {
        const sent = await sendWhatsAppText({
          phoneNumberId,
          accessToken: token,
          to: phone,
          text: text.trim()
        });
        await admin2.from("messages").update({
          status: "sent",
          whatsapp_message_id: sent.messageId
        }).eq("id", pendingMsg.id);
        await admin2.from("conversations").update({
          last_message: text.trim(),
          last_message_at: (/* @__PURE__ */ new Date()).toISOString(),
          unread_count: 0,
          updated_at: (/* @__PURE__ */ new Date()).toISOString(),
          lead_status: conversation.lead_status === "new" ? "contacted" : conversation.lead_status
        }).eq("id", conversationId);
        res.json({ success: true, messageId: pendingMsg.id, whatsappMessageId: sent.messageId });
      } catch (sendErr) {
        await admin2.from("messages").update({ status: "failed", error_message: sendErr.message }).eq("id", pendingMsg.id);
        throw sendErr;
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.patch("/api/whatsapp/conversations/:id", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "No organization on profile." });
        return;
      }
      const id = req.params.id;
      const patch = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      const allowed = [
        "lead_status",
        "assigned_to",
        "notes",
        "priority",
        "status",
        "lead_value",
        "expected_revenue",
        "actual_revenue",
        "lost_reason",
        "campaign_id",
        "unread_count",
        "tags"
      ];
      for (const key of allowed) {
        if (req.body?.[key] !== void 0) patch[key] = req.body[key];
      }
      const admin2 = getSupabaseAdmin();
      const { data, error } = await admin2.from("conversations").update(patch).eq("id", id).eq("org_id", auth.orgId).select("*").single();
      if (error) throw new Error(error.message);
      res.json({ success: true, conversation: data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/whatsapp/ai/suggest-reply", requireSupabaseUser, async (req, res) => {
    try {
      const { customerMessage, history, clientName } = req.body || {};
      if (!customerMessage) {
        res.status(400).json({ success: false, error: "customerMessage is required." });
        return;
      }
      const suggestion = generateGrowthAI2 ? await suggestReplyWithGemini({ customerMessage, history, clientName }, generateGrowthAI2) : `Thanks for reaching out. ${heuristicLeadAnalysis(customerMessage).recommendedAction === "assign_sales_manager" ? "I'll have a specialist confirm pricing and availability for you." : "I'll get the details and reply shortly."}`;
      res.json({ success: true, suggestion });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

// shared/calendarPublish.ts
var META_IG_PUBLISH_SCOPE = "instagram_content_publish";
var META_PAGE_PUBLISH_SCOPE = "pages_manage_posts";
var META_INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_posts",
  "ads_read",
  "business_management"
].join(",");
var META_FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_content_publish",
  "ads_read",
  "business_management"
].join(",");
function grantedScopesFromPermissions(payload) {
  return (payload?.data || []).filter((row) => String(row.status || "").toLowerCase() === "granted" && row.permission).map((row) => String(row.permission)).join(",");
}
function parseScopeList(scopes) {
  return String(scopes || "").toLowerCase().split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}
function hasMetaPublishScopes(platform, scopes) {
  const list = parseScopeList(scopes);
  if (platform === "instagram") return list.includes(META_IG_PUBLISH_SCOPE);
  if (platform === "facebook") return list.includes(META_PAGE_PUBLISH_SCOPE);
  return false;
}
function publishReadyNote(platform, scopes, connected = true) {
  if (platform !== "instagram" && platform !== "facebook") {
    return "Calendar publishing is live for Instagram and Facebook Pages. This network stays insights-only for now.";
  }
  if (!connected) return `Connect the ${platform === "instagram" ? "Instagram professional" : "Facebook Page"} account for this brand first.`;
  if (!hasMetaPublishScopes(platform, scopes)) {
    return "This login is insights-only. Reconnect Meta and accept publishing so GrowthOS can post to the professional account.";
  }
  return "";
}
function composeCaption(item) {
  const caption = String(item.captionText || "").trim();
  const hook = String(item.hookText || "").trim();
  const topic = String(item.topic || "").trim();
  const cta = String(item.cta || "").trim();
  const parts = [];
  if (caption) parts.push(caption);
  else if (hook) parts.push(hook);
  else if (topic) parts.push(topic);
  if (cta && !parts.join("\n").toLowerCase().includes(cta.toLowerCase())) {
    parts.push(cta);
  }
  return parts.join("\n\n").slice(0, 2200);
}
function isPublicMediaUrl(url) {
  const value = String(url || "").trim();
  if (!value) return { ok: false, reason: "Add a public image or video first. Meta has to fetch it over https." };
  if (value.startsWith("data:")) {
    return {
      ok: false,
      reason: "Instagram and Facebook cannot fetch a local or base64 file. Upload it so it has a public https URL."
    };
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      return { ok: false, reason: "Media must be an https URL that Meta can fetch." };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "Media URL is invalid." };
  }
}
function inferMediaKind(url, declared) {
  if (declared === "video" || declared === "image") return declared;
  const value = String(url || "").toLowerCase();
  if (/\.(mp4|mov|m4v|webm)(\?|#|$)/.test(value)) return "video";
  if (/\.(jpe?g|png|gif|webp|bmp)(\?|#|$)/.test(value)) return "image";
  return "unknown";
}
function resolvePublishKind(input) {
  const platform = String(input.platform || "").toLowerCase();
  const contentType = String(input.contentType || "");
  const mediaKind = inferMediaKind(input.mediaUrl, input.mediaType);
  if (platform === "tiktok" || platform === "linkedin" || platform === "youtube") {
    return {
      error: `${contentType || platform} stays on the calendar only. Live publishing is Instagram and Facebook Pages right now.`
    };
  }
  if (platform !== "instagram" && platform !== "facebook") {
    return { error: `GrowthOS does not publish to ${platform} yet.` };
  }
  if (platform === "instagram") {
    if (contentType === "Story") {
      const media2 = isPublicMediaUrl(input.mediaUrl);
      if (!media2.ok) return { error: media2.reason };
      return { kind: "ig_story" };
    }
    if (contentType === "Reel" || contentType === "Shorts") {
      if (mediaKind !== "video") {
        return { error: "Reels need a public MP4 or MOV. Upload a video, or change the format to a photo post." };
      }
      const media2 = isPublicMediaUrl(input.mediaUrl);
      if (!media2.ok) return { error: media2.reason };
      return { kind: "ig_reel" };
    }
    const media = isPublicMediaUrl(input.mediaUrl);
    if (!media.ok) return { error: media.reason };
    if (mediaKind === "video") return { kind: "ig_reel" };
    return {
      kind: "ig_image",
      note: contentType === "Carousel" ? "Published as a single Instagram image. Multi-image carousels need more than one public file." : void 0
    };
  }
  if (mediaKind === "video") {
    const media = isPublicMediaUrl(input.mediaUrl);
    if (!media.ok) return { error: media.reason };
    return { kind: "fb_video" };
  }
  if (input.mediaUrl) {
    const media = isPublicMediaUrl(input.mediaUrl);
    if (!media.ok) return { error: media.reason };
    return { kind: "fb_photo" };
  }
  const caption = composeCaption(input);
  if (!caption) return { error: "Facebook needs a caption or a public image." };
  return { kind: "fb_text" };
}
function isTerminalPublishError(message) {
  const text = String(message || "");
  return /reconnect|insights-only|not connected|missing.*media|cannot fetch|base64|does not publish|stays on the calendar|CREATE_CONTENT|Page Publishing Authorization|two-factor|two factor|App Review|#10\b|#200\b|invalid.*url|Reels need a public/i.test(
    text
  );
}
function humanizeMetaPublishError(message, code, subcode) {
  const raw = message || "Meta rejected the publish request.";
  if (code === 190) return `TERMINAL: Meta login expired. Reconnect the brand account. (${raw})`;
  if (code === 10 || code === 200) {
    return `TERMINAL: This login cannot publish. Reconnect Meta, accept publishing, and make sure the Page role is MANAGE or CREATE_CONTENT. (${raw})`;
  }
  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return `Meta rate-limited this app. Wait and try again. (${raw})`;
  }
  if (code === 80004 || /content publishing limit/i.test(raw)) {
    return `Instagram\u2019s daily publishing limit was reached for this professional account. (${raw})`;
  }
  if (code === 9007 || /media download/i.test(raw)) {
    return `Instagram could not fetch the media URL. It must be publicly reachable over https. (${raw})`;
  }
  if (/two-factor|two factor|publishing authorization|PPA/i.test(raw) || subcode === 458) {
    return `TERMINAL: Facebook Page publishing is blocked by Page Publishing Authorization or 2FA. Complete that in Meta Business Suite, then retry. (${raw})`;
  }
  return raw;
}

// server/social/providers.ts
function originFromHeader(raw) {
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}
function resolveOAuthRedirectUri(requested, originHeader, referer) {
  const requestOrigin = originFromHeader(originHeader) || originFromHeader(referer);
  const requestedUri = sanitizeCallback(requested);
  const originUri = requestOrigin ? sanitizeCallback(`${requestOrigin}/auth/callback`) : "";
  const appUri = `${getAppUrl()}/auth/callback`;
  let chosen = originUri || appUri;
  if (requestedUri) {
    const requestedOrigin = originFromHeader(requestedUri);
    if (requestOrigin && requestedOrigin === requestOrigin) chosen = requestedUri;
    else if (requestedOrigin && allowedOAuthOrigins().has(requestedOrigin)) chosen = requestedUri;
  }
  console.info("[oauth] resolve redirect", {
    requested: requestedUri || null,
    originHeader: originHeader || null,
    referer: referer || null,
    chosen
  });
  return chosen;
}
function sanitizeCallback(raw) {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const path = url.pathname.replace(/\/$/, "");
    if (path === "" || path === "/") return `${url.origin}/auth/callback`;
    if (path.endsWith("/auth/callback")) return `${url.origin}/auth/callback`;
    return "";
  } catch {
    return "";
  }
}
function familyOf(platform) {
  if (platform === "tiktok") return "tiktok";
  if (platform === "linkedin") return "linkedin";
  if (platform === "youtube" || platform === "google_analytics" || platform === "google_ads") return "google";
  return "meta";
}
function providerConfig(platform, overrides, redirectUri = resolveOAuthRedirectUri()) {
  const meta = overrides?.meta;
  const google = overrides?.google;
  const tiktok = overrides?.tiktok;
  const linkedin = overrides?.linkedin;
  const metaId = meta?.clientId || process.env.META_CLIENT_ID || process.env.META_APP_ID || "";
  const metaSecret = meta?.secret || process.env.META_APP_SECRET || "";
  const googleId = google?.clientId || process.env.GOOGLE_CLIENT_ID || "";
  const googleSecret = google?.secret || process.env.GOOGLE_CLIENT_SECRET || "";
  const linkedInId = linkedin?.clientId || process.env.LINKEDIN_CLIENT_ID || "";
  const linkedInSecret = linkedin?.secret || process.env.LINKEDIN_CLIENT_SECRET || "";
  const tiktokKey = tiktok?.clientId || process.env.TIKTOK_CLIENT_KEY || "";
  const tiktokSecret = tiktok?.secret || process.env.TIKTOK_CLIENT_SECRET || "";
  const map = {
    instagram: {
      authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
      clientId: metaId,
      secret: metaSecret,
      scopes: META_INSTAGRAM_SCOPES,
      configured: Boolean(metaId && metaSecret)
    },
    facebook: {
      authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
      clientId: metaId,
      secret: metaSecret,
      scopes: META_FACEBOOK_SCOPES,
      configured: Boolean(metaId && metaSecret)
    },
    meta_ads: {
      authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
      clientId: metaId,
      secret: metaSecret,
      scopes: "ads_read,ads_management,business_management,pages_show_list",
      configured: Boolean(metaId && metaSecret)
    },
    youtube: {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      clientId: googleId,
      secret: googleSecret,
      scopes: "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
      configured: Boolean(googleId && googleSecret)
    },
    google_analytics: {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      clientId: googleId,
      secret: googleSecret,
      scopes: "https://www.googleapis.com/auth/analytics.readonly",
      configured: Boolean(googleId && googleSecret)
    },
    google_ads: {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      clientId: googleId,
      secret: googleSecret,
      scopes: "https://www.googleapis.com/auth/adwords",
      configured: Boolean(googleId && googleSecret)
    },
    linkedin: {
      authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
      clientId: linkedInId,
      secret: linkedInSecret,
      scopes: "openid profile email r_organization_social rw_organization_admin",
      configured: Boolean(linkedInId && linkedInSecret)
    },
    tiktok: {
      authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
      clientId: tiktokKey,
      secret: tiktokSecret,
      scopes: "user.info.basic,user.info.stats,video.list",
      configured: Boolean(tiktokKey && tiktokSecret)
    }
  };
  const config = map[platform];
  if (!config) throw new Error(`Unsupported platform: ${platform}`);
  return { ...config, redirectUri };
}
function buildAuthorizeUrl(platform, state, overrides, redirectUri) {
  const config = providerConfig(platform, overrides, redirectUri);
  if (!config.configured) {
    const family = familyOf(platform);
    throw new Error(
      `${platform} is not connected yet. Add your ${family} app credentials in Agency Hub or Settings \u2192 Integrations, then sign in.`
    );
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes,
    state
  });
  if (platform === "youtube" || platform === "google_analytics" || platform === "google_ads") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
    params.set("include_granted_scopes", "true");
  }
  if (platform === "tiktok") {
    params.set("client_key", config.clientId);
  }
  if (platform === "instagram" || platform === "facebook" || platform === "meta_ads") {
    params.set("auth_type", "rerequest");
  }
  return `${config.authorizeUrl}?${params.toString()}`;
}
async function fetchGrantedMetaScopes(token) {
  const payload = await jsonFetch(
    `https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(token)}`
  );
  const granted = grantedScopesFromPermissions(payload);
  console.info("[oauth] granted meta scopes", {
    count: granted ? granted.split(",").length : 0,
    instagramPublish: hasMetaPublishScopes("instagram", granted),
    facebookPublish: hasMetaPublishScopes("facebook", granted)
  });
  return granted;
}
async function jsonFetch(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.error_description || data?.message || `HTTP ${res.status}`);
  }
  return data;
}
async function exchangeCodeForToken(platform, code, overrides, redirectUri) {
  const config = providerConfig(platform, overrides, redirectUri);
  if (platform === "instagram" || platform === "facebook" || platform === "meta_ads") {
    const short = await jsonFetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.secret,
        redirect_uri: config.redirectUri,
        code
      })}`
    );
    const longLived = await jsonFetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: config.clientId,
        client_secret: config.secret,
        fb_exchange_token: short.access_token
      })}`
    ).catch(() => short);
    const accessToken = longLived.access_token;
    const granted = await fetchGrantedMetaScopes(accessToken).catch((err) => {
      console.warn("[oauth] could not read granted Meta permissions", err.message);
      return "";
    });
    return {
      accessToken,
      refreshToken: void 0,
      expiresAt: longLived.expires_in ? new Date(Date.now() + Number(longLived.expires_in) * 1e3).toISOString() : null,
      scopes: granted
    };
  }
  if (platform === "youtube" || platform === "google_analytics" || platform === "google_ads") {
    const token = await jsonFetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.secret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code"
      })
    });
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1e3).toISOString() : null,
      scopes: config.scopes
    };
  }
  if (platform === "linkedin") {
    const token = await jsonFetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.secret
      })
    });
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1e3).toISOString() : null,
      scopes: config.scopes
    };
  }
  if (platform === "tiktok") {
    const token = await jsonFetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: config.clientId,
        client_secret: config.secret,
        code,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri
      })
    });
    const payload = token.data || token;
    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: payload.expires_in ? new Date(Date.now() + Number(payload.expires_in) * 1e3).toISOString() : null,
      scopes: config.scopes
    };
  }
  throw new Error(`Unsupported platform: ${platform}`);
}
function scoreFromRates(engagementRate, growth) {
  return Math.max(0, Math.min(100, Math.round(engagementRate * 800 + growth * 2 + 40)));
}
async function fetchLiveStats(platform, accessToken, extras) {
  if (platform === "instagram" || platform === "facebook" || platform === "meta_ads") {
    return fetchMetaStats(platform, accessToken, extras);
  }
  if (platform === "youtube") return fetchYouTubeStats(accessToken);
  if (platform === "google_analytics") return fetchGaStats(accessToken);
  if (platform === "google_ads") return fetchGoogleAdsStats(accessToken, extras);
  if (platform === "linkedin") return fetchLinkedInStats(accessToken);
  if (platform === "tiktok") return fetchTikTokStats(accessToken);
  throw new Error(`Unsupported platform: ${platform}`);
}
async function graphPaged(url) {
  const rows = [];
  let next = url;
  let hops = 0;
  while (next && hops < 8) {
    const payload = await jsonFetch(next);
    rows.push(...payload.data || []);
    next = payload.paging?.next;
    hops += 1;
  }
  return rows;
}
async function listMetaBrandAssets(token) {
  const seen = /* @__PURE__ */ new Map();
  const addPage = (page) => {
    if (page?.id && !seen.has(page.id)) seen.set(page.id, page);
  };
  const mine = await graphPaged(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,followers_count}&limit=100&access_token=${encodeURIComponent(token)}`
  ).catch((err) => {
    console.error("[meta] me/accounts failed", err.message);
    return [];
  });
  mine.forEach(addPage);
  const businesses = await graphPaged(
    `https://graph.facebook.com/v21.0/me/businesses?fields=id,name&limit=50&access_token=${encodeURIComponent(token)}`
  ).catch((err) => {
    console.error("[meta] me/businesses failed", err.message);
    return [];
  });
  for (const biz of businesses) {
    for (const edge of ["owned_pages", "client_pages"]) {
      const extra = await graphPaged(
        `https://graph.facebook.com/v21.0/${biz.id}/${edge}?fields=id,name,access_token,instagram_business_account{id,username,followers_count}&limit=100&access_token=${encodeURIComponent(token)}`
      ).catch((err) => {
        console.error(`[meta] ${edge} failed for ${biz.id}`, err.message);
        return [];
      });
      extra.forEach(addPage);
    }
  }
  const pages = [...seen.values()];
  const assets = [];
  for (const page of pages) {
    assets.push({ kind: "facebook", id: page.id, name: page.name, pageId: page.id, pageName: page.name });
    const ig = page.instagram_business_account;
    if (ig?.id) {
      assets.push({
        kind: "instagram",
        id: ig.id,
        name: ig.username ? `@${ig.username}` : page.name,
        pageId: page.id,
        pageName: page.name,
        followers: Number(ig.followers_count || 0)
      });
    }
  }
  const adActs = await graphPaged(
    `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&limit=50&access_token=${encodeURIComponent(token)}`
  ).catch(() => []);
  for (const act of adActs) {
    assets.push({ kind: "ad_account", id: act.id, name: act.name || act.id });
  }
  console.info("[meta] listed brand assets", {
    pages: pages.length,
    instagram: assets.filter((a) => a.kind === "instagram").length,
    adAccounts: adActs.length
  });
  return { pages, assets };
}
function pickMetaAsset(assets, platform, extras) {
  const kind = platform === "meta_ads" ? "ad_account" : platform === "instagram" ? "instagram" : "facebook";
  const pool = assets.filter((a) => a.kind === kind);
  if (extras?.externalId) {
    return pool.find((a) => a.id === extras.externalId) || assets.find((a) => a.id === extras.externalId) || null;
  }
  const needle = (extras?.clientName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (needle) {
    const named = pool.find((a) => {
      const hay = `${a.name} ${a.pageName || ""}`.toLowerCase().replace(/[^a-z0-9]/g, "");
      return hay.includes(needle) || needle.includes(hay.replace("@", ""));
    });
    if (named) return named;
  }
  return pool.length === 1 ? pool[0] : null;
}
async function fetchMetaStats(platform, token, extras) {
  const { pages, assets } = await listMetaBrandAssets(token);
  const chosen = pickMetaAsset(assets, platform, extras);
  if (!chosen) {
    const available = assets.filter(
      (a) => platform === "instagram" ? a.kind === "instagram" : platform === "meta_ads" ? a.kind === "ad_account" : a.kind === "facebook"
    );
    const err = new Error(
      available.length ? `This login can manage ${available.length} brand accounts. Select the ${platform.replace("_", " ")} account for this client.` : platform === "instagram" ? "This Meta login has no Instagram professional account. In Meta Business Suite, link the brand IG account to its Facebook Page, then sign in again." : platform === "meta_ads" ? "This Meta login has no ad accounts. Add the brand ad account in Business Manager, then sign in again." : "This Meta login has no Facebook Pages. Add the brand Page in Business Manager (owned or client Page), then sign in again."
    );
    err.code = "NEEDS_SELECTION";
    err.assets = available.map(({ id, name, kind, pageName, followers }) => ({ id, name, kind, pageName, followers }));
    throw err;
  }
  const page = pages.find((p) => p.id === chosen.pageId || p.id === chosen.id);
  const pageToken = page?.access_token || token;
  console.info("[meta] selected brand asset", { platform, id: chosen.id, name: chosen.name, pageId: chosen.pageId });
  if (platform === "instagram" || chosen.kind === "instagram") {
    const igId = chosen.kind === "instagram" ? chosen.id : page?.instagram_business_account?.id;
    if (!igId) {
      throw new Error("The selected Page has no linked Instagram professional account.");
    }
    return fetchInstagramProfessional(igId, pageToken, page?.name);
  }
  const pageId = chosen.pageId || chosen.id;
  const pageInfo = await jsonFetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=name,fan_count&access_token=${encodeURIComponent(pageToken)}`
  );
  let ads = { spend: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0, adAccountId: extras?.adAccountId || "" };
  if (platform === "meta_ads" || platform === "facebook") {
    const act = extras?.adAccountId ? { id: extras.adAccountId } : assets.find((a) => a.kind === "ad_account");
    if (act?.id) {
      const insights = await jsonFetch(
        `https://graph.facebook.com/v21.0/${act.id}/insights?fields=spend,impressions,clicks,actions,action_values&date_preset=last_30d&access_token=${encodeURIComponent(token)}`
      ).catch(() => ({ data: [] }));
      const row = insights.data?.[0] || {};
      ads = {
        spend: Number(row.spend || 0),
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        conversions: Number(
          (row.actions || []).find((a) => /purchase|lead|offsite_conversion/i.test(a.action_type))?.value || 0
        ),
        revenue: Number((row.action_values || []).find((a) => /purchase/i.test(a.action_type))?.value || 0),
        adAccountId: act.id
      };
    }
  }
  const linkedIg = page?.instagram_business_account;
  const igDemo = linkedIg?.id ? await fetchInstagramDemographics(linkedIg.id, pageToken, Number(linkedIg.followers_count || 0)) : null;
  const adsDemo = ads.adAccountId ? await fetchAdsDemographics(ads.adAccountId, token) : { adsAgeGender: {} };
  const hasAudience = Boolean(
    Object.keys(igDemo?.ageGender || {}).length || Object.keys(adsDemo.adsAgeGender || {}).length
  );
  console.info("[meta] facebook audience sources", {
    pageId,
    igId: linkedIg?.id || null,
    igSegments: Object.keys(igDemo?.ageGender || {}).length,
    adsSegments: Object.keys(adsDemo.adsAgeGender || {}).length
  });
  const demographics = {
    ...igDemo || {},
    ...adsDemo,
    source: igDemo?.ageGender && Object.keys(igDemo.ageGender).length ? "instagram_insights" : adsDemo.adsAgeGender && Object.keys(adsDemo.adsAgeGender).length ? "meta_ads_insights" : "facebook_page",
    note: hasAudience ? void 0 : "Meta removed Page fan age/gender Insights. Audience comes from the linked Instagram professional account or Ads Insights. Connect Instagram or a Meta ad account for this brand."
  };
  return {
    accountName: pageInfo.name || chosen.name,
    externalId: pageId,
    adAccountId: ads.adAccountId || void 0,
    followers: Number(pageInfo.fan_count || 0),
    growthRate: 0,
    healthScore: ads.impressions ? 78 : 70,
    impressions24h: ads.impressions ? Math.round(ads.impressions / 30) : 0,
    reach24h: ads.impressions ? Math.round(ads.impressions / 30) : 0,
    engagement24h: ads.clicks ? Math.round(ads.clicks / 30) : 0,
    clicks24h: ads.clicks ? Math.round(ads.clicks / 30) : 0,
    spend30d: ads.spend,
    conversions30d: ads.conversions,
    revenue30d: ads.revenue,
    demographics
  };
}
async function fetchInstagramProfessional(igId, pageToken, pageName) {
  const ig = await jsonFetch(
    `https://graph.facebook.com/v21.0/${igId}?fields=username,followers_count,media_count&access_token=${encodeURIComponent(pageToken)}`
  );
  let insights = await jsonFetch(
    `https://graph.facebook.com/v21.0/${igId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${encodeURIComponent(pageToken)}`
  ).catch(() => ({ data: [] }));
  if (!insights.data?.length) {
    insights = await jsonFetch(
      `https://graph.facebook.com/v21.0/${igId}/insights?metric=views,reach,profile_views&period=day&access_token=${encodeURIComponent(pageToken)}`
    ).catch(() => ({ data: [] }));
  }
  const media = await jsonFetch(
    `https://graph.facebook.com/v21.0/${igId}/media?fields=id,caption,timestamp,like_count,comments_count,insights.metric(impressions,reach,saved,shares)&limit=8&access_token=${encodeURIComponent(pageToken)}`
  ).catch(() => ({ data: [] }));
  const metric = (name) => Number(insights.data?.find((m) => m.name === name)?.values?.slice(-1)?.[0]?.value || 0);
  const impressions = metric("impressions") || metric("views");
  const posts = (media.data || []).map((m) => ({
    id: m.id,
    title: (m.caption || "Instagram post").slice(0, 80),
    platform: "instagram",
    postDate: (m.timestamp || "").slice(0, 10),
    likes: m.like_count || 0,
    comments: m.comments_count || 0,
    impressions: Number(m.insights?.data?.find((i) => i.name === "impressions")?.values?.[0]?.value || 0),
    reach: Number(m.insights?.data?.find((i) => i.name === "reach")?.values?.[0]?.value || 0),
    saves: Number(m.insights?.data?.find((i) => i.name === "saved")?.values?.[0]?.value || 0),
    shares: Number(m.insights?.data?.find((i) => i.name === "shares")?.values?.[0]?.value || 0)
  }));
  const engagement = posts.reduce((s, p) => s + p.likes + p.comments + p.saves, 0);
  const followers = Number(ig.followers_count || 0);
  return {
    accountName: `@${ig.username || pageName || "instagram"}`,
    externalId: igId,
    followers,
    growthRate: 0,
    healthScore: scoreFromRates(followers ? engagement / Math.max(followers, 1) : 0, 0),
    impressions24h: impressions,
    reach24h: metric("reach") || impressions,
    engagement24h: engagement,
    clicks24h: 0,
    spend30d: 0,
    conversions30d: 0,
    revenue30d: 0,
    posts,
    demographics: await fetchInstagramDemographics(igId, pageToken, followers)
  };
}
function collectBreakdown(metric, into) {
  for (const row of metric.total_value?.breakdowns?.[0]?.results || []) {
    const key = (row.dimension_values || []).filter((value) => value && !/DAYS|MONTH|WEEK/i.test(value)).join(" \xB7 ") || "unknown";
    into[key] = (into[key] || 0) + Number(row.value || 0);
  }
  const values = metric.values?.[0]?.value;
  if (values && typeof values === "object" && !Array.isArray(values)) {
    for (const [key, value] of Object.entries(values)) into[key] = Number(value || 0);
  }
}
async function fetchIgBreakdown(igId, token, metric, breakdown) {
  const queries = [
    `metric=${metric}&period=lifetime&metric_type=total_value&timeframe=this_month&breakdown=${breakdown}`,
    `metric=${metric}&period=lifetime&metric_type=total_value&timeframe=this_week&breakdown=${breakdown}`
  ];
  let lastError = "";
  for (const query of queries) {
    const payload = await jsonFetch(
      `https://graph.facebook.com/v21.0/${igId}/insights?${query}&access_token=${encodeURIComponent(token)}`
    ).catch((err) => {
      lastError = err.message;
      return { data: [] };
    });
    const into = {};
    for (const row of payload.data || []) collectBreakdown(row, into);
    if (Object.keys(into).length) return { into, error: "" };
  }
  return { into: {}, error: lastError };
}
async function fetchInstagramDemographics(igId, token, followers = 0) {
  const ageGender = {};
  const countries = {};
  const cities = {};
  let lastError = "";
  for (const metric of ["follower_demographics", "engaged_audience_demographics", "reached_audience_demographics"]) {
    const age = await fetchIgBreakdown(igId, token, metric, "age");
    const gender = await fetchIgBreakdown(igId, token, metric, "gender");
    const country = await fetchIgBreakdown(igId, token, metric, "country");
    const city = await fetchIgBreakdown(igId, token, metric, "city");
    lastError = age.error || gender.error || country.error || lastError;
    Object.assign(ageGender, age.into, gender.into);
    Object.assign(countries, country.into);
    Object.assign(cities, city.into);
    if (Object.keys(ageGender).length) {
      console.info("[meta] ig demographics", { igId, metric, ages: Object.keys(age.into).length, genders: Object.keys(gender.into).length });
      break;
    }
  }
  return {
    source: "instagram_insights",
    ageGender,
    countries,
    cities,
    note: Object.keys(ageGender).length ? void 0 : lastError || (followers > 0 && followers < 100 ? "Meta withholds follower age/gender until the professional account has at least 100 followers." : "Meta returned no age/gender for this professional account. Confirm instagram_manage_insights is granted and Insights is available in Meta Business Suite.")
  };
}
async function fetchAdsDemographics(adAccountId, token) {
  const insights = await jsonFetch(
    `https://graph.facebook.com/v21.0/${adAccountId}/insights?fields=impressions&breakdowns=age,gender&date_preset=last_30d&access_token=${encodeURIComponent(token)}`
  ).catch(() => ({ data: [] }));
  const ageGender = {};
  for (const row of insights.data || []) {
    const key = [row.gender, row.age].filter(Boolean).join(".");
    if (key) ageGender[key] = Number(row.impressions || 0);
  }
  return { adsAgeGender: ageGender };
}
async function fetchYouTubeStats(token) {
  const channels = await jsonFetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const ch = channels.items?.[0];
  if (!ch) throw new Error("No YouTube channel on this Google account.");
  const subs = Number(ch.statistics?.subscriberCount || 0);
  const views = Number(ch.statistics?.viewCount || 0);
  return {
    accountName: ch.snippet?.title || "YouTube",
    externalId: ch.id,
    followers: subs,
    growthRate: 0,
    healthScore: subs > 0 ? 74 : 50,
    impressions24h: Math.round(views / 365),
    reach24h: Math.round(views / 365),
    engagement24h: 0,
    clicks24h: 0,
    spend30d: 0,
    conversions30d: 0,
    revenue30d: 0
  };
}
async function fetchGaStats(token) {
  const accounts = await jsonFetch(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const property = accounts.accountSummaries?.[0]?.propertySummaries?.[0]?.property;
  if (!property) throw new Error("No GA4 property found on this Google account.");
  const report = await jsonFetch(`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "screenPageViews" },
        { name: "conversions" },
        { name: "totalRevenue" }
      ]
    })
  });
  const values = report.rows?.[0]?.metricValues || [];
  const sessions = Number(values[0]?.value || 0);
  const users = Number(values[1]?.value || 0);
  const views = Number(values[2]?.value || 0);
  const conversions = Number(values[3]?.value || 0);
  const revenue = Number(values[4]?.value || 0);
  return {
    accountName: property,
    externalId: property,
    followers: users,
    growthRate: 0,
    healthScore: sessions ? 80 : 50,
    impressions24h: Math.round(views / 28),
    reach24h: Math.round(users / 28),
    engagement24h: Math.round(sessions / 28),
    clicks24h: Math.round(sessions / 28),
    spend30d: 0,
    conversions30d: conversions,
    revenue30d: revenue
  };
}
async function resolveGoogleAdsCustomerId(token, devToken, preferred) {
  const chosen = (preferred || "").replace(/-/g, "");
  if (chosen) return chosen;
  const res = await fetch("https://googleads.googleapis.com/v18/customers:listAccessibleCustomers", {
    headers: {
      Authorization: `Bearer ${token}`,
      "developer-token": devToken
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Could not list Google Ads accounts.");
  const first = (data.resourceNames || [])[0];
  if (!first) throw new Error("This Google account has no accessible Ads customers.");
  return first.replace("customers/", "");
}
async function fetchGoogleAdsStats(token, extras) {
  const devToken = extras?.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) {
    throw new Error(
      "Google requires a developer token for Ads. Paste yours in Settings \u2192 Integrations (Google), then sync again."
    );
  }
  const customerId = await resolveGoogleAdsCustomerId(token, devToken, extras?.customerId || process.env.GOOGLE_ADS_CUSTOMER_ID);
  const query = "SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM customer WHERE segments.date DURING LAST_30_DAYS";
  const res = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "developer-token": devToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Google Ads query failed");
  const rows = Array.isArray(data) ? data.flatMap((b) => b.results || []) : data.results || [];
  const totals = rows.reduce(
    (acc, row) => {
      acc.impressions += Number(row.metrics?.impressions || 0);
      acc.clicks += Number(row.metrics?.clicks || 0);
      acc.cost += Number(row.metrics?.costMicros || 0) / 1e6;
      acc.conversions += Number(row.metrics?.conversions || 0);
      acc.revenue += Number(row.metrics?.conversionsValue || 0);
      return acc;
    },
    { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 }
  );
  return {
    accountName: `Google Ads ${customerId}`,
    externalId: customerId,
    adAccountId: customerId,
    followers: 0,
    growthRate: 0,
    healthScore: totals.impressions ? 76 : 40,
    impressions24h: Math.round(totals.impressions / 30),
    reach24h: Math.round(totals.impressions / 30),
    engagement24h: Math.round(totals.clicks / 30),
    clicks24h: Math.round(totals.clicks / 30),
    spend30d: totals.cost,
    conversions30d: Math.round(totals.conversions),
    revenue30d: totals.revenue
  };
}
async function fetchLinkedInStats(token) {
  const headers = { Authorization: `Bearer ${token}`, "LinkedIn-Version": "202401", "X-Restli-Protocol-Version": "2.0.0" };
  const me = await jsonFetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const acls = await jsonFetch(
    "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~))",
    { headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => ({ elements: [] }));
  const org = acls.elements?.[0]?.["organizationalTarget~"] || acls.elements?.[0]?.organizationalTarget;
  const orgUrn = typeof org === "string" ? org : org?.id ? `urn:li:organization:${org.id}` : acls.elements?.[0]?.organizationalTarget;
  const orgId = String(orgUrn || "").replace("urn:li:organization:", "");
  const orgName = org?.localizedName || org?.vanityName || me.name || "LinkedIn";
  if (!orgId) {
    return {
      accountName: me.name || me.email || "LinkedIn member",
      externalId: me.sub,
      followers: 0,
      growthRate: 0,
      healthScore: 40,
      impressions24h: 0,
      reach24h: 0,
      engagement24h: 0,
      clicks24h: 0,
      spend30d: 0,
      conversions30d: 0,
      revenue30d: 0,
      demographics: {
        source: "linkedin_member",
        note: "LinkedIn will not give page reach on a personal login. Your LinkedIn app needs Community Management / organization products, and you must be a Page admin."
      }
    };
  }
  const followers = await jsonFetch(
    `https://api.linkedin.com/v2/networkSizes/urn:li:organization:${orgId}?edgeType=CompanyFollowedByMember`,
    { headers }
  ).catch(() => ({ firstDegreeSize: 0 }));
  const shareStats = await jsonFetch(
    `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${orgId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => ({ elements: [] }));
  const share = shareStats.elements?.[0]?.totalShareStatistics || {};
  const followerStats = await jsonFetch(
    `https://api.linkedin.com/v2/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${orgId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => ({ elements: [] }));
  const follower = followerStats.elements?.[0] || {};
  return {
    accountName: orgName,
    externalId: orgId,
    followers: Number(followers.firstDegreeSize || follower.followerCounts?.organicFollowerCount || 0),
    growthRate: 0,
    healthScore: Number(share.impressionCount || 0) ? 74 : 55,
    impressions24h: Math.round(Number(share.impressionCount || 0) / 30),
    reach24h: Math.round(Number(share.uniqueImpressionsCount || share.impressionCount || 0) / 30),
    engagement24h: Math.round(Number(share.clickCount || 0) / 30) + Math.round(Number(share.likeCount || 0) / 30),
    clicks24h: Math.round(Number(share.clickCount || 0) / 30),
    spend30d: 0,
    conversions30d: 0,
    revenue30d: 0,
    demographics: {
      source: "linkedin_organization",
      countries: Object.fromEntries(
        (follower.followerCountsByGeoCountry || []).map((row) => [
          row.geo || row.country,
          Number(row.followerCounts?.organicFollowerCount || 0)
        ])
      ),
      ageGender: Object.fromEntries(
        (follower.followerCountsByMemberAge || []).map((row) => [
          String(row.memberAge || row.age),
          Number(row.followerCounts?.organicFollowerCount || 0)
        ])
      )
    }
  };
}
async function fetchTikTokStats(token) {
  const info = await jsonFetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count,likes_count,video_count", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const user = info.data?.user || info.user || {};
  const followers = Number(user.follower_count || 0);
  return {
    accountName: user.display_name || "TikTok",
    externalId: user.open_id,
    followers,
    growthRate: 0,
    healthScore: followers ? 72 : 50,
    impressions24h: 0,
    reach24h: 0,
    engagement24h: Number(user.likes_count || 0),
    clicks24h: 0,
    spend30d: 0,
    conversions30d: 0,
    revenue30d: 0
  };
}
async function createMetaBoost(input) {
  const cents = Math.max(100, Math.round(input.dailyBudget * 100));
  return jsonFetch(`https://graph.facebook.com/v21.0/${input.adAccountId}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: input.name,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: "[]",
      daily_budget: String(cents),
      access_token: input.accessToken
    })
  });
}

// server/insightsEngine.ts
function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}
async function rebuildClientInsights(clientId, orgId) {
  const admin2 = getSupabaseAdmin();
  const { data: connections } = await admin2.from("social_connections").select("*").eq("client_id", clientId).eq("org_id", orgId).eq("status", "connected");
  const rows = connections || [];
  const followers = rows.reduce((s, r) => s + Number(r.followers || 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions_24h || 0), 0);
  const reach = rows.reduce((s, r) => s + Number(r.reach_24h || 0), 0);
  const engagement = rows.reduce((s, r) => s + Number(r.engagement_24h || 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks_24h || 0), 0);
  const spend = rows.reduce((s, r) => s + Number(r.spend_30d || 0), 0);
  const conversions = rows.reduce((s, r) => s + Number(r.conversions_30d || 0), 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue_30d || 0), 0);
  const engagementRate = reach ? engagement / reach : followers ? engagement / followers : 0;
  const growthScore = rows.length ? clamp(
    (reach ? 20 : 0) + engagementRate * 120 + (conversions ? 15 : 0) + (revenue ? 10 : 0) + rows.reduce((s, r) => s + Number(r.health_score || 0), 0) / rows.length * 0.45
  ) : 0;
  const viralityScore = clamp(engagementRate * 400 + (impressions ? 20 : 0));
  const engagementHealth = clamp(engagementRate * 350 + (rows.length ? 25 : 0));
  const conversionScore = spend ? clamp(conversions / Math.max(spend, 1) * 400 + 20) : conversions ? clamp(50 + conversions) : 0;
  const roiMultiplier = spend > 0 ? Number((revenue / spend).toFixed(2)) : 0;
  const month = (/* @__PURE__ */ new Date()).toLocaleString("en-US", { month: "short" });
  const trends = [
    {
      month,
      reach,
      engagement,
      leads: conversions,
      conversions,
      revenue
    }
  ];
  const posts = rows.flatMap(
    (r) => Array.isArray(r.posts) ? r.posts : []
  );
  const snapshotPosts = posts.length > 0 ? posts : rows.filter((r) => Number(r.reach_24h || r.impressions_24h) > 0).map((r) => ({
    id: `${r.platform}-${r.id}`,
    title: `${r.account_name} last 24h`,
    platform: r.platform,
    postType: "Reel",
    postDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    reach: Number(r.reach_24h || 0),
    impressions: Number(r.impressions_24h || 0),
    saves: 0,
    shares: 0,
    likes: Number(r.engagement_24h || 0),
    comments: 0,
    clicks: Number(r.clicks_24h || 0),
    conversions: Number(r.conversions_30d || 0),
    viralityScore: clamp(Number(r.health_score || 0)),
    status: Number(r.health_score || 0) >= 80 ? "performing" : "underperforming",
    reboostRecommended: Number(r.reach_24h || 0) > 0 && Number(r.health_score || 0) < 70,
    hookText: r.account_name,
    source: "live_sync"
  }));
  const totalReach = Math.max(reach, 1);
  const attribution = rows.map((r) => {
    const rReach = Number(r.reach_24h || r.impressions_24h || 0);
    const rEngage = Number(r.engagement_24h || 0);
    const rClicks = Number(r.clicks_24h || 0);
    const rConv = Number(r.conversions_30d || 0);
    const rRev = Number(r.revenue_30d || 0);
    const rSpend = Number(r.spend_30d || 0);
    return {
      id: r.id,
      channel: r.platform,
      contentTitle: `${r.account_name} paid + organic path`,
      totalRevenueGenerated: rRev,
      cac: rConv > 0 ? Number((rSpend / rConv).toFixed(2)) : 0,
      roas: rSpend > 0 ? Number((rRev / rSpend).toFixed(2)) : 0,
      touchpoints: [
        { stage: "Content Impression", count: rReach || Number(r.impressions_24h || 0), conversionRatePct: 100 },
        {
          stage: "Engagement/Save",
          count: rEngage,
          conversionRatePct: rReach ? Number((rEngage / rReach * 100).toFixed(1)) : 0
        },
        {
          stage: "Link Click",
          count: rClicks,
          conversionRatePct: rEngage ? Number((rClicks / rEngage * 100).toFixed(1)) : 0
        },
        { stage: "Lead Form", count: rConv, conversionRatePct: rClicks ? Number((rConv / rClicks * 100).toFixed(1)) : 0 },
        {
          stage: "Sale Completed",
          count: rConv,
          conversionRatePct: rClicks ? Number((rConv / rClicks * 100).toFixed(1)) : 0
        }
      ]
    };
  });
  const personas = personasFromDemographics(rows, clientId);
  const payload = {
    client_id: clientId,
    org_id: orgId,
    source: rows.length ? "live_sync" : "empty",
    growth_score: growthScore,
    virality_score: viralityScore,
    engagement_health: engagementHealth,
    sentiment_score: engagementHealth,
    conversion_score: conversionScore,
    roi_multiplier: roiMultiplier,
    trends,
    personas,
    attribution,
    posts: snapshotPosts,
    demographics: {
      followers,
      impressions,
      reach,
      engagement,
      clicks,
      spend,
      conversions,
      revenue,
      notes: rows.map((r) => r.demographics?.note).filter(Boolean)
    },
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  const { error } = await admin2.from("client_live_insights").upsert(payload);
  if (error) throw new Error(error.message);
  await admin2.from("clients").update({
    growth_score: growthScore,
    virality_score: viralityScore,
    engagement_health: engagementHealth,
    sentiment_score: engagementHealth,
    conversion_score: conversionScore,
    roi_multiplier: roiMultiplier,
    recent_growth_trends: trends,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", clientId).eq("org_id", orgId);
  return payload;
}
function personasFromDemographics(rows, clientId) {
  const merged = {};
  const countries = {};
  const cities = {};
  const sources = [];
  for (const row of rows) {
    const demo = row.demographics || {};
    if (demo.source) sources.push(String(demo.source));
    for (const [key, value] of Object.entries({ ...demo.ageGender || {}, ...demo.adsAgeGender || {} })) {
      merged[key] = (merged[key] || 0) + Number(value || 0);
    }
    for (const [key, value] of Object.entries(demo.countries || {})) {
      countries[key] = (countries[key] || 0) + Number(value || 0);
    }
    for (const [key, value] of Object.entries(demo.cities || {})) {
      cities[key] = (cities[key] || 0) + Number(value || 0);
    }
  }
  const resolved = Object.entries(merged).map(([key, value]) => ({ key, value })).filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  const total = resolved.reduce((s, r) => s + r.value, 0);
  if (!total) return [];
  const topCountry = Object.entries(countries).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topCity = Object.entries(cities).sort((a, b) => b[1] - a[1])[0]?.[0];
  const sourceLabel = sources[0] || "connected_platform";
  return resolved.slice(0, 3).map((row, index) => {
    const [gender, age] = row.key.includes(".") ? row.key.split(".") : row.key.split(" \xB7 ");
    const ageRange = (age || row.key).replace(/^F\.|^M\.|^U\./, "").replace(/-/g, " - ");
    const genderLabel = /^(F|female)/i.test(gender || row.key) ? "Women" : /^(M|male)/i.test(gender || row.key) ? "Men" : "Audience";
    return {
      id: `${clientId}-demo-${index}`,
      name: `${genderLabel} ${ageRange}`,
      segmentName: sourceLabel.replace(/_/g, " "),
      percentage: clamp(row.value / total * 100, 1, 99),
      ageRange,
      activeHours: "Not reported by the provider",
      interests: [topCountry, topCity, rows[0]?.platform].filter(Boolean),
      buyingTriggers: ["Reported by the connected ads/social audience breakdown"],
      preferredFormat: rows[0]?.platform === "tiktok" ? "Short-form video" : "Feed + Reels",
      sentimentScore: 0,
      purchasingPower: "Medium",
      source: "provider_demographics"
    };
  });
}
function campaignMetricsFromInsights(insights, budget) {
  const d = insights?.demographics || {};
  const impressions = Number(d.impressions || 0);
  const engagements = Number(d.engagement || 0);
  const clicks = Number(d.clicks || 0);
  const leads = Number(d.conversions || 0);
  const conversions = Number(d.conversions || 0);
  const revenue = Number(d.revenue || 0);
  const spend = Number(d.spend || 0) || budget;
  const cvr = clicks ? Number((conversions / clicks * 100).toFixed(1)) : 0;
  const cac = conversions ? Number((spend / conversions).toFixed(2)) : 0;
  const roas = spend ? Number((revenue / spend).toFixed(2)) : 0;
  const progress = impressions ? clamp(conversions / Math.max(impressions, 1) * 4e3, 0, 100) : 0;
  const funnel = [
    { stageName: "1. Impressions", count: impressions, conversionRate: 100, dropoffRate: 0, description: "Live last-sync impressions" },
    {
      stageName: "2. Engagement",
      count: engagements,
      conversionRate: impressions ? Number((engagements / impressions * 100).toFixed(1)) : 0,
      dropoffRate: impressions ? Number((100 - engagements / impressions * 100).toFixed(1)) : 0,
      description: "Likes, comments, saves from connected APIs"
    },
    {
      stageName: "3. Clicks",
      count: clicks,
      conversionRate: engagements ? Number((clicks / engagements * 100).toFixed(1)) : 0,
      dropoffRate: engagements ? Number((100 - clicks / engagements * 100).toFixed(1)) : 0,
      description: "Link and ad clicks"
    },
    {
      stageName: "4. Conversions / leads",
      count: leads,
      conversionRate: clicks ? Number((leads / clicks * 100).toFixed(1)) : 0,
      dropoffRate: clicks ? Number((100 - leads / clicks * 100).toFixed(1)) : 0,
      description: "Ads conversions or GA4 conversions"
    },
    {
      stageName: "5. Revenue",
      count: Math.round(revenue),
      conversionRate: cvr,
      dropoffRate: 0,
      description: "Reported conversion value"
    }
  ];
  return {
    currentProgress: progress,
    metrics: { impressions, engagements, clicks, leads, conversions, revenueGenerated: revenue, cvr, cac, roas },
    funnelStages: funnel
  };
}

// server/social/routes.ts
async function overridesForOrg(orgId) {
  const families = ["meta", "google", "tiktok", "linkedin"];
  const map = {};
  for (const family of families) {
    const creds = await getOrgFamilyCreds(orgId, family);
    if (creds.configured) {
      map[family] = { clientId: creds.clientId, secret: creds.secret, extra: creds.extra };
    }
  }
  return map;
}
function maskToken(token) {
  if (!token) return void 0;
  if (token.length < 10) return "\u2022\u2022\u2022\u2022";
  return `${token.slice(0, 4)}\u2026${token.slice(-4)}`;
}
async function assertClientInOrg(clientId, orgId) {
  const admin2 = getSupabaseAdmin();
  const { data, error } = await admin2.from("clients").select("id, org_id").eq("id", clientId).maybeSingle();
  if (error || !data || data.org_id !== orgId) throw new Error("Client not found in your organization.");
  return data;
}
function registerSocialRoutes(app2) {
  app2.get("/api/org/meta", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      const creds = await getOrgMetaCreds(auth.orgId);
      res.json({
        success: true,
        configured: creds.configured,
        source: creds.source,
        appId: creds.appId ? `${creds.appId.slice(0, 4)}\u2026` : "",
        verifyToken: creds.verifyToken,
        redirectUri: resolveOAuthRedirectUri(void 0, req.get("origin"), req.get("referer")),
        webhookUrl: `${getAppUrl()}/api/meta/webhook`
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/org/meta", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete workspace onboarding first." });
        return;
      }
      if (auth.role && !["admin", "super_admin", "manager"].includes(auth.role)) {
        res.status(403).json({ success: false, error: "Only admins can connect Meta." });
        return;
      }
      const { appId, appSecret, verifyToken } = req.body || {};
      if (!appId) {
        res.status(400).json({ success: false, error: "Meta App ID is required." });
        return;
      }
      const saved = await saveOrgMetaCreds(auth.orgId, { appId, appSecret, verifyToken });
      res.json({ success: true, ...saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.get("/api/org/providers", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      const families = await getAllOrgProviderStatus(auth.orgId);
      res.json({
        success: true,
        families,
        redirectUri: resolveOAuthRedirectUri(void 0, req.get("origin"), req.get("referer")),
        webhookUrl: `${getAppUrl()}/api/meta/webhook`
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/org/providers", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete workspace onboarding first." });
        return;
      }
      if (auth.role && !["admin", "super_admin", "manager"].includes(auth.role)) {
        res.status(403).json({ success: false, error: "Only admins can save provider apps." });
        return;
      }
      const family = String(req.body?.family || "");
      if (!["meta", "google", "tiktok", "linkedin"].includes(family)) {
        res.status(400).json({ success: false, error: "family must be meta, google, tiktok, or linkedin." });
        return;
      }
      const saved = await saveOrgFamilyCreds(auth.orgId, family, {
        clientId: req.body?.clientId || req.body?.appId,
        clientSecret: req.body?.clientSecret || req.body?.appSecret,
        verifyToken: req.body?.verifyToken,
        developerToken: req.body?.developerToken,
        customerId: req.body?.customerId
      });
      res.json({ success: true, ...saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.get("/api/socials/status", requireSupabaseUser, async (req, res) => {
    const auth = authOf(req);
    const overrides = await overridesForOrg(auth.orgId);
    const platforms = [
      "instagram",
      "facebook",
      "meta_ads",
      "youtube",
      "google_analytics",
      "google_ads",
      "linkedin",
      "tiktok"
    ];
    res.json({
      success: true,
      families: await getAllOrgProviderStatus(auth.orgId),
      providers: Object.fromEntries(
        platforms.map((p) => {
          try {
            return [p, { configured: providerConfig(p, overrides).configured, family: familyForPlatform(p) }];
          } catch {
            return [p, { configured: false, family: familyForPlatform(p) }];
          }
        })
      )
    });
  });
  app2.get("/api/auth/:platform/url", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      const platform = String(req.params.platform);
      const clientId = String(req.query.clientId || "");
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete onboarding first." });
        return;
      }
      if (!clientId) {
        res.status(400).json({ success: false, error: "clientId is required." });
        return;
      }
      await assertClientInOrg(clientId, auth.orgId);
      const state = `${platform}_${crypto.randomUUID()}`;
      const redirectUri = resolveOAuthRedirectUri(
        String(req.query.redirectUri || ""),
        req.get("origin"),
        req.get("referer")
      );
      const openerOrigin = String(req.get("origin") || new URL(redirectUri).origin).replace(/\/$/, "");
      const admin2 = getSupabaseAdmin();
      await admin2.from("oauth_states").insert({
        state,
        user_id: auth.userId,
        org_id: auth.orgId,
        client_id: clientId,
        platform,
        redirect_origin: openerOrigin,
        redirect_uri: redirectUri
      });
      const overrides = await overridesForOrg(auth.orgId);
      const url = buildAuthorizeUrl(platform, state, overrides, redirectUri);
      console.info("[oauth] authorize url ready", { platform, orgId: auth.orgId, clientId, redirectUri });
      res.json({ success: true, platform, url, externalUrl: url, mock: false });
    } catch (err) {
      console.warn("[oauth] authorize url failed", err?.message);
      res.status(400).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/socials/connect", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete onboarding first." });
        return;
      }
      const { clientId, platform, accessToken } = req.body || {};
      if (!clientId || !platform || !accessToken) {
        res.status(400).json({ success: false, error: "clientId, platform, and accessToken are required." });
        return;
      }
      await assertClientInOrg(String(clientId), auth.orgId);
      const extras = { ...(await getOrgFamilyCreds(auth.orgId, familyForPlatform(String(platform)))).extra };
      const { data: client } = await getSupabaseAdmin().from("clients").select("name").eq("id", clientId).maybeSingle();
      if (client?.name) extras.clientName = client.name;
      let stats;
      let lastError = null;
      try {
        stats = await fetchLiveStats(String(platform), String(accessToken).trim(), extras);
      } catch (err) {
        lastError = err.message;
        stats = emptyStats(String(platform), lastError);
      }
      const token = String(accessToken).trim();
      const scopes = ["instagram", "facebook", "meta_ads"].includes(String(platform)) ? await fetchGrantedMetaScopes(token).catch(() => "") : void 0;
      const connection = await upsertConnection({
        orgId: auth.orgId,
        clientId: String(clientId),
        platform: String(platform),
        stats,
        accessToken: token,
        scopes,
        lastError
      });
      await rebuildClientInsights(String(clientId), auth.orgId);
      res.json({ success: true, connection, oauthTokenMasked: maskToken(accessToken) });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/socials/bind", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete onboarding first." });
        return;
      }
      const { clientId, platform, externalId } = req.body || {};
      if (!clientId || !platform || !externalId) {
        res.status(400).json({ success: false, error: "clientId, platform, and externalId are required." });
        return;
      }
      await assertClientInOrg(String(clientId), auth.orgId);
      const admin2 = getSupabaseAdmin();
      const { data: connection } = await admin2.from("social_connections").select("id, ad_account_id").eq("org_id", auth.orgId).eq("client_id", clientId).eq("platform", platform).maybeSingle();
      if (!connection) {
        res.status(400).json({ success: false, error: "Sign in with Meta first, then choose the brand account." });
        return;
      }
      const { data: secret } = await admin2.from("social_connection_secrets").select("access_token").eq("connection_id", connection.id).maybeSingle();
      if (!secret?.access_token) {
        res.status(400).json({ success: false, error: "Saved Meta token is missing. Sign in again." });
        return;
      }
      const extras = {
        ...(await getOrgFamilyCreds(auth.orgId, familyForPlatform(String(platform)))).extra,
        externalId: String(externalId),
        adAccountId: connection.ad_account_id || ""
      };
      const stats = await fetchLiveStats(String(platform), secret.access_token, extras);
      const saved = await upsertConnection({
        orgId: auth.orgId,
        clientId: String(clientId),
        platform: String(platform),
        stats,
        accessToken: secret.access_token
      });
      await rebuildClientInsights(String(clientId), auth.orgId);
      res.json({ success: true, connection: saved });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });
  app2.get("/api/socials/connections", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.json({ success: true, connections: [] });
        return;
      }
      const clientId = String(req.query.clientId || "");
      const admin2 = getSupabaseAdmin();
      let q = admin2.from("social_connections").select("*").eq("org_id", auth.orgId);
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q.order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      const ids = (data || []).map((row) => row.id);
      const { data: secrets } = ids.length ? await admin2.from("social_connection_secrets").select("connection_id, scopes").in("connection_id", ids) : { data: [] };
      const scopeMap = new Map((secrets || []).map((row) => [row.connection_id, row.scopes]));
      const connections = (data || []).map((row) => {
        const scopes = scopeMap.get(row.id) || "";
        const canPublish = hasMetaPublishScopes(row.platform, scopes);
        return {
          ...row,
          can_publish: canPublish,
          publish_ready_note: publishReadyNote(row.platform, scopes, true)
        };
      });
      res.json({ success: true, connections });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/socials/sync", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete onboarding first." });
        return;
      }
      const { clientId, platform } = req.body || {};
      if (!clientId) {
        res.status(400).json({ success: false, error: "clientId is required." });
        return;
      }
      await assertClientInOrg(String(clientId), auth.orgId);
      const admin2 = getSupabaseAdmin();
      let q = admin2.from("social_connections").select("id, platform, external_id, ad_account_id").eq("org_id", auth.orgId).eq("client_id", clientId);
      if (platform) q = q.eq("platform", platform);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      if (!rows?.length) {
        res.status(400).json({ success: false, error: "No connected social accounts to sync." });
        return;
      }
      const synced = [];
      for (const row of rows) {
        const { data: secret } = await admin2.from("social_connection_secrets").select("access_token").eq("connection_id", row.id).maybeSingle();
        if (!secret?.access_token) continue;
        try {
          const extras = {
            ...(await getOrgFamilyCreds(auth.orgId, familyForPlatform(row.platform))).extra,
            externalId: row.external_id || "",
            adAccountId: row.ad_account_id || ""
          };
          const stats = await fetchLiveStats(row.platform, secret.access_token, extras);
          const scopes = ["instagram", "facebook", "meta_ads"].includes(row.platform) ? await fetchGrantedMetaScopes(secret.access_token).catch(() => void 0) : void 0;
          const connection = await upsertConnection({
            orgId: auth.orgId,
            clientId: String(clientId),
            platform: row.platform,
            stats,
            accessToken: secret.access_token,
            scopes
          });
          synced.push(connection);
        } catch (err) {
          await admin2.from("social_connections").update({ last_error: err.message, status: "error", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", row.id);
        }
      }
      const insights = await rebuildClientInsights(String(clientId), auth.orgId);
      res.json({ success: true, synced, insights });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.delete("/api/socials/connections/:id", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "No organization." });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const { error } = await admin2.from("social_connections").delete().eq("id", req.params.id).eq("org_id", auth.orgId);
      if (error) throw new Error(error.message);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.get(["/auth/callback", "/auth/callback/", "/api/auth/callback", "/api/auth/callback/"], async (req, res) => {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const fallbackOrigin = getAppUrl().replace(/\/$/, "");
    let openerOrigin = fallbackOrigin;
    try {
      if (!code || !state) throw new Error("Missing OAuth code or state.");
      const admin2 = getSupabaseAdmin();
      const { data: row } = await admin2.from("oauth_states").select("*").eq("state", state).maybeSingle();
      if (!row || new Date(row.expires_at).getTime() < Date.now()) {
        throw new Error("OAuth state expired. Start the connection again.");
      }
      openerOrigin = String(row.redirect_origin || fallbackOrigin).replace(/\/$/, "");
      const redirectUri = resolveOAuthRedirectUri(row.redirect_uri, row.redirect_origin);
      console.info("[oauth] callback exchange", { platform: row.platform, redirectUri, openerOrigin });
      const overrides = await overridesForOrg(row.org_id);
      const tokens = await exchangeCodeForToken(row.platform, code, overrides, redirectUri);
      const extras = { ...(await getOrgFamilyCreds(row.org_id, familyForPlatform(row.platform))).extra };
      const { data: client } = await admin2.from("clients").select("name").eq("id", row.client_id).maybeSingle();
      if (client?.name) extras.clientName = client.name;
      let stats;
      let lastError = null;
      let needsSelection;
      try {
        stats = await fetchLiveStats(row.platform, tokens.accessToken, extras);
      } catch (err) {
        lastError = err.message;
        if (err.code === "NEEDS_SELECTION") needsSelection = err.assets;
        stats = emptyStats(row.platform, lastError);
      }
      await upsertConnection({
        orgId: row.org_id,
        clientId: row.client_id,
        platform: row.platform,
        stats,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        lastError,
        status: needsSelection ? "needs_selection" : void 0
      });
      await rebuildClientInsights(row.client_id, row.org_id);
      await admin2.from("oauth_states").delete().eq("id", row.id);
      const canPublish = (row.platform === "instagram" || row.platform === "facebook") && hasMetaPublishScopes(row.platform, tokens.scopes);
      const publishWarning = (row.platform === "instagram" || row.platform === "facebook") && !canPublish ? "Signed in, but Meta did not grant publishing. Add instagram_content_publish and pages_manage_posts on the Meta app, then reconnect and accept those permissions." : void 0;
      res.send(
        callbackPage(openerOrigin, {
          ok: true,
          platform: row.platform,
          accountName: stats.accountName,
          warning: lastError || publishWarning,
          canPublish,
          needsSelection
        })
      );
    } catch (err) {
      console.error("[oauth] callback failed", err?.message);
      res.status(400).send(callbackPage(openerOrigin, { ok: false, error: err.message }));
    }
  });
}
function emptyStats(platform, note) {
  return {
    accountName: platform,
    followers: 0,
    growthRate: 0,
    healthScore: 0,
    impressions24h: 0,
    reach24h: 0,
    engagement24h: 0,
    clicks24h: 0,
    spend30d: 0,
    conversions30d: 0,
    revenue30d: 0,
    demographics: { note }
  };
}
async function upsertConnection(input) {
  const admin2 = getSupabaseAdmin();
  const { data: connection, error } = await admin2.from("social_connections").upsert(
    {
      org_id: input.orgId,
      client_id: input.clientId,
      platform: input.platform,
      account_name: input.stats.accountName,
      external_id: input.stats.externalId || null,
      ad_account_id: input.stats.adAccountId || null,
      status: input.status || (input.lastError ? "error" : "connected"),
      followers: input.stats.followers,
      growth_rate: input.stats.growthRate,
      health_score: input.stats.healthScore,
      impressions_24h: input.stats.impressions24h,
      reach_24h: input.stats.reach24h,
      engagement_24h: input.stats.engagement24h,
      clicks_24h: input.stats.clicks24h,
      spend_30d: input.stats.spend30d,
      conversions_30d: input.stats.conversions30d,
      revenue_30d: input.stats.revenue30d,
      last_sync: (/* @__PURE__ */ new Date()).toISOString(),
      last_error: input.lastError || null,
      posts: input.stats.posts || [],
      demographics: input.stats.demographics || {},
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "client_id,platform" }
  ).select("*").single();
  if (error) throw new Error(error.message);
  const secretRow = {
    connection_id: connection.id,
    access_token: input.accessToken,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (input.refreshToken !== void 0) secretRow.refresh_token = input.refreshToken || null;
  if (input.expiresAt !== void 0) secretRow.token_expires_at = input.expiresAt || null;
  if (input.scopes !== void 0) secretRow.scopes = input.scopes || null;
  const { error: secretErr } = await admin2.from("social_connection_secrets").upsert(secretRow);
  if (secretErr) throw new Error(secretErr.message);
  return connection;
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function callbackPage(origin, payload) {
  const message = payload.ok ? "Account connected. You can close this window." : String(payload.error || "OAuth failed");
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#070b12;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh">
  <p>${escapeHtml(message)}</p>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: ${JSON.stringify(payload.ok ? "OAUTH_AUTH_SUCCESS" : "OAUTH_AUTH_ERROR")}, ...${JSON.stringify(payload)} }, ${JSON.stringify(origin)});
      setTimeout(() => window.close(), 800);
    } else {
      location.href = ${JSON.stringify(origin)} + '/?view=agency';
    }
  </script></body></html>`;
}

// server/social/publish.ts
var GRAPH = "https://graph.facebook.com/v21.0";
async function graph(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const err = data?.error || {};
    const message = humanizeMetaPublishError(
      err.error_user_msg || err.message || `HTTP ${res.status}`,
      Number(err.code) || void 0,
      Number(err.error_subcode) || void 0
    );
    const wrapped = new Error(message);
    wrapped.code = Number(err.code) || void 0;
    wrapped.subcode = Number(err.error_subcode) || void 0;
    throw wrapped;
  }
  return data;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function resolveMetaPublishTarget(userToken, platform, extras) {
  const { pages, assets } = await listMetaBrandAssets(userToken);
  const chosen = pickMetaAsset(assets, platform, extras);
  if (!chosen) {
    throw new Error(
      platform === "instagram" ? "TERMINAL: No Instagram professional account is bound to this brand. Connect Instagram and pick the brand account." : "TERMINAL: No Facebook Page is bound to this brand. Connect Facebook and pick the brand Page."
    );
  }
  const page = pages.find((p) => p.id === chosen.pageId || p.id === chosen.id);
  if (!page?.access_token) {
    throw new Error(
      "TERMINAL: Meta did not return a Page access token. Reconnect with a login that has MANAGE or CREATE_CONTENT on this Page."
    );
  }
  const ig = page.instagram_business_account;
  return {
    pageId: String(page.id),
    pageToken: String(page.access_token),
    pageName: page.name,
    igId: ig?.id || (chosen.kind === "instagram" ? chosen.id : void 0),
    igUsername: ig?.username
  };
}
async function assertInstagramQuota(igId, token) {
  try {
    const data = await graph(
      `${GRAPH}/${igId}/content_publishing_limit?fields=config,quota_usage&access_token=${encodeURIComponent(token)}`
    );
    const row = data?.data?.[0] || data;
    const used = Number(row?.quota_usage ?? 0);
    const quota = Number(row?.config?.quota_total ?? row?.config?.quota ?? 0);
    if (quota > 0 && used >= quota) {
      throw new Error(
        `Instagram\u2019s content publishing limit is exhausted (${used}/${quota} in the current window). Try again after Meta resets the quota.`
      );
    }
  } catch (err) {
    if (String(err.message || "").includes("publishing limit")) throw err;
    console.warn("[publish] content_publishing_limit unavailable", err.message);
  }
}
async function pollContainer(containerId, token, timeoutMs = 42e3) {
  const started = Date.now();
  let delay = 1500;
  while (Date.now() - started < timeoutMs) {
    const data = await graph(
      `${GRAPH}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`
    );
    const code = String(data.status_code || "").toUpperCase();
    if (code === "FINISHED" || code === "PUBLISHED") return data;
    if (code === "ERROR") {
      throw new Error(data.status || "Instagram rejected the media container.");
    }
    if (code === "EXPIRED") {
      throw new Error("The Instagram media container expired. Upload the file again and retry.");
    }
    await sleep(delay);
    delay = Math.min(delay + 500, 4e3);
  }
  const pending = new Error(
    "Instagram is still processing this media. GrowthOS will finish publishing on the next run."
  );
  pending.containerPending = true;
  pending.containerId = containerId;
  throw pending;
}
async function createAndPublishIg(input) {
  await assertInstagramQuota(input.igId, input.token);
  let containerId = input.existingContainerId || "";
  if (containerId) {
    try {
      await pollContainer(containerId, input.token, 2e4);
    } catch (err) {
      if (err.containerPending) throw err;
      containerId = "";
    }
  }
  if (!containerId) {
    const params = new URLSearchParams({ access_token: input.token });
    if (input.kind === "ig_reel") {
      params.set("media_type", "REELS");
      params.set("video_url", input.mediaUrl);
      params.set("caption", input.caption);
      params.set("share_to_feed", "true");
    } else if (input.kind === "ig_story") {
      params.set("media_type", "STORIES");
      const video = /\.(mp4|mov|m4v)(\?|#|$)/i.test(input.mediaUrl);
      params.set(video ? "video_url" : "image_url", input.mediaUrl);
    } else {
      params.set("image_url", input.mediaUrl);
      params.set("caption", input.caption);
    }
    const created = await graph(`${GRAPH}/${input.igId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });
    containerId = String(created.id || "");
    if (!containerId) throw new Error("Instagram did not return a media container id.");
    await input.onContainer?.(containerId);
    try {
      await pollContainer(containerId, input.token);
    } catch (err) {
      if (err.containerPending) err.containerId = containerId;
      throw err;
    }
  }
  const published = await graph(`${GRAPH}/${input.igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: input.token
    })
  });
  const mediaId = String(published.id || "");
  if (!mediaId) throw new Error("Instagram accepted the container but did not return a media id.");
  await input.onPublished?.(mediaId);
  const permalink = await graph(
    `${GRAPH}/${mediaId}?fields=id,permalink&access_token=${encodeURIComponent(input.token)}`
  ).catch(() => ({ permalink: "" }));
  return {
    providerPostId: mediaId,
    permalink: String(permalink.permalink || ""),
    containerId
  };
}
async function publishFacebook(input) {
  if (input.kind === "fb_photo" && input.mediaUrl) {
    const created2 = await graph(`${GRAPH}/${input.pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        url: input.mediaUrl,
        caption: input.caption,
        published: "true",
        access_token: input.token
      })
    });
    const postId2 = String(created2.post_id || created2.id || "");
    const permalink2 = postId2 ? await graph(
      `${GRAPH}/${postId2}?fields=permalink_url&access_token=${encodeURIComponent(input.token)}`
    ).catch(() => ({ permalink_url: "" })) : { permalink_url: "" };
    return { providerPostId: postId2, permalink: String(permalink2.permalink_url || "") };
  }
  if (input.kind === "fb_video" && input.mediaUrl) {
    const created2 = await graph(`${GRAPH}/${input.pageId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        file_url: input.mediaUrl,
        description: input.caption,
        access_token: input.token
      })
    });
    const videoId = String(created2.id || "");
    return { providerPostId: videoId, permalink: videoId ? `https://www.facebook.com/${videoId}` : "" };
  }
  const created = await graph(`${GRAPH}/${input.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      message: input.caption,
      access_token: input.token
    })
  });
  const postId = String(created.id || "");
  const permalink = postId ? await graph(
    `${GRAPH}/${postId}?fields=permalink_url&access_token=${encodeURIComponent(input.token)}`
  ).catch(() => ({ permalink_url: "" })) : { permalink_url: "" };
  return { providerPostId: postId, permalink: String(permalink.permalink_url || "") };
}
async function publishCalendarItemToMeta(input) {
  const resolved = resolvePublishKind({
    platform: input.platform,
    contentType: input.contentType,
    mediaType: input.mediaType,
    mediaUrl: input.mediaUrl,
    topic: input.topic,
    hookText: input.hookText,
    captionText: input.captionText,
    cta: input.cta
  });
  if (!resolved.kind) throw new Error(resolved.error || "This post cannot be published.");
  const caption = composeCaption(input);
  const target = await resolveMetaPublishTarget(input.userToken, input.platform, {
    externalId: input.externalId,
    clientName: input.clientName
  });
  if (resolved.kind.startsWith("ig_")) {
    if (!target.igId) {
      throw new Error(
        "TERMINAL: The selected Facebook Page has no linked Instagram professional account."
      );
    }
    const result2 = await createAndPublishIg({
      igId: target.igId,
      token: target.pageToken,
      kind: resolved.kind,
      mediaUrl: String(input.mediaUrl),
      caption,
      existingContainerId: input.existingContainerId,
      onContainer: input.onContainer,
      onPublished: input.onPublished
    });
    return {
      ...result2,
      accountLabel: target.igUsername ? `@${target.igUsername}` : target.pageName,
      note: resolved.note
    };
  }
  const result = await publishFacebook({
    pageId: target.pageId,
    token: target.pageToken,
    kind: resolved.kind,
    mediaUrl: input.mediaUrl || void 0,
    caption
  });
  await input.onPublished?.(result.providerPostId);
  return {
    ...result,
    containerId: void 0,
    accountLabel: target.pageName,
    note: resolved.note
  };
}

// server/social/publishRunner.ts
async function loadMetaSecret(admin2, orgId, clientId, platform) {
  const order = platform === "instagram" ? ["instagram", "facebook"] : ["facebook", "instagram"];
  for (const candidate of order) {
    const { data: connection } = await admin2.from("social_connections").select("id, platform, external_id, account_name, status").eq("org_id", orgId).eq("client_id", clientId).eq("platform", candidate).maybeSingle();
    if (!connection?.id) continue;
    const { data: secret } = await admin2.from("social_connection_secrets").select("access_token, scopes").eq("connection_id", connection.id).maybeSingle();
    if (!secret?.access_token) continue;
    return { connection, secret };
  }
  return null;
}
async function claimItem(admin2, id) {
  const { data, error } = await admin2.rpc("claim_calendar_publish", { p_id: id });
  if (error) throw new Error(error.message);
  console.info("[publish] claim", { itemId: id, claimed: Boolean(data) });
  return Boolean(data);
}
async function recordAttempt(admin2, input) {
  await admin2.from("calendar_publish_attempts").insert({
    calendar_item_id: input.itemId,
    org_id: input.orgId,
    client_id: input.clientId,
    platform: input.platform,
    status: input.status,
    provider_post_id: input.providerPostId || null,
    provider_permalink: input.permalink || null,
    error: input.error || null,
    requested_by: input.requestedBy || null,
    source: input.source,
    finished_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function publishOneCalendarItem(input) {
  const admin2 = getSupabaseAdmin();
  const { data: item, error } = await admin2.from("calendar_items").select(
    "id, client_id, platform, content_type, topic, hook_text, caption_text, cta, visual_asset_url, visual_asset_type, provider_post_id, provider_container_id, publish_blocked, status"
  ).eq("id", input.itemId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new Error("Calendar item not found.");
  const { data: client } = await admin2.from("clients").select("id, org_id, name").eq("id", item.client_id).maybeSingle();
  if (!client || client.org_id !== input.orgId) throw new Error("Client not found in your organization.");
  if (item.provider_post_id) {
    return {
      success: true,
      alreadyPublished: true,
      itemId: item.id,
      providerPostId: item.provider_post_id
    };
  }
  if (item.publish_blocked && !input.force) {
    throw new Error("This post is blocked until the last publish error is fixed. Use Publish now after you reconnect or replace the media.");
  }
  const claimed = await claimItem(admin2, item.id);
  if (!claimed) {
    if (input.source === "manual") {
      throw new Error("This post is already publishing or already live. Wait a moment and refresh.");
    }
    return { success: false, skipped: true, itemId: item.id };
  }
  const platform = item.platform === "facebook" ? "facebook" : item.platform === "instagram" ? "instagram" : null;
  if (!platform) {
    const message = `TERMINAL: GrowthOS does not publish ${item.platform} from the calendar yet.`;
    await admin2.from("calendar_items").update({
      publish_error: message,
      publish_blocked: true,
      publish_lock_until: null
    }).eq("id", item.id);
    await recordAttempt(admin2, {
      itemId: item.id,
      orgId: input.orgId,
      clientId: item.client_id,
      platform: item.platform,
      status: "failed",
      error: message,
      requestedBy: input.requestedBy,
      source: input.source
    });
    throw new Error(message);
  }
  const bound = await loadMetaSecret(admin2, input.orgId, item.client_id, platform);
  if (!bound) {
    const message = `TERMINAL: Connect the ${platform === "instagram" ? "Instagram professional" : "Facebook Page"} account for this brand first.`;
    await failItem(admin2, item, input, message);
    throw new Error(message);
  }
  const liveScopes = await fetchGrantedMetaScopes(bound.secret.access_token).catch((err) => {
    console.warn("[publish] live permission check failed, using stored scopes", err.message);
    return bound.secret.scopes || "";
  });
  if (liveScopes && liveScopes !== bound.secret.scopes) {
    await admin2.from("social_connection_secrets").update({ scopes: liveScopes, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("connection_id", bound.connection.id);
  }
  const scopes = liveScopes || bound.secret.scopes || "";
  console.info("[publish] permissions", {
    itemId: item.id,
    platform,
    canPublish: hasMetaPublishScopes(platform, scopes)
  });
  if (!hasMetaPublishScopes(platform, scopes)) {
    const message = "TERMINAL: This Meta login is insights-only. Reconnect the account and accept Instagram/Facebook publishing.";
    await failItem(admin2, item, input, message);
    throw new Error(message);
  }
  try {
    const result = await publishCalendarItemToMeta({
      platform,
      contentType: item.content_type,
      topic: item.topic,
      hookText: item.hook_text,
      captionText: item.caption_text,
      cta: item.cta,
      mediaUrl: item.visual_asset_url,
      mediaType: item.visual_asset_type,
      userToken: bound.secret.access_token,
      externalId: bound.connection.external_id || void 0,
      clientName: client.name,
      existingContainerId: item.provider_container_id,
      onContainer: async (containerId) => {
        await admin2.from("calendar_items").update({ provider_container_id: containerId }).eq("id", item.id);
      },
      onPublished: async (providerPostId) => {
        await admin2.from("calendar_items").update({
          status: "published",
          published_at: (/* @__PURE__ */ new Date()).toISOString(),
          provider_post_id: providerPostId,
          publish_error: null,
          publish_blocked: false
        }).eq("id", item.id);
      }
    });
    const { error: updateErr } = await admin2.from("calendar_items").update({
      status: "published",
      published_at: (/* @__PURE__ */ new Date()).toISOString(),
      provider_post_id: result.providerPostId,
      provider_permalink: result.permalink || null,
      provider_container_id: result.containerId || null,
      publish_error: null,
      publish_blocked: false,
      publish_lock_until: null
    }).eq("id", item.id);
    if (updateErr) throw new Error(updateErr.message);
    await recordAttempt(admin2, {
      itemId: item.id,
      orgId: input.orgId,
      clientId: item.client_id,
      platform,
      status: "published",
      providerPostId: result.providerPostId,
      permalink: result.permalink,
      requestedBy: input.requestedBy,
      source: input.source
    });
    return {
      success: true,
      itemId: item.id,
      providerPostId: result.providerPostId,
      permalink: result.permalink,
      accountLabel: result.accountLabel,
      note: result.note
    };
  } catch (err) {
    const pending = Boolean(err.containerPending);
    const message = String(err.message || "Publish failed.");
    const blocked = !pending && isTerminalPublishError(message);
    await admin2.from("calendar_items").update({
      publish_error: message,
      publish_blocked: blocked,
      provider_container_id: err.containerId || item.provider_container_id || null,
      publish_lock_until: pending ? new Date(Date.now() + 60 * 1e3).toISOString() : null
    }).eq("id", item.id);
    await recordAttempt(admin2, {
      itemId: item.id,
      orgId: input.orgId,
      clientId: item.client_id,
      platform,
      status: pending ? "processing" : "failed",
      error: message,
      requestedBy: input.requestedBy,
      source: input.source
    });
    throw err;
  }
}
async function failItem(admin2, item, input, message) {
  await admin2.from("calendar_items").update({
    publish_error: message,
    publish_blocked: isTerminalPublishError(message),
    publish_lock_until: null
  }).eq("id", item.id);
  await recordAttempt(admin2, {
    itemId: item.id,
    orgId: input.orgId,
    clientId: item.client_id,
    platform: item.platform,
    status: "failed",
    error: message,
    requestedBy: input.requestedBy,
    source: input.source
  });
}
async function publishDueCalendarItems(input) {
  const admin2 = getSupabaseAdmin();
  const limit = Math.min(Math.max(input?.limit || 6, 1), 12);
  let query = admin2.from("calendar_items").select("id, client_id, platform, scheduled_at, publish_blocked, provider_post_id").eq("status", "scheduled").in("platform", ["instagram", "facebook"]).is("provider_post_id", null).eq("publish_blocked", false).lte("scheduled_at", (/* @__PURE__ */ new Date()).toISOString()).order("scheduled_at", { ascending: true }).limit(24);
  if (input?.clientId) query = query.eq("client_id", input.clientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const clientIds = [...new Set((data || []).map((row) => row.client_id))];
  const { data: clients } = clientIds.length ? await admin2.from("clients").select("id, org_id, name").in("id", clientIds) : { data: [] };
  const clientMap = new Map((clients || []).map((row) => [row.id, row]));
  const rows = (data || []).map((row) => ({ ...row, org_id: clientMap.get(row.client_id)?.org_id })).filter((row) => {
    if (!row.org_id) return false;
    if (input?.orgId && row.org_id !== input.orgId) return false;
    return true;
  }).slice(0, limit);
  const published = [];
  const failed = [];
  for (const row of rows) {
    try {
      const result = await publishOneCalendarItem({
        itemId: row.id,
        orgId: String(row.org_id),
        requestedBy: input?.requestedBy,
        source: input?.source || "cron"
      });
      if (result.skipped) continue;
      published.push(result);
    } catch (err) {
      failed.push({ itemId: row.id, error: err.message });
    }
  }
  return { success: true, scanned: rows.length, published, failed };
}

// server/social/publishRoutes.ts
function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const header = req.header("authorization") || req.header("x-cron-secret") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return token === secret;
}
async function requireCronOrUser(req, res, next) {
  if (cronAuthorized(req)) {
    req.cron = true;
    next();
    return;
  }
  return requireSupabaseUser(req, res, next);
}
function registerPublishRoutes(app2) {
  app2.get("/api/calendar/readiness", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      const clientId = String(req.query.clientId || "");
      if (!auth.orgId || !clientId) {
        res.json({ success: true, instagram: { connected: false }, facebook: { connected: false } });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const { data: rows } = await admin2.from("social_connections").select("id, platform, status, account_name, external_id").eq("org_id", auth.orgId).eq("client_id", clientId).in("platform", ["instagram", "facebook"]);
      const ids = (rows || []).map((row) => row.id);
      const { data: secrets } = ids.length ? await admin2.from("social_connection_secrets").select("connection_id, scopes, access_token").in("connection_id", ids) : { data: [] };
      const secretMap = /* @__PURE__ */ new Map();
      for (const row of secrets || []) {
        secretMap.set(row.connection_id, row);
      }
      const readiness = {};
      for (const platform of ["instagram", "facebook"]) {
        const row = (rows || []).find((item) => item.platform === platform);
        const secret = row ? secretMap.get(row.id) : void 0;
        let scopes = secret?.scopes || "";
        if (secret?.access_token) {
          const live = await fetchGrantedMetaScopes(secret.access_token).catch(() => "");
          if (live) {
            scopes = live;
            if (live !== secret.scopes) {
              await admin2.from("social_connection_secrets").update({ scopes: live, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("connection_id", row.id);
            }
          }
        }
        const canPublish = Boolean(row && hasMetaPublishScopes(platform, scopes));
        readiness[platform] = {
          connected: Boolean(row && (row.status === "connected" || row.status === "needs_selection")),
          accountName: row?.account_name || "",
          canPublish,
          note: publishReadyNote(platform, scopes, Boolean(row))
        };
      }
      res.json({ success: true, ...readiness });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post(["/api/calendar/due", "/api/calendar/due/"], requireCronOrUser, async (req, res) => {
    try {
      const isCron = Boolean(req.cron);
      const auth = isCron ? null : authOf(req);
      if (!isCron && !auth?.orgId) {
        res.status(400).json({ success: false, error: "Complete workspace onboarding first." });
        return;
      }
      const result = await publishDueCalendarItems({
        orgId: isCron ? void 0 : auth?.orgId,
        clientId: req.body?.clientId || req.query.clientId || void 0,
        requestedBy: auth?.userId,
        source: isCron ? "cron" : "flush"
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.get(["/api/calendar/due", "/api/calendar/due/"], requireCronOrUser, async (req, res) => {
    try {
      const isCron = Boolean(req.cron);
      const auth = isCron ? null : authOf(req);
      if (!isCron && !auth?.orgId) {
        res.status(400).json({ success: false, error: "Complete workspace onboarding first." });
        return;
      }
      const result = await publishDueCalendarItems({
        orgId: isCron ? void 0 : auth?.orgId,
        requestedBy: auth?.userId,
        source: isCron ? "cron" : "flush"
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/calendar/:itemId/publish", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete workspace onboarding first." });
        return;
      }
      if (!canManageCalendar(auth)) {
        res.status(403).json({ success: false, error: "Your role cannot publish from the calendar." });
        return;
      }
      const result = await publishOneCalendarItem({
        itemId: String(req.params.itemId),
        orgId: auth.orgId,
        requestedBy: auth.userId,
        source: "manual",
        force: true
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });
}

// server/commerceRoutes.ts
var import_express2 = __toESM(require("express"), 1);

// server/email.ts
function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
async function sendTransactionalEmail(input) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    throw new Error(
      "Email is not configured. Set RESEND_API_KEY and EMAIL_FROM on the server."
    );
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Email send failed (${res.status})`);
  }
  return data;
}

// server/stripeBilling.ts
function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
async function stripeRequest(path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  const body = new URLSearchParams(params);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe request failed (${res.status})`);
  }
  return data;
}
var TIER_PRICES = {
  starter: { name: "GrowthOS Starter", amount: 0 },
  growth: { name: "GrowthOS Growth", amount: 7900 },
  agency: { name: "GrowthOS Agency", amount: 19900 }
};
function listBillingTiers() {
  return Object.entries(TIER_PRICES).map(([id, t]) => ({
    id,
    name: t.name,
    amountUsd: t.amount / 100
  }));
}
async function createSubscriptionCheckout(input) {
  const tier = TIER_PRICES[input.tier];
  if (!tier) throw new Error("Unknown billing tier.");
  if (tier.amount === 0) {
    return { id: "free", url: null, free: true };
  }
  const appUrl = getAppUrl().replace(/\/$/, "");
  return stripeRequest("/checkout/sessions", {
    mode: "subscription",
    "success_url": `${appUrl}/?view=settings&billing=success`,
    "cancel_url": `${appUrl}/?view=settings&billing=canceled`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(tier.amount),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": tier.name,
    "metadata[org_id]": input.orgId,
    "metadata[kind]": "subscription",
    "metadata[tier]": input.tier,
    ...input.customerEmail ? { customer_email: input.customerEmail } : {}
  });
}
function verifyStripeSignature(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const parts = Object.fromEntries(
    signature.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k, rest.join("=")];
    })
  );
  const crypto3 = require("crypto");
  const signed = `${parts.t}.${rawBody.toString("utf8")}`;
  const expected = crypto3.createHmac("sha256", secret).update(signed).digest("hex");
  try {
    return crypto3.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1 || ""));
  } catch {
    return false;
  }
}

// server/ai/gemini.ts
var MAX_PROMPT_CHARS = 24e3;
var DEFAULT_TIMEOUT_MS = 55e3;
var DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
var FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
var genAiSdk = null;
async function loadGenAiSdk() {
  if (!genAiSdk) {
    console.info("[AI] loading @google/genai");
    genAiSdk = await import("@google/genai");
  }
  return genAiSdk;
}
function isLegacyGemini25(model) {
  return /^gemini-2\.[05]/i.test(model);
}
function modelCandidates(preferred) {
  const ordered = [preferred, process.env.GEMINI_MODEL, ...FALLBACK_MODELS].map((m) => (m || "").trim()).filter(Boolean).filter((m) => !isLegacyGemini25(m));
  const unique = [...new Set(ordered)];
  return unique.length ? unique : ["gemini-3.6-flash"];
}
function isUnavailableModelError(err) {
  const message = `${err?.message || ""} ${JSON.stringify(err?.error || err || "")}`;
  return /404|NOT_FOUND|no longer available|not found for API version/i.test(message);
}
var aiClient = null;
var initError = null;
function getApiKey() {
  return (process.env.GEMINI_API_KEY || "").trim();
}
function isAiConfigured() {
  return Boolean(getApiKey()) && !initError;
}
function getAiStatus() {
  return {
    configured: isAiConfigured(),
    model: DEFAULT_MODEL,
    initError
  };
}
async function getAiClient() {
  if (aiClient) return aiClient;
  const apiKey = getApiKey();
  if (!apiKey) {
    initError = "GEMINI_API_KEY is not set";
    return null;
  }
  try {
    const { GoogleGenAI } = await loadGenAiSdk();
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { "User-Agent": "growthos-ai" }
      }
    });
    initError = null;
    return aiClient;
  } catch (err) {
    initError = err?.message || "Failed to initialize Gemini client";
    console.error("Failed to initialize GoogleGenAI:", err);
    return null;
  }
}
function truncate(input, max = MAX_PROMPT_CHARS) {
  if (!input) return "";
  if (input.length <= max) return input;
  return `${input.slice(0, max)}

[truncated]`;
}
async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
var AiServiceError = class extends Error {
  constructor(message, status = 500, code = "ai_error") {
    super(message);
    this.name = "AiServiceError";
    this.status = status;
    this.code = code;
  }
};
async function generateGrowthAI(prompt, systemInstruction, options) {
  const client = await getAiClient();
  if (!client) {
    throw new AiServiceError(
      "Gemini is not configured. Set GEMINI_API_KEY on the server and restart.",
      503,
      "ai_not_configured"
    );
  }
  const temperature = options?.temperature ?? 0.7;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const contents = truncate(prompt);
  const system = systemInstruction ? truncate(systemInstruction, 8e3) : void 0;
  return generateGeminiContent({
    client,
    contents,
    systemInstruction: system,
    temperature,
    timeoutMs,
    model: options?.model,
    tools: options?.tools
  });
}
async function generateGeminiContent(opts) {
  const temperature = opts.temperature ?? 0.7;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { ThinkingLevel } = await loadGenAiSdk();
  const models = modelCandidates(opts.model);
  let lastErr;
  for (const model of models) {
    const run = async () => {
      const response = await opts.client.models.generateContent({
        model,
        contents: opts.contents,
        config: {
          temperature,
          ...opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {},
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          ...opts.tools?.length ? { tools: opts.tools } : {}
        }
      });
      const text = (response.text || "").trim();
      if (!text) {
        throw new AiServiceError("Gemini returned an empty response.", 502, "ai_empty");
      }
      return text;
    };
    try {
      return await withTimeout(run(), timeoutMs);
    } catch (err) {
      lastErr = err;
      if (isUnavailableModelError(err)) {
        console.warn(`[AI] model ${model} unavailable, trying fallback`);
        continue;
      }
      const message = String(err?.message || err);
      if (/timeout|429|503|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(message)) {
        try {
          return await withTimeout(run(), timeoutMs);
        } catch (retryErr) {
          lastErr = retryErr;
          throw normalizeAiError(retryErr);
        }
      }
      throw normalizeAiError(err);
    }
  }
  throw normalizeAiError(lastErr);
}
function normalizeAiError(err) {
  if (err instanceof AiServiceError) return err;
  const message = String(err?.message || "AI request failed");
  if (/API key|PERMISSION|401|UNAUTHENTICATED/i.test(message)) {
    return new AiServiceError("Gemini API key is invalid or unauthorized.", 401, "ai_auth");
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(message)) {
    return new AiServiceError("Gemini rate limit or quota exceeded. Try again shortly.", 429, "ai_quota");
  }
  if (/timeout/i.test(message)) {
    return new AiServiceError(message, 504, "ai_timeout");
  }
  if (/404|NOT_FOUND|no longer available/i.test(message)) {
    return new AiServiceError(
      "Gemini model is unavailable. Set GEMINI_MODEL to gemini-3.6-flash (or another current Flash model).",
      502,
      "ai_model"
    );
  }
  return new AiServiceError(message, 500, "ai_error");
}
function parseJsonFromModel(raw, fallback) {
  if (!raw) return fallback;
  let clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const objStart = clean.indexOf("{");
  const arrStart = clean.indexOf("[");
  let start = -1;
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) start = objStart;
  else if (arrStart >= 0) start = arrStart;
  if (start > 0) clean = clean.slice(start);
  const endObj = clean.lastIndexOf("}");
  const endArr = clean.lastIndexOf("]");
  const end = Math.max(endObj, endArr);
  if (end > 0) clean = clean.slice(0, end + 1);
  try {
    return JSON.parse(clean);
  } catch {
    return fallback;
  }
}
function sendAiError(res, err) {
  const normalized = normalizeAiError(err);
  console.error(`[AI] ${normalized.code}:`, normalized.message);
  res.status(normalized.status).json({
    success: false,
    error: normalized.message,
    code: normalized.code
  });
}

// server/commerceRoutes.ts
function registerCommerceRoutes(app2) {
  app2.get("/api/invoices", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.json({ success: true, invoices: [] });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const { data, error } = await admin2.from("invoices").select("*").eq("org_id", auth.orgId).order("issued_at", { ascending: false });
      if (error) throw new Error(error.message);
      res.json({ success: true, invoices: data || [], emailConfigured: isEmailConfigured(), stripeConfigured: isStripeConfigured() });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/invoices", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete onboarding first." });
        return;
      }
      const { clientId, clientName, clientEmail, amount, currency, description, dueDate } = req.body || {};
      if (!clientId || !amount) {
        res.status(400).json({ success: false, error: "clientId and amount are required." });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const invoiceNumber = `INV-${(/* @__PURE__ */ new Date()).getFullYear()}-${Date.now().toString().slice(-6)}`;
      const { data: invoice, error } = await admin2.from("invoices").insert({
        org_id: auth.orgId,
        client_id: clientId,
        invoice_number: invoiceNumber,
        client_name: clientName || "Client",
        client_email: clientEmail || null,
        amount: Number(amount),
        currency: currency || "USD",
        description: description || "Growth services",
        due_date: dueDate || null,
        status: "outstanding",
        created_by: auth.userId
      }).select("*").single();
      if (error) throw new Error(error.message);
      let emailSent = false;
      if (clientEmail && isEmailConfigured()) {
        await sendTransactionalEmail({
          to: clientEmail,
          subject: `Invoice ${invoiceNumber} from GrowthOS`,
          html: `<p>Hi,</p><p>Invoice <strong>${invoiceNumber}</strong> for ${amount} ${currency || "USD"} is ready.</p><p>${description || ""}</p><p>Payment collection is paused \u2014 settle this invoice offline.</p>`
        });
        await admin2.from("invoices").update({ email_sent_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", invoice.id);
        emailSent = true;
      }
      res.json({
        success: true,
        invoice,
        emailSent,
        checkoutUrl: null
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.patch("/api/invoices/:id", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete onboarding first." });
        return;
      }
      const status = String(req.body?.status || "");
      if (status !== "paid" && status !== "outstanding") {
        res.status(400).json({ success: false, error: "status must be paid or outstanding." });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const { data, error } = await admin2.from("invoices").update({
        status,
        paid_at: status === "paid" ? (/* @__PURE__ */ new Date()).toISOString() : null
      }).eq("id", req.params.id).eq("org_id", auth.orgId).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        res.status(404).json({ success: false, error: "Invoice not found." });
        return;
      }
      res.json({ success: true, invoice: data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.delete("/api/invoices/:id", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete onboarding first." });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const { error } = await admin2.from("invoices").delete().eq("id", req.params.id).eq("org_id", auth.orgId);
      if (error) throw new Error(error.message);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/team/invite", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      const { email, name } = req.body || {};
      if (!email) {
        res.status(400).json({ success: false, error: "email is required." });
        return;
      }
      if (!isEmailConfigured()) {
        res.json({
          success: true,
          emailed: false,
          warning: "Invite saved. Set RESEND_API_KEY and EMAIL_FROM to send the email automatically."
        });
        return;
      }
      const appUrl = getAppUrl().replace(/\/$/, "");
      await sendTransactionalEmail({
        to: String(email).trim(),
        subject: `You're invited to GrowthOS`,
        html: `<p>Hi ${name || ""},</p><p>You've been invited to a GrowthOS workspace.</p><p><a href="${appUrl}/?view=overview">Create your account with this email</a> to join.</p>`
      });
      res.json({ success: true, emailed: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.get("/api/billing/tiers", requireSupabaseUser, async (_req, res) => {
    res.json({
      success: true,
      tiers: listBillingTiers(),
      stripeConfigured: isStripeConfigured()
    });
  });
  app2.get("/api/billing/status", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.json({ success: true, billingTier: "starter", billingStatus: "inactive" });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const { data } = await admin2.from("organizations").select("billing_tier, billing_status, custom_domain, domain_verified").eq("id", auth.orgId).maybeSingle();
      res.json({ success: true, ...data || {} });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/billing/checkout", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete onboarding first." });
        return;
      }
      const tier = String(req.body?.tier || "growth");
      if (tier === "starter") {
        const admin2 = getSupabaseAdmin();
        await admin2.from("organizations").update({ billing_tier: "starter", billing_status: "active" }).eq("id", auth.orgId);
        res.json({ success: true, free: true });
        return;
      }
      if (!isStripeConfigured()) {
        res.status(400).json({ success: false, error: "Set STRIPE_SECRET_KEY to enable paid billing." });
        return;
      }
      const session = await createSubscriptionCheckout({
        orgId: auth.orgId,
        tier,
        customerEmail: auth.email
      });
      res.json({ success: true, url: session.url });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/org/domain", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete onboarding first." });
        return;
      }
      const domain = String(req.body?.domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!domain) {
        res.status(400).json({ success: false, error: "domain is required." });
        return;
      }
      const token = `growthos-verify=${auth.orgId}`;
      const admin2 = getSupabaseAdmin();
      await admin2.from("organizations").update({ custom_domain: domain, domain_verify_token: token, domain_verified: false }).eq("id", auth.orgId);
      if (process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID) {
        await fetch(`https://api.vercel.com/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name: domain })
        }).catch(() => void 0);
      }
      res.json({
        success: true,
        domain,
        txtRecord: { host: domain, value: token },
        cname: { host: domain, value: "cname.vercel-dns.com" }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/org/domain/verify", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "Complete onboarding first." });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const { data: org } = await admin2.from("organizations").select("custom_domain, domain_verify_token").eq("id", auth.orgId).maybeSingle();
      if (!org?.custom_domain || !org.domain_verify_token) {
        res.status(400).json({ success: false, error: "Save a domain first." });
        return;
      }
      const lookup = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(org.custom_domain)}&type=TXT`,
        { headers: { Accept: "application/dns-json" } }
      );
      const dns = await lookup.json();
      const answers = (dns.Answer || []).map((a) => String(a.data || "").replace(/"/g, ""));
      const verified = answers.some((txt) => txt.includes(org.domain_verify_token));
      await admin2.from("organizations").update({ domain_verified: verified }).eq("id", auth.orgId);
      res.json({ success: true, verified, answers });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/campaigns/seed-metrics", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "No organization." });
        return;
      }
      const { clientId, budget } = req.body || {};
      const admin2 = getSupabaseAdmin();
      const { data } = await admin2.from("client_live_insights").select("*").eq("client_id", clientId).eq("org_id", auth.orgId).maybeSingle();
      res.json({ success: true, ...campaignMetricsFromInsights(data, Number(budget) || 0), hasLiveData: Boolean(data && data.source === "live_sync") });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.get("/api/insights/:clientId", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.json({ success: true, insights: null });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const { data } = await admin2.from("client_live_insights").select("*").eq("client_id", req.params.clientId).eq("org_id", auth.orgId).maybeSingle();
      res.json({ success: true, insights: data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.get("/api/growth/reboost", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.json({ success: true, jobs: [] });
        return;
      }
      const admin2 = getSupabaseAdmin();
      const { data, error } = await admin2.from("reboost_jobs").select("*").eq("org_id", auth.orgId).eq("client_id", String(req.query.clientId || "")).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      res.json({ success: true, jobs: data || [] });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post("/api/growth/reboost", requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: "No organization." });
        return;
      }
      const { clientId, post, budget } = req.body || {};
      if (!clientId || !post) {
        res.status(400).json({ success: false, error: "clientId and post are required." });
        return;
      }
      const planText = await generateGrowthAI(
        `Create a paid reboost plan for this live post:
${JSON.stringify(post)}
Daily budget: ${budget || 20}`,
        "Return markdown with audience, creative variants, and budget split. Use only the provided live metrics."
      );
      const admin2 = getSupabaseAdmin();
      let providerCampaignId = null;
      let status = "drafted";
      let error = null;
      const { data: conn } = await admin2.from("social_connections").select("id, ad_account_id, platform").eq("client_id", clientId).eq("org_id", auth.orgId).in("platform", ["meta_ads", "facebook"]).maybeSingle();
      if (conn?.ad_account_id) {
        const { data: secret } = await admin2.from("social_connection_secrets").select("access_token").eq("connection_id", conn.id).maybeSingle();
        if (secret?.access_token) {
          try {
            const created = await createMetaBoost({
              accessToken: secret.access_token,
              adAccountId: conn.ad_account_id,
              name: `Reboost: ${post.title || "GrowthOS"}`,
              dailyBudget: Number(budget) || 20
            });
            providerCampaignId = created.id;
            status = "created_paused";
          } catch (err) {
            error = err.message;
            status = "plan_only";
          }
        }
      }
      const { data: job, error: jobErr } = await admin2.from("reboost_jobs").insert({
        org_id: auth.orgId,
        client_id: clientId,
        post_id: post.id,
        post_title: post.title,
        platform: post.platform,
        budget: Number(budget) || 20,
        status,
        plan: { markdown: planText },
        provider_campaign_id: providerCampaignId,
        error,
        created_by: auth.userId
      }).select("*").single();
      if (jobErr) throw new Error(jobErr.message);
      res.json({ success: true, job });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.post(
    "/api/stripe/webhook",
    import_express2.default.raw({ type: "application/json" }),
    async (req, res) => {
      try {
        const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
        if (process.env.STRIPE_WEBHOOK_SECRET && !verifyStripeSignature(raw, req.header("stripe-signature") || void 0)) {
          res.status(400).json({ success: false, error: "Invalid Stripe signature" });
          return;
        }
        const event = JSON.parse(raw.toString("utf8"));
        const admin2 = getSupabaseAdmin();
        if (event.type === "checkout.session.completed") {
          const session = event.data?.object;
          if (session?.metadata?.kind === "invoice" && session.metadata.invoice_id) {
            await admin2.from("invoices").update({
              status: "paid",
              paid_at: (/* @__PURE__ */ new Date()).toISOString(),
              stripe_payment_intent_id: session.payment_intent || null
            }).eq("id", session.metadata.invoice_id);
          }
          if (session?.metadata?.kind === "subscription" && session.metadata.org_id) {
            await admin2.from("organizations").update({
              billing_tier: session.metadata.tier || "growth",
              billing_status: "active",
              stripe_customer_id: session.customer || null
            }).eq("id", session.metadata.org_id);
          }
        }
        res.json({ received: true });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    }
  );
}

// shared/googleAuth.ts
async function probeGoogleAuthEnabled(supabaseUrl, anonKey) {
  if (!supabaseUrl || !anonKey) return false;
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/authorize?provider=google`, {
      method: "GET",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      redirect: "manual"
    });
    if (res.status >= 300 && res.status < 400) return true;
    if (res.status === 0 && res.type === "opaqueredirect") return true;
    const text = await res.text();
    if (/provider is not enabled|Unsupported provider/i.test(text)) return false;
    return res.ok;
  } catch {
    return false;
  }
}

// server/app.ts
function createApp() {
  const app2 = (0, import_express3.default)();
  app2.use((req, _res, next) => {
    const original = String(
      req.headers["x-vercel-original-path"] || req.headers["x-invoke-path"] || req.headers["x-forwarded-uri"] || ""
    ).split("?")[0];
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const stripped = req.path === "/api" || req.path === "/";
    if (stripped && (original.startsWith("/auth/") || original.startsWith("/api/") && original !== "/api")) {
      console.info("[api] restored vercel path", { from: req.path, to: original, method: req.method });
      req.url = `${original}${qs}`;
    }
    next();
  });
  app2.use((req, res, next) => {
    if (req.method === "POST" && (req.path === "/api/meta/webhook" || req.path === "/api/stripe/webhook")) {
      return next();
    }
    return import_express3.default.json({ limit: "2mb" })(req, res, next);
  });
  app2.get("/api/health", (_req, res) => {
    const ai = getAiStatus();
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
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
        meta: (() => {
          try {
            return providerConfig("instagram").configured;
          } catch {
            return false;
          }
        })(),
        google: (() => {
          try {
            return providerConfig("youtube").configured;
          } catch {
            return false;
          }
        })(),
        tiktok: (() => {
          try {
            return providerConfig("tiktok").configured;
          } catch {
            return false;
          }
        })(),
        linkedin: (() => {
          try {
            return providerConfig("linkedin").configured;
          } catch {
            return false;
          }
        })()
      },
      supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
      appUrl: getAppUrl(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.get("/api/public-config", async (_req, res) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    const googleAuthEnabled = await probeGoogleAuthEnabled(supabaseUrl, supabaseAnonKey);
    res.json({
      configured: Boolean(supabaseUrl && supabaseAnonKey),
      supabaseUrl,
      supabaseAnonKey,
      googleAuthEnabled
    });
  });
  registerMetaWebhookRoutes(app2, generateGrowthAI);
  registerWhatsAppStaffRoutes(app2, generateGrowthAI);
  registerSocialRoutes(app2);
  registerPublishRoutes(app2);
  registerCommerceRoutes(app2);
  const growthAi = [requireSupabaseUser];
  app2.post("/api/growth/multi-agent", ...growthAi, async (req, res) => {
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

Context: Client Name: "${clientName || "General Client"}", Industry: "${industry || "E-commerce"}", Target Goal: "${targetGoal || "3x Followers & Sales"}".

Provide a structured collaborative breakdown where each relevant agent provides specific data-backed recommendations, actionable tactics, and predicted ROI. Respond in clean Markdown with clear agent headers.`;
      const userPrompt = inputPrompt || `Run a complete growth audit and strategic roadmap for ${clientName || "our brand"} to achieve predictable growth in reach, engagement, and conversion revenue over the next 90 days.`;
      const resultText = await generateGrowthAI(userPrompt, systemPrompt);
      res.json({ success: true, analysis: resultText });
    } catch (err) {
      sendAiError(res, err);
    }
  });
  app2.post("/api/growth/predict", ...growthAi, async (req, res) => {
    try {
      const { platform, contentType, hookText, targetAudience, industry } = req.body || {};
      if (!String(hookText || "").trim()) {
        res.status(400).json({ success: false, error: "hookText is required", code: "validation" });
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
      const prompt = `Platform: ${platform || "Instagram"}, Content Type: ${contentType || "Reel"}, Hook: "${hookText}", Target Audience: "${targetAudience || "Gen Z & Millennials"}", Industry: "${industry || "FMCG"}". Predict expected reach, virality score, best time, and key recommendations.`;
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
        conversionProbability: "8%"
      });
      res.json({ success: true, prediction: parsedData });
    } catch (err) {
      sendAiError(res, err);
    }
  });
  app2.post("/api/growth/optimize-content", ...growthAi, async (req, res) => {
    try {
      const { topic, channel, goal, audience } = req.body || {};
      if (!String(topic || "").trim()) {
        res.status(400).json({ success: false, error: "topic is required", code: "validation" });
        return;
      }
      const systemPrompt = `You are GrowthOS AI Content Optimization Agent. 
Generate 3 high-converting Viral Hooks, 2 Captions with high retention structure, a cluster of 15 targeted SEO Hashtags, and 3 CTA Strategies. Respond in clean structured Markdown.`;
      const prompt = `Topic: "${topic}", Target Channel: "${channel}", Main Goal: "${goal}", Audience: "${audience}". Optimize this content for maximum engagement and viral reach.`;
      const resultText = await generateGrowthAI(prompt, systemPrompt);
      res.json({ success: true, optimization: resultText });
    } catch (err) {
      sendAiError(res, err);
    }
  });
  app2.post("/api/growth/competitor-scan", ...growthAi, async (req, res) => {
    try {
      const { competitorName, industry, channel, website } = req.body || {};
      if (!String(competitorName || "").trim()) {
        res.status(400).json({ success: false, error: "competitorName is required", code: "validation" });
        return;
      }
      const target = String(website || competitorName).trim();
      let fetched = "";
      const urlGuess = target.startsWith("http") ? target : `https://${target.replace(/^@/, "")}`;
      try {
        const page = await fetch(urlGuess, {
          headers: { "User-Agent": "GrowthOS-Research/1.0" },
          signal: AbortSignal.timeout(8e3)
        });
        if (page.ok) {
          const html = await page.text();
          fetched = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 6e3);
        }
      } catch {
        fetched = "";
      }
      const systemPrompt = `You are GrowthOS AI Competitor Intelligence Engine.
Use live web search plus any fetched page text. Cite public sources. Do not invent follower counts. If a number is unknown, say unknown.
Identify positioning, content themes, engagement triggers, and 3 counter-strategies. Markdown.`;
      const prompt = `Competitor: "${competitorName}", Industry: "${industry}", Channel: "${channel}", Website/handle: "${target}".
Fetched public page text (may be empty): ${fetched || "[none]"}
Search the public web for this brand's social presence and summarize only what you can verify.`;
      const resultText = await generateGrowthAI(prompt, systemPrompt, {
        tools: [{ googleSearch: {} }]
      });
      res.json({ success: true, report: resultText, fetchedPage: Boolean(fetched) });
    } catch (err) {
      sendAiError(res, err);
    }
  });
  app2.post("/api/growth/analyze-calendar", ...growthAi, async (req, res) => {
    try {
      const { calendarData, campaignGoal, clientName } = req.body;
      const systemPrompt = `You are GrowthOS AI Content Calendar Audit Engine.
Analyze the provided monthly content calendar for "${clientName || "Client"}" against campaign goal: "${campaignGoal || "Drive engagement and sales"}".
Evaluate:
1. Overall Quality Score (0-100)
2. Content Pillar Balance (Educational, Promotional, Social Proof, Viral Curiosity %)
3. Top 3 Strengths
4. Top 3 Critical Weaknesses & Content Gaps
5. Posting Time & Format Optimizations
6. Specific 1-Click Suggestions to improve weak posts.

Respond in structured Markdown.`;
      const userPrompt = `Content Calendar Data: ${typeof calendarData === "string" ? calendarData : JSON.stringify(calendarData, null, 2)}`;
      const resultText = await generateGrowthAI(userPrompt, systemPrompt);
      res.json({ success: true, auditReport: resultText });
    } catch (err) {
      sendAiError(res, err);
    }
  });
  app2.post("/api/growth/generate-campaign-funnel", ...growthAi, async (req, res) => {
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
      const prompt = `Campaign: "${campaignName}", Goal: "${primaryGoal}", Audience: "${targetAudience}", Monthly Ad Budget: "$${budget || 5e3}".`;
      const resultText = await generateGrowthAI(prompt, systemPrompt);
      res.json({ success: true, funnelStrategy: resultText });
    } catch (err) {
      sendAiError(res, err);
    }
  });
  app2.post("/api/growth/analyze-creative-multimodal", ...growthAi, async (req, res) => {
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
Platform: ${platform || "Instagram"}, Content Format: ${contentType || "Reel/Graphic"}
Scheduled Calendar Topic: "${calendarTopic || "Product Showcase"}"
Hook Text: "${hookText || "Stop doing this standard mistake"}"
Caption Preview: "${captionText || "Learn how our framework triples reach"}"
Target Campaign Goal: "${campaignGoal || "Scale high-intent conversions"}"
Visual Asset URL/Data: ${visualAssetUrl ? visualAssetUrl.substring(0, 100) + "..." : "Provided Graphic Asset"}
Asset Type: ${visualAssetType || "image"}
    `;
      const aiClient2 = await getAiClient();
      if (!aiClient2) {
        throw new AiServiceError(
          "Gemini is not configured. Set GEMINI_API_KEY on the server and restart.",
          503,
          "ai_not_configured"
        );
      }
      let contentsPayload = promptText;
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
                mimeType
              }
            },
            {
              text: promptText
            }
          ]
        };
      }
      const resultText = await generateGeminiContent({
        client: aiClient2,
        contents: contentsPayload,
        systemInstruction: systemPrompt,
        temperature: 0.4
      });
      const parsed = parseJsonFromModel(resultText, {
        visualScore: 85,
        campaignGoalMatchPct: 90,
        predictedSuccessRate: 84,
        visualHookAudit: resultText || "Strong visual layout matching intended hook.",
        relevanceAnalysis: "Visual elements complement the scheduled calendar topic.",
        designTweaks: [
          "Optimize color contrast for mobile OLED screens",
          "Ensure text safe zones clear native social platform UI overlays"
        ]
      });
      parsed.analyzedAt = (/* @__PURE__ */ new Date()).toISOString();
      res.json({ success: true, analysis: parsed });
    } catch (err) {
      sendAiError(res, err);
    }
  });
  app2.use((err, _req, res, _next) => {
    console.error("[api] unhandled", err);
    if (res.headersSent) return;
    res.status(500).json({ success: false, error: err?.message || "Internal server error" });
  });
  return app2;
}

// api/vercel.ts
console.info("[api] creating Express app");
var app = createApp();
console.info("[api] Express app ready");
function handler(req, res) {
  try {
    return app(req, res);
  } catch (err) {
    console.error("[api] invocation failed", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: err?.message || "API request failed"
      });
    }
  }
}
module.exports = module.exports.default || module.exports;
