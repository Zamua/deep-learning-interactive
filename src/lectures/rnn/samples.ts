// Precomputed with src/lib/rnn-charrnn.ts on src/lib/rnn-corpus.ts, so the narration can quote the
// text and every browser shows the same samples. MILESTONES and CURVE: the chapter's training loop
// (CharRNN(V, 64, seed 7), lr 0.1, 25-character chunks, a 160-character sample from Rng(3) at each
// milestone). The rest comes from the pretrained model in public/data/rnn-charrnn.json.

export const MILESTONES: { n: number; loss: number; text: string }[] = [
  { n: 0, loss: 98.8, text: "j!T'lVV;EaA,jUnsIhFgYpa\nsIvmRj;Nj\n\nUrdhmcc'NYpRUVbmrgNhiUysjhwl!'YsLaHUacOl;wflm'R;hmezzyctwoIewOd:eaEs!r,St g-FzY?\n;fephn.A.dhcjIw,yANVSaFg\nUmLTNz,-?.smpO'LE.." },
  { n: 100, loss: 98.3, text: "g, iiewut:ea.s\n,eycl kr\nyW \nintiisnttlAithA h os siIWtogtaredsWnYohousse'  oouWpArTeltr sautmoe Rlhfo uoirtwys cl llsoaii  araelf  e d Seofpeytnssrohvaea:rreiba" },
  { n: 300, loss: 94.6, text: " afosue sbhaohn.nCdr atatea\n bgg brr ea?\nAwe M shbi  a jo nbr ,rifrsrenn awmoldre dso  isrem sh\ni:eth:cye f  r o rhn;Sfst\n rhe.Wht te uvneeae alrsr rhe nsim wit" },
  { n: 1000, loss: 79, text: "angt ir cooly wat le and ond tevendly, fusnto stl\nAgor tire yipteaas.\nI ru.du hitr we hounonghe noe be t Fopsre: cotroo too uce'nonnsl the su oor\nWate pateze pd" },
  { n: 3000, loss: 51.8, text: "g bus contedon the\ngor sor geut,t to llllll,\nIlve ssre ans whar kay, helpve fh peir\nhe ho't, the that. Oor moy tod douy yod th hord thay ypizen:\ncirino co tid c" },
];

/** smooth_loss every 50 iterations, from 0 to 3000. */
export const CURVE = [98.8, 99.1, 98.3, 97.6, 96.6, 95.7, 94.6, 93.5, 92.5, 91.4, 90.3, 89.2, 88.1, 87, 85.8, 84.6, 83.4, 82.3, 81.2, 80.1, 79, 78, 76.9, 75.9, 74.9, 73.9, 73, 72, 71.1, 70.2, 69.4, 68.5, 67.6, 66.8, 66.1, 65.3, 64.5, 63.8, 63.1, 62.4, 61.6, 61, 60.4, 59.9, 59.6, 59.3, 58.8, 58.2, 57.6, 57.1, 56.6, 56.1, 55.5, 55, 54.5, 54.1, 53.6, 53.1, 52.7, 52.2, 51.8];

/** 200 characters at T = 1 after "First Citizen:\n", Rng(3). */
export const PRETRAINED = "We are accore theing tidy ungo faabst Citizen:\nOne wounthy peou care cusa them, dall sust to git cot on\ns-ct Caks bars rou, arreyow\nWi's here? Leswcied?\n\nAll:\nAghe hatrs, mat acurs: thy have corthen a";

/** Output scores y (one per vocab character) after reading each context. */
export const SCORES: Record<string, number[]> = {
  "First Citizen:\n": [2.81, -4.29, -1.35, 3.68, -3.55, -1.12, -1.96, 2.54, -1.92, -5.35, 1.56, 8.66, 3.76, -0.88, 4.15, 6.42, 6.64, 2.29, 0.03, 6.84, 4.18, 1.72, 5.89, 4, 0.38, 0.51, 8.26, 3.2, -0.15, -2.23, 0.98, 4.42, 0.5, -2.07, 2.57, -1.67, -0.07, -1.78, -0.37, 0.61, -2.82, -2.25, -0.17, -2.97, 1.75, 1.29, -1.18, -3.18, 0.67, 2.44, 3.05, -1.8],
  "the ": [-12.78, -2.37, 1.45, -6.97, -2.35, -5.75, -5.22, -8.01, -2.03, -7.27, -9.67, -4.64, -0.32, -10.99, -6.79, -7.28, -4.93, -3.01, -3.85, -7.15, -4.66, -6.11, -5.52, -5.08, -11.04, -4.22, -0.97, -5.1, 4.68, 0.8, 1.48, 6.25, 0.25, 3.26, 4.54, 1.29, 1.11, -3.5, -0.34, 3.23, 4.72, 3.94, -1.53, 2.88, 6.35, 3.81, 2.2, 1.42, 4.13, 4.71, 4.75, -4.57],
};

/** 90 characters after "the " at each temperature. */
export const TEMP_SAMPLES: [number, string][] = [
  [0.5, "doo.\n\nApeart allity ine knd rake tis citizens, the senate.\n\nFirst Citizen:\nWire hire say i"],
  [1, "pitite, welpeyaln tor sorstigh,\nYou thell\nst Citizen:\nOg iwe che iseas ar be\nwirst, foatno"],
  [2, "fepraCithiby,ithbyt: tod anbece nok. Ohn -cti sean tdla lat :ughe ;hese mfdy you ay! an's "],
];

/** Hidden unit 28 (the unit most correlated with reading a space, r = 0.57) and unit 10, per character. */
export const INSIDE = {
  text: "First Citizen:\nBefore we proceed any further, hear me speak.",
  space: [-0.95, -0.87, -0.99, -0.8, -1, 1, 0.85, 0.95, -1, 0.79, 0.38, -0.32, -0.78, -1, 0.9, -0.99, 0.01, -0.99, -0.99, -0.85, -0.94, 0.99, -0.87, -0.91, 1, 0.42, -0.68, -0.88, -0.09, -0.97, -0.31, -1, 0.99, 0.99, -0.62, -0.97, 0.95, -0.35, 0.64, 0.72, -0.89, -0.98, -0.97, -0.72, -0.97, 1, -0.65, -0.99, 0.9, -0.85, 0.99, 0.21, -0.96, 0.98, -0.96, -0.6, -0.94, 0.8, -0.11, -0.99],
  other: [-0.83, 1, 0.96, -1, -1, 0.97, 0.91, -0.99, -1, 0.96, 0.07, -1, -1, 1, 0.95, 0.98, 0.81, 0.48, 0.56, -1, -1, 0.98, -0.99, -1, -0.97, 0.99, -0.36, -1, -1, 1, -1, -1, -0.97, -0.51, -0.98, -1, -0.84, -0.61, -0.83, -1, -1, -0.92, 0.05, -1, -0.99, 0.56, -0.9, -0.88, -0.99, 0.45, -0.93, -1, -0.91, 1, -1, -1, -1, -0.74, -1, -1],
};
