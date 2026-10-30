// Anima los bloques [data-timeline] de la portada: ver lib/timeline.ts para los atributos. El contenido está todo en el
// HTML; esto solo prende y apaga la clase is-in según el reloj. Corre solo mientras el bloque se ve en pantalla, tiene
// pausa y, con "reducir movimiento", no arranca: muestra un cuadro fijo (data-static, en segundos).
import { advance, isActive, parseWindow, toSeconds, type TimelineWindow } from '../lib/timeline';

const LABELS = { pause: 'Pausar animación', play: 'Reproducir animación' } as const;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DEFAULT_STATIC_SECONDS = 0;

interface Item {
  element: HTMLElement;
  window: TimelineWindow;
  active: boolean;
}

function mount(root: HTMLElement): void {
  const loopSeconds = Number(root.dataset.loop);
  if (!Number.isFinite(loopSeconds) || loopSeconds <= 0) throw new Error(`data-loop inválido: "${root.dataset.loop}"`);
  const staticSeconds = Number(root.dataset.static ?? DEFAULT_STATIC_SECONDS);
  const toggle = root.querySelector<HTMLButtonElement>('[data-timeline-toggle]');

  const items: Item[] = [...root.querySelectorAll<HTMLElement>('[data-in]')].map((element) => ({
    element,
    window: parseWindow(element.dataset.in ?? '', element.dataset.out ?? null),
    active: false,
  }));

  let elapsedMs = 0;
  let playing = !window.matchMedia(REDUCED_MOTION_QUERY).matches;
  let visible = false;
  let frame = 0;
  let last = 0;

  function render(): void {
    const seconds = toSeconds(elapsedMs);
    for (const item of items) {
      const active = isActive(item.window, seconds);
      if (active !== item.active) {
        item.active = active;
        item.element.classList.toggle('is-in', active);
      }
    }
  }

  function tick(now: number): void {
    elapsedMs = advance(elapsedMs, now - last, loopSeconds);
    last = now;
    render();
    frame = requestAnimationFrame(tick);
  }

  // Corre solo si está reproduciendo y a la vista
  function sync(): void {
    cancelAnimationFrame(frame);
    if (playing && visible) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function updateToggle(): void {
    if (toggle) toggle.textContent = playing ? LABELS.pause : LABELS.play;
  }

  toggle?.addEventListener('click', () => {
    playing = !playing;
    updateToggle();
    sync();
  });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(root);

  if (!playing) {
    elapsedMs = staticSeconds * 1000;
    root.classList.add('tl-still');
  }
  render();
  updateToggle();
}

for (const root of document.querySelectorAll<HTMLElement>('[data-timeline]')) mount(root);
