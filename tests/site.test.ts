// Tests sobre el HTML que genera `astro build` (dist/): es exactamente lo que ven Meta y los visitantes.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HTMLElement, NodeType, parse, type Node } from 'node-html-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUSINESS_NAME,
  CONTACT_EMAIL,
  FACEBOOK_DOMAIN_VERIFICATION,
  LOCATION,
  OWNER_NAME,
  RESPONSE_DEADLINES,
  RETENTION,
  ROUTES,
} from '../src/config';
import { canonicalUrl } from '../src/lib/url';

const DIST_DIR = join(import.meta.dirname, '..', 'dist');
const NOT_FOUND_FILE = '404.html';
const DESCRIPTION_LENGTH = { min: 50, max: 160 };
const TEXT_NODE = NodeType.TEXT_NODE;
// Palabras con mayúscula interna que no son texto pegado
const WORDS_WITH_INNER_CAPITALS = ['WhatsApp'];
const PLACEHOLDER_PATTERN = /en construcci[oó]n|pr[oó]ximamente|lorem ipsum|coming soon|\bTODO\b|\bTBD\b/i;

const INDEXABLE_ROUTES = Object.values(ROUTES);

function routeToFile(route: string): string {
  return route === '/' ? 'index.html' : `${route.slice(1)}.html`;
}

function loadPage(file: string): HTMLElement {
  return parse(readFileSync(join(DIST_DIR, file), 'utf8'));
}

function bodyText(page: HTMLElement): string {
  return (page.querySelector('body')?.text ?? '').replace(/\s+/g, ' ');
}

function textNodes(element: HTMLElement): Node[] {
  return element.childNodes.flatMap((child) =>
    child.nodeType === TEXT_NODE ? [child] : child instanceof HTMLElement ? textNodes(child) : [],
  );
}

function metaContent(page: HTMLElement, selector: string): string | undefined {
  return page.querySelector(selector)?.getAttribute('content');
}

const pages = new Map<string, HTMLElement>();

beforeAll(() => {
  if (!existsSync(DIST_DIR)) {
    throw new Error('No existe dist/. Corré `npm test`, que buildea antes de testear.');
  }
  for (const route of INDEXABLE_ROUTES) {
    const file = routeToFile(route);
    if (existsSync(join(DIST_DIR, file))) pages.set(route, loadPage(file));
  }
});

describe('build', () => {
  it.each(INDEXABLE_ROUTES)('genera la página de %s', (route) => {
    expect(existsSync(join(DIST_DIR, routeToFile(route)))).toBe(true);
  });

  it('genera una 404 que no se indexa', () => {
    const page = loadPage(NOT_FOUND_FILE);
    expect(metaContent(page, 'meta[name="robots"]')).toBe('noindex');
    expect(page.querySelector('link[rel="canonical"]')).toBeNull();
  });
});

describe.each(INDEXABLE_ROUTES)('página %s', (route) => {
  const page = () => pages.get(route)!;

  it('está en español de Argentina', () => {
    expect(page().querySelector('html')?.getAttribute('lang')).toBe('es-AR');
  });

  it('tiene título con el nombre del negocio y un solo h1', () => {
    expect(page().querySelector('title')?.text).toContain(BUSINESS_NAME);
    expect(page().querySelectorAll('h1')).toHaveLength(1);
  });

  it('tiene una meta description de largo razonable', () => {
    const description = metaContent(page(), 'meta[name="description"]') ?? '';
    expect(description.length).toBeGreaterThanOrEqual(DESCRIPTION_LENGTH.min);
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_LENGTH.max);
  });

  it('tiene canonical y Open Graph coherentes', () => {
    const expectedUrl = canonicalUrl(route);
    expect(page().querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(expectedUrl);
    expect(metaContent(page(), 'meta[property="og:url"]')).toBe(expectedUrl);
    expect(metaContent(page(), 'meta[property="og:title"]')).toBe(page().querySelector('title')?.text);
    expect(metaContent(page(), 'meta[property="og:description"]')).toBe(
      metaContent(page(), 'meta[name="description"]'),
    );
    expect(metaContent(page(), 'meta[property="og:locale"]')).toBe('es_AR');
  });

  it('muestra el negocio, el titular, la ubicación y el email de contacto', () => {
    const text = bodyText(page());
    expect(text).toContain(BUSINESS_NAME);
    expect(text).toContain(OWNER_NAME);
    expect(text).toContain(LOCATION);
    expect(text).toContain(CONTACT_EMAIL);
    const mailtoLinks = page()
      .querySelectorAll('a')
      .filter((link) => link.getAttribute('href')?.startsWith(`mailto:${CONTACT_EMAIL}`));
    expect(mailtoLinks.length).toBeGreaterThan(0);
  });

  it.each([ROUTES.privacy, ROUTES.terms, ROUTES.dataDeletion])('linkea a %s', (target) => {
    expect(page().querySelector(`a[href="${target}"]`)).not.toBeNull();
  });

  // Astro recorta el espacio de un salto de línea antes de {expresión} o de una etiqueta inline:
  // "dentro de los\n{plazo}" se renderiza como "dentro de los5".
  it('no pega palabras entre sí ni con números', () => {
    const glued: string[] = [];
    for (const node of textNodes(page().querySelector('body')!)) {
      // "los5" (letra+número), "queCale" (minúscula+mayúscula) o "Contacto,Cale" (puntuación+letra)
      for (const match of node.text.matchAll(/\S*(?:\p{Ll}\d|\p{Ll}\p{Lu}|[,;:]\p{L})\S*/gu)) {
        if (!WORDS_WITH_INNER_CAPITALS.some((word) => match[0].includes(word))) glued.push(match[0]);
      }
    }
    for (const element of page().querySelectorAll('body a, body strong, body em, body time')) {
      const previous = element.previousSibling;
      const next = element.nextSibling;
      if (previous?.nodeType === TEXT_NODE && /[\p{L},;:]$/u.test(previous.text) && /^[\p{L}\d]/u.test(element.text)) {
        glued.push(`${previous.text.trim().split(' ').at(-1)}|${element.text}`);
      }
      if (next?.nodeType === TEXT_NODE && /[\p{L}\d]$/u.test(element.text) && /^\p{L}/u.test(next.text)) {
        glued.push(`${element.text}|${next.text.trim().split(' ')[0]}`);
      }
    }
    expect(glued).toEqual([]);
  });

  it('no tiene textos de relleno ni de "en construcción"', () => {
    expect(bodyText(page())).not.toMatch(PLACEHOLDER_PATTERN);
  });

  // La CSP de vercel.json bloquea scripts y estilos inline: si aparecen, se rompen en producción.
  it('no tiene scripts ni estilos inline', () => {
    expect(page().querySelectorAll('script')).toHaveLength(0);
    expect(page().querySelectorAll('style')).toHaveLength(0);
    expect(page().querySelectorAll('[style]')).toHaveLength(0);
  });
});

