# PrintAir "Process" design system

The PWA looks nothing like the original site, but does exactly what it does. This file is the contract that keeps those two statements true.

## The idea

A print marketplace, dressed in the four inks a press runs: **cyan, magenta, yellow, key (black)**. Neutrals are `ink`; surfaces are `paper`. Two overprints get names because they are used alone: `grape` (cyan over magenta) and `leaf` (cyan over yellow). Decoration comes from the pressroom: halftone dot fields, registration marks, the colour control strip, crop marks. Headlines are Bricolage Grotesque (bold, slightly condensed); everything else is Figtree.

**The logo is not part of that palette, on purpose.** It is PrintAir's own navy-and-orange paper plane, used exactly as supplied (`brand/printair-mark-source.png` → `public/logo-mark.png` via `npm run icons`). Don't redraw, recolour or crop it. Its body is navy, so it always sits on a white tile (`LogoMark`), including on the ink side rail. "Air" in the wordmark takes the logo's orange; orange is used nowhere else in the interface.

Tone: friendly, confident, plain-spoken. Big type, big touch targets, lots of colour in tiles and badges, black for primary actions, magenta for "create" and for the moments that matter.

## Skins: Process and Classic

The owner likes two things: this app's layout and flow, and the original website's calm, Airbnb-like look (warm paper, ember orange, Fraunces serif headlines, Plus Jakarta Sans). So the look is a **skin**, separate from the layout:

- Four palettes (`ink`, `paper`, `magenta`, `cyan`) and the two font families are CSS variables (`tailwind.config.js`). With no class you get **Process**. Inside a `.classic` wrapper the same class names resolve to the website's values: `magenta-*` becomes ember, `cyan-*` becomes teal, `ink` and `paper` turn warm, `font-display` becomes Fraunces and `font-sans` Plus Jakarta Sans.
- `src/styles/classic.css` holds what variables can't: the ember gradient button with its glow (keyed on `data-variant`, which `Button` sets), hairline inputs, white hairline option cards instead of coloured tiles (`data-option`, `data-option-icon`, `data-option-sub`, `data-option-tick`), ember progress segments (`data-progress-done` / `-todo`), warm sheet background (`data-sheet`), and hiding the press-room ornaments (`data-ornament`, halftones).
- `src/lib/look.ts` decides where it applies. `mixed` (default): Classic on the guided flows — `AuthModal` (sign-up, partner and designer onboarding) and `ProjectBuilder` — via `<Sheet skin={useFlowSkin()}>`; Process everywhere else. `process`: Process everywhere. `classic`: `.classic` on `<html>`, Classic everywhere. The switch is in the demo's yellow button only.
- To put another flow in Classic, pass `skin={useFlowSkin()}` to its `Sheet` (or wrap the page in a `div` with that class). Write components with the normal tokens; never hard-code ember or Fraunces. Mark new option cards and ornaments with the data attributes above so both skins stay right.
- The wordmark keeps its own face in every skin (`data-wordmark`); the logo artwork is never touched.

When the owner settles on one look, make it the default in `look.ts` and remove the switch.

## Non-negotiables

1. **Logic is frozen.** State, effects, handlers, API calls, validation, routes, status values and the order things happen in are carried over from the original unchanged. Only JSX, class names and presentational structure change. Keep the original's explanatory comments where the code they describe survives.
2. **Every feature stays.** Every field, button, state (loading / empty / error / not-found), conditional branch and piece of helper copy in the original file must still exist afterwards. `docs/FEATURE-INVENTORY.md` is the checklist.
3. **No browser dialogs.** `confirm()` becomes `await confirm({...})` and `prompt()` becomes `await askReason({...})`, both from `useDialogs()`. Control flow stays identical: `if (!(await confirm(...))) return;`. `askReason` resolves to the trimmed text or `null`.
4. **Phone first.** Design at 390px wide, then make sure 1280px looks deliberate. Touch targets at least 44px. Body text is `text-base` or `text-sm`; never build a screen out of `text-xs`.
5. **Use the kit.** Don't hand-roll a button, input, card, badge, loader, empty state or error box. If something is missing, build it from the tokens below and keep it local to the file.
6. **Old tokens are gone.** `ember-*`, `teal-*`, `paper-400+`, `success-*`, `error-*`, `warning-*`, `amber-*`, `shadow-glow`, `glass`, `animate-slide-up`, `animate-scale-in`, `h-4.5` and friends do not exist any more. Nor do `@/components/Modal`'s `maxWidth` prop or lucide's `Loader2` spinner pattern — use `loading` on `Button`, or `InkLoader`.
7. **Pages don't wrap themselves in a shell.** Role layouts (`CustomerLayout`, `PartnerLayout`, `DesignerLayout`, `AdminLayout`) render `AppShell` once with an `<Outlet />`. Public pages wrap in `PublicShell`.

