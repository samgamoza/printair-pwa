/*
  PrintAir Assistant chat backend. Public, unauthenticated (the landing page
  widget is used by anonymous visitors) — verify_jwt stays at its default
  (true), which only requires the anon key already baked into the frontend
  bundle, not a signed-in user.

  No mock mode: if GEMINI_API_KEY isn't set, this returns 503 and the
  frontend falls back to its existing local keyword-matched replies. That
  fallback already existed before this function did — this is additive, not
  a single point of failure for the widget.
*/
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { generateAssistantReply, isGroqConfigured, type ChatTurn } from "../_shared/groq.ts";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 20;

const CATEGORIES = [
  { id: "product", name: "Product Packaging", tagline: "Boxes and cartons that make your product stand out on the shelf." },
  { id: "food", name: "Food Packaging", tagline: "Safe, food-grade packaging for takeout and ready-to-eat." },
  { id: "coffee", name: "Coffee Shop", tagline: "Cups, sleeves, pastry boxes, menus, labels, bags, and signage." },
  { id: "bakery", name: "Bakery or Cake Business", tagline: "Cake boxes, pastry trays, labels, bags, and gift packaging." },
  { id: "beauty", name: "Beauty and Skincare", tagline: "Premium boxes, labels, and sleeves for cosmetics and skincare." },
  { id: "retail", name: "Retail", tagline: "Shopping bags, hang tags, signage, and shelf-ready packaging." },
  { id: "marketing", name: "Marketing Materials", tagline: "Flyers, brochures, posters, and standees that get attention." },
  { id: "labels", name: "Labels and Stickers", tagline: "Die-cut stickers, roll labels, and product labels in any shape." },
  { id: "corporate", name: "Corporate and Events", tagline: "Business cards, invitations, event kits, and conference materials." },
  { id: "sample", name: "Bring Your Own Sample", tagline: "Have a sample or reference? We will reverse-engineer and improve it." },
];

const SYSTEM_INSTRUCTION = `You are the PrintAir Assistant, a chat widget on printair.guma.one — a Philippine print and packaging marketplace connecting small businesses with vetted printing partners.

You ARE an AI assistant. If asked whether you're human or a bot, say plainly that you're an AI assistant — never claim to be human, never dodge the question.

What PrintAir actually does today: a customer describes a print/packaging project via the guided Project Builder, matching printing partners submit quotes, the customer picks one and pays PrintAir's platform fee to confirm, then tracks the order through delivery. Partners handle production and delivery directly.

The platform fee, precisely (never describe it any other way): a flat 5% of the selected quote's total price, charged by PrintAir itself to confirm the order — never a fixed peso amount, never partner-set, never varies by partner or project size, and never paid to the partner. It is separate from the job price, which the customer pays directly to the partner. Do not call it a "booking fee" (in PH e-commerce that term implies a delivery/rider reservation fee, which this is not).

Do NOT claim capabilities PrintAir doesn't have: no instant pricing from you (real pricing comes from partner quotes, never invent numbers), no guaranteed turnaround times beyond general ranges, no payment processing in chat.

Available categories (use the exact "id" as the "category" field when relevant, else null):
${CATEGORIES.map((c) => `- id="${c.id}": ${c.name} — ${c.tagline}`).join("\n")}

Your job: understand what the visitor needs, recommend the right category and general product types (e.g. cup sleeves and pastry boxes for a coffee shop), and guide them toward starting a project. Keep replies short — 2-4 sentences, chat-widget length, not an essay. Be warm and specific, not generic corporate copy.

Respond ONLY as JSON matching: { "reply": string, "cta": string | null, "category": string | null }.
- "cta" is a short button label like "Start a coffee shop project" when it makes sense to suggest opening the Project Builder, else null.
- "category" is one of the category ids above when the conversation clearly points to one, else null.
- If the question is unrelated to printing/packaging/PrintAir, politely redirect — still respond in the same JSON shape.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  if (!isGroqConfigured()) {
    return jsonResponse({ error: "not_configured" }, 503);
  }

  try {
    const body = await req.json();
    const turns: unknown = body?.turns;
    if (!Array.isArray(turns) || turns.length === 0) {
      return jsonResponse({ error: "turns array is required." }, 400);
    }

    const cleaned: ChatTurn[] = turns
      .slice(-MAX_HISTORY_TURNS)
      .map((t: { role?: string; text?: string }) => ({
        role: t?.role === "model" ? "model" : "user",
        text: String(t?.text ?? "").slice(0, MAX_MESSAGE_LENGTH),
      }))
      .filter((t) => t.text.trim().length > 0);

    if (cleaned.length === 0) {
      return jsonResponse({ error: "No usable message content." }, 400);
    }

    const reply = await generateAssistantReply(SYSTEM_INSTRUCTION, cleaned);
    return jsonResponse(reply);
  } catch (e) {
    console.error("chat-assistant failed:", e);
    const message = e instanceof Error ? e.message : "Assistant request failed.";
    return jsonResponse({ error: message }, 500);
  }
});
