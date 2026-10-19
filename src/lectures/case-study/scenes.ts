import type { SceneDef } from '../../lecture/scene';
import { scenes1 } from './scenes-1';
import { scenes2 } from './scenes-2';
import { scenes3 } from './scenes-3';

export const scenes: Record<string, SceneDef> = { ...scenes1, ...scenes2, ...scenes3 };