describe('links internos', () => {
  it('títulos y descriptions no se repiten entre páginas', () => {
    const titles = [...pages.values()].map((page) => page.querySelector('title')?.text);
    const descriptions = [...pages.values()].map((page) => metaContent(page, 'meta[name="description"]'));
    expect(new Set(titles).size).toBe(pages.size);
    expect(new Set(descriptions).size).toBe(pages.size);
  });

  it('todos los links internos y anclas apuntan a algo que existe', () => {
    const broken: string[] = [];
    for (const [route, page] of pages) {
      for (const link of page.querySelectorAll('a')) {
        const href = link.getAttribute('href') ?? '';
        if (!href.startsWith('/') && !href.startsWith('#')) continue;

        const [path, hash] = href.split('#');
        const targetRoute = path === '' ? route : path;
        const targetFile = join(DIST_DIR, routeToFile(targetRoute));
        if (!existsSync(targetFile)) {
          broken.push(`${route} → ${href}`);
          continue;
        }
        if (hash && !loadPage(routeToFile(targetRoute)).querySelector(`[id="${hash}"]`)) {
          broken.push(`${route} → ${href} (no existe el ancla)`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('contenido requerido', () => {
  // Meta busca la etiqueta en el <head> del HTML de la home, sin JS
  it('la home tiene la etiqueta de verificación de dominio de Meta en el head', () => {
    expect(FACEBOOK_DOMAIN_VERIFICATION).toMatch(/^[a-z0-9]{20,}$/);
    const tag = pages.get(ROUTES.home)!.querySelector('head meta[name="facebook-domain-verification"]');
    expect(tag?.getAttribute('content')).toBe(FACEBOOK_DOMAIN_VERIFICATION);
  });

  it('la landing explica cómo funciona, para quién es y tiene contacto', () => {
    const page = pages.get(ROUTES.home)!;
    for (const id of ['como-funciona', 'para-quien', 'contacto']) {
      expect(page.querySelector(`#${id}`)).not.toBeNull();
    }
    const text = bodyText(page);
    for (const action of ['Confirmar', 'Cancelar', 'Reprogramar']) {
      expect(text).toContain(action);
    }
  });

  it('la política de privacidad cubre datos, Meta, proveedores, plazos y Ley 25.326', () => {
    const page = pages.get(ROUTES.privacy)!;
    const text = bodyText(page);
    for (const required of [
      'Ley 25.326',
      // Leyenda obligatoria de la Disposición 10/2008 (frases que no aparecen en otra parte de la página)
      'a intervalos no inferiores a seis meses',
      'La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley Nº 25.326',
      'WhatsApp Business Platform',
      'Número de teléfono',
      'Datos del turno',
      'Contenido de los mensajes',
      'Estados de entrega',
      'Supabase',
      `${RETENTION.appointmentDataMonths} meses`,
      `${RETENTION.afterTerminationDays} días`,
      `${RESPONSE_DEADLINES.deletionBusinessDays} días hábiles`,
    ]) {
      expect(text, `falta "${required}"`).toContain(required);
    }
  });

  it('los términos cubren opt-in, pago a Meta y limitación de responsabilidad', () => {
    const text = bodyText(pages.get(ROUTES.terms)!);
    for (const required of [
      'Consentimiento de los clientes (opt-in)',
      'Cada negocio paga esos mensajes directamente a Meta',
      'Limitación de responsabilidad',
      'Ley aplicable y jurisdicción',
      // Modelo sin Tech Provider: la cuenta es del negocio y el acceso de Cale es revocable
      'crea y mantiene su propia app y su cuenta de WhatsApp Business',
      'puede revocarle el acceso',
    ]) {
      expect(text, `falta "${required}"`).toContain(required);
    }
  });

  // Decisión de Titular (2026-10-11): el sitio no habla del precio del servicio.
  it.each(INDEXABLE_ROUTES)('%s no menciona el precio del servicio', (route) => {
    expect(bodyText(pages.get(route)!)).not.toMatch(/precio|cu[aá]nto cuesta|propuesta comercial|lo que cobra/i);
  });

  it('la página de eliminación explica cómo pedirlo y en qué plazo', () => {
    const page = pages.get(ROUTES.dataDeletion)!;
    const deletionLink = page
      .querySelectorAll('a')
      .find((link) => link.getAttribute('href')?.startsWith(`mailto:${CONTACT_EMAIL}?subject=`));
    expect(deletionLink).toBeDefined();
    expect(bodyText(page)).toContain(`${RESPONSE_DEADLINES.deletionBusinessDays} días hábiles`);
  });
});
