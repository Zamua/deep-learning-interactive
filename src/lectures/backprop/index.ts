import type { LectureDef } from '../../lecture/player';
import type { Timing } from '../../lecture/types';
import { BACKPROP_SYMBOLS } from '../../lib/backprop-symbols';
import { scenes } from './scenes';
import { script } from './script';

// Written by tools/lecture/build.mjs; until the first build the lecture plays silently on estimated timing.
const audio = Object.values(import.meta.glob<string>('./narration.m4a', { query: '?url', import: 'default', eager: true }))[0] ?? '';
const timing = (Object.values(import.meta.glob('./timing.json', { import: 'default', eager: true }))[0] ?? null) as Timing | null;

const lecture: LectureDef = { script, timing, scenes, symbols: BACKPROP_SYMBOLS, audio };
export default lecture;
