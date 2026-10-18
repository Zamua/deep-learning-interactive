import type { LectureDef } from '../../lecture/player';
import type { Timing } from '../../lecture/types';
import { MATH_KIT_SYMBOLS } from '../../lib/math-kit-symbols';
import audio from './narration.m4a?url';
import { scenes } from './scenes';
import { script } from './script';
import timing from './timing.json';

const lecture: LectureDef = { script, timing: timing as unknown as Timing, scenes, symbols: MATH_KIT_SYMBOLS, audio };
export default lecture;
