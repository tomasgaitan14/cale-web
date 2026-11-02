// Este repo es público: ningún archivo versionado puede llevar datos personales del titular (nombre, apellido, domicilio,
// CUIT, celular ni su situación fiscal). Los datos privados van en ~/projects-claude/personal/cale-privado/, fuera de git.
// Las palabras se arman por partes para que este archivo no se delate a sí mismo.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const BINARY_FILE = /\.(png|jpe?g|webp|svg|ico|woff2?|pdf|mp4)$/i;
const SELF = 'tests/no-personal-data.test.ts';
// El usuario público de GitHub aparece en URLs del repo: es un identificador de cuenta, no el nombre de la persona
const GITHUB_HANDLE = /tomas\w*gaitan14/gi;

const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ['el nombre de pila (en el repo se escribe «Titular»)', new RegExp(`\\b${'To'}${'m'}\\b`)],
  ['el apellido', new RegExp(`${'gai'}${'tan'}`, 'i')],
  ['la calle del domicilio', new RegExp(`${'laba'}${'yen'}`, 'i')],
  ['la ciudad del domicilio', new RegExp(`${'guale'}${'guay'}`, 'i')],
  ['el CUIT', new RegExp(`20-?${'4118'}${'8294'}`)],
  ['el celular personal', new RegExp(`${'344'}${'6'}[0-9]{6}`)],
  ['la situación fiscal', new RegExp(`${'monot'}${'ribut'}`, 'i')],
];

function trackedTextFiles(): string[] {
  const listed = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  return listed
    .split('\n')
    .filter((file) => file !== '' && file !== SELF && file !== 'package-lock.json' && !BINARY_FILE.test(file));
}

describe('el repo público no tiene datos personales', () => {
  const files = trackedTextFiles();

  it('revisa los archivos versionados (si no encuentra ninguno, el test no sirve)', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain('CLAUDE.md');
    expect(files).toContain('src/config.ts');
  });

  it.each(FORBIDDEN)('ningún archivo versionado lleva %s', (_label, pattern) => {
    const offenders = files.flatMap((file) => {
      const text = readFileSync(join(ROOT, file), 'utf8').replace(GITHUB_HANDLE, '');
      return text.split('\n').flatMap((line, index) => (pattern.test(line) ? [`${file}:${index + 1}`] : []));
    });
    expect(offenders).toEqual([]);
  });
});
