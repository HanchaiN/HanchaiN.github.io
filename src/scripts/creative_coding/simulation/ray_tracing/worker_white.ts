import { Light, TColorRGB } from "./colors.js";
import { Ray, trace } from "./ray.js";
import {
  CAMERA_POSITION,
  LIGHT_DIRECTION,
  SCENE,
  WHITE_DIRECTION,
} from "./scene.js";

let iter = 0;
const white = Light.black,
  bright = Light.black,
  white_ray = new Ray(CAMERA_POSITION, WHITE_DIRECTION),
  ref_ray = new Ray(CAMERA_POSITION, LIGHT_DIRECTION);

export type MessageRequest = Record<string, never>;
export type MessageResponse = {
  white: TColorRGB;
  bright: TColorRGB;
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function main(data: MessageRequest) {
  for (let i = 0; i < 1000; i++) {
    white.mix(trace(white_ray, SCENE));
    bright.mix(trace(ref_ray, SCENE));
    iter++;
  }
  return {
    white: white
      .clone()
      .mult(1 / iter)
      .rgb(),
    bright: bright
      .clone()
      .mult(1 / iter)
      .rgb(),
  };
}

self?.addEventListener("message", ({ data }: MessageEvent<MessageRequest>) => {
  return self.postMessage(main(data));
});
