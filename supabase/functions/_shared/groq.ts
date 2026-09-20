/*
  Groq client for the PrintAir Assistant chat widget. Same fail-closed
  philosophy as _shared/paymongo.ts: no key configured means "not
  available," never a silently fabricated reply — the frontend already has
  a scripted fallback for that case (see src/components/Assistant.tsx).

  Chosen over Gemini because Gemini's free tier didn't provision on the
  Workspace-type Google account being used (quota limit 0 for a fresh
  project, likely needs billing linked to unlock free-tier allocation on
  that account type) — Groq's free tier didn't have that friction.

  Endpoint/request/response shapes verified against
  https://console.groq.com/docs/api-reference (2026-08-07) rather than
  assumed from memory.
*/

// Structured JSON output (json_schema, strict mode) is only supported by
// the gpt-oss family on Groq — llama-3.3-70b-versatile and most other
// models only support best-effort JSON Object Mode, which doesn't
// guarantee schema compliance. Verified against
// console.groq.com/docs/structured-outputs (2026-08-07).
const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

export interface AssistantReply {
  reply: string;
  cta: string | null;
  category: string | null;
}

const REPLY_JSON_SCHEMA = {
  name: "assistant_reply",
  strict: true,
  schema: {
    type: "object",
    properties: {
      reply: { type: "string" },
      cta: { type: ["string", "null"] },
      category: { type: ["string", "null"] },
    },
    required: ["reply", "cta", "category"],
    additionalProperties: false,
  },
};

export function isGroqConfigured(): boolean {
  const key = Deno.env.get("GROQ_API_KEY");
  return Boolean(key && key.trim());
}

export async function generateAssistantReply(systemInstruction: string, turns: ChatTurn[]): Promise<AssistantReply> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const messages = [
    { role: "system", content: systemInstruction },
    ...turns.map((t) => ({ role: t.role === "model" ? "assistant" : "user", content: t.text })),
  ];

  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      response_format: { type: "json_schema", json_schema: REPLY_JSON_SCHEMA },
      temperature: 0.6,
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq request failed (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Groq returned no content.");
  }

  let parsed: Partial<AssistantReply>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Groq returned malformed JSON.");
  }
  if (!parsed.reply) {
    throw new Error("Groq response missing 'reply'.");
  }

  return { reply: parsed.reply, cta: parsed.cta ?? null, category: parsed.category ?? null };
}