## Tokens (Tailwind)

| Family | Use |
|---|---|
| `ink-50…950` | Text and neutrals. `ink-950` headings and primary buttons, `ink-600` body-secondary, `ink-500` captions, `ink-400` disabled/meta, `ink-100`/`ink-50` fills. |
| `paper-200` | App background. Cards are plain `bg-white`. |
| `magenta-*` | Create actions, "new" markers, counts, links that matter (`text-magenta-700`). |
| `cyan-*` | Information, "selected/confirmed" states, focus ring. |
| `sun-*` | Attention: things waiting on the person, active tab, highlights. |
| `grape-*` | In-progress states, designer-side accents. |
| `leaf-*` | Success, delivered, approved. |
| `danger-*` | Destructive actions and errors. |

Radii: cards `rounded-3xl`, big tiles/sheets `rounded-4xl`, controls `rounded-2xl`, buttons and chips `rounded-full`.
Shadows: `shadow-soft` (resting card), `shadow-card` (hover), `shadow-lift` (sheets), `shadow-magenta` (the create button).
Type: `h1`–`h4` are already the display face. For display type elsewhere use `font-display font-bold`. Page titles `text-3xl sm:text-4xl`, card titles `text-lg`/`text-xl`, big numbers `font-display text-2xl font-extrabold`.
Helpers: `.slug` (tiny uppercase section label), `.control` (any input), `.skeleton`, `.no-scrollbar`, `.pb-safe`/`.pt-safe`, `bg-halftone bg-dots text-{colour}` (dot field; colour comes from the text colour).
Animations: `animate-fade-up`, `animate-fade-in`, `animate-pop-in`, `animate-pulse-ring`, `animate-float`.

## The kit (`src/components/ui`)

| Import | What it gives you |
|---|---|
| `Button`, `ButtonLink`, `IconButton` from `ui/Button` | Variants `primary` (ink), `accent` (magenta), `secondary`, `outline`, `ghost`, `danger`, `light`. Sizes `sm`/`md`/`lg`. Props `icon`, `iconRight`, `fullWidth`, `loading`, `disabled`. |
| `Sheet` from `ui/Sheet` | Every overlay. Bottom sheet on phones, dialog on desktop. `size` sm/md/lg/xl, `full` for whole-screen flows, `footer` for a pinned action bar, `labelledBy`. |
| `useDialogs()` from `ui/dialogs` | `confirm({title, body, confirmLabel, cancelLabel, tone})`, `askReason({title, body, label, placeholder, confirmLabel, tone})`, `toast(message, 'success'|'error'|'info')`. |
| `TextField`, `TextAreaField`, `SelectField`, `Field`, `Chip`, `Segmented`, `Switch` from `ui/Field` | All `onChange` handlers take the **string value**, not an event. `Field` wraps a custom control with label/hint/error and an optional `action` opposite the label. |
| `Dropzone` from `ui/Dropzone` | Tap-or-drop picker: `onFiles(FileList|null)`, `accept`, `multiple`, `title`, `hint`, `busy`. Validation stays in the caller. |
| `Card`, `LinkCard`, `CardTitle`, `KeyValueList`, `Chevron` from `ui/Card` | `Card tone` plain/cyan/magenta/sun/grape/leaf/ink/danger. `KeyValueList rows=[{label, value}]` skips empty values. |
| `PageHeader`, `FilterTabs`, `Badge`, `Stars`, `StarInput`, `Avatar`, `FileRow`, `Stat` from `ui/bits` | `PageHeader {title, subtitle, back:{to,label}, action, badge}`. `FileRow {name, size|meta, onDownload, onRemove, busy}`. `Avatar {name, square}` draws initials on an ink. |
| `PageLoader`, `SkeletonList`, `EmptyState`, `ErrorState`, `Banner`, `FormError` from `ui/states` | `EmptyState {icon, title, body, action, tone}`. `ErrorState {title, message, onRetry}`. `FormError` renders nothing when empty. |
| `Timeline` from `ui/Timeline` | Used through `OrderTimeline` / `DesignOrderTimeline`. |
| `Logo`, `LogoMark`, `PlaneGlyph`, `InkLoader`, `ColorBar`, `RegistrationMark`, `CropMarks`, `Halftone` from `ui/Marks` | The supplied logo (`PlaneGlyph` is the bare mark, `LogoMark` puts it on its white tile, `Logo` adds the wordmark) and the press ornaments. |
| Status badges from `components/dashboard/StatusBadge` | `ProjectStatusBadge`, `OrderStatusBadge`, `QuoteStatusBadge`, `OpportunityStatusBadge`, `DesignRequestStatusBadge`, `DesignOrderStatusBadge`, `DesignProposalStatusBadge`, `DesignOpportunityStatusBadge`, `AccountStatusBadge`. |
| `formatDate`, `formatDateTime`, `formatBytes`, `peso` from `lib/format`; `formatPHP` from `lib/pricing` | `peso()` for list prices, `formatPHP()` (with centavos) for amounts being charged. |

