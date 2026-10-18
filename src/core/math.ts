import katex from 'katex';
import { escapeHtml } from './dom';

let macros: Record<string, string> = {};

/** Set by the page before rendering so `\sym...` shorthands resolve to that page's symbols. */
export function setMacros(m: Record<string, string>): void {
  macros = { ...m };
}

export function tex(src: string, display = false): string {
  try {
    return katex.renderToString(src, {
      displayMode: display,
      macros: { ...macros },
      trust: (ctx) => ctx.command === '\\htmlClass',
      strict: 'ignore',
      throwOnError: true,
      output: 'html',
    });
  } catch (e) {
    console.error('KaTeX:', (e as Error).message, '\n', src);
    return `<code class="tex-error">${escapeHtml(src)}</code>`;
  }
}

/**
 * A small Markdown dialect for prose: blank-line paragraphs, `- ` and `1. ` lists, `### ` headings,
 * **bold**, *italic*, `code`, [links](url), $inline math$. Lines starting with `<` pass through as HTML.
 * Identifiers in backticks that name a page symbol are linked like code.
 */
export function md(src: string, symIdx: Map<string, string> = new Map()): string {
  const stash: string[] = [];
  const keep = (html: string) => `${stash.push(html) - 1}`;
  let s = src
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m: string) => keep(tex(m, true)))
    .replace(/(^|[^\\])\$([^$\n]+?)\$/g, (_, pre: string, m: string) => pre + keep(tex(m)))
    .replace(/\\\$/g, '$')
    .replace(/`([^`\n]+)`/g, (_, c: string) => {
      const sym = symIdx.get(c);
      return keep(sym ? `<code class="sym sym-${sym}">${escapeHtml(c)}</code>` : `<code>${escapeHtml(c)}</code>`);
    });
  const inline = (t: string) =>
    t
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t2: string, u: string) => {
        const ext = /^https?:/.test(u);
        return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t2}</a>`;
      });
  const blocks = s.trim().split(/\n\s*\n/);
  const out = blocks.map((b) => {
    const t = b.trim();
    if (t.startsWith('<')) return t;
    if (/^#{2,4} /.test(t)) {
      const lvl = t.match(/^#+/)![0].length;
      return `<h${lvl}>${inline(t.slice(lvl + 1))}</h${lvl}>`;
    }
    const lines = t.split('\n');
    if (lines.every((l) => /^\s*[-*] /.test(l) || /^\s{2,}\S/.test(l))) {
      const items = t.split(/\n(?=\s*[-*] )/).map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`);
      return `<ul>${items.join('')}</ul>`;
    }
    if (/^\d+\. /.test(lines[0]!)) {
      const items = t.split(/\n(?=\d+\. )/).map((l) => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`);
      return `<ol>${items.join('')}</ol>`;
    }
    return `<p>${inline(t.replace(/\n/g, ' '))}</p>`;
  });
  return out.join('\n').replace(/(\d+)/g, (_, n: string) => stash[Number(n)]!);
}
