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
/** z: depth 0 (back) .. 1 (front) — drives stacking order and parallax strength. */
export interface Tile extends Placed { z: number }

const MARGIN = 80; // whitespace between tiles and the field border
const DENSITY = 2.6; // field area / total tile area (overlap allowed, so a bit denser)
const RATIO = 1.55; // field width / height
const OVERLAP = 0.28; // tiles may overlap up to this share of the smaller tile's side

/** Signed distance between two rectangles: positive gap, or negative penetration depth when they overlap. */
const sdist = (a: Placed, b: Placed) => {
  const gx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
  const gy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
  if (gx < 0 && gy < 0) return Math.max(gx, gy); // overlapping: the shallower axis
  return Math.hypot(Math.max(0, gx), Math.max(0, gy));
};

/** Width from a skewed distribution: mostly small/medium, a few large "hero" tiles. */
function pickWidth(r: () => number, ratio: number) {
  const u = r();
  const w = u < 0.08 ? 460 + r() * 220 : u < 0.3 ? 280 + r() * 160 : 110 + r() * 170;
  return Math.round(ratio > 1.4 ? w * 0.75 : w); // tall images a bit narrower
}

/**
 * aspects = height/width per tile. Returns an organic scatter with very varied sizes where tiles may
 * partly overlap (best-candidate sampling on signed distance), plus a depth per tile.
 */
export function layoutScatter(aspects: number[], seed = 11) {
  const r = rng(seed);
  const sizes = aspects.map((asp) => {
    const ratio = Math.min(1.8, Math.max(0.55, asp || 1));
    const w = pickWidth(r, ratio);
    return { w, h: Math.round(w * ratio) };
  });
  const area = sizes.reduce((s, z) => s + z.w * z.h, 0);
  let fieldArea = area * DENSITY;
  // Big tiles first (they sit further back), small ones fill in on top.
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b].w * sizes[b].h - sizes[a].w * sizes[a].h);

  for (let attempt = 0; attempt < 12; attempt++, fieldArea *= 1.08) {
    const H = Math.round(Math.sqrt(fieldArea / RATIO));
    const W = Math.round(H * RATIO);
    const placed: Placed[] = [];
    const out: Tile[] = new Array(sizes.length);
    let ok = true;
    order.forEach((i, rankBySize) => {
      if (!ok) return;
      const { w, h } = sizes[i];
      // ~1/3 of tiles look for a partial overlap with a neighbour, the rest for a gap of 30-150px.
      const wantOverlap = placed.length > 0 && r() < 0.35;
      const target = wantOverlap ? -OVERLAP * 0.6 * Math.min(w, h) : 30 + r() * 120;
      let best: Placed | null = null, bestScore = -Infinity;
      for (let k = 0; k < 60; k++) {
        const c: Placed = { x: Math.round(MARGIN + r() * (W - 2 * MARGIN - w)), y: Math.round(MARGIN + r() * (H - 2 * MARGIN - h)), w, h };
        let nearest = Infinity, valid = true;
        for (const p of placed) {
          const d = sdist(c, p);
          if (d < -OVERLAP * Math.min(c.w, c.h, p.w, p.h)) { valid = false; break; } // too deep
          if (d < nearest) nearest = d;
        }
        if (!valid) continue;
        const score = placed.length ? -Math.abs(nearest - target) : 0;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (!best) { ok = false; return; }
      placed.push(best);
      // Depth: small tiles in front; a little randomness so it doesn't look ordered.
      const z = Math.min(1, Math.max(0, rankBySize / sizes.length * 0.8 + r() * 0.2));
      out[i] = { ...best, z: Math.round(z * 100) / 100 };
    });
    if (ok) return { tiles: out, W, H };
  }
  throw new Error('layoutScatter: could not place all tiles');
}
