import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Send, ArrowRight } from 'lucide-react';
import { InkLoader, PlaneGlyph } from '@/components/ui/Marks';
import { supabase } from '@/lib/api/client';

type Msg = { role: 'user' | 'ai'; text: string; cta?: string; ctaCategory?: string };

const QUICK_PROMPTS = [
  "I'm opening a coffee shop — where do I start?",
  'What packaging is best for a bakery?',
  'How fast can I get labels printed?',
  'I already have a sample — can you match it?',
];

const ASSISTANT_REPLIES: { match: RegExp; reply: string; cta?: string; category?: string }[] = [
  {
    match: /coffee|cafe|caf\u00e9/i,
    reply:
      'Great choice! For a coffee shop, most owners start with cup sleeves, pastry boxes, and takeaway bags. I can open the Project Builder preset to Coffee Shop so you just pick what you want to begin with.',
    cta: 'Start a coffee shop project',
    category: 'coffee',
  },
  {
    match: /bakery|cake|pastry/i,
    reply:
      'Bakeries usually need cake boxes, pastry trays, and ingredient labels first. Our Project Builder has a dedicated Bakery path that recommends exactly those. Shall I open it for you?',
    cta: 'Start a bakery project',
    category: 'bakery',
  },
  {
    match: /label|sticker/i,
    reply:
      'Labels and stickers are one of the fastest products we produce. Roll labels are best for machine application; die-cut stickers are great for branding. I can open the Project Builder on Labels & Stickers \u2014 want to?',
    cta: 'Start a labels project',
    category: 'labels',
  },
  {
    match: /fast|rush|asap|quick|timeline/i,
    reply:
      'Digital printing can turn around labels and cards in as little as 2\u20133 days. Packaging usually takes 2\u20133 weeks. When you start a project, pick the rush timeline and we fast-track it.',
    cta: 'Start a project',
  },
  {
    match: /sample|match|reference|copy/i,
    reply:
      'Absolutely \u2014 bring your sample and we\u2019ll reverse-engineer and often improve it. Choose "Bring Your Own Sample" in the Project Builder and describe what you have.',
    cta: 'Start with a sample',
    category: 'sample',
  },
  {
    match: /beauty|cosmetic|skincare|skin/i,
    reply:
      'For beauty and skincare, premium product boxes and waterproof labels are the usual starting point. Our Beauty path recommends those plus box sleeves for an elevated unboxing feel.',
    cta: 'Start a beauty project',
    category: 'beauty',
  },
  {
    match: /price|cost|quote|how much|expensive/i,
    reply:
      'Pricing depends on quantity, material, and finish \u2014 but you never need to figure that out alone. Start a project and we\u2019ll send a clear, jargon-free plan with pricing.',
    cta: 'Start a project',
  },
];

const FALLBACK =
  'I can help you start a printing or packaging project, recommend materials, or answer questions about PrintAir. The easiest next step is to open the Project Builder \u2014 it guides you visually, no printing knowledge needed. Want me to open it?';

const GREETING =
  "Hi! I\u2019m your PrintAir assistant. I can help you figure out what to print, recommend materials, or start a project. What are you working on?";

// Proactive suggestions based on scroll position
const SECTION_SUGGESTIONS: { id: string; text: string; cta: string; category?: string }[] = [
  {
    id: 'builder',
    text: 'I noticed you\u2019re browsing the Project Builder. Would you like me to start one for you? Just tell me what you\u2019re making.',
    cta: 'Start a project',
  },
  {
    id: 'inspiration',
    text: 'See a success story you like? I can start a project in the same direction \u2014 just tell me which one caught your eye.',
    cta: 'Start a project',
  },
  {
    id: 'partners',
    text: 'Wondering which partner is right for your project? Start a project and we\u2019ll match you automatically \u2014 no need to choose.',
    cta: 'Start a project',
  },
  {
    id: 'providers',
    text: 'Are you a printing business? I can open the partner application for you \u2014 it takes under 2 minutes.',
    cta: 'Apply as a partner',
  },
];

type AssistantProps = {
  onOpenBuilder: (categoryId?: string) => void;
  onOpenProvider?: () => void;
};

