// Minimal YouTube player: our own controls, no YouTube title/overlays.
// - The iframe is taller than the frame (overflow hidden), so YouTube's top title bar and bottom chrome sit outside.
// - A transparent shield over the iframe stops YouTube's hover UI; clicks toggle play/pause.
// - While paused/ended the poster covers the frame (hides YouTube's pause screen).
// Styles: .ytp in src/styles/global.css.

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<any> | null = null;
function loadAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiReady ??= new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  });
  return apiReady;
}

const icon = (d: string) => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
const I = {
  play: icon('M6 3.5v13l11-6.5z'),
  pause: icon('M5 3.5h3.5v13H5zM11.5 3.5H15v13h-3.5z'),
  vol: icon('M3 7.5h3.5L11 4v12l-4.5-3.5H3zM13.5 6.5a5 5 0 0 1 0 7l-1-1a3.6 3.6 0 0 0 0-5z'),
  mute: icon('M3 7.5h3.5L11 4v12l-4.5-3.5H3zM13 7.4l1-1 1.8 1.8 1.8-1.8 1 1-1.8 1.8 1.8 1.8-1 1-1.8-1.8-1.8 1.8-1-1 1.8-1.8z'),
  full: icon('M3 3h5v1.6H4.6V8H3zM12 3h5v5h-1.6V4.6H12zM3 12h1.6v3.4H8V17H3zM15.4 12H17v5h-5v-1.6h3.4z'),
};
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export type YTLabels = { play: string; pause: string; mute: string; unmute: string; fullscreen: string };

/** Mounts a player inside `host` (which sets the aspect ratio) and starts playback. Returns a destroy function. */
export function mountYT(host: HTMLElement, id: string, opts: { poster?: string; title?: string; labels: YTLabels }) {
  const L = opts.labels;
  host.classList.add('ytp', 'is-loading');
  host.innerHTML = `
    <div class="ytp-crop"><div class="ytp-frame"></div></div>
    <div class="ytp-shield"></div>
    <button type="button" class="ytp-cover" aria-label="${L.play}">
      ${opts.poster ? `<img src="${opts.poster}" alt="" draggable="false">` : ''}<span class="ytp-big">${I.play}</span>
    </button>
    <div class="ytp-bar">
      <button type="button" class="ytp-btn" data-a="toggle" aria-label="${L.pause}">${I.pause}</button>
      <input class="ytp-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="${opts.title ?? ''}">
      <span class="ytp-time">0:00</span>
      <button type="button" class="ytp-btn" data-a="mute" aria-label="${L.mute}">${I.vol}</button>
      ${document.fullscreenEnabled ? `<button type="button" class="ytp-btn" data-a="full" aria-label="${L.fullscreen}">${I.full}</button>` : ''}
    </div>`;
  const $ = <T extends Element>(s: string) => host.querySelector(s) as T;
  const seek = $<HTMLInputElement>('.ytp-seek'), time = $<HTMLElement>('.ytp-time');
  const toggleBtn = $<HTMLButtonElement>('[data-a="toggle"]'), muteBtn = $<HTMLButtonElement>('[data-a="mute"]');
  let player: any, timer = 0, dead = false, seeking = false, startTry = 0;

  const setPlaying = (on: boolean) => {
    host.classList.toggle('is-playing', on);
    toggleBtn.innerHTML = on ? I.pause : I.play;
    toggleBtn.setAttribute('aria-label', on ? L.pause : L.play);
  };
  const setMuted = (m: boolean) => {
    muteBtn.innerHTML = m ? I.mute : I.vol;
    muteBtn.setAttribute('aria-label', m ? L.unmute : L.mute);
    host.classList.toggle('is-muted', m);
  };
  const tick = () => {
    if (!player?.getDuration || seeking) return;
    const d = player.getDuration() || 0, t = player.getCurrentTime() || 0;
    if (d) seek.value = String(Math.round((t / d) * 1000));
    seek.style.setProperty('--p', `${d ? (t / d) * 100 : 0}%`);
    time.textContent = `${fmt(t)} / ${fmt(d)}`;
  };
  const play = () => player?.playVideo?.();
  const toggle = () => (host.classList.contains('is-playing') ? player?.pauseVideo() : play());

  loadAPI().then((YT) => {
    if (dead) return;
    player = new YT.Player($('.ytp-frame'), {
      videoId: id,
      host: 'https://www.youtube-nocookie.com',
      playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, modestbranding: 1, iv_load_policy: 3, disablekb: 1, fs: 0 },
      events: {
        onReady: () => {
          host.classList.remove('is-loading');
          play();
          // Browsers (iOS) may block autoplay with sound: fall back to muted playback.
          startTry = window.setTimeout(() => {
            if (player.getPlayerState() !== YT.PlayerState.PLAYING) { player.mute(); setMuted(true); play(); }
          }, 1200);
          timer = window.setInterval(tick, 250);
        },
        onStateChange: (e: { data: number }) => {
          setPlaying(e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING);
          if (e.data === YT.PlayerState.ENDED) { player.seekTo(0, true); player.pauseVideo(); }
        },
      },
    });
  });

  host.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.ytp-cover') || t.closest('.ytp-shield') || t.closest('[data-a="toggle"]')) toggle();
    else if (t.closest('[data-a="mute"]')) {
      if (player?.isMuted()) { player.unMute(); setMuted(false); } else { player?.mute(); setMuted(true); }
    } else if (t.closest('[data-a="full"]')) {
      document.fullscreenElement ? document.exitFullscreen() : host.requestFullscreen?.();
    }
  });
  seek.addEventListener('input', () => {
    seeking = true;
    seek.style.setProperty('--p', `${Number(seek.value) / 10}%`);
  });
  seek.addEventListener('change', () => {
    const d = player?.getDuration?.() || 0;
    player?.seekTo((Number(seek.value) / 1000) * d, true);
    seeking = false;
  });

  setPlaying(true);
  return () => {
    dead = true;
    clearInterval(timer);
    clearTimeout(startTry);
    try { player?.destroy(); } catch {}
    host.replaceChildren();
  };
}
