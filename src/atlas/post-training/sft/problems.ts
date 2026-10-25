import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round, vec } from '../../kit';
import { choose, LN, sumTex, traps, useLn, vtraps } from '../kit';

/** Single-turn chats: the user's question and the assistant's reply, as tokens (the reply without `<end>`). */
const CHATS: [string[], string[]][] = [
  [['capital', 'of', 'peru', '?'], ['lima', '.']],
  [['2', '+', '2', '?'], ['4', '.']],
  [['say', 'hello'], ['hello', '!']],
  [['opposite', 'of', 'hot', '?'], ['cold', '.']],
  [['largest', 'planet', '?'], ['jupiter', '.']],
  [['translate', 'gato'], ['cat']],
  [['color', 'of', 'grass', '?'], ['green', '.']],
  [['spider', 'legs', '?'], ['eight', '.']],
  [['first', 'month', '?'], ['january', '.']],
  [['name', 'a', 'fruit'], ['an', 'apple', '.']],
  [['hi'], ['hello', '!']],
  [['3', 'times', '3'], ['9']],
  [['dog', 'in', 'french'], ['chien']],
  [['sky', 'color', '?'], ['blue']],
  [['2', '+', '3'], ['5']],
];

const M = '\\sym{m}{m}';

/** `k` different chats. */
function chats(rng: Rng, k: number): [string[], string[]][] {
  return rng.shuffle(CHATS.slice()).slice(0, k);
}

/** A conversation's tokens, one turn per line as the listing shows them, and which tokens the assistant wrote. */
function layout(cs: [string[], string[]][]): { toks: string[]; mine: boolean[]; lines: string[] } {
  const toks: string[] = [];
  const mine: boolean[] = [];
  const lines: string[] = [];
  for (const [q, a] of cs) {
    const user = ['<user>', ...q];
    const asst = ['<asst>', ...a, '<end>'];
    user.forEach((t) => (toks.push(t), mine.push(false)));
    asst.forEach((t, i) => (toks.push(t), mine.push(i > 0)));
    lines.push(user.join(' '), asst.join(' '));
  }
  return { toks, mine, lines };
}

const quote = (cs: [string[], string[]][]): string => cs.map(([q, a]) => `\`<user> ${q.join(' ')} <asst> ${a.join(' ')} <end>\``).join(' then ');

