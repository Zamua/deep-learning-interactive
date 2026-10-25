// Pure data, no imports: tools/lecture/build.mjs loads lecture scripts in Node.

/**
 * One narrated line. `say` is both spoken and captioned; `{shown|spoken}` gives the caption
 * and the voice different text, e.g. `{f(x) = 2x + 1|f of x equals two x plus one}`.
 */
export interface Beat {
  id: string;
  say: string;
  /** Code lines lit while this beat plays: `#@label`s or 1-based line numbers. */
  code?: string | number | (string | number)[];
  /** Extra silence after the beat, in seconds. */
  pause?: number;
  /** A question for the viewer: playback stops after it until they choose to see it solved. */
  think?: boolean;
}

export interface SceneScript {
  id: string;
  title: string;
  /** The listing beside the visual, in CodePanel syntax (`#@label`, `{{slot:init}}`). */
  code: string;
  codeTitle: string;
  beats: Beat[];
}

export interface LectureScript {
  /** The chapter this lecture precedes. */
  id: string;
  title: string;
  /** Speech model: `kokoro` (local) or an OpenRouter speech model such as `elevenlabs/eleven-v4`. */
  model: string;
  /** A voice of that model, e.g. `af_heart` (Kokoro) or `george` (ElevenLabs). */
  voice: string;
  /** Speaking rate; Kokoro only. */
  speed: number;
  scenes: SceneScript[];
}

/** Written by tools/lecture/build.mjs from the synthesized narration. Times are seconds. */
export interface Timing {
  duration: number;
  scenes: Record<string, [number, number]>;
  /**
   * `scene/beat` -> [start, end, spoken text, pauses]. The text detects a script edited after
   * synthesis; pauses are the [from, to] silences inside the line, where its phrases break.
   */
  beats: Record<string, [number, number, string, [number, number][]?]>;
}

/** Gaps the narration track leaves, shared by the builder and the player's estimate. */
export const GAP = { sceneLead: 0.7, beat: 0.38, sceneTail: 1.1 };

/** Caption text for a beat: the `shown` half of every `{shown|spoken}`. */
export function shownText(say: string): string {
  return say.replace(/\{([^|{}]*)\|([^{}]*)\}/g, '$1');
}

/** Voice text for a beat: the `spoken` half of every `{shown|spoken}`. */
export function spokenText(say: string): string {
  return say.replace(/\{([^|{}]*)\|([^{}]*)\}/g, '$2');
}
