import type { SceneDef } from '../../lecture/scene';
import { intro, iouScene, localize, nms, sliding } from './part1';
import { fast, faster, rcnn, yolo } from './part2';
import { mapScene, outro, segment, upsample } from './part3';

export const scenes: Record<string, SceneDef> = {
  intro,
  localize,
  iou: iouScene,
  sliding,
  nms,
  rcnn,
  fast,
  faster,
  yolo,
  map: mapScene,
  segment,
  upsample,
  outro,
};
