import type { SceneDef } from '../../lecture/scene';
import { scenesA } from './scenes-a';
import { scenesB } from './scenes-b';
import { scenesC } from './scenes-c';

export const scenes: Record<string, SceneDef> = { ...scenesA, ...scenesB, ...scenesC };
