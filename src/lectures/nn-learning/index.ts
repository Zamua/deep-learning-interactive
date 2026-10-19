import type { LectureDef } from '../../lecture/player';
import type { Timing } from '../../lecture/types';
import { NN_LEARNING_SYMBOLS } from '../../lib/nn-learning-symbols';
import { scenes } from './scenes';
import { script } from './script';

const audio = Object.values(import.meta.glob<string>('./narration.m4a', { query: '?url', import: 'default', eager: true }))[0] ?? '';
const timing = (Object.values(import.meta.glob('./timing.json', { import: 'default', eager: true }))[0] ?? null) as Timing | null;

const lecture: LectureDef = { script, timing, scenes, symbols: NN_LEARNING_SYMBOLS, audio };
export default lecture;
