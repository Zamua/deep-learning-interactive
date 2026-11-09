// Where a part's concepts sit when the map draws one part of a course: rows from what each builds on, then top to bottom.

export interface PartNode {
  id: string;
  /** What it builds on; ids outside the drawing are ignored. */
  prereqs: readonly string[];
}

/** A node's column as a share of the width, centered in its row. */
export interface Placed {
  id: string;
  row: number;
  x: number;
}

/**
 * Rows in reading order: a node sits below everything it builds on, a row holds at most `perRow` (a fuller one spills
 * onto the rows under it), and each node is placed near the middle of what it builds on, so edges cross less.
 */
export function layoutPart(nodes: readonly PartNode[], perRow = 3): Placed[] {
  const known = new Map(nodes.map((n) => [n.id, n]));
  const within = (n: PartNode) => n.prereqs.filter((p) => known.has(p));
  const depths = new Map<string, number>();
  const depth = (n: PartNode): number => {
    let d = depths.get(n.id);
    if (d === undefined) depths.set(n.id, (d = Math.max(-1, ...within(n).map((p) => depth(known.get(p)!))) + 1));
    return d;
  };
  const byDepth: PartNode[][] = [];
  for (const n of nodes) (byDepth[depth(n)] ??= []).push(n);

  const placed = new Map<string, Placed>();
  let row = 0;
  for (const level of byDepth) {
    if (!level) continue;
    const near = (n: PartNode) => {
      const xs = within(n).map((p) => placed.get(p)!.x);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0.5;
    };
    const ordered = [...level].sort((a, b) => near(a) - near(b));
    for (let i = 0; i < ordered.length; i += perRow, row++) {
      const chunk = ordered.slice(i, i + perRow);
      chunk.forEach((n, k) => placed.set(n.id, { id: n.id, row, x: (k + 0.5) / chunk.length }));
    }
  }
  return nodes.map((n) => placed.get(n.id)!);
}

/** A title broken into lines of about `width` characters, at most `lines` of them. */
export function wrapTitle(title: string, width: number, lines = 3): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of title.split(' ')) {
    if (line && (line + ' ' + word).length > width && out.length < lines - 1) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  return [...out, line];
}
