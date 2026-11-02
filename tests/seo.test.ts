// SEO técnico sobre el HTML que genera `astro build` (dist/) y la configuración del hosting: título de la portada,
// imagen para compartir, datos estructurados, precarga de fuentes y la redirección del dominio de Vercel.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HTMLElement, parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import { BUSINESS_NAME, CONTACT_EMAIL, SITE_URL } from '../src/config';
import { APPLE_TOUCH_ICON, OG_IMAGE } from '../src/lib/brand';
import { homeStructuredData, jsonLd } from '../src/lib/structured-data';
import { pngInfo } from './support/png';

const DIST_DIR = join(import.meta.dirname, '..', 'dist');
const ASTRO_DIR = join(DIST_DIR, '_astro');
// Google corta los títulos cerca de los 60 caracteres y las descripciones cerca de los 160
const TITLE_MAX = 60;
const DESCRIPTION_LENGTH = { min: 120, max: 160 };
// WhatsApp no muestra la imagen de la vista previa de un enlace si pesa más de 300 KB
const OG_IMAGE_MAX_BYTES = 300 * 1024;
// Google pide un logo de al menos 112 × 112 px
const LOGO_MIN_PX = 112;
const FONT_PRELOAD_COUNT = 2;
const VERCEL_HOST = 'cale-turnos.vercel.app';

const pageFiles = readdirSync(DIST_DIR).filter((file) => file.endsWith('.html'));
const load = (file: string): HTMLElement => parse(readFileSync(join(DIST_DIR, file), 'utf8'));
const meta = (root: HTMLElement, selector: string): string | undefined => root.querySelector(selector)?.getAttribute('content');
const home = load('index.html');

// Ruta de un archivo publicado a partir de su URL absoluta en el sitio
function distFile(url: string): string {
  expect(url.startsWith(`${SITE_URL}/`), `${url} tiene que ser del dominio del sitio`).toBe(true);
  return join(DIST_DIR, url.slice(SITE_URL.length));
}

