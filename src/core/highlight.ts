// Syntax highlighting for the listings, a line at a time: Python, Nix and shell.
import { escapeHtml } from './dom';

export type Lang = 'python' | 'nix' | 'shell';

const KEYWORDS = new Set(
  'and as assert break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield'.split(' '),
);
const BUILTINS = new Set('print range len int float str list dict tuple zip enumerate min max sum abs self super isinstance sorted reversed map'.split(' '));

/** Sentinel bracketing a live slot index inside source text, outside any real character range. */
export const LIVE_OPEN = '';
export const LIVE_CLOSE = '';

export type Slot = { name: string; init: string };
export type TokState = { inTriple: string | null };
type Highlighter = (line: string, st: TokState, symIdx: Map<string, string>, slots: Slot[]) => string;

const span = (cls: string, s: string) => `<span class="${cls}">${escapeHtml(s)}</span>`;

/** Fills in the live slots inside already highlighted text. */
const fill = (s: string, slots: Slot[]) =>
  s.replace(new RegExp(`${LIVE_OPEN}(\\d+)${LIVE_CLOSE}`, 'g'), (_, n: string) => {
    const sl = slots[Number(n)]!;
    return `<span class="live" data-live="${sl.name}">${escapeHtml(sl.init)}</span>`;
  });