export const generators: Generator[] = [
  {
    id: 'count',
    make(rng, d) {
      if (d < 0.6) {
        const turns = d < 0.3 ? 1 : 2;
        const cs = chats(rng, turns);
        const { toks, mine, lines } = layout(cs);
        const graded = mine.filter(Boolean).length;
        const last = cs[turns - 1]![1].length + 1;
        return {
          prompt: `A training conversation is tokenized as in the listing, one turn per line. In supervised fine-tuning, how many of its ${toks.length} tokens carry loss?`,
          code: lines.join('\n'),
          answer: { kind: 'number', value: graded },
          traps: traps(graded, [
            { value: toks.length, why: 'That counts every token. The mask leaves the user\'s turns and the role markers out of the loss.' },
            { value: graded - turns, why: 'That leaves out `<end>`. The end token is part of the reply: predicting it is how the model learns to stop.' },
            { value: graded + turns, why: 'That counts the `<asst>` marker. The template puts it there, not the assistant, so it gets a 0.' },
            { value: toks.length - graded, why: 'That counts the tokens the mask leaves out: the user\'s turns and the markers.' },
            ...(turns > 1 ? [{ value: last, why: 'That counts only the last reply. Every reply is the assistant\'s writing, and each one carries loss.' }] : []),
          ]),
          solution: [
            `The mask is 1 on each token the assistant wrote: ${cs.map(([, a]) => [...a, '<end>'].map((t) => `\`${t}\``).join(' ')).join(', and ')}.`,
            'The `<user>` and `<asst>` markers and the user\'s words get 0: they stay in the input, but their predictions are not graded.',
            turns > 1 ? `That is $${cs.map(([, a]) => a.length + 1).join(' + ')} = ${graded}$ tokens carrying loss.` : `That is ${graded} tokens carrying loss.`,
          ],
        };
      }
      const sys = pick(rng, [0, 20, 30, 40, 64]);
      const u = [int(rng, 8, 30), int(rng, 5, 20)];
      const a = [int(rng, 10, 60), int(rng, 6, 40)];
      const graded = a[0]! + a[1]!;
      const total = sys + u[0]! + u[1]! + graded;
      const sysText = sys ? `a ${sys}-token system prompt, then ` : '';
      return {
        prompt: `A training conversation has ${sysText}a user turn of ${u[0]} tokens, an assistant reply of ${a[0]} tokens, a second user turn of ${u[1]} tokens and a second reply of ${a[1]} tokens. Each reply's count includes the \`<end>\` token that closes it. In supervised fine-tuning, how many tokens carry loss?`,
        answer: { kind: 'number', value: graded },
        traps: traps(graded, [
          { value: total, why: 'That counts every token. The mask leaves out everything the assistant did not write.' },
          { value: total - graded, why: 'That counts the tokens the mask leaves out. The loss is on the replies.' },
          { value: a[1]!, why: 'That counts only the last reply. Every reply is the assistant\'s writing, and each one carries loss.' },
          { value: graded - 2, why: 'That leaves out the two `<end>` tokens. They are part of the replies: predicting them is how the model learns to stop.' },
        ]),
        solution: [
          `Only the replies carry loss: ${a[0]} and ${a[1]} tokens, each including its \`<end>\`.`,
          `${sys ? 'The system prompt and the' : 'The'} user's turns stay in the input as context, with mask 0.`,
          `So $${a[0]} + ${a[1]} = ${graded}$ of the ${total} tokens carry loss.`,
        ],
      };
    },
  },
  {
    id: 'mean-loss',
    make(rng, d) {
      const [q, a0] = chats(rng, 1)[0]!;
      const words = d < 0.35 ? [a0[0]!] : a0;
      const q2 = q.slice(0, 3);
      const toks = ['<user>', ...q2, '<asst>', ...words, '<end>'];
      const mine = toks.map((_, i) => i > q2.length + 1);
      const p = toks.map((t, i) => (i === 0 ? 0 : !mine[i] ? (t === '<asst>' ? pick(rng, [0.8, 0.9]) : pick(rng, [0.1, 0.2, 0.25, 0.4])) : t === '<end>' ? pick(rng, [0.5, 0.8, 0.9]) : pick(rng, [0.4, 0.5, 0.6, 0.8, 0.9])));
      const nll = p.map((v) => (v ? -LN(v) : 0));
      const graded = nll.filter((_, i) => mine[i]);
      const n = graded.length;
      const sum = round(graded.reduce((s, v) => s + v, 0), 2);
      const v = sum / n;
      const all = nll.slice(1);
      const width = Math.max(...toks.map((t) => t.length)) + 3;
      const code = toks.map((t, i) => (i === 0 ? t : `${t.padEnd(width)}p = ${num(p[i]!)}`)).join('\n');
      return {
        prompt: `Beside each token of the conversation in the listing is $\\symp$, the probability the model gave it. What is the supervised fine-tuning loss $\\symL$? Round to two decimals.\n\nUse ${useLn(p.filter((x) => x > 0))}.`,
        code,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: all.reduce((s, x) => s + x, 0) / all.length, why: 'That averages over every token. The user\'s words and the markers stay in the input, but their predictions are not graded.' },
            { value: sum, why: `That is the sum. The loss divides it by the number of graded tokens, ${n}.` },
            { value: graded.slice(0, -1).reduce((s, x) => s + x, 0) / (n - 1), why: 'That leaves out `<end>`. The end token is part of the reply: predicting it is how the model learns to stop.' },
            { value: sum / toks.length, why: `That divides by all ${toks.length} tokens. Divide by the number of graded tokens, ${n}.` },
          ],
          2,
        ),
        solution: [
          'The loss averages $-\\ln \\symp$ over the tokens with mask 1, the ones the assistant wrote.',
          `The assistant's tokens are ${toks.filter((_, i) => mine[i]).map((t) => `\`${t}\``).join(', ')}; the \`<user>\` and \`<asst>\` markers and the question get mask 0.`,
          `Their losses: ${p.filter((_, i) => mine[i]).map((x) => `$-\\ln ${num(x)} \\approx ${num(-LN(x), 2)}$`).join(', ')}.`,
          `Average them: $(${sumTex(graded, 2)}) / ${n} = ${num(sum, 2)} / ${n} \\approx ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'mask',
    make(rng, d) {
      const pool = CHATS.filter(([q, a]) => q.length + a.length <= (d < 0.5 ? 5 : 4));
      const turns = d < 0.5 ? 1 : 2;
      const cs = rng.shuffle(pool.slice()).slice(0, turns);
      const { toks, mine, lines } = layout(cs);
      const m = mine.map((x) => (x ? 1 : 0));
      const isAsst = toks.map((t) => t === '<asst>');
      const isEnd = toks.map((t) => t === '<end>');
      return {
        prompt: `What is the loss mask $${M}$ for the ${toks.length} tokens of the conversation ${lines.map((l) => `\`${l}\``).join(' ')}?`,
        answer: { kind: 'vector', value: m },
        traps: vtraps(m, [
          { value: m.map((x) => 1 - x), why: 'That is the mask flipped. The loss belongs on the assistant\'s tokens, not the user\'s.' },
          { value: m.map((x, i) => (isAsst[i] ? 1 : x)), why: 'That gives the `<asst>` marker a 1. The template puts it there, not the assistant, so it gets a 0.' },
          { value: m.map((x, i) => (isEnd[i] ? 0 : x)), why: 'That gives `<end>` a 0. The end token is part of the reply: predicting it is how the model learns to stop.' },
          { value: m.map(() => 1), why: 'That grades every token, so the model would also learn to write the user\'s questions.' },
        ]),
        solution: [
          'The mask is 1 on each token the assistant wrote, its `<end>` included, and 0 on everything else.',
          `The 1s go on ${toks.filter((_, i) => mine[i]).map((t) => `\`${t}\``).join(', ')}.`,
          `So $${M} = ${vec(m)}$.`,
        ],
      };
    },
  },
  {
    id: 'why-mask',
    make(rng) {
      const cs = chats(rng, 1);
      const ex = `Take the conversation ${quote(cs)}.`;
      const kind = rng.int(3);
      if (kind === 0) {
        return {
          prompt: `${ex} Why does supervised fine-tuning count the loss only on the assistant's tokens?`,
          answer: choose('The model should learn to write the replies, not the questions it is asked', [
            ['Leaving the user\'s tokens out of the input makes each step cheaper', 'The user\'s tokens stay in the input: the model reads the question to answer it. They are only left out of the loss.'],
            ['The model has no probabilities for the user\'s tokens to grade', 'It predicts a next token at every position, the user\'s included. The mask only decides which predictions are graded.'],
            ['Grading the user\'s tokens would make the loss come out negative', 'Every token\'s loss is minus the log of a probability, which is never negative.'],
          ]),
          solution: [
            'With every token graded, the model would also be trained to write questions like the user\'s.',
            'The mask keeps the question in the input, as context, and grades only the reply and its `<end>`.',
          ],
        };
      }
      if (kind === 1) {
        return {
          prompt: `${ex} During supervised fine-tuning with the loss mask, what happens to the user's tokens?`,
          answer: choose('The model reads them as context, but is not graded on predicting them', [
            ['They are deleted, so the model sees only the reply', 'Masked tokens stay in the input: without the question the reply would make no sense.'],
            ['They are graded like the reply, only with a smaller weight', 'Their mask is 0, so their predictions add nothing to the loss.'],
            ['They are graded only where the model predicts them badly', 'The mask is fixed by who wrote each token, not by how well the model predicts it.'],
          ]),
          solution: [
            'The mask is 0 on the user\'s tokens, so their predictions add nothing to the loss.',
            'They are still in the input, so every reply token is predicted from the full question.',
          ],
        };
      }
      return {
        prompt: `${ex} Why does the \`<end>\` token get a 1 in the loss mask?`,
        answer: choose('Predicting it is how the model learns to stop when its reply is done', [
          ['It marks where the loss stops being added up', 'The mask decides what is graded token by token; `<end>` is graded because the assistant writes it.'],
          ['It is the last token, and the last token is always graded', 'Position does not decide the mask: who wrote the token does. The assistant writes `<end>`.'],
          ['It does not: like the markers, it gets a 0', '`<end>` is part of the reply, not the template. Without its 1 the model never learns to stop.'],
        ]),
        solution: [
          'The assistant writes `<end>` when its reply is finished, so it is part of the reply and gets a 1.',
          'Training on it teaches the model when to stop; the `<user>` and `<asst>` markers come from the template and get 0.',
        ],
      };
    },
  },
];
