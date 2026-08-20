const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

export type SendTextResult = {
  messageId: string;
  raw: unknown;
};

export async function sendWhatsAppText(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}): Promise<SendTextResult> {
  const to = params.to.replace(/\D/g, '');
  const res = await fetch(`${GRAPH_BASE}/${params.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: params.text },
    }),
  });

  const raw = await res.json();
  if (!res.ok) {
    const msg =
      (raw as any)?.error?.message ||
      `WhatsApp send failed with status ${res.status}`;
    throw new Error(msg);
  }

  const messageId = (raw as any)?.messages?.[0]?.id;
  if (!messageId) throw new Error('WhatsApp API returned no message id.');
  return { messageId, raw };
}

export async function markWhatsAppMessageRead(params: {
  phoneNumberId: string;
  accessToken: string;
  messageId: string;
}): Promise<void> {
  await fetch(`${GRAPH_BASE}/${params.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: params.messageId,
    }),
  });
}
