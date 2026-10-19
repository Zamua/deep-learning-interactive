import type { SceneDef } from '../../lecture/scene';
import { goal, history, intro } from './scenes-a';
import { map } from './scenes-b';

export const scenes: Record<string, SceneDef> = { intro, history, goal, map };
