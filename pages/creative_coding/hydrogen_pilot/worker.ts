import type { TComplex } from "@/utils/math/complex.ts";
import { constrainMap } from "@/utils/math/utils.js";
import { Vector } from "@/utils/math/vector.js";
import type { TVector } from "@/utils/math/vector.ts";

import { HigherOrderState } from "../dynamical_system/dynamic.js";
import {
  psi_getvel,
  psi_orbital_superposition,
  psi_orbital_superposition_der,
  psi_orbital_superposition_sample,
} from "../hydrogen_cloud/psi.js";


export type MessageRequest = {
  superposition?: { c: TComplex; n: number; l: number; m: number }[];
  addStates?: number;
  resetState?: boolean;
  time?: number;
  time_scale?: number;
};
export type MessageResponse = {
  states?: { x: number; y: number; z: number; h: number }[];
};

export function createMain() {
  let superposition: { c: TComplex; n: number; l: number; m: number }[] = [];
  let states: HigherOrderState[] = [];
  let pretime: number = 0,
    time_scale = 1;
  
  function getHue(pos: Vector, t: number) {
    const val = psi_orbital_superposition(
      superposition,
      pos.val as readonly number[] as TVector<number, 3>,
      t,
    );
    const phase = Math.atan2(val[1], val[0]);
    return constrainMap(phase, -Math.PI, +Math.PI, 0, 360);
  }
  return function main(data: MessageRequest) {
    const response: MessageResponse = {};
    if (data.superposition) {
      superposition = data.superposition;
    }
    if (data.addStates)
      states.push(
        ...psi_orbital_superposition_sample(superposition, data.addStates).map(
          (pos: TVector<number, 3>) => new HigherOrderState(new Vector(...pos)),
        ),
      );
    if (data.resetState) states = [];
    if (data.time && pretime) {
      const deltaTime = (data.time - pretime) * time_scale;
      const subdivide = Math.ceil(deltaTime / (time_scale * 10)); // 60 fps
      const stepTime = deltaTime / subdivide;
      for (let i = 0; i < subdivide; i++) {
        const time = pretime * time_scale + (i + 0.5) * stepTime;
        states.forEach((state) => {
          state.update(
            (t: number, [pos]: Vector[]) => {
              return new Vector(
                ...psi_getvel(
                  psi_orbital_superposition(
                    superposition,
                    pos!.val as readonly number[] as TVector<number, 3>,
                    t,
                  ),
                  psi_orbital_superposition_der(
                    superposition,
                    pos!.val as readonly number[] as TVector<number, 3>,
                    t,
                  ),
                ),
              );
            },
            time,
            stepTime,
          );
        });
      }
    }
    if (data.time_scale) time_scale = data.time_scale;
    if (data.time) pretime = data.time;
    if (states)
      response.states = states.map((state) => ({
        x: state.state[0]!.x,
        y: state.state[0]!.y,
        z: state.state[0]!.z,
        h: getHue(state.state[0]!, pretime * time_scale),
      }));
    return response;
  }
}
const main = createMain();

self?.addEventListener("message", ({ data }: MessageEvent<MessageRequest>) => data !== null ? self.postMessage(main(data)) : null);
self?.postMessage(null); // indicate ready