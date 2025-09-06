import { Vector } from "@/scripts/utils/math/vector.js";

import { HigherOrderState } from "./dynamic.js";

export type MessageRequest = {
  states?: { state: number[][]; hue: number }[];
  param?: typeof param;
  time?: number;
  time_scale?: number;
};
export type MessageResponse = {
  subdivide?: number;
  states?: { state: number[]; hue: number }[];
};

let states: { state: HigherOrderState; hue: number }[] = [];
let pretime: number,
  time_scale = 1;
let param = {
  rho: 28,
  sigma: 10,
  beta: 8 / 3,
};
function f(time: number, state: Vector[]) {
  return new Vector(
    param.sigma * (state[0].y - state[0].x),
    state[0].x * (param.rho - state[0].z) - state[0].y,
    state[0].x * state[0].y - param.beta * state[0].z,
  );
}
export function main(data: MessageRequest) {
  const response: MessageResponse = {};
  if (data.states)
    states = data.states.map(({ state, hue }) => ({
      state: new HigherOrderState(new Vector(...state[0])),
      hue,
    }));
  if (data.param) param = { ...param, ...data.param };
  if (data.time && pretime) {
    const deltaTime = (data.time - pretime) * time_scale;
    const subdivide = Math.ceil(deltaTime / (time_scale * 10)); // 60 fps
    const stepTime = deltaTime / subdivide;
    states.forEach(({ state }) => {
      for (let i = 0; i < subdivide; i++) {
        const time = pretime * time_scale + (i + 0.5) * stepTime;
        state.update(f, time, stepTime);
      }
    });
    response.subdivide = subdivide;
  }
  if (data.time_scale) time_scale = data.time_scale;
  if (data.time) pretime = data.time;
  response.states = states.map(({ state, hue }) => ({
    state: state.state[0].val,
    hue,
  }));
  return response;
}
self?.addEventListener("message", ({ data }: MessageEvent<MessageRequest>) => {
  return self.postMessage(main(data));
});
