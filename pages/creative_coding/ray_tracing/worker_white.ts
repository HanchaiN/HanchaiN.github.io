import { LightAccumulator } from "./colors.js";
import { Ray, trace } from "./ray.js";
import {
  CAMERA_POSITION,
  LIGHT_DIRECTION,
  SCENE_REF as SCENE,
  WALL_DIRECTION,
} from "./scene.js";
import type { TSpectrum } from "./spectrum.ts";

type LandmarkKey = "light" | "wall";

const landmarks: {
  [key in LandmarkKey]: { acc: LightAccumulator; ray: Ray };
} = {
  light: {
    acc: new LightAccumulator(),
    ray: new Ray(CAMERA_POSITION, LIGHT_DIRECTION),
  },
  wall: {
    acc: new LightAccumulator(),
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
  for (let i = 0; i < 1024; i++) {
    for (const key in landmarks) {
      landmarks[key as LandmarkKey].acc.accumulate(
        trace(landmarks[key as LandmarkKey].ray, SCENE),
      );
    }
  }
  return Object.fromEntries(
    Object.entries(landmarks).map(([k, v]) => [k, v.acc.color]),
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
