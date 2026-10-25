import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rand';
import { equivalent, evaluate, parse } from './expr';

const at = (src: string, env: Record<string, number> = {}) => evaluate(parse(src, Object.keys(env)), env);
const rand = () => {
  const r = new Rng(7);
  return () => r.next();
};
const eq = (a: string, b: string, vars = ['x']) => equivalent(a, b, vars, rand());

describe('parse and evaluate', () => {
  it('follows the usual precedence', () => {
    expect(at('1 + 2 * 3')).toBe(7);
    expect(at('2 ^ 3 ^ 2')).toBe(512);
    expect(at('-2 ^ 2')).toBe(-4);
    expect(at('2 ^ -1')).toBe(0.5);
    expect(at('(1 + 2) * 3')).toBe(9);
  });

  it('reads implicit multiplication', () => {
    expect(at('2x', { x: 3 })).toBe(6);
    expect(at('3(x + 1)', { x: 1 })).toBe(6);
    expect(at('(x + 1)(x - 1)', { x: 3 })).toBe(8);
    expect(at('2x^2', { x: 3 })).toBe(18);
    expect(at('xy', { x: 2, y: 5 })).toBe(10);
  });

  it('knows functions and constants, with or without parentheses', () => {
    expect(at('exp(0) + ln(e)')).toBe(2);
    expect(at('ln x', { x: Math.E })).toBe(1);
    expect(at('xe^x', { x: 1 })).toBeCloseTo(Math.E);
    expect(at('max(1, 4, 2)')).toBe(4);
    expect(at('sigmoid(0)')).toBe(0.5);
  });

  it('accepts typographic symbols', () => {
    expect(at('3 × 2 − 1 ÷ 2')).toBe(5.5);
    expect(at('x² + x³', { x: 2 })).toBe(12);
  });

  it('rejects what it cannot read', () => {
    expect(() => parse('2 +')).toThrow();
    expect(() => parse('(1 + 2')).toThrow(/expected "\)"/);
    expect(() => parse('2 $ 3')).toThrow(/unexpected/);
    expect(() => parse('q + 1', ['x'])).toThrow(/unknown name/);
  });
});

describe('equivalent', () => {
  it('accepts every equal form', () => {
    expect(eq('x^2 + 2x + 1', '(x + 1)^2')).toBe(true);
    expect(eq('sin(x)^2 + cos(x)^2', '1')).toBe(true);
    expect(eq('2e^(2x)', '2exp(2x)')).toBe(true);
    expect(eq('x e^x - e^x', 'e^x (x - 1)')).toBe(true);
  });

  it('rejects a different expression', () => {
    expect(eq('x^2 + 2x + 1', 'x^2 + 1')).toBe(false);
    expect(eq('2x', 'x^2')).toBe(false);
  });

  it('only compares where the expected expression is defined', () => {
    expect(eq('ln(x^2)', '2ln(abs(x))')).toBe(true);
    expect(eq('1 / x', 'x^-1')).toBe(true);
  });

  it('handles several variables', () => {
    expect(eq('x y + y', 'y (x + 1)', ['x', 'y'])).toBe(true);
    expect(eq('x y', 'x + y', ['x', 'y'])).toBe(false);
  });
});
