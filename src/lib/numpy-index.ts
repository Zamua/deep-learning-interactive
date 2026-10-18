/**
 * A tiny evaluator for NumPy index expressions on a 2-D array named `a`, enough for the
 * slicing figure: integers, slices with steps, integer lists, boolean lists and boolean masks
 * built from `a` with Python's operator precedence. Error messages match NumPy's.
 */

export type IndexOutcome =
  | { ok: true; cells: [number, number][]; shape: number[]; kind: 'scalar' | 'view' | 'copy' }
  | { ok: false; error: string };

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

class Fail extends Error {}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const num = src.slice(i).match(/^\d+(\.\d+)?/);
    if (num) {
      out.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = src.slice(i).match(/^[A-Za-z_]\w*/);
    if (id) {
      out.push({ t: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    const op = src.slice(i).match(/^(==|!=|<=|>=|\/\/|[[\]():,<>&|~%+\-*])/);
    if (op) {
      out.push({ t: 'op', v: op[0] });
      i += op[0].length;
      continue;
    }
    throw new Fail(`SyntaxError: unexpected character '${ch}'`);
  }
  return out;
}

/** A value inside a mask expression: a plain number or an array evaluated per cell. */
type Val = { arr: boolean; bool: boolean; at: (r: number, c: number) => number };

type Item =
  | { k: 'int'; v: number }
  | { k: 'slice'; start: number | null; stop: number | null; step: number | null }
  | { k: 'list'; v: number[] }
  | { k: 'blist'; v: boolean[] }
  | { k: 'mask'; m: Val };

class Parser {
  i = 0;
  constructor(private toks: Tok[], private val: (r: number, c: number) => number) {}

  peek(o = 0): Tok | undefined {
    return this.toks[this.i + o];
  }
  isOp(v: string, o = 0): boolean {
    const t = this.peek(o);
    return !!t && t.t === 'op' && t.v === v;
  }
  eat(v: string): void {
    if (!this.isOp(v)) throw new Fail(`SyntaxError: expected '${v}'`);
    this.i++;
  }

  top(): Item[] {
    const t = this.peek();
    if (t && t.t === 'id' && t.v !== 'a') throw new Fail(`NameError: name '${t.v}' is not defined (the array here is called a)`);
    if (!t || t.t !== 'id') throw new Fail("SyntaxError: start with the array's name, as in a[1, 2]");
    this.i++;
    this.eat('[');
    const items: Item[] = [this.item()];
    while (this.isOp(',')) {
      this.i++;
      if (this.isOp(']')) break;
      items.push(this.item());
    }
    this.eat(']');
    if (this.isOp('[')) throw new Fail('This demo reads a single a[...]; chained indexing like a[1][2] also works in NumPy, but write it as a[1, 2] here.');
    if (this.i < this.toks.length) throw new Fail('SyntaxError: unexpected text after the closing ]');
    return items;
  }

  /** Scans the current item (up to a top-level ',' or ']') for what it contains. */
  scan(): { colon: boolean; usesA: boolean } {
    let depth = 0;
    let colon = false;
    let usesA = false;
    for (let j = this.i; j < this.toks.length; j++) {
      const t = this.toks[j]!;
      if (t.t === 'op' && (t.v === '[' || t.v === '(')) depth++;
      else if (t.t === 'op' && (t.v === ']' || t.v === ')')) {
        if (depth === 0) break;
        depth--;
      } else if (t.t === 'op' && t.v === ',' && depth === 0) break;
      else if (t.t === 'op' && t.v === ':' && depth === 0) colon = true;
      else if (t.t === 'id' && t.v === 'a') usesA = true;
    }
    return { colon, usesA };
  }

  item(): Item {
    if (this.isOp('[')) return this.list();
    const s = this.scan();
    if (s.colon) return this.slice();
    if (s.usesA) {
      const m = this.compare();
      return { k: 'mask', m };
    }
    return { k: 'int', v: this.int() };
  }

  int(): number {
    let sign = 1;
    while (this.isOp('-') || this.isOp('+')) {
      if (this.isOp('-')) sign = -sign;
      this.i++;
    }
    const t = this.peek();
    if (!t || t.t !== 'num') throw new Fail('SyntaxError: expected a whole number');
    if (!Number.isInteger(t.v)) throw new Fail('IndexError: only integers, slices (`:`), ellipsis (`...`), numpy.newaxis (`None`) and integer or boolean arrays are valid indices');
    this.i++;
    return sign * t.v;
  }

  optInt(): number | null {
    if (this.isOp(':') || this.isOp(',') || this.isOp(']')) return null;
    return this.int();
  }

  slice(): Item {
    const start = this.optInt();
    this.eat(':');
    const stop = this.optInt();
    let step: number | null = null;
    if (this.isOp(':')) {
      this.i++;
      step = this.optInt();
    }
    return { k: 'slice', start, stop, step };
  }

  list(): Item {
    this.eat('[');
    const ints: number[] = [];
    const bools: boolean[] = [];
    while (!this.isOp(']')) {
      const t = this.peek();
      if (t?.t === 'id' && (t.v === 'True' || t.v === 'False')) {
        bools.push(t.v === 'True');
        this.i++;
      } else ints.push(this.int());
      if (this.isOp(',')) this.i++;
      else if (!this.isOp(']')) throw new Fail("SyntaxError: expected ',' or ']' in the list");
    }
    this.eat(']');
    if (bools.length && ints.length) throw new Fail('This demo wants a list of all integers or all True/False values.');
    return bools.length ? { k: 'blist', v: bools } : { k: 'list', v: ints };
  }

  // Python precedence: comparison < | < & < + - < * % // < unary
  compare(): Val {
    const first = this.bitor();
    const ops: string[] = [];
    const vals: Val[] = [first];
    while (['<', '>', '<=', '>=', '==', '!='].some((o) => this.isOp(o))) {
      ops.push((this.peek() as { v: string }).v);
      this.i++;
      vals.push(this.bitor());
    }
    const t = this.peek();
    if (t && t.t === 'id' && (t.v === 'and' || t.v === 'or')) throw new Fail('ValueError: The truth value of an array with more than one element is ambiguous. Use a.any() or a.all()');
    if (!ops.length) return first;
    if (ops.length > 1 && vals.some((v) => v.arr)) throw new Fail('ValueError: The truth value of an array with more than one element is ambiguous. Use a.any() or a.all()');
    const [l, r] = [vals[0]!, vals[1]!];
    const op = ops[0]!;
    const f = (x: number, y: number) => (op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : op === '>=' ? x >= y : op === '==' ? x === y : x !== y);
    return { arr: l.arr || r.arr, bool: true, at: (rr, cc) => (f(l.at(rr, cc), r.at(rr, cc)) ? 1 : 0) };
  }
  bitor(): Val {
    let l = this.bitand();
    while (this.isOp('|')) {
      this.i++;
      const r = this.bitand();
      const L = l;
      l = { arr: L.arr || r.arr, bool: L.bool && r.bool, at: (a, b) => L.at(a, b) | r.at(a, b) };
    }
    return l;
  }
  bitand(): Val {
    let l = this.arith();
    while (this.isOp('&')) {
      this.i++;
      const r = this.arith();
      const L = l;
      l = { arr: L.arr || r.arr, bool: L.bool && r.bool, at: (a, b) => L.at(a, b) & r.at(a, b) };
    }
    return l;
  }
  arith(): Val {
    let l = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.peek() as { v: string }).v;
      this.i++;
      const r = this.term();
      const L = l;
      l = { arr: L.arr || r.arr, bool: false, at: (a, b) => (op === '+' ? L.at(a, b) + r.at(a, b) : L.at(a, b) - r.at(a, b)) };
    }
    return l;
  }
  term(): Val {
    let l = this.unary();
    while (this.isOp('*') || this.isOp('%') || this.isOp('//')) {
      const op = (this.peek() as { v: string }).v;
      this.i++;
      const r = this.unary();
      const L = l;
      const pymod = (x: number, y: number) => x - y * Math.floor(x / y);
      l = { arr: L.arr || r.arr, bool: false, at: (a, b) => (op === '*' ? L.at(a, b) * r.at(a, b) : op === '%' ? pymod(L.at(a, b), r.at(a, b)) : Math.floor(L.at(a, b) / r.at(a, b))) };
    }
    return l;
  }
  unary(): Val {
    if (this.isOp('~')) {
      this.i++;
      const v = this.unary();
      return { arr: v.arr, bool: v.bool, at: (a, b) => (v.bool ? 1 - v.at(a, b) : ~v.at(a, b)) };
    }
    if (this.isOp('-')) {
      this.i++;
      const v = this.unary();
      return { arr: v.arr, bool: false, at: (a, b) => -v.at(a, b) };
    }
    return this.atom();
  }
  atom(): Val {
    const t = this.peek();
    if (!t) throw new Fail('SyntaxError: the expression ended early');
    if (t.t === 'num') {
      this.i++;
      return { arr: false, bool: false, at: () => t.v };
    }
    if (t.t === 'id' && t.v === 'a') {
      this.i++;
      if (this.isOp('[')) throw new Fail('This demo builds masks from the whole array, like a > 5 or a % 2 == 0.');
      return { arr: true, bool: false, at: (r, c) => this.val(r, c) };
    }
    if (t.t === 'id' && (t.v === 'True' || t.v === 'False')) {
      this.i++;
      return { arr: false, bool: true, at: () => (t.v === 'True' ? 1 : 0) };
    }
    if (t.t === 'id' && (t.v === 'and' || t.v === 'or' || t.v === 'not')) throw new Fail('ValueError: The truth value of an array with more than one element is ambiguous. Use a.any() or a.all()');
    if (this.isOp('(')) {
      this.i++;
      const v = this.compare();
      this.eat(')');
      return v;
    }
    throw new Fail(t.t === 'id' ? `NameError: name '${t.v}' is not defined` : `SyntaxError: unexpected '${t.v}'`);
  }
}

