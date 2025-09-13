import { map } from "@/scripts/utils/math/utils.js";
import { Vector } from "@/scripts/utils/math/vector.js";

import type { Light } from "./colors.ts";
import { Ray, trace } from "./ray.js";
import { CAMERA_POSITION, FOCAL_LENGTH, FRAME_SIZE, SCENE } from "./scene.js";

export function trace_screen(
  x: number,
  y: number,
  w: number,
  h: number,
): Light {
  return trace(
    new Ray(
      CAMERA_POSITION,
      new Vector(
        map(
          x + Math.random() - 0.5,
          0,
          w,
          FRAME_SIZE[0] / 2,
          -FRAME_SIZE[0] / 2,
        ),
        map(
          y + Math.random() - 0.5,
          0,
          h,
          -FRAME_SIZE[1] / 2,
          FRAME_SIZE[1] / 2,
        ),
        FOCAL_LENGTH,
      ),
    ),
    SCENE,
  );
}