## Patterns

- **List page:** `PageHeader` → `FilterTabs` (if any) → `SkeletonList` while loading / `ErrorState` with retry / `EmptyState` / a grid of `LinkCard`s. Each card: `.slug` category line, title, status badge, then a tinted "what happens next" strip (`bg-sun-100` when it's waiting on the person, `bg-ink-50` otherwise).
- **Detail page:** `PageHeader` with `back` and the status `badge`. Two columns from `lg` (`lg:grid-cols-[1.35fr_1fr]`). Whatever needs the person's action goes first, the brief it refers to underneath, reference info (timeline, counterpart card, history) in the side column.
- **Money moments** (platform fee): `Card tone="ink"` with the amount in `font-display text-5xl font-extrabold` and an `accent` button.
- **Forms:** `space-y-5`, labels via the kit, one `FormError` directly above the actions, primary action `accent` when it sends something to other people, `primary` otherwise.
- **Destructive actions:** `variant="danger"` plus a `confirm({tone: 'danger'})`.
- **Questions and notes from other people** read as chat bubbles: theirs `bg-ink-100 rounded-3xl rounded-tl-md`, yours `bg-ink-950 text-white rounded-3xl rounded-tr-md`.
- **Reference implementations:** `pages/customer/ProjectsListPage.tsx` (list), `pages/customer/ProjectDetailPage.tsx` (detail), `components/ProjectBuilder.tsx` (multi-step flow), `components/DesignRequestBuilder.tsx` (single form in a sheet), `pages/customer/CustomerLayout.tsx` (role layout).

## Checks

```bash
npm run typecheck   # must be clean
npm run lint        # no errors
npm test            # 76 unit tests
npm run build
```

## Pip, voice and dark mode (added 2026-09-20)

- **Pip** — `src/delight/Mascot.tsx`. Moods: `fly`, `carry`, `cheer`, `nap`, `oops`. Drawn in code in the logo's navy and orange, but it is not the logo and never replaces it. Sizes: `h-20 w-20` beside text, `h-24 w-24` alone. Where Pip may appear is listed in `AGENT-HANDOFF.md` §6a.
- **Voice** — `useSay()` returns `(english, taglish) => string`. Write the English first; add Taglish only where a smile costs nothing.
- **Dark mode** — every palette, including `white`, is a CSS variable, and `.dark` on `<html>` swaps in the `DARK` set from `tailwind.config.js`. Scales are flipped, so `bg-white` becomes the dark surface and `text-ink-950` becomes near-white: existing screens work without `dark:` classes. Use a literal (`bg-[#fff]`, `text-[#fff]`) only when a colour must not flip. Labelled Beta until it has had a real-device pass.
- **Effects** — `src/delight/effects.ts`. Confetti uses the Web Animations API (no library), sounds are synthesised (no audio files), both are skipped for reduced motion or when the device switch is off.
