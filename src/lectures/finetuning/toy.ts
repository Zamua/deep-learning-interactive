import { Rng } from '../../core/rand';
import { type Example, ToyLM, VOCAB, chatDocs, examples, ids, webDocs } from '../../lib/finetuning-toylm';

/** The chapter's toy, run once: pretrain, then fine-tune with and without replay. */

export const TOY_PROMPTS = ['what is the capital of france ?', '<user> what is the capital of japan ? <bot>', '<user> where is egypt ? <bot>'];
export const SFT_STEPS = 400;
const SNAPS = [0, 8, 16, 24, 40, 60, 100, 150, 200, 300, 400];

export interface Run {
  /** [step, demo loss, web loss] every 4 steps. */
  curve: [number, number, number][];
  /** Greedy completions of each prompt at each snapshot step. */
  gens: Map<number, string[][]>;
}

export interface ToyResult {
  base: string[][];
  plain: Run;
  replay: Run;
}

const words = (m: ToyLM) => TOY_PROMPTS.map((p) => m.generate(ids(p)).map((i) => VOCAB[i]!));

function* compute(): Generator<void, ToyResult> {
  const wex = examples(webDocs(600, 3), true);
  const held = new Rng(4).shuffle(examples(webDocs(150, 99), true)).slice(0, 700);
  const cex = examples(chatDocs(5));
  const model = new ToyLM(7);
  const pr = new Rng(1);
  for (let s = 0; s < 1200; s++) {
    const b: Example[] = [];
    for (let i = 0; i < 32; i++) b.push(wex[pr.int(wex.length)]!);
    model.step(b, s < 800 ? 0.01 : 0.003);
    if (s % 60 === 59) yield;
  }
  const base = model.clone();
  const run = function* (replay: boolean): Generator<void, Run> {
    const m = base.clone();
    const rng = new Rng(2);
    const curve: Run['curve'] = [];
    const gens: Run['gens'] = new Map();
    for (let step = 0; step <= SFT_STEPS; step++) {
      if (step % 4 === 0) curve.push([step, m.loss(cex), m.loss(held)]);
      if (SNAPS.includes(step)) gens.set(step, words(m));
      if (step === SFT_STEPS) break;
      const b: Example[] = [];
      for (let i = 0; i < 16; i++) b.push(cex[rng.int(cex.length)]!);
      if (replay) for (let i = 0; i < 16; i++) b.push(wex[rng.int(wex.length)]!);
      m.step(b, 0.01);
      if (step % 20 === 19) yield;
    }
    return { curve, gens };
  };
  const plain = yield* run(false);
  const replay = yield* run(true);
  return { base: words(base), plain, replay };
}

let job: Generator<void, ToyResult> | null = null;
let result: ToyResult | null = null;

const pump = () => {
  if (result) return;
  job ??= compute();
  const r = job.next();
  if (r.done) result = r.value;
  else setTimeout(pump, 0);
};
if (typeof window !== 'undefined') setTimeout(pump, 400);

/** The finished result, computing whatever is left synchronously if the background job is behind. */
export function toy(): ToyResult {
  if (result) return result;
  job ??= compute();
  for (;;) {
    const r = job.next();
    if (r.done) return (result = r.value);
  }
}

/** The last snapshot at or before `step`. */
export function gensAt(run: Run, step: number): string[][] {
  let best = 0;
  for (const k of run.gens.keys()) if (k <= step && k >= best) best = k;
  return run.gens.get(best)!;
}
