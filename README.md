# Daniel Neto: portfolio

Personal portfolio site. A full-screen canvas of work plus a text index, bilingual (English and European Portuguese), with content edited through Keystatic.

## Stack

- **Astro 7**: static pages. Only `/keystatic` and its API run on the server.
- **Keystatic**: CMS. Content lives in YAML files and images in the repository.
- **Vercel**: hosting, via the Astro adapter.
- Vanilla TypeScript in `<script>` tags. No UI libraries.

## Scripts

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at http://localhost:4321 (Keystatic at `/keystatic`, local storage) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Type-check with `astro check` |

## Structure

```
src/
  components/seo/   SEO head tags (Seo.astro)
  content/          YAML content: projects, sections, settings (written by Keystatic)
  assets/projects/  Project images
  i18n/ui.ts        UI strings and locale helpers (EN at /, PT under /pt)
  views/            Page views
  pages/            Thin route wrappers
  styles/tokens.css Design tokens (both themes)
public/             robots.txt, favicon.svg
docs/               Guides and shared contracts
```

## Documentation

- [Guide for Daniel](docs/GUIA-DANIEL.md) (pt-PT): adding and editing projects.
- [Deployment](docs/DEPLOY.md): one-time Vercel and Keystatic GitHub setup.
- [Shared contracts](docs/CONTRACTS.md): routes, modules and component interfaces.

## CI

GitHub Actions (`.github/workflows/build.yml`) runs `npm ci` and `npm run build` on every pull request and on pushes to `main`.