describe('título y descripción de la portada', () => {
  const title = home.querySelector('title')!.text;
  const description = meta(home, 'meta[name="description"]')!;

  it('el título empieza por la palabra clave y termina con la marca', () => {
    expect(title.startsWith('Recordatorios de turnos por WhatsApp')).toBe(true);
    expect(title.endsWith(BUSINESS_NAME)).toBe(true);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it('la descripción cabe en el resultado de búsqueda y termina con un llamado a la acción', () => {
    expect(description.length).toBeGreaterThanOrEqual(DESCRIPTION_LENGTH.min);
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_LENGTH.max);
    expect(description).toMatch(/Empezá gratis\.$/);
  });

  it('el título y la descripción de las redes son los mismos', () => {
    expect(meta(home, 'meta[property="og:title"]')).toBe(title);
    expect(meta(home, 'meta[property="og:description"]')).toBe(description);
  });
});

describe.each(pageFiles)('imagen para compartir en %s', (file) => {
  const page = load(file);

  it('declara la imagen con URL absoluta, tipo, tamaño y texto alternativo', () => {
    const image = meta(page, 'meta[property="og:image"]')!;
    expect(image).toBe(`${SITE_URL}${OG_IMAGE.path}`);
    expect(meta(page, 'meta[property="og:image:type"]')).toBe('image/png');
    expect(meta(page, 'meta[property="og:image:width"]')).toBe(String(OG_IMAGE.width));
    expect(meta(page, 'meta[property="og:image:height"]')).toBe(String(OG_IMAGE.height));
    expect(meta(page, 'meta[property="og:image:alt"]')).toBe(OG_IMAGE.alt);
  });

  it('usa la tarjeta grande de X/Twitter con la misma imagen', () => {
    expect(meta(page, 'meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(meta(page, 'meta[name="twitter:image"]')).toBe(meta(page, 'meta[property="og:image"]'));
  });
});

describe('archivo de la imagen para compartir', () => {
  const path = distFile(`${SITE_URL}${OG_IMAGE.path}`);

  it('se publica, mide lo que declara y pesa menos de 300 KB', () => {
    expect(existsSync(path)).toBe(true);
    const png = readFileSync(path);
    expect(pngInfo(png)).toMatchObject({ width: OG_IMAGE.width, height: OG_IMAGE.height });
    expect(png.length).toBeLessThan(OG_IMAGE_MAX_BYTES);
  });
});

describe('datos estructurados', () => {
  const blocks = home.querySelectorAll('script[type="application/ld+json"]');
  const data = JSON.parse(blocks[0]!.text) as ReturnType<typeof homeStructuredData>;
  const [organization, website] = data['@graph'];

  it('la portada lleva un solo bloque de JSON válido, que coincide con el código', () => {
    expect(blocks).toHaveLength(1);
    expect(data).toEqual(homeStructuredData());
  });

  it('describe a la organización con su nombre, su dirección y su logo', () => {
    expect(data['@context']).toBe('https://schema.org');
    expect(organization['@type']).toBe('Organization');
    expect(organization.name).toBe(BUSINESS_NAME);
    expect(organization.url).toBe(`${SITE_URL}/`);
    expect(organization.logo.url).toBe(`${SITE_URL}${APPLE_TOUCH_ICON.path}`);
  });

  it('el logo existe y es cuadrado, con el tamaño que Google pide', () => {
    const logo = pngInfo(readFileSync(distFile(organization.logo.url)));
    expect(logo.width).toBe(organization.logo.width);
    expect(logo.height).toBe(organization.logo.height);
    expect(logo.width).toBe(logo.height);
    expect(logo.width).toBeGreaterThanOrEqual(LOGO_MIN_PX);
  });

  it('el único contacto es el correo público del sitio: sin teléfono ni domicilio', () => {
    expect(organization.contactPoint.email).toBe(CONTACT_EMAIL);
    expect(blocks[0]!.text).not.toMatch(/telephone|address/i);
    expect(blocks[0]!.text).not.toMatch(/\d{8,}/);
  });

  it('el sitio web pertenece a la organización y declara su idioma', () => {
    expect(website['@type']).toBe('WebSite');
    expect(website.url).toBe(`${SITE_URL}/`);
    expect(website.inLanguage).toBe('es-AR');
    expect(website.publisher['@id']).toBe(organization['@id']);
  });

  it('solo la portada lleva datos estructurados', () => {
    const others = pageFiles.filter((file) => file !== 'index.html' && load(file).querySelector('script[type="application/ld+json"]'));
    expect(others).toEqual([]);
  });

  it('jsonLd escapa "<" para que un texto con </script> no corte el bloque', () => {
    const output = jsonLd({ name: '</script><b>' });
    expect(output).not.toContain('<');
    expect(JSON.parse(output)).toEqual({ name: '</script><b>' });
  });
});

describe.each(pageFiles)('precarga de las fuentes en %s', (file) => {
  const preloads = load(file).querySelectorAll('link[rel="preload"]');
  const css = readdirSync(ASTRO_DIR)
    .filter((name) => name.endsWith('.css'))
    .map((name) => readFileSync(join(ASTRO_DIR, name), 'utf8'))
    .join('\n');

  it('precarga las dos tipografías latinas, con crossorigin (si no, el navegador las baja dos veces)', () => {
    expect(preloads).toHaveLength(FONT_PRELOAD_COUNT);
    for (const link of preloads) {
      expect(link.getAttribute('as')).toBe('font');
      expect(link.getAttribute('type')).toBe('font/woff2');
      expect(link.hasAttribute('crossorigin')).toBe(true);
    }
    expect(preloads.map((link) => link.getAttribute('href')).join(' ')).toMatch(/manrope-latin-wght.*dm-sans-latin-wght/);
  });

  it('cada archivo precargado existe y es el mismo que pide el CSS del sitio', () => {
    for (const link of preloads) {
      const href = link.getAttribute('href')!;
      expect(existsSync(join(DIST_DIR, href)), `${href} no se publicó`).toBe(true);
      expect(css, `${href} no figura en el CSS: se descargaría dos veces`).toContain(href);
    }
  });
});

describe('redirección del dominio de Vercel (vercel.json)', () => {
  interface Redirect {
    source: string;
    has?: { type: string; value: string }[];
    destination: string;
    permanent?: boolean;
  }
  const { redirects } = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'vercel.json'), 'utf8')) as { redirects: Redirect[] };
  const rule = redirects.find((item) => item.has?.some((condition) => condition.value === VERCEL_HOST));

  it('manda todo el tráfico de cale-turnos.vercel.app al dominio propio, conservando la ruta', () => {
    expect(rule, `falta la redirección de ${VERCEL_HOST}`).toBeDefined();
    expect(rule!.has).toEqual([{ type: 'host', value: VERCEL_HOST }]);
    expect(new RegExp(`^${rule!.source}$`).test('/privacidad')).toBe(true);
    expect(rule!.destination).toBe(`${SITE_URL}/$1`);
  });

  // `permanent: true` es el 308 de Vercel: Google pasa la señal al dominio propio
  it('es permanente', () => {
    expect(rule!.permanent).toBe(true);
  });

  it('es la única regla y exige el host de Vercel: no toca el tráfico del dominio propio', () => {
    expect(redirects).toHaveLength(1);
    expect(rule!.has).toHaveLength(1);
  });
});
