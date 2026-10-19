import type { SceneDef } from '../../lecture/scene';
import { attention, decade, images, intro, softmax } from './scenes-a';
import { carried, laws, map, pretrain, rlhf, rlvr } from './scenes-b';

export const scenes: Record<string, SceneDef> = { intro, decade, attention, softmax, images, pretrain, laws, rlhf, rlvr, carried, map };
