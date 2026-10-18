#!/usr/bin/env node
// One-off migration: legacy portfolio JSON (docs/legacy-*.json) -> Keystatic YAML + downloaded media.
// Usage: node scripts/migrate-legacy.mjs
// Overwrites src/content/sections/*.yaml and src/content/projects/*.yaml; downloads images and video posters
// into src/assets/projects/<id>/. Videos are never downloaded (they are uploaded to YouTube by hand).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY_BASE = 'https://danielneto.vercel.app/';
const SECTIONS_DIR = path.join(ROOT, 'src/content/sections');
const PROJECTS_DIR = path.join(ROOT, 'src/content/projects');
const ASSETS_DIR = path.join(ROOT, 'src/assets/projects');
const REF_PREFIX = '../../assets/projects/';
const DOWNLOAD_CONCURRENCY = 8;

// --- minimal YAML scalar writer (plain when safe, JSON-style double quotes otherwise) ---
const PLAIN = /^[A-Za-z0-9./][A-Za-z0-9 ._/()&,?=+%@~:'-]*$/;
const RESERVED = /^(true|false|yes|no|on|off|null|y|n|~)$/i;
const NUMBERISH = /^[-+]?[\d._]+$/;
function q(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (value === '') return "''";
  const plain =
    PLAIN.test(value) &&
    !/:(\s|$)/.test(value) &&
    !/\s$/.test(value) &&
    !RESERVED.test(value) &&
    !NUMBERISH.test(value);
  return plain ? value : JSON.stringify(value);
}

const sectionYaml = (title, order) => [`title: ${q(title)}`, `order: ${q(order)}`].join('\n') + '\n';

function projectYaml(d) {
  const out = [
    `title: ${q(d.title)}`,
    `section: ${q(d.section)}`,
    `year: ${q(d.year)}`,
    'discipline:',
    `  en: ${q(d.discipline.en)}`,
    `  pt: ${q(d.discipline.pt)}`,
    `client: ${q(d.client)}`,
    `cover: ${q(d.cover)}`,
  ];
  if (d.gallery.length) {
    out.push('gallery:');
    for (const g of d.gallery) out.push(`  - image: ${q(g.image)}`, `    alt: ${q(g.alt)}`);
  } else out.push('gallery: []');
  if (d.videos.length) {
    out.push('videos:');
    for (const v of d.videos)
      out.push(
        `  - youtube: ${q(v.youtube)}`,
        `    title: ${q(v.title)}`,
        `    vertical: ${q(v.vertical)}`,
        `    poster: ${q(v.poster)}`,
      );
  } else out.push('videos: []');
  out.push(
    `credits: ${q(d.credits)}`,
    'body:',
    `  en: ${q(d.body.en)}`,
    `  pt: ${q(d.body.pt)}`,
    `featured: ${q(d.featured)}`,
    `order: ${q(d.order)}`,
  );
  return out.join('\n') + '\n';
}

// --- helpers ---
const resolveUrl = (src) =>
  /^https?:\/\//.test(src) ? src : new URL(src.replace(/^\.\//, ''), LEGACY_BASE).href;

async function pool(items, size, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

async function download(url, file) {
  if (existsSync(file)) return 'cached';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return 'downloaded';
}

// --- main ---
const projects = JSON.parse(await readFile(path.join(ROOT, 'docs/legacy-projects.json'), 'utf8'));
const sections = JSON.parse(await readFile(path.join(ROOT, 'docs/legacy-sections.json'), 'utf8'));
const byId = new Map(projects.map((p) => [p.id, p]));

const downloads = []; // { url, file }
const missingYoutube = []; // for the pt-PT upload checklist
const stats = { projects: 0, images: 0, posters: 0, videos: 0, youtube: 0 };
const placedIds = new Set();

for (const [sectionOrder, sec] of sections.entries()) {
  await writeFile(path.join(SECTIONS_DIR, `${sec.id}.yaml`), sectionYaml(sec.title, sectionOrder));

  for (const [order, pid] of sec.children.entries()) {
    const p = byId.get(pid);
    if (!p) throw new Error(`section ${sec.id} lists unknown project ${pid}`);
    placedIds.add(pid);
    const dir = path.join(ASSETS_DIR, p.id);
    const names = new Map(); // filename -> source url (guards against collisions)

    const place = (url, name) => {
      if (names.has(name) && names.get(name) !== url) throw new Error(`filename clash in ${p.id}: ${name}`);
      names.set(name, url);
      downloads.push({ url, file: path.join(dir, name) });
      return REF_PREFIX + `${p.id}/${name}`;
    };

    // Images: first = cover, rest = gallery (alt empty).
    const imageRefs = (p.images ?? []).map((img) => {
      stats.images++;
      return place(resolveUrl(img.src), path.posix.basename(img.src));
    });

    // Videos: YouTube id if present, poster downloaded (never the .mp4).
    const videos = (p.videos ?? []).map((v) => {
      stats.videos++;
      const youtube = v.youtubeId ? `https://www.youtube.com/watch?v=${v.youtubeId}` : null;
      let poster = null;
      if (v.poster) {
        stats.posters++;
        const url = resolveUrl(v.poster);
        const name = /ytimg\.com/.test(url) && v.youtubeId ? `yt-${v.youtubeId}.jpg` : path.posix.basename(v.poster);
        poster = place(url, name);
      }
      if (youtube) stats.youtube++;
      else missingYoutube.push({ project: p.id, title: p.title, label: v.label, url: resolveUrl(v.src) });
      return { youtube, title: v.label ?? '', vertical: v.h > v.w, poster };
    });

    let cover = null;
    let gallery = [];
    if (imageRefs.length) {
      cover = imageRefs[0];
      gallery = imageRefs.slice(1).map((image) => ({ image, alt: '' }));
    } else {
      const firstPoster = videos.find((v) => v.poster);
      cover = firstPoster ? firstPoster.poster : null;
    }

    const yearMatch = /\b(20\d{2})\b/.exec(p.title);
    const cs = p.caseStudy;

    const yaml = projectYaml({
      title: p.title,
      section: sec.id,
      year: yearMatch ? Number(yearMatch[1]) : null,
      discipline: { en: p.subtitle ?? '', pt: '' },
      client: p.note ?? '',
      cover,
      gallery,
      videos,
      credits: cs?.credits ?? '',
      body: { en: cs?.body?.length ? cs.body.join('\n\n') : '', pt: '' },
      featured: true,
      order,
    });
    await writeFile(path.join(PROJECTS_DIR, `${p.id}.yaml`), yaml);
    stats.projects++;
  }
}

const orphans = projects.filter((p) => !placedIds.has(p.id)).map((p) => p.id);
if (orphans.length) throw new Error(`projects not placed in any section: ${orphans.join(', ')}`);

// Download media with bounded concurrency.
let fetched = 0;
let cached = 0;
await pool(downloads, DOWNLOAD_CONCURRENCY, async (d) => {
  const r = await download(d.url, d.file);
  if (r === 'cached') cached++;
  else fetched++;
});

console.log(JSON.stringify({ ...stats, downloadsFetched: fetched, downloadsCached: cached }, null, 2));
console.log('VIDEOS_WITHOUT_YOUTUBE');
console.log(JSON.stringify(missingYoutube, null, 2));
