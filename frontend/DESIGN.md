# LARE Platform — DESIGN.md (Brand Contract)

The single source of truth for the platform's look and feel. Every screen reads
from this contract (pattern adopted from **Open Design**). Anti-slop rules from
**Hallmark**; concrete color/type/motion/a11y rules from **UI-UX Pro Max**.

> Rule 0: **No AI-slop.** No purple→pink gradients on white/dark, no Inter/Roboto/
> Arial/system-font defaults, no emoji used as UI icons, no cookie-cutter
> center-hero + 3-cards clone. Different pages get differently-shaped layouts.

---

## 1. Brand

- **Company:** LARE IT Cloud Solutions — *"Elevating Ideas. Empowering Futures."*
- **Product:** one platform, two experiences — **LARE LMS** (learn, gamified) and
  **LARE Drive** (assess & recruit, focused/serious).
- **Personality:** trustworthy + energetic. Education that feels like progress,
  assessment that feels fair and calm. Confident, not childish.

## 2. Color System

Industry = ed-tech + hiring. Deliberately **not** the cliché AI palette. Deep
"LARE ink" blue for trust, a warm **amber** for gamification/energy (XP, streaks,
achievements), fresh **teal** for success/growth.

| Token | Hex | Use |
|-------|-----|-----|
| `ink-950` | `#0B1B33` | App background (dark), deepest text |
| `ink-900` | `#13294B` | LARE primary / headers |
| `ink-700` | `#1E3A66` | Primary hover, nav |
| `brand-500` | `#2563EB` | Primary action (blue) |
| `brand-400` | `#3B82F6` | Focus ring, links |
| `amber-500` | `#F59E0B` | XP / gamification / streaks |
| `amber-400` | `#FBBF24` | Badge highlights |
| `teal-500` | `#0D9488` | Success / growth / "ready" |
| `rose-500` | `#E11D48` | Error / danger / integrity flags |
| `slate-50…900` | Tailwind slate | Neutrals, surfaces, borders |

- **Light mode** default for LMS/learning; **dark ink** for exam/proctoring focus.
- **Contrast:** body text ≥ 4.5:1, large text ≥ 3:1. Never amber text on white.
- Gamification color (amber) is an **accent**, never the primary chrome.

## 3. Typography

Google Fonts, distinctive (not defaults):
- **Display / headings:** `Space Grotesk` (geometric, modern, memorable).
- **Body / UI:** `Plus Jakarta Sans` (clean, humanist — not Inter).
- **Code / mono:** `JetBrains Mono` (exam coding IDE, scores, data).

Scale (fluid): 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 / 60. Headings tight
tracking (`-0.02em`), body normal. Line-height 1.5 body, 1.1–1.2 display.

## 4. Layout & Shape

- **Radii:** `sm 8px`, `md 12px`, `lg 16px`, `xl 24px`, `full`. Cards use `lg`.
- **Spacing:** 4px base grid (Tailwind scale).
- **Elevation:** soft, layered shadows (`shadow-sm/md/lg`), never harsh. Dark mode
  uses subtle inner borders (`border-white/10`) instead of heavy shadow.
- **Breakpoints (hard requirement):** `375` (mobile), `768` (tablet),
  `1024` (laptop), `1440` (desktop). Test all four.
- **Layout variety:** landing = editorial split hero; auth = focused single panel
  with brand rail; dashboards = sidebar + content grid; exam = distraction-free
  full-bleed. Do **not** reuse one template recolored.

## 5. Motion

- Transitions **150–300ms**, `ease-out` for enter, `ease-in` for exit.
- Micro-interactions: button press, XP fill, badge pop, streak flame. Tasteful,
  purposeful — never gratuitous.
- **Respect `prefers-reduced-motion`**: disable non-essential animation.
- Gamified surfaces (level-up, badge earned) may use a short spring/confetti
  moment; the rest of the app stays calm.

## 6. Iconography

- **SVG icons only** (`lucide-react`). No emoji as functional icons.
- Consistent stroke width (1.75), size steps 16/20/24.
- Gamification illustrations allowed but consistent and on-brand.

## 7. Accessibility (non-negotiable)

- Visible **focus states** for keyboard nav (`focus-visible` ring in `brand-400`).
- `cursor-pointer` on every clickable element.
- All interactive controls have accessible names; forms have labels + error text.
- Color is never the only signal (pair with icon/text).
- Target size ≥ 40px on touch.

## 8. Components (design-system primitives)

`Button` (primary/secondary/ghost/danger, sizes) · `Card` · `Input`/`Field` ·
`Badge` · `Avatar` · `XPBar` · `StatTile` · `StreakFlame` · `Toast` · `Modal` ·
`Table` · `Tabs` · `EmptyState`. All read tokens from Tailwind config — no ad-hoc
hex in components.

## 9. Pre-delivery checklist (Hallmark-style gates, applied every screen)

- [ ] No default fonts / no purple-pink gradient / no emoji icons
- [ ] Layout shape is distinct from other pages (not a recolored clone)
- [ ] Contrast passes (≥ 4.5:1 body)
- [ ] Focus-visible on all interactive elements; keyboard nav works
- [ ] Responsive at 375 / 768 / 1024 / 1440
- [ ] Motion 150–300ms; reduced-motion respected
- [ ] Amber used only as accent, blue as primary chrome
- [ ] Empty/loading/error states designed, not blank
