// Single needle in a haystack: the share of needles found (%) by 1.3B models, at 1K to 8K tokens of
// context. Yang, Kautz & Hatamizadeh (2024), Table 2: S-NIAH-1 (repeating filler) and S-NIAH-2 (essays).
export const NIAH_LENGTHS = ['1K', '2K', '4K', '8K'];

export const NIAH = {
  repeat: { deltanet: [97.4, 96.8, 99.0, 98.8], mamba2: [99.2, 98.8, 65.4, 30.4], gated: [98.4, 88.4, 91.4, 91.8] },
  essay: { deltanet: [98.4, 45.6, 18.6, 14.4], mamba2: [99.4, 98.8, 56.2, 17.0], gated: [100.0, 99.8, 92.2, 29.6] },
};
