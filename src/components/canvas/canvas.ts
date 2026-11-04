// Finite scatter canvas. cam.x/y = world coords of the viewport's top-left; cam.s = scale.
const MIN_ABS = 0.1, MAX = 2.5, TAP = 6, TAU = 350, HEAD = 64, RESIST = 0.3, PANEL_GAP = 32;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface Tile {
  el: HTMLElement; a: HTMLAnchorElement; img: HTMLImageElement;
  p: string; i: number; rank: number; kind: string;
  x: number; y: number; w: number; h: number; sz: number;
}
interface Proj { id: string; tiles: Tile[]; edges: [number, number][]; tpl: HTMLTemplateElement }
interface Cam { cx: number; cy: number; s: number }
type Side = 'left' | 'right';

export function initCanvas(root: HTMLElement): () => void {
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const view = $('.cv-view'), layer = $('.cv-layer'), cap = $('.cv-caption');
  const capT = cap.querySelector<HTMLElement>('.cv-ct')!, capD = cap.querySelector<HTMLElement>('.cv-cd')!;
  const label = $('[data-zoom-label]');
  const edgesSvg = root.querySelector<SVGSVGElement>('.cv-edges')!;
  const panel = $('[data-panel-el]'), panelBody = $('[data-panel-content]');
  const lbEl = $('.cv-lb'), lbStage = $('[data-lb-stage]'), lbN = $('[data-lb-n]'), lbT = $('[data-lb-t]');
  const W = +root.dataset.w!, H = +root.dataset.h!;
  const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
  const sheetMq = matchMedia('(max-width: 767px)');
  const reduce = () => reduceMq.matches;
  const ac = new AbortController();
  const on = (t: EventTarget, type: string, fn: (e: any) => void, opts: AddEventListenerOptions = {}) =>
    t.addEventListener(type, fn, { ...opts, signal: ac.signal });

  /* ---------- data ---------- */
  const tiles: Tile[] = [...layer.querySelectorAll<HTMLElement>('.tile')].map((el) => {
    const d = el.dataset;
    const a = el.querySelector('a')!;
    const img = a.querySelector('img')!;
    return {
      el, a, img, p: d.p!, i: +d.i!, rank: +d.rank!, kind: d.kind!,
      x: +d.x!, y: +d.y!, w: +d.w!, h: +d.h!, sz: Math.round(+d.w! * 0.4),
    };
  });
  const tileOf = new Map<Element, Tile>(tiles.map((t) => [t.a, t]));
  const projects = new Map<string, Proj>();
  for (const t of tiles) {
    if (!projects.has(t.p)) projects.set(t.p, { id: t.p, tiles: [], edges: [], tpl: null as any });
    projects.get(t.p)!.tiles[t.i] = t;
  }
  root.querySelectorAll<HTMLTemplateElement>('template[data-panel]').forEach((tpl) => {
    const pr = projects.get(tpl.dataset.panel!);
    if (!pr) return;
    pr.tpl = tpl;
    try { pr.edges = JSON.parse(tpl.dataset.edges || '[]'); } catch {}
  });

  let vw = view.clientWidth || innerWidth, vh = view.clientHeight || innerHeight;
  const cam = { x: 0, y: 0, s: 1 };
  const center = () => ({ x: cam.x + vw / (2 * cam.s), y: cam.y + vh / (2 * cam.s) });
  const setCam = (c: Cam) => { cam.s = c.s; cam.x = c.cx - vw / (2 * c.s); cam.y = c.cy - vh / (2 * c.s); };

  /** Camera that fits box `b` inside the viewport minus insets, centred in what is left. */
  function camFor(b: { x: number; y: number; w: number; h: number }, ins: { l: number; r: number; t: number; b: number }, cap: number): Cam {
    const aw = Math.max(80, vw - ins.l - ins.r), ah = Math.max(80, vh - ins.t - ins.b);
    const s = clamp(Math.min(aw / b.w, ah / b.h), minScale(), cap);
    const sx = ins.l + aw / 2, sy = ins.t + ah / 2;
    return { cx: b.x + b.w / 2 - (sx - vw / 2) / s, cy: b.y + b.h / 2 - (sy - vh / 2) / s, s };
  }
  const fitAllIns = () => ({ l: 16, r: 16, t: HEAD, b: 24 });
  const fitAllScale = () => Math.min((vw - 32) / W, (vh - HEAD - 24) / H);
  const minScale = () => Math.min(MIN_ABS, fitAllScale() * 0.9);
  const fitAllCam = () => camFor({ x: 0, y: 0, w: W, h: H }, fitAllIns(), MAX);
  const rectAt = (t: Tile, c: Cam) => {
    const x0 = c.cx - vw / (2 * c.s), y0 = c.cy - vh / (2 * c.s);
    return { x: (t.x - x0) * c.s, y: (t.y - y0) * c.s, w: t.w * c.s, h: t.h * c.s };
  };

  // Initial view: centred, roughly a third of the field visible.
  {
    const s = clamp(Math.sqrt((vw * vh * 3) / (W * H)), vw < 640 ? 0.3 : 0.2, 1);
    setCam({ cx: W / 2, cy: H / 2, s });
  }

  /* ---------- render loop ---------- */
  let raf = 0, last = 0, settleTimer = 0;
  let vx = 0, vy = 0; // inertia px/ms
  let tw: { t0: number; dur: number; c0: Cam; c1: Cam } | null = null;
  let dragging = false;
  let pw = 320, ph = 400; // cached panel size

  function placePanel() {
    if (!sel || sheetMq.matches) return;
    const t = sel.tile;
    const sx = (t.x - cam.x) * cam.s, sy = (t.y - cam.y) * cam.s, sw = t.w * cam.s, sh = t.h * cam.s;
    const x = sel.side === 'right' ? sx + sw : sx - pw;
    const y = Math.max(HEAD + 8, Math.min(sy, vh - ph - 56));
    panel.style.setProperty('--px', x.toFixed(1) + 'px');
    panel.style.setProperty('--py', y.toFixed(1) + 'px');
    panel.classList.toggle('is-away', sx + sw < 0 || sx > vw || sy + sh < 0 || sy > vh);
  }

  function hardClamp() {
    const c = center();
    cam.x += clamp(c.x, 0, W) - c.x;
    cam.y += clamp(c.y, 0, H) - c.y;
  }

  function render() {
    if (reduce()) hardClamp();
    layer.style.transform = `translate3d(${-cam.x * cam.s}px,${-cam.y * cam.s}px,0) scale(${cam.s})`;
    layer.style.setProperty('--inv', (1 / cam.s).toFixed(4));
    label.textContent = Math.round(cam.s * 100) + '%';
    placePanel();
    root.classList.add('is-moving');
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, 180);
  }

  /** After the camera stops: let the browser re-raster and pick sharper srcset candidates. */
  function settle() {
    root.classList.remove('is-moving');
    const x1 = cam.x + vw / cam.s, y1 = cam.y + vh / cam.s;
    for (const t of tiles) {
      if (t.x > x1 || t.x + t.w < cam.x || t.y > y1 || t.y + t.h < cam.y) continue;
      const px = Math.ceil(t.w * cam.s);
      if (Math.abs(px - t.sz) > t.sz * 0.08) {
        t.sz = px;
        t.img.sizes = px + 'px';
      }
    }
  }

  const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  function frame(t: number) {
    raf = 0;
    const dt = Math.min(48, t - last);
    last = t;
    let active = false;
    if (tw) {
      const p = clamp((t - tw.t0) / tw.dur, 0, 1);
      const e = ease(p);
      const ls = Math.log(tw.c0.s) + (Math.log(tw.c1.s) - Math.log(tw.c0.s)) * e;
      setCam({
        cx: tw.c0.cx + (tw.c1.cx - tw.c0.cx) * e,
        cy: tw.c0.cy + (tw.c1.cy - tw.c0.cy) * e,
        s: Math.exp(ls),
      });
      if (p < 1) active = true; else tw = null;
    }
    if (!dragging && !tw && (vx || vy)) {
      pan(vx * dt, vy * dt);
      const d = Math.exp(-dt / TAU);
      vx *= d; vy *= d;
      if (Math.hypot(vx, vy) < 0.02) vx = vy = 0; else active = true;
    }
    if (!dragging && !tw) { // soft clamp: the field centre can't leave the field; ease back when overshooting
      const c = center();
      const ox = clamp(c.x, 0, W) - c.x, oy = clamp(c.y, 0, H) - c.y;
      if (ox || oy) {
        const k = 1 - Math.exp(-dt / 140);
        cam.x += ox * k; cam.y += oy * k;
        if (Math.hypot(ox, oy) * cam.s > 0.5) active = true; else { cam.x += ox; cam.y += oy; }
      }
    }
    render();
    if (active) raf = requestAnimationFrame(frame);
  }
  const kick = () => {
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };

  /* ---------- camera ops ---------- */
  function pan(dx: number, dy: number) {
    let wx = -dx / cam.s, wy = -dy / cam.s;
    const c = center();
    if (!reduce()) { // resistance when pushing past the field edge
      if ((c.x < 0 && wx < 0) || (c.x > W && wx > 0)) wx *= RESIST;
      if ((c.y < 0 && wy < 0) || (c.y > H && wy > 0)) wy *= RESIST;
    }
    cam.x += wx; cam.y += wy;
  }
  function zoomAt(f: number, px: number, py: number) {
    const s2 = clamp(cam.s * f, minScale(), MAX);
    const wx = cam.x + px / cam.s, wy = cam.y + py / cam.s;
    cam.s = s2;
    cam.x = wx - px / s2;
    cam.y = wy - py / s2;
    kick();
  }
  function flyTo(c: Cam, dur = 750) {
    c = { ...c, s: clamp(c.s, minScale(), MAX) };
    vx = vy = 0;
    if (reduce() || dur <= 0) { tw = null; setCam(c); render(); return; }
    const ct = center();
    tw = { t0: performance.now(), dur, c0: { cx: ct.x, cy: ct.y, s: cam.s }, c1: c };
    kick();
  }
  const zoomStep = (f: number) => {
    const base = tw?.c1 ?? { cx: center().x, cy: center().y, s: cam.s };
    flyTo({ ...base, s: base.s * f }, 260);
  };
  const fitAll = () => flyTo(fitAllCam(), 800);

  const rel = (e: { clientX: number; clientY: number }) => {
    const r = view.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const touched = () => root.classList.add('is-touched');
  const stopMotion = () => { vx = vy = 0; tw = null; };

  /* ---------- pointer: pan, pinch, tap ---------- */
  const ptrs = new Map<number, { x: number; y: number }>();
  let moved = false, sx = 0, sy = 0, pinchD = 0, suppressUntil = 0;
  let samples: { t: number; x: number; y: number }[] = [];
  const pinchState = () => {
    const [a, b] = [...ptrs.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };

  on(view, 'pointerdown', (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopMotion();
    if (ptrs.size === 1) {
      moved = false; sx = e.clientX; sy = e.clientY; samples = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
    } else if (ptrs.size === 2) {
      moved = true;
      pinchD = pinchState().d;
      if (!dragging) { dragging = true; root.classList.add('is-dragging'); }
      try { view.setPointerCapture(e.pointerId); } catch {}
    }
  });

  on(view, 'pointermove', (e: PointerEvent) => {
    const p = ptrs.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') hover(e);
      return;
    }
    if (ptrs.size === 1) {
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > TAP) {
        moved = true; dragging = true;
        root.classList.add('is-dragging'); root.classList.remove('is-hover');
        touched();
        try { view.setPointerCapture(e.pointerId); } catch {}
        pan(e.clientX - sx, e.clientY - sy);
      } else if (moved) pan(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY;
      if (moved) {
        samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
        while (samples.length > 2 && e.timeStamp - samples[0].t > 100) samples.shift();
        kick();
      }
    } else if (ptrs.size === 2) {
      const before = pinchState();
      p.x = e.clientX; p.y = e.clientY;
      const now = pinchState();
      const r = view.getBoundingClientRect();
      pan(now.cx - before.cx, now.cy - before.cy);
      if (pinchD > 0) zoomAt(now.d / pinchD, now.cx - r.left, now.cy - r.top);
      pinchD = now.d;
      touched();
      kick();
    }
  });

  function release(e: PointerEvent) {
    if (!ptrs.delete(e.pointerId)) return;
    if (moved) suppressUntil = performance.now() + 150;
    if (ptrs.size === 1) { // pinch -> single finger: restart pan baseline
      const q = [...ptrs.values()][0];
      samples = [{ t: e.timeStamp, x: q.x, y: q.y }];
      return;
    }
    if (ptrs.size) return;
    dragging = false;
    root.classList.remove('is-dragging');
    const a = samples[0], b = samples[samples.length - 1];
    if (moved && e.type === 'pointerup' && !reduce() && a && b && b !== a && e.timeStamp - b.t < 80) {
      const dt = Math.max(1, b.t - a.t);
      vx = clamp((b.x - a.x) / dt, -4, 4);
      vy = clamp((b.y - a.y) / dt, -4, 4);
    }
    samples = [];
    kick();
  }
  on(view, 'pointerup', release);
  on(view, 'pointercancel', release);
  on(view, 'dragstart', (e: Event) => e.preventDefault());

  /* A click on a tile (a tap, not a drag) selects its project / opens the lightbox; empty space deselects. */
  on(view, 'click', (e: MouseEvent) => {
    if (performance.now() < suppressUntil) { e.preventDefault(); e.stopPropagation(); return; }
    const a = (e.target as HTMLElement).closest('.tile a');
    if (a) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; // let "open in new tab" through
      e.preventDefault();
      const t = tileOf.get(a);
      if (t) onTile(t);
    } else if (sel) deselect();
  });

  /* ---------- wheel / trackpad ---------- */
  on(view, 'wheel', (e: WheelEvent) => {
    e.preventDefault();
    stopMotion();
    touched();
    root.classList.remove('is-hover');
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1;
    if (e.ctrlKey) {
      const p = rel(e);
      zoomAt(Math.exp(-clamp(e.deltaY * k, -40, 40) * 0.01), p.x, p.y);
    } else {
      pan(-e.deltaX * k, -e.deltaY * k);
      kick();
    }
  }, { passive: false });

  /* ---------- zoom buttons ---------- */
  root.querySelectorAll<HTMLElement>('[data-zoom]').forEach((btn) =>
    on(btn, 'click', () => {
      touched();
      const z = btn.dataset.zoom;
      if (z === 'fit') fitAll(); else zoomStep(z === 'in' ? 1.4 : 1 / 1.4);
    }),
  );

  /* ---------- hover caption (mouse only) ---------- */
  function hover(e: PointerEvent) {
    if (dragging) return;
    const a = (e.target as HTMLElement).closest<HTMLElement>('.tile a');
    if (!a) return void root.classList.remove('is-hover');
    capT.textContent = a.dataset.title ?? '';
    capD.textContent = a.dataset.discipline ?? '';
    root.classList.add('is-hover');
    const p = rel(e);
    const w = cap.offsetWidth, h = cap.offsetHeight;
    const x = p.x + 16 + w > vw - 8 ? p.x - 16 - w : p.x + 16;
    const y = p.y + 16 + h > vh - 8 ? p.y - 16 - h : p.y + 16;
    cap.style.transform = `translate3d(${x}px,${y}px,0)`;
  }
  on(view, 'pointerleave', () => root.classList.remove('is-hover'));

  // Tabbing to a tile pans it into view (only for keyboard focus, never for clicks).
  on(view, 'focusin', (e: FocusEvent) => {
    const el = e.target as HTMLElement;
    const t = el.closest('.tile');
    if (!t || !el.matches(':focus-visible')) return;
    const r = t.getBoundingClientRect(), v = view.getBoundingClientRect();
    if (r.left >= v.left && r.right <= v.right && r.top >= v.top + HEAD && r.bottom <= v.bottom) return;
    pan(v.left + v.width / 2 - (r.left + r.width / 2), v.top + v.height / 2 - (r.top + r.height / 2));
    kick();
  });

  /* ---------- selection ---------- */
  let sel: { id: string; tile: Tile; side: Side } | null = null;
  let drawTimer = 0;

  function syncURL(id: string | null) {
    try {
      const u = new URL(location.href);
      if (id) u.searchParams.set('p', id); else u.searchParams.delete('p');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch {}
  }

  function bbox(pr: Proj) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of pr.tiles) {
      x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y);
      x1 = Math.max(x1, t.x + t.w); y1 = Math.max(y1, t.y + t.h);
    }
    const pad = 28; // room for the sequence labels
    return { x: x0 - pad, y: y0 - pad * 1.6, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2.6 };
  }

  // Approximate cubic Bézier length by sampling (getTotalLength can return 0 before first render).
  function bezLen(p: number[]) {
    let len = 0, px = p[0], py = p[1];
    for (let i = 1; i <= 32; i++) {
      const t = i / 32, u = 1 - t;
      const x = u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6];
      const y = u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7];
      len += Math.hypot(x - px, y - py); px = x; py = y;
    }
    return Math.ceil(len) + 2;
  }

  function drawEdges(pr: Proj, instant: boolean) {
    clearTimeout(drawTimer);
    edgesSvg.replaceChildren();
    const ranks = [...new Set(pr.tiles.map((t) => t.rank))].sort((a, b) => a - b);
    const paths: SVGPathElement[] = [];
    for (const [ia, ib] of pr.edges) {
      const A = pr.tiles[ia], B = pr.tiles[ib];
      if (!A || !B) continue;
      const ax = A.x + A.w / 2, ay = A.y + A.h / 2, bx = B.x + B.w / 2, by = B.y + B.h / 2;
      const dx = bx - ax, dy = by - ay;
      const c = Math.abs(dx) >= Math.abs(dy)
        ? [ax, ay, ax + dx * 0.55, ay, bx - dx * 0.55, by, bx, by]
        : [ax, ay, ax, ay + dy * 0.55, bx, by - dy * 0.55, bx, by];
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${c[0]} ${c[1]}C${c[2]} ${c[3]} ${c[4]} ${c[5]} ${c[6]} ${c[7]}`);
      const len = bezLen(c);
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      path.style.setProperty('--delay', (0.2 + ranks.indexOf(A.rank) * 0.35).toFixed(2) + 's');
      paths.push(path);
    }
    edgesSvg.append(...paths);
    const finish = () => paths.forEach((p) => { p.style.strokeDasharray = 'none'; p.style.strokeDashoffset = '0'; p.classList.add('done'); });
    if (instant || reduce()) return finish();
    // Two frames so the hidden start state is painted before the transition to 0 begins.
    requestAnimationFrame(() => requestAnimationFrame(() => paths.forEach((p) => (p.style.strokeDashoffset = '0'))));
    drawTimer = window.setTimeout(finish, (0.2 + ranks.length * 0.35 + 1.6) * 1000);
  }


  function fillPanel(pr: Proj, side: Side) {
    panel.dataset.side = side;
    panelBody.replaceChildren(pr.tpl ? pr.tpl.content.cloneNode(true) : '');
    panelBody.scrollTop = 0;
    panel.classList.remove('is-open', 'is-away');
    void panel.offsetWidth; // restart the slide-out
    pw = panel.offsetWidth || 320;
    ph = panel.offsetHeight || 400;
    placePanel();
    panel.classList.add('is-open');
  }

  function selectionCam(pr: Proj, side: Side) {
    const ins = { l: 24, r: 24, t: HEAD + 16, b: 24 };
    if (sheetMq.matches) ins.b += Math.min(vh * 0.52, 520) + 8;
    else ins[side === 'right' ? 'r' : 'l'] += pw + PANEL_GAP;
    return camFor(bbox(pr), ins, 1.1);
  }

  function select(id: string, tile: Tile, opts: { instant?: boolean } = {}) {
    const pr = projects.get(id);
    if (!pr) return;
    for (const t of tiles) t.el.classList.toggle('in-sel', t.p === id);
    root.classList.add('has-sel');

    // Panel side: outward from the group (the clicked tile's side of the group's centre), where the
    // camera leaves room for it.
    const box = bbox(pr);
    const side: Side = tile.x + tile.w / 2 >= box.x + box.w / 2 ? 'right' : 'left';
    const target = selectionCam(pr, side);

    sel = { id, tile, side };
    drawEdges(pr, !!opts.instant);
    fillPanel(pr, side);
    flyTo(target, opts.instant ? 0 : 800);
    if (opts.instant) placePanel();
    syncURL(id);
  }

  function deselect() {
    if (!sel) return;
    sel = null;
    clearTimeout(drawTimer);
    edgesSvg.replaceChildren();
    for (const t of tiles) t.el.classList.remove('in-sel');
    root.classList.remove('has-sel');
    panel.classList.remove('is-open');
    syncURL(null);
  }
  panel.querySelectorAll('[data-close]').forEach((b) => on(b, 'click', deselect));

  // Bottom sheet: swipe down on the handle to close.
  {
    const grab = panel.querySelector<HTMLElement>('.cp-grab')!;
    let y0 = 0, dy = 0, id = -1;
    on(grab, 'pointerdown', (e: PointerEvent) => {
      id = e.pointerId; y0 = e.clientY; dy = 0;
      try { grab.setPointerCapture(id); } catch {}
    });
    on(grab, 'pointermove', (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      dy = Math.max(0, e.clientY - y0);
      panel.style.transition = 'none';
      panel.style.transform = `translateY(${dy}px)`;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      panel.style.transition = '';
      panel.style.transform = '';
      if (dy > 60) deselect();
    };
    on(grab, 'pointerup', end);
    on(grab, 'pointercancel', end);
  }

  function onTile(t: Tile) {
    touched();
    if (sel && sel.id === t.p) openLB(t);
    else select(t.p, t);
  }

  /* ---------- lightbox ---------- */
  let lb: { pr: Proj; idx: number } | null = null;
  let lbReturn: HTMLElement | null = null;
  const inertTargets = [view, panel, $('.cv-zoom')];

  function renderLB() {
    if (!lb) return;
    const t = lb.pr.tiles[lb.idx];
    const a = t.a;
    lbStage.replaceChildren();
    const yt = a.dataset.yt;
    if (t.kind === 'video' && yt) {
      const frame = document.createElement('div');
      frame.className = 'lb-frame' + (a.dataset.vertical ? ' is-vertical' : '');
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.title = a.dataset.alt || a.dataset.title || '';
      frame.append(f);
      lbStage.append(frame);
    } else {
      const img = document.createElement('img');
      img.sizes = '100vw';
      if (a.dataset.srcset) img.srcset = a.dataset.srcset;
      img.src = a.dataset.full || t.img.currentSrc || t.img.src;
      img.alt = a.dataset.alt || a.dataset.title || '';
      img.draggable = false;
      lbStage.append(img);
    }
    lbN.textContent = `${lb.idx + 1} / ${lb.pr.tiles.length}`;
    lbT.textContent = [a.dataset.title, a.dataset.alt && a.dataset.alt !== a.dataset.title ? a.dataset.alt : ''].filter(Boolean).join(' — ');
    lbEl.querySelectorAll<HTMLElement>('[data-lb="prev"],[data-lb="next"]').forEach((b) => (b.hidden = lb!.pr.tiles.length < 2));
  }
  function openLB(t: Tile) {
    const pr = projects.get(t.p)!;
    lb = { pr, idx: t.i };
    lbReturn = t.a;
    lbEl.hidden = false;
    inertTargets.forEach((el) => el.setAttribute('inert', ''));
    renderLB();
    lbEl.querySelector<HTMLElement>('[data-lb="close"]')!.focus({ preventScroll: true });
  }
  function closeLB() {
    if (!lb) return;
    lb = null;
    lbEl.hidden = true;
    lbStage.replaceChildren();
    inertTargets.forEach((el) => el.removeAttribute('inert'));
    lbReturn?.focus({ preventScroll: true });
  }
  function stepLB(d: number) {
    if (!lb) return;
    const n = lb.pr.tiles.length;
    lb.idx = (lb.idx + d + n) % n;
    renderLB();
  }
  lbEl.querySelectorAll<HTMLElement>('[data-lb]').forEach((b) =>
    on(b, 'click', () => {
      const k = b.dataset.lb;
      if (k === 'close') closeLB(); else stepLB(k === 'next' ? 1 : -1);
    }),
  );
  on(lbEl, 'click', (e: MouseEvent) => { // backdrop click closes
    if (e.target === lbEl || e.target === lbStage) closeLB();
  });
  {
    let x0 = 0, y0 = 0, id = -1;
    on(lbStage, 'pointerdown', (e: PointerEvent) => { id = e.pointerId; x0 = e.clientX; y0 = e.clientY; });
    on(lbStage, 'pointerup', (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (e.pointerType !== 'mouse' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) stepLB(dx < 0 ? 1 : -1);
    });
  }

  /* ---------- keyboard ---------- */
  on(window, 'keydown', (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (e.metaKey || e.ctrlKey || e.altKey || (el as any)?.closest?.('input,textarea,select,[contenteditable]')) return;
    if (lb) {
      if (e.key === 'Escape') { e.preventDefault(); closeLB(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepLB(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stepLB(-1); }
      else if (e.key === 'Tab') { // keep focus inside the dialog
        const btns = [...lbEl.querySelectorAll<HTMLElement>('button:not([hidden])')];
        const i = btns.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length]?.focus();
      }
      return;
    }
    if (e.key === 'Escape') { if (sel) deselect(); return; }
    const dir: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const d = dir[e.key];
    if (d) {
      if ((el as any)?.closest?.('.cv-panel')) return;
      e.preventDefault(); touched();
      if (reduce()) { pan(d[0] * 100, d[1] * 100); kick(); return; }
      tw = null;
      vx = clamp(vx + d[0] * 0.35, -1.4, 1.4);
      vy = clamp(vy + d[1] * 0.35, -1.4, 1.4);
      kick();
    } else if (e.key === '+' || e.key === '=') { touched(); zoomStep(1.4); }
    else if (e.key === '-' || e.key === '_') { touched(); zoomStep(1 / 1.4); }
    else if (e.key === '0') { touched(); fitAll(); }
  });

  /* ---------- resize ---------- */
  const ro = new ResizeObserver(() => {
    const c = center();
    vw = view.clientWidth || innerWidth; vh = view.clientHeight || innerHeight;
    setCam({ cx: c.x, cy: c.y, s: Math.max(cam.s, minScale()) });
    if (sel) {
      pw = panel.offsetWidth || pw; ph = panel.offsetHeight || ph;
      flyTo(selectionCam(projects.get(sel.id)!, sel.side), 0); // keep the group framed
    }
    kick();
  });
  ro.observe(view);

  /* ---------- intro ---------- */
  const diag = Math.hypot(vw, vh) || 1;
  render();
  for (const t of tiles) {
    const cx = (t.x + t.w / 2 - cam.x) * cam.s - vw / 2;
    const cy = (t.y + t.h / 2 - cam.y) * cam.s - vh / 2;
    const d = Math.hypot(cx, cy) / diag;
    t.a.style.setProperty('--d', d < 0.7 ? (d * 0.7).toFixed(2) + 's' : '0s');
  }
  requestAnimationFrame(() => root.classList.add('is-ready'));

  // Deep link: ?p=<project-slug>
  const deep = new URLSearchParams(location.search).get('p');
  if (deep && projects.has(deep)) {
    // Attach the panel to the group's right-most tile: it opens outward, over the free space.
    const first = projects.get(deep)!.tiles.filter(Boolean).sort((a, b) => b.x + b.w - (a.x + a.w))[0];
    if (first) requestAnimationFrame(() => select(deep, first, { instant: true }));
  }

  return () => {
    ac.abort();
    ro.disconnect();
    clearTimeout(settleTimer);
    clearTimeout(drawTimer);
    if (raf) cancelAnimationFrame(raf);
  };
}
