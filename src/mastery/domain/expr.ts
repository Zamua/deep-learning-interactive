// A small expression language for answers such as derivatives: parse, evaluate, and compare
// two expressions by evaluating both at random points.

export type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

const FNS: Record<string, (...x: number[]) => number> = {
  exp: Math.exp,
  ln: Math.log,
  log: Math.log,
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  tanh: Math.tanh,
  abs: Math.abs,
  max: Math.max,
  min: Math.min,
  sigmoid: (x) => 1 / (1 + Math.exp(-x)),
};
const CONSTS: Record<string, number> = { e: Math.E, pi: Math.PI, 'π': Math.PI };

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function lex(src: string, vars: readonly string[]): Tok[] {
  const s = src
    .replace(/[−–]/g, '-')
    .replace(/[×·⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\*\*/g, '^');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (/\s/.test(ch)) i++;
    else if (/[\d.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (!m) throw new Error(`unexpected "${ch}"`);
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if (/[A-Za-zπ]/.test(ch)) {
      const word = /^[A-Za-zπ]+/.exec(s.slice(i))![0];
      i += word.length;
      out.push(...splitWord(word, vars));
    } else if ('+-*/^(),'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
    } else throw new Error(`unexpected "${ch}"`);
  }
  return out;
}

/** `xy` with variables x and y is x times y; known names (`exp`, `pi`) stay whole. */
function splitWord(word: string, vars: readonly string[]): Tok[] {
  if (word in FNS || word in CONSTS || vars.includes(word)) return [{ t: 'id', v: word }];
  const out: Tok[] = [];
  let rest = word;
  while (rest) {
    const known = [...Object.keys(FNS), ...Object.keys(CONSTS), ...vars].filter((n) => rest.startsWith(n)).sort((a, b) => b.length - a.length)[0];
    if (!known) throw new Error(`unknown name "${rest}"`);
    out.push({ t: 'id', v: known });
    rest = rest.slice(known.length);
  }
  return out;
}

/** Parses with the usual precedence; `^` is right associative and binds tighter than unary minus. */
export function parse(src: string, vars: readonly string[] = []): Node {
  const toks = lex(src, vars);
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new Error(`expected "${v}"`);
    i++;
  };
  // A value can follow another directly (2x, 3(x+1), (x+1)(x-1)): that is multiplication.
  const startsValue = () => {
    const p = peek();
    return !!p && (p.t === 'num' || p.t === 'id' || (p.t === 'op' && p.v === '('));
  };
  const sum = (): Node => {
    let a = product();
    while (isOp('+') || isOp('-')) {
      const op = toks[i++]!.v as '+' | '-';
      a = { k: 'bin', op, a, b: product() };
    }
    return a;
  };
  const product = (): Node => {
    let a = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = toks[i++]!.v as '*' | '/';
        a = { k: 'bin', op, a, b: unary() };
      } else if (startsValue()) a = { k: 'bin', op: '*', a, b: power() };
      else return a;
    }
  };
  const unary = (): Node => {
    if (isOp('-')) {
      i++;
      return { k: 'neg', a: unary() };
    }
    if (isOp('+')) {
      i++;
      return unary();
    }
    return power();
  };
  const power = (): Node => {
    const a = atom();
    if (isOp('^')) {
      i++;
      return { k: 'bin', op: '^', a, b: unary() };
    }
    return a;
  };
  const atom = (): Node => {
    const p = toks[i++];
    if (!p) throw new Error('unexpected end');
    if (p.t === 'num') return { k: 'num', v: p.v };
    if (p.t === 'op' && p.v === '(') {
      const a = sum();
      expect(')');
      return a;
    }
    if (p.t === 'id') {
      if (p.v in FNS) {
        if (!isOp('(')) {
          // ln x, exp 2x: a bare argument binds like a power
          return { k: 'call', fn: p.v, args: [power()] };
        }
        i++;
        const args = [sum()];
        while (isOp(',')) {
          i++;
          args.push(sum());
        }
        expect(')');
        return { k: 'call', fn: p.v, args };
      }
      if (p.v in CONSTS) return { k: 'num', v: CONSTS[p.v]! };
      return { k: 'var', name: p.v };
    }
    throw new Error(`unexpected "${p.v}"`);
  };
  const tree = sum();
  if (i < toks.length) throw new Error(`unexpected "${toks[i]!.v}"`);
  return tree;
}

export function evaluate(n: Node, env: Readonly<Record<string, number>>): number {
  switch (n.k) {
    case 'num':
      return n.v;
    case 'var': {
      const v = env[n.name];
      if (v === undefined) throw new Error(`unknown variable "${n.name}"`);
      return v;
    }
    case 'neg':
      return -evaluate(n.a, env);
    case 'call':
      return FNS[n.fn]!(...n.args.map((a) => evaluate(a, env)));
    case 'bin': {
      const a = evaluate(n.a, env);
      const b = evaluate(n.b, env);
      switch (n.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return a / b;
        case '^':
          return a ** b;
      }
    }
  }
}

/**
 * True when `answer` equals `expected` wherever `expected` is defined: compared at random
 * points in [-3, 3], to a relative 1e-6. Throws if `answer` does not parse.
 */
export function equivalent(expected: string, answer: string, vars: readonly string[], rand: () => number = Math.random): boolean {
  const e = parse(expected, vars);
  const a = parse(answer, vars);
  let checked = 0;
  for (let tries = 0; tries < 60 && checked < 12; tries++) {
    const env = Object.fromEntries(vars.map((v) => [v, -3 + 6 * rand()]));
    const x = evaluate(e, env);
    if (!Number.isFinite(x)) continue;
    let y: number;
    try {
      y = evaluate(a, env);
    } catch {
      return false;
    }
    if (!(Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y)))) return false;
    checked++;
  }
  return checked >= 6;
}
