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

// Link mailto con asunto opcional, codificado para que no se rompa con acentos ni espacios.
export function mailtoUrl(email: string, subject?: string): string {
  return subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;
}
