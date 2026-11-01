import { describe, expect, it } from 'vitest';
import { canonicalUrl, mailtoUrl } from '../src/lib/url';

const SITE = 'https://cale.example';

describe('canonicalUrl', () => {
  it('la home termina en una sola barra', () => {
    expect(canonicalUrl('/', SITE)).toBe('https://cale.example/');
  });

  it('las rutas internas no llevan barra final', () => {
    expect(canonicalUrl('/privacidad', SITE)).toBe('https://cale.example/privacidad');
  });

  it('saca la barra final de la ruta', () => {
    expect(canonicalUrl('/terminos/', SITE)).toBe('https://cale.example/terminos');
  });

  it('no duplica la barra si la URL base termina en barra', () => {
    expect(canonicalUrl('/privacidad', `${SITE}/`)).toBe('https://cale.example/privacidad');
    expect(canonicalUrl('/', `${SITE}/`)).toBe('https://cale.example/');
  });

  it('usa SITE_URL por defecto', async () => {
    const { SITE_URL } = await import('../src/config');
    expect(canonicalUrl('/terminos')).toBe(`${SITE_URL}/terminos`);
  });

  it.each(['', 'privacidad', 'https://otro.com/x'])('rechaza la ruta relativa o absoluta "%s"', (path) => {
    expect(() => canonicalUrl(path, SITE)).toThrow('debe empezar con "/"');
  });

  it.each(['/privacidad?ref=meta', '/privacidad#eliminacion'])('rechaza query o hash en "%s"', (path) => {
    expect(() => canonicalUrl(path, SITE)).toThrow('query ni hash');
  });
});

describe('mailtoUrl', () => {
  it('sin asunto devuelve el mailto simple', () => {
    expect(mailtoUrl('hola@cale.example')).toBe('mailto:hola@cale.example');
  });

  it('codifica espacios y acentos del asunto', () => {
    expect(mailtoUrl('hola@cale.example', 'Eliminación de datos')).toBe(
      'mailto:hola@cale.example?subject=Eliminaci%C3%B3n%20de%20datos',
    );
  });

  it('no deja que el asunto agregue parámetros extra', () => {
    const url = mailtoUrl('hola@cale.example', 'Hola&cc=otro@mail.com');
    expect(new URL(url).searchParams.get('subject')).toBe('Hola&cc=otro@mail.com');
    expect(new URL(url).searchParams.has('cc')).toBe(false);
  });

  it('con asunto vacío devuelve el mailto simple', () => {
    expect(mailtoUrl('hola@cale.example', '')).toBe('mailto:hola@cale.example');
  });
});
