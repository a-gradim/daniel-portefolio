// Deterministic scatter layout, computed at build time. Pure: same input -> same output (SSR-stable).

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], seed: number) {
  const r = rng(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface Placed { x: number; y: number; w: number; h: number }

const GAP = 40; // minimum whitespace between two tiles
const MARGIN = 80; // whitespace between tiles and the field border
const DENSITY = 3.2; // field area / total tile area (3-4x)
const RATIO = 1.55; // field width / height

/** Distance between two axis-aligned rectangles (0 when they touch or overlap). */
const dist = (a: Placed, b: Placed) =>
  Math.hypot(
    Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w)),
    Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h)),
  );

/**
 * aspects = height/width per tile. Returns a finite, organic scatter: varied widths (~140-380px),
 * no overlaps, blue-noise spacing (best-candidate sampling), field area ~3.2x the tile area.
 */
export function layoutScatter(aspects: number[], seed = 11) {
  const r = rng(seed);
  const sizes = aspects.map((asp) => {
    const ratio = Math.min(1.8, Math.max(0.55, asp || 1));
    const portrait = ratio > 1.1;
    const lo = 140;
    const hi = ratio > 1.5 ? 250 : portrait ? 300 : 380;
    const w = Math.round(lo + (hi - lo) * Math.pow(r(), 1.25));
    return { w, h: Math.round(w * ratio) };
  });
  const area = sizes.reduce((s, z) => s + z.w * z.h, 0);
  let fieldArea = area * DENSITY;
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b].w * sizes[b].h - sizes[a].w * sizes[a].h);

  for (let attempt = 0; attempt < 12; attempt++, fieldArea *= 1.08) {
    const H = Math.round(Math.sqrt(fieldArea / RATIO));
    const W = Math.round(H * RATIO);
    const placed: Placed[] = [];
    const out: Placed[] = new Array(sizes.length);
    let ok = true;
    for (const i of order) {
      const { w, h } = sizes[i];
      let best: Placed | null = null;
      let bestScore = -1;
      for (let k = 0; k < 40; k++) {
        const c: Placed = {
          x: Math.round(MARGIN + r() * (W - 2 * MARGIN - w)),
          y: Math.round(MARGIN + r() * (H - 2 * MARGIN - h)),
          w,
          h,
        };
        let nearest = Infinity;
        for (const p of placed) {
          const d = dist(c, p);
          if (d < nearest) nearest = d;
          if (nearest < GAP) break;
        }
        if (nearest >= GAP && nearest > bestScore) {
          bestScore = nearest;
          best = c;
        }
      }
      if (!best) { ok = false; break; }
      placed.push(best);
      out[i] = best;
    }
    if (ok) return { tiles: out, W, H };
  }
  throw new Error('layoutScatter: could not place all tiles');
}