/** Identifiers in `symIdx` get the matching `sym-*` class. */
const python: Highlighter = (line, st, symIdx, slots) => {
  let out = '';
  let i = 0;
  const slot = (s: string) => fill(s, slots);
  if (st.inTriple) {
    const end = line.indexOf(st.inTriple);
    if (end < 0) return span('tk-str', line);
    out += span('tk-str', line.slice(0, end + 3));
    i = end + 3;
    st.inTriple = null;
  }
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpMatchArray | null;
    if (rest[0] === LIVE_OPEN) {
      const end = rest.indexOf(LIVE_CLOSE);
      out += slot(rest.slice(0, end + 1));
      i += end + 1;
    } else if (rest[0] === '#') {
      out += slot(span('tk-com', rest));
      break;
    } else if ((m = rest.match(/^[rbfu]?("""|''')/i))) {
      const q = m[1]!;
      const end = rest.indexOf(q, m[0].length);
      if (end < 0) {
        out += span('tk-str', rest);
        st.inTriple = q;
        break;
      }
      out += span('tk-str', rest.slice(0, end + 3));
      i += end + 3;
    } else if ((m = rest.match(/^[rbfu]?(['"])(?:\\.|(?!\1).)*\1?/i))) {
      out += slot(span('tk-str', m[0]));
      i += m[0].length;
    } else if ((m = rest.match(/^(?:\d+\.?\d*(?:e[-+]?\d+)?|\.\d+(?:e[-+]?\d+)?)j?/i))) {
      out += span('tk-num', m[0]);
      i += m[0].length;
    } else if ((m = rest.match(/^[A-Za-z_]\w*/))) {
      const w = m[0];
      const prev = line.slice(0, i).trimEnd();
      const sym = symIdx.get(w);
      if (sym && !prev.endsWith('.')) out += `<span class="sym sym-${sym}">${w}</span>`;
      else if (KEYWORDS.has(w)) out += span('tk-kw', w);
      else if (prev.endsWith('def') || prev.endsWith('class')) out += span('tk-def', w);
      else if (BUILTINS.has(w)) out += span('tk-bi', w);
      else if (line.slice(i + w.length).startsWith('(')) out += span('tk-fn', w);
      else out += escapeHtml(w);
      i += w.length;
    } else if ((m = rest.match(/^[-+*/%=<>!&|^~@:]+/))) {
      out += span('tk-op', m[0]);
      i += m[0].length;
    } else {
      out += escapeHtml(rest[0]!);
      i += 1;
    }
  }
  return out;
};

const NIX_KEYWORDS = new Set('let in with rec inherit if then else assert or'.split(' '));
const NIX_BUILTINS = new Set('import map throw abort toString true false null'.split(' '));

/** Paths, `<nixpkgs>` and `builtins.*` get their own colors; a name before `=` reads as a definition. */
const nix: Highlighter = (line, st, symIdx, slots) => {
  let out = '';
  let i = 0;
  if (st.inTriple) {
    const end = line.indexOf(st.inTriple);
    if (end < 0) return fill(span('tk-str', line), slots);
    out += fill(span('tk-str', line.slice(0, end + 2)), slots);
    i = end + 2;
    st.inTriple = null;
  }
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpMatchArray | null;
    if (rest[0] === LIVE_OPEN) {
      const end = rest.indexOf(LIVE_CLOSE);
      out += fill(rest.slice(0, end + 1), slots);
      i += end + 1;
    } else if (rest[0] === '#') {
      out += fill(span('tk-com', rest), slots);
      break;
    } else if (rest.startsWith("''")) {
      const end = rest.indexOf("''", 2);
      if (end < 0) {
        out += fill(span('tk-str', rest), slots);
        st.inTriple = "''";
        break;
      }
      out += fill(span('tk-str', rest.slice(0, end + 2)), slots);
      i += end + 2;
    } else if ((m = rest.match(/^"(?:\\.|[^"\\])*"?/))) {
      out += fill(span('tk-str', m[0]), slots);
      i += m[0].length;
    } else if ((m = rest.match(/^(?:\.{0,2}\/[\w.+-][\w.+/-]*|<[\w.+/-]+>)/))) {
      out += span('tk-str', m[0]);
      i += m[0].length;
    } else if ((m = rest.match(/^\d+(?:\.\d+)?/))) {
      out += span('tk-num', m[0]);
      i += m[0].length;
    } else if ((m = rest.match(/^builtins(?:\.[A-Za-z_][\w']*)?/))) {
      out += span('tk-bi', m[0]);
      i += m[0].length;
    } else if ((m = rest.match(/^[A-Za-z_][\w'-]*/))) {
      const w = m[0];
      const sym = symIdx.get(w);
      if (sym) out += `<span class="sym sym-${sym}">${w}</span>`;
      else if (NIX_KEYWORDS.has(w)) out += span('tk-kw', w);
      else if (NIX_BUILTINS.has(w)) out += span('tk-bi', w);
      else if (/^\s*=(?!=)/.test(rest.slice(w.length))) out += span('tk-def', w);
      else out += escapeHtml(w);
      i += w.length;
    } else if ((m = rest.match(/^(?:\/\/|\+\+|==|!=|&&|\|\||->|<=|>=|[-+*?:=@!<>])/))) {
      out += span('tk-op', m[0]);
      i += m[0].length;
    } else {
      out += escapeHtml(rest[0]!);
      i += 1;
    }
  }
  return out;
};

/** A line that starts `$ ` is a command; any other line is what the last one printed, set back like a comment. */
const shell: Highlighter = (line, _st, _symIdx, slots) => {
  const cmd = line.match(/^(\s*)\$ (.*)$/);
  if (!cmd) return line ? fill(span('tk-com', line), slots) : '';
  let out = `${cmd[1]}${span('tk-op', '$')} `;
  const src = cmd[2]!;
  let i = 0;
  let head = true;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\s+/))) {
      out += m[0];
    } else if (rest[0] === '#') {
      out += fill(span('tk-com', rest), slots);
      break;
    } else if ((m = rest.match(/^(?:\|\||&&|[|;])/))) {
      out += span('tk-op', m[0]);
      head = true;
    } else if ((m = rest.match(/^(['"])(?:\\.|(?!\1).)*\1?/))) {
      out += fill(span('tk-str', m[0]), slots);
      head = false;
    } else if ((m = rest.match(/^[^\s|;&'"]+/))) {
      const w = m[0];
      const cls = head ? 'tk-bi' : w.startsWith('-') ? 'tk-op' : /[/:#]/.test(w) ? 'tk-str' : '';
      out += cls ? fill(span(cls, w), slots) : fill(escapeHtml(w), slots);
      head = false;
    } else {
      m = [rest[0]!] as RegExpMatchArray;
      out += escapeHtml(rest[0]!);
    }
    i += m[0].length;
  }
  return out;
};

/** The highlighted HTML of one line of a listing; `st` carries a multi-line string to the next line. */
export const highlightLine: Record<Lang, Highlighter> = { python, nix, shell };
