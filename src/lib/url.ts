import { SITE_URL } from '../config';

// Arma la URL canónica absoluta de una ruta del sitio, sin barra final (salvo la home).
export function canonicalUrl(pathname: string, siteUrl: string = SITE_URL): string {
  if (!pathname.startsWith('/')) {
    throw new Error(`La ruta debe empezar con "/": ${pathname}`);
  }
  if (/[?#]/.test(pathname)) {
    throw new Error(`La ruta no puede tener query ni hash: ${pathname}`);
  }

  const base = siteUrl.replace(/\/+$/, '');
  const path = pathname.replace(/\/+$/, '');
  return path === '' ? `${base}/` : `${base}${path}`;
}

// Número internacional sin "+" ni espacios (E.164 sin el signo): entre 8 y 15 dígitos
const WHATSAPP_NUMBER_PATTERN = /^\d{8,15}$/;

// Link de WhatsApp (wa.me) con un mensaje opcional ya escrito.
export function whatsappUrl(number: string, text?: string): string {
  if (!WHATSAPP_NUMBER_PATTERN.test(number)) {
    throw new Error(`Número de WhatsApp inválido (solo dígitos, con código de país): ${number}`);
  }
  return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`;
}

// Link mailto con asunto opcional, codificado para que no se rompa con acentos ni espacios.
export function mailtoUrl(email: string, subject?: string): string {
  return subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;
}