function slicePositions(n: number, s: { start: number | null; stop: number | null; step: number | null }): number[] {
  const step = s.step ?? 1;
  if (step === 0) throw new Fail('ValueError: slice step cannot be zero');
  const out: number[] = [];
  if (step > 0) {
    let start = s.start ?? 0;
    let stop = s.stop ?? n;
    if (start < 0) start += n;
    if (stop < 0) stop += n;
    start = Math.max(0, Math.min(n, start));
    stop = Math.max(0, Math.min(n, stop));
    for (let i = start; i < stop; i += step) out.push(i);
  } else {
    let start = s.start ?? n - 1;
    let stop = s.stop ?? -n - 1;
    if (start < 0) start += n;
    if (stop < 0) stop += n;
    start = Math.max(-1, Math.min(n - 1, start));
    stop = Math.max(-1, Math.min(n - 1, stop));
    for (let i = start; i > stop; i += step) out.push(i);
  }
  return out;
}

function checkInt(i: number, n: number, axis: number): number {
  if (i < -n || i >= n) throw new Fail(`IndexError: index ${i} is out of bounds for axis ${axis} with size ${n}`);
  return i < 0 ? i + n : i;
}

/** Evaluates `src` (e.g. "a[1:3, ::2]") against a rows x cols array whose entries are `val(r, c)`. */
export function evalIndex(src: string, rows: number, cols: number, val: (r: number, c: number) => number): IndexOutcome {
  try {
    const items = new Parser(tokenize(src), val).top();
    const dims = [rows, cols];
    const used = items.reduce((a, it) => a + (it.k === 'mask' ? 2 : 1), 0);
    if (used > 2) throw new Fail(`IndexError: too many indices for array: array is 2-dimensional, but ${used} were indexed`);
    // a boolean mask over the whole array
    if (items[0]!.k === 'mask') {
      const m = items[0]!.m;
      if (!m.arr) throw new Fail('This demo needs the mask to involve a, as in a > 5.');
      if (!m.bool) throw new Fail('That is an integer array, so NumPy would treat it as a list of positions. For a mask, compare: a % 2 == 0.');
      const cells: [number, number][] = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (m.at(r, c)) cells.push([r, c]);
      return { ok: true, cells, shape: [cells.length], kind: 'copy' };
    }
    type Ax = { k: 'int'; i: number } | { k: 'slice'; p: number[] } | { k: 'list'; p: number[] };
    const axes: Ax[] = [0, 1].map((ax) => {
      const it = items[ax];
      const n = dims[ax]!;
      if (!it) return { k: 'slice', p: slicePositions(n, { start: null, stop: null, step: null }) };
      if (it.k === 'int') return { k: 'int', i: checkInt(it.v, n, ax) };
      if (it.k === 'slice') return { k: 'slice', p: slicePositions(n, it) };
      if (it.k === 'list') return { k: 'list', p: it.v.map((v) => checkInt(v, n, ax)) };
      if (it.k === 'blist') {
        if (it.v.length !== n) throw new Fail(`IndexError: boolean index did not match indexed array along axis ${ax}; size of axis is ${n} but size of corresponding boolean axis is ${it.v.length}`);
        return { k: 'list', p: it.v.flatMap((b, i) => (b ? [i] : [])) };
      }
      throw new Fail('IndexError: a mask must be the only index here');
    });
    const [A0, A1] = axes as [Ax, Ax];
    const anyList = A0.k === 'list' || A1.k === 'list';
    if (!anyList) {
      if (A0.k === 'int' && A1.k === 'int') return { ok: true, cells: [[A0.i, A1.i]], shape: [], kind: 'scalar' };
      if (A0.k === 'int' && A1.k === 'slice') return { ok: true, cells: A1.p.map((c) => [A0.i, c]), shape: [A1.p.length], kind: 'view' };
      if (A0.k === 'slice' && A1.k === 'int') return { ok: true, cells: A0.p.map((r) => [r, A1.i]), shape: [A0.p.length], kind: 'view' };
      const p0 = (A0 as { p: number[] }).p, p1 = (A1 as { p: number[] }).p;
      return { ok: true, cells: p0.flatMap((r) => p1.map((c): [number, number] => [r, c])), shape: [p0.length, p1.length], kind: 'view' };
    }
    if (A0.k !== 'slice' && A1.k !== 'slice') {
      // advanced indexes on both axes are paired up, broadcasting a scalar or a length-1 list
      const s0 = A0.k === 'int' ? [A0.i] : A0.p;
      const s1 = A1.k === 'int' ? [A1.i] : A1.p;
      const sh = (s: number[], a: Ax) => (a.k === 'int' ? '()' : `(${s.length},)`);
      if (s0.length !== s1.length && s0.length !== 1 && s1.length !== 1) throw new Fail(`IndexError: shape mismatch: indexing arrays could not be broadcast together with shapes ${sh(s0, A0)} ${sh(s1, A1)}`);
      const L = Math.max(s0.length, s1.length);
      const cells: [number, number][] = [];
      for (let k = 0; k < L; k++) cells.push([s0[s0.length === 1 ? 0 : k]!, s1[s1.length === 1 ? 0 : k]!]);
      return { ok: true, cells, shape: [L], kind: 'copy' };
    }
    if (A0.k === 'list' && A1.k === 'slice') return { ok: true, cells: A0.p.flatMap((r) => A1.p.map((c): [number, number] => [r, c])), shape: [A0.p.length, A1.p.length], kind: 'copy' };
    if (A0.k === 'slice' && A1.k === 'list') return { ok: true, cells: A0.p.flatMap((r) => A1.p.map((c): [number, number] => [r, c])), shape: [A0.p.length, A1.p.length], kind: 'copy' };
    throw new Fail('This combination is not supported in the demo.');
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.message };
    return { ok: false, error: `SyntaxError: ${(e as Error).message}` };
  }
}

/** Python-style shape tuple: [] -> "()", [3] -> "(3,)", [2, 3] -> "(2, 3)". */
export function shapeStr(shape: number[]): string {
  if (shape.length === 0) return '()';
  if (shape.length === 1) return `(${shape[0]},)`;
  return `(${shape.join(', ')})`;
}
