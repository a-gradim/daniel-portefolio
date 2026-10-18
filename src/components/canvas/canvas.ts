// Infinite wrapping drag/zoom canvas. cam.x/y = world coords of the viewport's top-left; cam.s = scale.
const MIN = 0.5, MAX = 2, TAP = 6, TAU = 350;
const LEVELS = [1, 0.7, 0.5];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const mod = (a: number, n: number) => ((a % n) + n) % n;

interface Slot { el: HTMLElement; bx: number; by: number; w: number; h: number; a: number; b: number; kx?: number; ky?: number }

export function initCanvas(root: HTMLElement): () => void {
  const view = root.querySelector<HTMLElement>('.cv-view')!;
  const layer = root.querySelector<HTMLElement>('.cv-layer')!;
  const cap = root.querySelector<HTMLElement>('.cv-caption')!;
  const capT = cap.querySelector<HTMLElement>('.cv-ct')!;
  const capD = cap.querySelector<HTMLElement>('.cv-cd')!;
  const label = root.querySelector<HTMLElement>('[data-zoom-label]')!;
  const W = +root.dataset.w!, H = +root.dataset.h!;
  const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
  const ac = new AbortController();
  const on = (t: EventTarget, type: string, fn: (e: any) => void, opts: AddEventListenerOptions = {}) =>
    t.addEventListener(type, fn, { ...opts, signal: ac.signal });

  const originals = [...layer.querySelectorAll<HTMLElement>(':scope > .tile')];
  const maxW = Math.max(...originals.map((t) => +t.dataset.w!), 0);
  const maxH = Math.max(...originals.map((t) => +t.dataset.h!), 0);
  const slots: Slot[] = [];
  const seen = new Set<string>();
  let vw = view.clientWidth || innerWidth, vh = view.clientHeight || innerHeight;
  let builtX = 0, builtY = 0;

  const cam = { x: 0, y: 0, s: vw < 640 ? 0.7 : 1 };
  cam.x = (W - vw / cam.s) / 2;
  cam.y = (H - vh / cam.s) / 2;

  /** Make sure enough copies of the pattern exist to cover the viewport at scale >= level. */
  function build(level: number) {
    const nx = Math.ceil((vw / level + maxW) / W) + 1;
    const ny = Math.ceil((vh / level + maxH) / H) + 1;
    if (nx <= builtX && ny <= builtY) return;
    for (let b = 0; b < ny; b++)
      for (let a = 0; a < nx; a++)
        originals.forEach((o, i) => {
          const key = `${i}:${a}:${b}`;
          if (seen.has(key)) return;
          seen.add(key);
          let el = o;
          if (a || b) {
            el = o.cloneNode(true) as HTMLElement;
            el.setAttribute('aria-hidden', 'true');
            el.querySelector('a')!.tabIndex = -1;
            layer.appendChild(el);
          }
          slots.push({ el, bx: +o.dataset.x!, by: +o.dataset.y!, w: +o.dataset.w!, h: +o.dataset.h!, a, b });
        });
    builtX = Math.max(nx, builtX);
    builtY = Math.max(ny, builtY);
  }
  const levelFor = (s: number) => LEVELS.find((l) => l <= s) ?? MIN;
  let level = levelFor(cam.s);
  build(level);

  /* ---------- render ---------- */
  let raf = 0, last = 0;
  let vx = 0, vy = 0; // inertia px/ms
  let tween: { t0: number; s0: number; s1: number; ax: number; ay: number; px: number; py: number } | null = null;
  let dragging = false;

  function render() {
    cam.x = mod(cam.x, W);
    cam.y = mod(cam.y, H);
    layer.style.transform = `translate3d(${-cam.x * cam.s}px,${-cam.y * cam.s}px,0) scale(${cam.s})`;
    const x1 = cam.x, y1 = cam.y;
    for (const sl of slots) {
      const kx = Math.ceil((x1 - sl.w - sl.bx) / W) + sl.a;
      const ky = Math.ceil((y1 - sl.h - sl.by) / H) + sl.b;
      if (kx !== sl.kx || ky !== sl.ky) {
        sl.kx = kx; sl.ky = ky;
        sl.el.style.transform = `translate3d(${kx * W}px,${ky * H}px,0)`;
      }
    }
    label.textContent = Math.round(cam.s * 100) + '%';
  }

  function frame(t: number) {
    raf = 0;
    const dt = Math.min(48, t - last);
    last = t;
    let active = false;
    if (tween) {
      const p = clamp((t - tween.t0) / 220, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      cam.s = tween.s0 + (tween.s1 - tween.s0) * e;
      cam.x = tween.ax - tween.px / cam.s;
      cam.y = tween.ay - tween.py / cam.s;
      if (p < 1) active = true; else tween = null;
      ensureCoverage();
    }
    if (!dragging && (vx || vy)) {
      pan(vx * dt, vy * dt);
      const d = Math.exp(-dt / TAU);
      vx *= d; vy *= d;
      if (Math.hypot(vx, vy) < 0.02) vx = vy = 0; else active = true;
    }
    render();
    if (active) raf = requestAnimationFrame(frame);
  }
  const kick = () => {
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };

  /* ---------- camera ops ---------- */
  const pan = (dx: number, dy: number) => { cam.x -= dx / cam.s; cam.y -= dy / cam.s; };
  function ensureCoverage() {
    const l = levelFor(cam.s);
    if (l < level) { level = l; build(l); }
  }
  function zoomAt(f: number, px: number, py: number) {
    const s2 = clamp(cam.s * f, MIN, MAX);
    const wx = cam.x + px / cam.s, wy = cam.y + py / cam.s;
    cam.s = s2;
    cam.x = wx - px / s2;
    cam.y = wy - py / s2;
    ensureCoverage();
    kick();
  }
  function zoomTo(target: number, px: number, py: number) {
    target = clamp(target, MIN, MAX);
    if (reduceMq.matches) return zoomAt(target / cam.s, px, py);
    const s0 = cam.s;
    tween = { t0: performance.now(), s0, s1: target, ax: cam.x + px / s0, ay: cam.y + py / s0, px, py };
    kick();
  }
  const rel = (e: { clientX: number; clientY: number }) => {
    const r = view.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const touched = () => root.classList.add('is-touched');
  const stopMotion = () => { vx = vy = 0; tween = null; };

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
    if (moved && e.type === 'pointerup' && !reduceMq.matches && a && b && b !== a && e.timeStamp - b.t < 80) {
      const dt = Math.max(1, b.t - a.t);
      vx = clamp((b.x - a.x) / dt, -4, 4);
      vy = clamp((b.y - a.y) / dt, -4, 4);
      kick();
    }
    samples = [];
  }
  on(view, 'pointerup', release);
  on(view, 'pointercancel', release);
  on(view, 'click', (e: Event) => {
    if (performance.now() < suppressUntil) { e.preventDefault(); e.stopPropagation(); }
  }, { capture: true });
  on(view, 'dragstart', (e: Event) => e.preventDefault());

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

  /* ---------- keyboard ---------- */
  on(window, 'keydown', (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (e.metaKey || e.ctrlKey || e.altKey || el?.closest('input,textarea,select,[contenteditable]')) return;
    const dir: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const d = dir[e.key];
    if (d) {
      e.preventDefault(); touched();
      if (reduceMq.matches) { pan(d[0] * 100, d[1] * 100); kick(); return; }
      tween = null;
      vx = clamp(vx + d[0] * 0.35, -1.4, 1.4);
      vy = clamp(vy + d[1] * 0.35, -1.4, 1.4);
      kick();
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      touched();
      zoomTo((tween?.s1 ?? cam.s) * (e.key === '-' ? 0.8 : 1.25), vw / 2, vh / 2);
    }
  });

  /* ---------- zoom buttons ---------- */
  root.querySelectorAll<HTMLElement>('[data-zoom]').forEach((btn) =>
    on(btn, 'click', () => {
      touched();
      zoomTo((tween?.s1 ?? cam.s) * (btn.dataset.zoom === 'in' ? 1.25 : 0.8), vw / 2, vh / 2);
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

  // Tabbing to a tile pans it to the middle of the screen.
  on(view, 'focusin', (e: FocusEvent) => {
    const t = (e.target as HTMLElement).closest('.tile');
    if (!t) return;
    const r = t.getBoundingClientRect(), v = view.getBoundingClientRect();
    pan(v.left + v.width / 2 - (r.left + r.width / 2), v.top + v.height / 2 - (r.top + r.height / 2));
    kick();
  });

  /* ---------- resize ---------- */
  const ro = new ResizeObserver(() => {
    vw = view.clientWidth || innerWidth; vh = view.clientHeight || innerHeight;
    build(level);
    kick();
  });
  ro.observe(view);

  /* ---------- intro ---------- */
  const diag = Math.hypot(vw, vh) || 1;
  render();
  for (const sl of slots) {
    const cx = (sl.bx + sl.w / 2 + (sl.kx ?? 0) * W - cam.x) * cam.s - vw / 2;
    const cy = (sl.by + sl.h / 2 + (sl.ky ?? 0) * H - cam.y) * cam.s - vh / 2;
    const d = Math.hypot(cx, cy) / diag;
    sl.el.firstElementChild instanceof HTMLElement &&
      sl.el.firstElementChild.style.setProperty('--d', d < 0.7 ? (d * 0.7).toFixed(2) + 's' : '0s');
  }
  requestAnimationFrame(() => root.classList.add('is-ready'));

  return () => {
    ac.abort();
    ro.disconnect();
    if (raf) cancelAnimationFrame(raf);
  };
}
