# For agents working in this repo

Start with **[docs/AGENT-HANDOFF.md](docs/AGENT-HANDOFF.md)** — what this is, the rules, the map, how to verify, what is open. Then `README.md` and `docs/DESIGN-SYSTEM.md`.

The rules that matter most:

- This is the PrintAir **PWA front end only**. The backend (Supabase migrations, RLS, RPCs, edge functions, PayMongo) lives in the separate website repo and is never changed from here. Never touch `D:\All Apps\Printair`.
- `src/lib/**` and `src/contexts/**` are carried over from the website and are **frozen**; only screens and presentation are ours. Every original feature must survive (`docs/FEATURE-INVENTORY.md`).
- Use the kit in `src/components/ui`; no browser `confirm` / `prompt` / `alert`; phone-first.
- The logo is the owner's artwork, used as-is.
- Never cache Supabase or PayMongo responses; keep `lucide-react` pre-bundled.
- `npm run check` must pass, and `npm run demo` must still click through, before every commit. Never commit `.env*` except `.env.example`.
