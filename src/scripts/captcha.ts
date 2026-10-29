// Widget de Cloudflare Turnstile en /empezar. Se carga recién al llegar al paso de los datos: quien abandona antes
// no le manda nada a Cloudflare. Sin framework: el script de Turnstile se agrega al DOM al hacer falta.
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      language: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ): string;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// No se pudo cargar el script de Cloudflare (bloqueador, sin red)
export class CaptchaLoadError extends Error {
  constructor() {
    super('No se pudo cargar Cloudflare Turnstile');
    this.name = 'CaptchaLoadError';
  }
}

export interface CaptchaHandlers {
  onToken: (token: string) => void;
  // El token venció o el widget falló: ya no sirve
  onInvalid: () => void;
}

export interface CaptchaWidget {
  reset(): void;
}

let scriptPromise: Promise<TurnstileApi> | undefined;

function loadScript(): Promise<TurnstileApi> {
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new CaptchaLoadError()));
    script.onerror = () => {
      // Se permite reintentar si la carga falló
      scriptPromise = undefined;
      reject(new CaptchaLoadError());
    };
    document.head.append(script);
  });
  return scriptPromise;
}

export async function mountCaptcha(container: HTMLElement, siteKey: string, handlers: CaptchaHandlers): Promise<CaptchaWidget> {
  const turnstile = await loadScript();
  const widgetId = turnstile.render(container, {
    sitekey: siteKey,
    language: 'es',
    callback: handlers.onToken,
    'expired-callback': handlers.onInvalid,
    'error-callback': handlers.onInvalid,
  });
  return { reset: () => turnstile.reset(widgetId) };
}
