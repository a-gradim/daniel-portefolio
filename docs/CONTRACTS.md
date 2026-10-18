# Shared contracts (read before coding)

Astro 7 + Keystatic + Vercel. Static pages, only `/keystatic` + `/api/keystatic` run server-side.
Inspiration: sub.global (draggable canvas of work + text index). Keep JS minimal: vanilla TS in `<script>` tags, no UI libraries, no GSAP/Three.

## Routes (EN at root, PT under /pt)
| Route | View |
|---|---|
| `/` , `/pt` | `src/views/HomeView.astro` — full-screen canvas |
| `/projects`, `/pt/projects` | `src/views/IndexView.astro` — text list + filters |
| `/work/[slug]`, `/pt/work/[slug]` | `src/views/ProjectView.astro` |
| `/about`, `/pt/about` | `src/views/AboutView.astro` (bio, skills, contact) |

Pages in `src/pages/**` are thin wrappers: `<XView locale="en|pt" ... />`.

## Shared modules (phase 0 — do not change signatures; add new exports if needed)
- `src/i18n/ui.ts` — `locales`, `Locale`, `useT(locale)(key)`, `localePath(locale, path)`, `switchLocalePath(pathname, to)`. Add UI keys to BOTH `en` and `pt` (European Portuguese, pt-PT: "ecrã", "contacto", "telemóvel").
- `src/lib/content.ts` — `getProjects()`, `getSections()`, `getSettings()`, `pick(i18nField, locale)`, `projectImages(project)`, `youtubeId(url)`.
- `src/styles/tokens.css` — all colors/spacing/type/easing. Use ONLY these CSS vars. Both themes (`data-theme="dark"` / `"light"`) must look right.
- `src/layouts/Base.astro` — owned by A3. Keeps the inline theme bootstrap script.

## Component contracts
- **Canvas (A2)**: `src/components/canvas/Canvas.astro`
  `Props { projects: Project[]; locale: Locale }`. Renders every image from `projectImages(p)` of featured projects, each tile links to `localePath(locale, '/work/' + p.id)`. Fills its parent (parent gives it size). Uses `astro:assets` `<Image>` with small widths (≤ 640).
- **Corner toggles (A3)**: `src/components/ui/Toggles.astro` — fixed in one corner (bottom-right), language EN/PT + theme dark/light. Theme persisted in `localStorage.theme`.
- **SEO (A4)**: `src/components/seo/Seo.astro` `Props { title: string; description?: string; image?: ImageMetadata; locale: Locale }` — put inside `<head>` by Base. Emits OG/Twitter tags, canonical, hreflang alternates en/pt.

## Content (A1)
- YAML files written by Keystatic: `src/content/projects/<slug>.yaml`, `src/content/sections/<slug>.yaml`, `src/content/settings/site.yaml`.
- Images: `src/assets/projects/<slug>/<file>`; referenced from YAML as `../../assets/projects/<slug>/<file>`.
- Videos: YouTube URLs only (no video files in git).

## Rules
- Mobile first. Touch targets ≥ 44px. No scroll-jacking outside the canvas. Respect `prefers-reduced-motion`.
- `npm run build` must pass before you finish. Commit on your branch with clear messages. Never touch files owned by another agent.
