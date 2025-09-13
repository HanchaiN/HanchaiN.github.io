import { Light } from "./colors.js";
import type { TSpectrum } from "./data.ts";
import { Ray, trace } from "./ray.js";
import {
  CAMERA_POSITION,
  LIGHT_DIRECTION,
  SCENE_REF as SCENE,
  WALL_DIRECTION,
} from "./scene.js";

type LandmarkKey = "light" | "wall";

let iter = 0;
const landmarks: {
  [key in LandmarkKey]: { acc: Light; ray: Ray };
} = {
  light: {
    acc: Light.black,
    ray: new Ray(CAMERA_POSITION, LIGHT_DIRECTION),
  },
  wall: {
    acc: Light.black,
    ray: new Ray(CAMERA_POSITION, WALL_DIRECTION),
  },
};
let isActive = true,
  lock = false;

export type MessageRequest = { active: boolean };
export type MessageResponse = {
  [key in LandmarkKey]: TSpectrum;
};
function main(): MessageResponse {
  for (let i = 0; i < 1000; i++) {
    for (const key in landmarks) {
      landmarks[key as LandmarkKey].acc.mix(
        trace(landmarks[key as LandmarkKey].ray, SCENE),
      );
    }
    iter++;
  }
  return Object.fromEntries(
    Object.entries(landmarks).map(([k, v]) => [
      k,
      v.acc.clone().mult(1 / iter).color,
    ]),
  ) as MessageResponse;
}

function start() {
  if (lock) return;
  lock = true;
  while (isActive) {
    self.postMessage(main());
  }
  lock = false;
}

self?.addEventListener("message", ({ data }: MessageEvent<MessageRequest>) => {
  isActive = data.active;
  start();
});

start();
