import { describe, expect, it } from 'vitest';
import { highlightLine, type Lang, type TokState } from './highlight';

const paint = (lang: Lang, ...lines: string[]): string[] => {
  const st: TokState = { inTriple: null };
  return lines.map((l) => highlightLine[lang](l, st, new Map(), []));
};
const span = (cls: string, s: string) => `<span class="${cls}">${s}</span>`;

describe('python', () => {
  it('colors keywords, calls and numbers', () => {
    expect(paint('python', 'return f(1)')[0]).toBe(`${span('tk-kw', 'return')} ${span('tk-fn', 'f')}(${span('tk-num', '1')})`);
  });
});

describe('nix', () => {
  it('tells keywords, definitions and strings apart', () => {
    expect(paint('nix', 'let name = "hello"; in name')[0]).toBe(
      `${span('tk-kw', 'let')} ${span('tk-def', 'name')} ${span('tk-op', '=')} ${span('tk-str', '&quot;hello&quot;')}; ${span('tk-kw', 'in')} name`);
  });

  it('keeps the update operator apart from a path', () => {
    expect(paint('nix', 'a // ./b')[0]).toBe(`a ${span('tk-op', '//')} ${span('tk-str', './b')}`);
  });

  it('reads <nixpkgs> and builtins as units', () => {
    expect(paint('nix', 'import <nixpkgs>')[0]).toBe(`${span('tk-bi', 'import')} ${span('tk-str', '&lt;nixpkgs&gt;')}`);
    expect(paint('nix', 'builtins.readFile')[0]).toBe(span('tk-bi', 'builtins.readFile'));
  });

  it('carries an indented string across lines', () => {
    const [a, b, c] = paint('nix', "x = ''", '  echo hi', "'';");
    expect(a).toContain(span('tk-str', "''"));
    expect(b).toBe(span('tk-str', '  echo hi'));
    expect(c).toBe(`${span('tk-str', "''")};`);
  });
});

describe('shell', () => {
  it('colors the command, its flags and paths', () => {
    expect(paint('shell', '$ nix-store --query ./result')[0]).toBe(
      `${span('tk-op', '$')} ${span('tk-bi', 'nix-store')} ${span('tk-op', '--query')} ${span('tk-str', './result')}`);
  });

  it('colors the command after a pipe too', () => {
    expect(paint('shell', '$ a | wc -l')[0]).toContain(`${span('tk-op', '|')} ${span('tk-bi', 'wc')}`);
  });

  it('keeps nixpkgs#hello in one word, and sets output back', () => {
    expect(paint('shell', '$ nix build nixpkgs#hello')[0]).toContain(span('tk-str', 'nixpkgs#hello'));
    expect(paint('shell', '/nix/store/abc-hello')[0]).toBe(span('tk-com', '/nix/store/abc-hello'));
  });
});
