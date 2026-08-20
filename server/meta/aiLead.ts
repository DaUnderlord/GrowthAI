export type LeadAnalysis = {
  score: number;
  classification: 'low_intent' | 'medium_intent' | 'high_intent';
  intent: string;
  sentiment: string;
  urgency: 'low' | 'medium' | 'high';
  product?: string | null;
  quantity?: number | null;
  location?: string | null;
  budget?: string | null;
  objection?: string | null;
  conversionProbability: number;
  recommendedAction: string;
  summary: string;
};

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function heuristicLeadAnalysis(text: string): LeadAnalysis {
  const t = (text || '').toLowerCase();
  let score = 20;
  let urgency: LeadAnalysis['urgency'] = 'low';
  let intent = 'enquiry';
  let classification: LeadAnalysis['classification'] = 'low_intent';

  const purchaseWords = ['buy', 'price', 'cost', 'how much', 'order', 'purchase', 'wholesale', 'quote', 'invoice', 'payment'];
  const urgentWords = ['today', 'tomorrow', 'urgent', 'asap', 'immediately', 'now'];
  const qtyMatch = t.match(/(\d+)\s*(pieces?|units?|pcs|qty|quantity)?/);

  const purchaseHits = purchaseWords.filter((w) => t.includes(w)).length;
  score += purchaseHits * 12;
  if (purchaseHits >= 2) intent = 'purchase';

  if (urgentWords.some((w) => t.includes(w))) {
    urgency = 'high';
    score += 15;
  } else if (t.includes('this week') || t.includes('soon')) {
    urgency = 'medium';
    score += 8;
  }

  let quantity: number | null = null;
  if (qtyMatch) {
    quantity = Number(qtyMatch[1]);
    if (quantity >= 10) score += 20;
    else if (quantity >= 2) score += 8;
    intent = intent === 'enquiry' ? 'bulk_interest' : intent;
  }

  if (t.includes('deliver') || t.includes('shipping') || t.includes('abuja') || t.includes('lagos')) {
    score += 10;
  }

  score = clampScore(score);
  if (score >= 75) classification = 'high_intent';
  else if (score >= 45) classification = 'medium_intent';

  const recommendedAction =
    classification === 'high_intent'
      ? 'assign_sales_manager'
      : classification === 'medium_intent'
        ? 'follow_up_with_pricing'
        : 'nurture_with_info';

  return {
    score,
    classification,
    intent,
    sentiment: t.includes('angry') || t.includes('disappointed') ? 'negative' : 'positive',
    urgency,
    product: null,
    quantity,
    location: t.includes('abuja') ? 'Abuja' : t.includes('lagos') ? 'Lagos' : null,
    budget: null,
    objection: t.includes('expensive') || t.includes('too much') ? 'price' : null,
    conversionProbability: Number((score / 100).toFixed(2)),
    recommendedAction,
    summary: `Detected ${classification.replace('_', ' ')} (${intent}), urgency ${urgency}, score ${score}.`,
  };
}

export async function analyzeLeadWithGemini(
  text: string,
  generateGrowthAI: (prompt: string, system?: string) => Promise<string>
): Promise<LeadAnalysis> {
  const fallback = heuristicLeadAnalysis(text);
  try {
    const raw = await generateGrowthAI(
      `Analyze this WhatsApp customer message and return ONLY valid JSON with keys:
score (0-100 number), classification (low_intent|medium_intent|high_intent), intent, sentiment,
urgency (low|medium|high), product, quantity (number|null), location, budget, objection,
conversionProbability (0-1), recommendedAction, summary.

Message:
"""${text}"""`,
      'You are a CRM lead-scoring engine. Respond with pure JSON only. No markdown.'
    );
    const cleaned = raw.replace(/```json|```/g, '').trim();
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
      summary: String(parsed.summary || fallback.summary),
    };
  } catch {
    return fallback;
  }
}

export async function suggestReplyWithGemini(
  params: {
    customerMessage: string;
    history?: string;
    clientName?: string;
  },
  generateGrowthAI: (prompt: string, system?: string) => Promise<string>
): Promise<string> {
  const fallback = `Thanks for your message. I'll confirm the details and get back to you shortly.`;
  try {
    const text = await generateGrowthAI(
      `Draft one short professional WhatsApp reply (max 2 sentences) for a sales rep.
Brand: ${params.clientName || 'our company'}
Latest customer message: ${params.customerMessage}
Recent context: ${params.history || 'n/a'}
Return plain text only.`,
      'You write concise WhatsApp sales replies. No emojis unless useful. No markdown.'
    );
    return (text || fallback).trim();
  } catch {
    return fallback;
  }
}
