// Deterministic masonry pattern. Pure: same input -> same output (SSR-stable).
export const COL_W = 300;
const GAP_X = 56;
const GAP_Y = 48;

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

/** aspects = height/width per tile. Returns positions inside a W x H pattern that tiles seamlessly. */
export function layoutPattern(aspects: number[], seed = 11) {
  const r = rng(seed);
  const n = aspects.length;
  const K = Math.min(9, Math.max(5, Math.ceil(Math.sqrt(n))));
  const colY = Array.from({ length: K }, () => r() * GAP_Y * 3);
  const cols: number[][] = Array.from({ length: K }, () => []);
  const placed: Placed[] = [];

  aspects.forEach((asp, i) => {
    const ratio = Math.min(1.6, Math.max(0.6, asp));
    const f = ratio < 0.9 ? (r() < 0.5 ? 1 : 0.82) : r() < 0.5 ? 0.62 : 0.8;
    const w = Math.round(COL_W * f);
    const h = Math.round(w * ratio);
    let c = 0;
    for (let k = 1; k < K; k++) if (colY[k] < colY[c]) c = k;
    placed[i] = { x: c * (COL_W + GAP_X) + Math.round(r() * (COL_W - w)), y: colY[c], w, h };
    colY[c] += h + GAP_Y;
    cols[c].push(i);
  });

  // Equalize column heights by spreading slack across gaps so every column ends at H.
  const H = Math.ceil(Math.max(...colY));
  cols.forEach((idx, c) => {
    if (!idx.length) return;
    const extra = (H - colY[c]) / idx.length;
    idx.forEach((i, j) => (placed[i].y = Math.round(placed[i].y + extra * j)));
  });
  return { tiles: placed, W: K * (COL_W + GAP_X), H };
}
