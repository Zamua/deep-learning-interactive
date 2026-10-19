import type { SceneDef } from '../../lecture/scene';
import { aeScenes } from './scenes-ae';
import { ganScenes } from './scenes-gan';
import { videoScenes } from './scenes-video';

export const scenes: Record<string, SceneDef> = { ...videoScenes, ...aeScenes, ...ganScenes };
