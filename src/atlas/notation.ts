// Mathematical notation beyond arithmetic. A concept may use a mark only once its own narration
// or an earlier concept's has said what it means; notation.test.ts holds the course to that.

export interface Notation {
  /** A use in TeX: prompts, solutions, marks on the stage. */
  tex: RegExp;
  /** The mark as a caption writes it, in Unicode. */
  shown: RegExp;
  /** `shown` is a plain word, which a scene's code may also spell (a beat id, a key). */
  word?: boolean;
  name: string;
  about: string;
  /** TeX for the lookup card. */
  glyph: string;
  /** The concepts whose narration first explains it, each on a chain no other one is on. */
  from: string[];
}

export const NOTATION: Record<string, Notation> = {
  partial: {
    tex: /\\partial/,
    shown: /∂/,
    name: 'partial derivative',
    about: 'A curly d, read “partial”. ∂f/∂x is how fast f changes when only x moves, with every other input held still. With x the only input, it is the plain derivative, f′(x).',
    glyph: String.raw`\partial f / \partial x`,
    from: ['partials'],
  },
  nabla: {
    tex: /\\nabla/,
    shown: /∇/,
    name: 'nabla: the gradient',
    about: 'An upside-down triangle, read “nabla”. ∇f stacks every partial derivative of f into one vector, which points the way f climbs fastest.',
    glyph: String.raw`\nabla f`,
    from: ['gradient'],
  },
  leibniz: {
    tex: /\\d?frac\{d[^}]*\}\{d/,
    shown: /(^|[^∂\w])d[a-zσ]+\/d[a-z]/,
    name: 'derivative',
    about: 'dz/dx, read “d z, d x”: how fast z changes per tiny change in x.',
    glyph: String.raw`\frac{dz}{dx}`,
    from: ['chain-slopes'],
  },
  prime: {
    tex: /[A-Za-z]'\(|\\prime/,
    shown: /′/,
    name: 'prime: the derivative',
    about: 'f′(x), read “f prime of x”: the slope of f at x.',
    glyph: String.raw`f'(x)`,
    from: ['slope'],
  },
  delta: {
    tex: /\\Delta/,
    shown: /Δ/,
    name: 'delta: the change in',
    about: 'The Greek capital delta. Δx is the change in x.',
    glyph: String.raw`\Delta x`,
    from: ['derivative'],
  },
  approx: {
    tex: /\\approx/,
    shown: /≈/,
    name: 'is about',
    about: 'A wavy equals sign: the two sides are nearly equal.',
    glyph: String.raw`\approx`,
    from: ['e-and-ln', 'derivative'],
  },
  sum: {
    tex: /\\sum/,
    shown: /[Σ∑]/,
    name: 'sum',
    about: 'A capital Greek sigma: add up what follows, once for every value of the index written below it.',
    glyph: String.raw`\textstyle\sum_i`,
    from: ['dot-product', 'softmax'],
  },
  sqrt: {
    tex: /\\sqrt/,
    shown: /√/,
    name: 'square root',
    about: '√a is the positive number whose square is a.',
    glyph: String.raw`\sqrt{a}`,
    from: ['minibatch', 'adam', 'variance-sum', 'bptt'],
  },
  norm: {
    tex: /\\lVert|\\\|/,
    shown: /‖/,
    name: 'norm: a vector’s length',
    about: '‖g‖ is g’s length as an arrow: the square root of its squared entries added up.',
    glyph: String.raw`\lVert g \rVert`,
    from: ['autoencoder', 'bptt'],
  },
  transpose: {
    tex: /\^\{?(\\top|T)\}?(?![\w{])/,
    shown: /ᵀ/,
    name: 'transpose',
    about: 'Wᵀ, read “W transpose”: W with its rows turned into columns, so Wᵀ times a vector dots each column of W with it. Code writes W.T.',
    glyph: String.raw`W^\top`,
    from: ['matrix-shape'],
  },
  hadamard: {
    tex: /\\odot/,
    shown: /⊙/,
    name: 'entry-by-entry product',
    about: 'a ⊙ b multiplies matching entries of a and b.',
    glyph: String.raw`a \odot b`,
    from: [],
  },
  hat: {
    tex: /\\hat|\\widehat/,
    shown: /̂/,
    name: 'hat',
    about: 'A hat over a letter marks an estimate, a guess or a rebuilt version of it.',
    glyph: String.raw`\hat x`,
    from: ['adam', 'batch-norm', 'autoencoder', 'diffusion-loss', 'dpo'],
  },
  bar: {
    tex: /\\bar\b|\\overline/,
    shown: /̄|ᾱ/,
    name: 'bar',
    about: 'A bar over a letter marks a related quantity, often a running product or an average.',
    glyph: String.raw`\bar x`,
    from: ['diffusion-noise'],
  },
  assign: {
    tex: /\\leftarrow|\\gets/,
    shown: /←/,
    name: 'gets',
    about: 'w ← w − ηg, read “w gets w minus eta g”: replace w with the right side.',
    glyph: String.raw`\leftarrow`,
    from: ['gd-step'],
  },
  arrow: {
    tex: /\\to(?![a-z])|\\rightarrow/,
    shown: /→/,
    name: 'arrow',
    about: 'Points from what goes in to what comes out, or toward a limit: “goes to”.',
    glyph: String.raw`\to`,
    from: ['matvec', 'power-rule', 'cross-entropy'],
  },
  neq: {
    tex: /\\ne(?![a-z])|\\neq/,
    shown: /≠/,
    name: 'is not equal to',
    about: 'An equals sign struck through: the two sides differ.',
    glyph: String.raw`\ne`,
    from: ['hinge-loss', 'softmax-grad'],
  },
  ineq: {
    tex: /\\le(?![a-z])|\\leq|\\ge(?![a-z])|\\geq/,
    shown: /[≤≥]/,
    name: 'at most, at least',
    about: 'a ≤ b reads “a is at most b”; a ≥ b reads “a is at least b”.',
    glyph: String.raw`\le \; \ge`,
    from: ['gd-step'],
  },
  infinity: {
    tex: /\\infty/,
    shown: /∞/,
    name: 'infinity',
    about: 'No end: larger than any number.',
    glyph: String.raw`\infty`,
    from: ['cross-entropy', 'activations'],
  },
  member: {
    tex: /\\in(?![a-z])/,
    shown: /∈/,
    name: 'is in',
    about: 'x ∈ ℝ⁴ reads “x is in R four”: x is one of the things in that set.',
    glyph: String.raw`\in`,
    from: ['vector'],
  },
  reals: {
    tex: /\\mathbb\{R\}/,
    shown: /ℝ/,
    name: 'the real numbers',
    about: 'Every number on the number line. ℝ⁴ is every list of four of them.',
    glyph: String.raw`\mathbb{R}`,
    from: ['vector'],
  },
  expect: {
    tex: /\\mathbb\{E\}/,
    shown: /𝔼/,
    name: 'expected value',
    about: 'The average over random draws.',
    glyph: String.raw`\mathbb{E}`,
    from: ['advantage'],
  },
  sim: {
    tex: /\\sim(?![a-z])/,
    shown: /∼/,
    name: 'drawn from',
    about: 'y ∼ π reads “y drawn from pi”: y is a random sample from π.',
    glyph: String.raw`\sim`,
    from: ['policy-gradient'],
  },
  max: {
    word: true,
    tex: /(?<!_\{?)\\max(?![a-z])|(?<!_\{?)\\min(?![a-z])/,
    shown: /(?<![\\\w{])(max|min)\b/,
    name: 'max and min',
    about: 'max(a, b) is the larger of a and b; min(a, b) the smaller.',
    glyph: String.raw`\max`,
    from: ['argmax', 'hinge-loss', 'neuron', 'pooling', 'comp-graph'],
  },
  argmax: {
    word: true,
    tex: /arg\s*\\?max|argmax/,
    shown: /arg ?max/,
    name: 'argmax',
    about: 'The position of the largest entry, not the entry itself.',
    glyph: String.raw`\arg\max`,
    from: ['argmax', 'unembedding', 'saliency', 'upsampling'],
  },
  log: {
    word: true,
    tex: /\\ln|\\log/,
    shown: /\bln\b|\blog\b/,
    name: 'logarithm',
    about: 'ln y asks: e to what power gives y? log₁₀ asks the same of 10.',
    glyph: String.raw`\ln`,
    from: ['e-and-ln'],
  },
  exp: {
    tex: /(^|[^\w\\])e\^|\\exp/,
    shown: /\be[²³¹⁰-₟ᴬ-ᵪˣⁱ]/,
    name: 'e to a power',
    about: 'e is about 2.718. eˣ is e multiplied by itself x times, defined for every x.',
    glyph: String.raw`e^x`,
    from: ['e-and-ln'],
  },
};