export function Assistant({ onOpenBuilder, onOpenProvider }: AssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'ai', text: GREETING }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [unread, setUnread] = useState(false);
  const [proactiveText, setProactiveText] = useState<string | null>(null);
  const [proactiveCta, setProactiveCta] = useState<string | null>(null);
  const [proactiveCategory, setProactiveCategory] = useState<string | undefined>(undefined);
  const [proactiveIsProvider, setProactiveIsProvider] = useState(false);
  const [lastProactiveSection, setLastProactiveSection] = useState<string | null>(null);
  // Starts honest (unclaimed) — only flips true after a real LLM reply
  // succeeds, never optimistically. See generateReply() below.
  const [poweredByAi, setPoweredByAi] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking, open]);

  useEffect(() => {
    if (open) {
      setPulse(false);
      setUnread(false);
    }
  }, [open]);

  // Auto-suggest after 5 seconds of no interaction (if not opened)
  useEffect(() => {
    if (open || unread) return;
    const t = setTimeout(() => setUnread(true), 5000);
    return () => clearTimeout(t);
  }, [open, unread]);

  // Proactive contextual suggestions based on scroll section
  useEffect(() => {
    if (open) return; // don't override active conversation
    const sections = SECTION_SUGGESTIONS.map((s) => ({
      ...s,
      el: document.getElementById(s.id),
    }));
    const handleScroll = () => {
      for (const s of sections) {
        if (!s.el) continue;
        const rect = s.el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.4 && rect.bottom > window.innerHeight * 0.3) {
          if (lastProactiveSection !== s.id) {
            setLastProactiveSection(s.id);
            setProactiveText(s.text);
            setProactiveCta(s.cta);
            setProactiveCategory(s.category);
            setProactiveIsProvider(s.cta.includes('partner') || s.cta.includes('Apply'));
            setUnread(true);
          }
          return;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [open, lastProactiveSection]);

  const generateReplyScripted = (text: string): { reply: string; cta?: string; category?: string } => {
    for (const r of ASSISTANT_REPLIES) {
      if (r.match.test(text)) {
        return { reply: r.reply, cta: r.cta, category: r.category };
      }
    }
    return { reply: FALLBACK, cta: 'Start a project' };
  };

  /**
   * Tries the real LLM backend (chat-assistant Edge Function) first; falls
   * back to the scripted keyword replies above on any failure — missing
   * GEMINI_API_KEY, network error, rate limit, malformed response. The
   * widget must never appear broken just because the LLM path had a bad
   * moment. `poweredByAi` only ever flips true after a real LLM reply
   * succeeds — it starts honest (unclaimed) rather than optimistic.
   */
  const generateReply = async (
    text: string,
    history: Msg[],
  ): Promise<{ reply: string; cta?: string; category?: string }> => {
    try {
      const turns = [...history, { role: 'user' as const, text }]
        .slice(-20)
        .map((m) => ({ role: m.role === 'ai' ? 'model' : 'user', text: m.text }));
      const { data, error } = await supabase.functions.invoke('chat-assistant', { body: { turns } });
      if (error) throw error;
      if (!data?.reply) throw new Error('Assistant returned no reply.');
      setPoweredByAi(true);
      return { reply: data.reply, cta: data.cta ?? undefined, category: data.category ?? undefined };
    } catch {
      return generateReplyScripted(text);
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const history = messages;
    setMessages((m) => [...m, { role: 'user', text: trimmed }]);
    setInput('');
    setThinking(true);
    setProactiveText(null);
    setProactiveCta(null);
    const { reply, cta, category } = await generateReply(trimmed, history);
    setMessages((m) => [...m, { role: 'ai', text: reply, cta, ctaCategory: category }]);
    setThinking(false);
  };

  const handleProactiveCta = () => {
    if (proactiveIsProvider && onOpenProvider) {
      onOpenProvider();
    } else {
      onOpenBuilder(proactiveCategory);
    }
    setOpen(false);
  };

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-[calc(var(--sab)+1.25rem)] right-5 z-[90] flex h-16 w-16 items-center justify-center rounded-full bg-ink-950 text-white shadow-lift transition-transform duration-300 hover:scale-105 active:scale-95 sm:right-7"
        aria-label={open ? 'Close PrintAir assistant' : 'Open PrintAir assistant'}
      >
        {pulse && !open && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-magenta-400/60" aria-hidden="true" />}
        {unread && !open && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-sun-400 text-[0.65rem] font-extrabold text-ink-950 ring-[3px] ring-paper-200">
            1
          </span>
        )}
        <span className="relative transition-transform duration-300" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
          {open ? <X className="h-7 w-7" /> : <Sparkles className="h-7 w-7 text-sun-300" />}
        </span>
      </button>

      {/* Panel */}
      <div
        className={`fixed bottom-[calc(var(--sab)+6rem)] right-3 z-[90] w-[calc(100vw-1.5rem)] max-w-sm origin-bottom-right transition-all duration-300 sm:right-7 ${
          open ? 'scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0'
        }`}
        role="dialog"
        aria-label="PrintAir assistant"
        aria-hidden={!open}
        // Closed, the panel is only faded out, so without this its buttons stay reachable by keyboard.
        {...(open ? {} : ({ inert: '' } as Record<string, string>))}
      >
        <div className="overflow-hidden rounded-4xl bg-white shadow-lift ring-1 ring-ink-900/10">
          {/* Header */}
          <div className="relative flex items-center gap-3 overflow-hidden bg-ink-950 p-4 text-white">
            <span className="pointer-events-none absolute -right-6 -top-8 h-28 w-40 bg-halftone bg-dots text-white/15" aria-hidden="true" />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff]">
              <PlaneGlyph className="h-7 w-7" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-leaf-400 ring-[3px] ring-ink-950" />
            </span>
            <div className="relative flex-1">
              <p className="font-display text-lg font-bold leading-tight">PrintAir Assistant</p>
              <p className="text-sm text-white/60">{poweredByAi ? 'AI-powered printing guide' : 'Your printing guide'}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="no-scrollbar max-h-[44dvh] min-h-[220px] space-y-3 overflow-y-auto bg-paper-200 p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex animate-fade-up ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${m.role === 'user' ? '' : 'space-y-2'}`}>
                  <div
                    className={`rounded-3xl px-4 py-2.5 leading-relaxed ${
                      m.role === 'user' ? 'rounded-tr-md bg-ink-950 text-white' : 'rounded-tl-md bg-white text-ink-900 shadow-soft'
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.cta && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenBuilder(m.ctaCategory);
                        setOpen(false);
                      }}
                      className="group inline-flex min-h-10 items-center gap-2 rounded-full bg-magenta-500 px-4 text-sm font-bold text-white transition-colors hover:bg-magenta-600"
                    >
                      {m.cta}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Proactive suggestion bubble */}
            {proactiveText && !thinking && messages.length <= 1 && (
              <div className="flex animate-fade-up justify-start">
                <div className="max-w-[85%] space-y-2">
                  <div className="rounded-3xl rounded-tl-md bg-sun-100 px-4 py-2.5 leading-relaxed text-ink-900 ring-1 ring-sun-300">{proactiveText}</div>
                  {proactiveCta && (
                    <button
                      type="button"
                      onClick={handleProactiveCta}
                      className="group inline-flex min-h-10 items-center gap-2 rounded-full bg-ink-950 px-4 text-sm font-bold text-white transition-colors hover:bg-ink-800"
                    >
                      {proactiveCta}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {thinking && (
              <div className="flex animate-fade-in justify-start">
                <div className="rounded-3xl rounded-tl-md bg-white px-4 py-3.5 shadow-soft">
                  <InkLoader label="Thinking" className="[&>span]:h-2 [&>span]:w-2" />
                </div>
              </div>
            )}
          </div>

          {/* Quick prompts (only before first user message) */}
          {messages.length <= 1 && !thinking && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-ink-100 bg-paper-200 px-4 pb-3 pt-3">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="min-h-10 shrink-0 rounded-full bg-white px-4 text-sm font-bold text-ink-700 ring-1 ring-ink-900/10 transition-colors hover:text-ink-950 hover:ring-ink-900"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-ink-100 bg-white p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send(input);
              }}
              placeholder="Ask anything…"
              aria-label="Message the assistant"
              className="min-h-12 flex-1 rounded-full bg-ink-100 px-5 text-ink-900 outline-none placeholder:text-ink-400 focus:ring-2 focus:ring-ink-900"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || thinking}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-magenta-500 text-white transition-all hover:bg-magenta-600 active:scale-95 disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
