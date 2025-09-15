import { Vector } from "@/scripts/utils/math/vector.js";

import { Light } from "./colors.js";
import {
  MAX_DEPTH,
  MAX_DIST,
  MIN_DIST,
  RIG_PROB,
  RIG_THETA,
  STEP_SCALE,
} from "./const.js";
import type { SceneObject } from "./object.ts";
import { getRigDir } from "./scene.js";

export class Ray {
  position: Vector;
  direction: Vector;
  constructor(pos: Vector, dir: Vector) {
    this.position = pos;
    this.direction = dir.normalize();
  }
  intersect(object: SceneObject) {
    const position = this.position.copy();
    const direction = this.direction.copy();
    let d: number,
      total_dist = 0;
    // initial push out of surface
    while (Math.abs((d = object.distance(position, direction))) <= MIN_DIST) {
      total_dist += d = Math.max(Math.abs(d) * STEP_SCALE, MIN_DIST);
      position.add(direction.copy().mult(d));
    }
    const s = Math.sign(object.distance(position, direction));
    // push into another surface
    while ((d = s * object.distance(position, direction)) > MIN_DIST) {
      total_dist += d = Math.max(
        Math.abs(d) * STEP_SCALE,
        Math.abs(d) - MIN_DIST / 2,
      );
      position.add(direction.copy().mult(d));
      if (total_dist > MAX_DIST) {
        return null;
      }
    }
    // revert overshoot
    while ((d = s * object.distance(position, direction)) < 0) {
      total_dist -= d = Math.max(Math.abs(d) * STEP_SCALE, MIN_DIST);
      position.sub(direction.copy().mult(d));
    }
    return {
      position,
      total_dist,
      isInside: s < 0,
    };
  }
}

export function trace(ray: Ray, object: SceneObject, depth = 0) {
  if (depth > MAX_DEPTH) return Light.black;
  const intersect = ray.intersect(object);
  const toViewer = ray.direction.copy().mult(-1);
  if (intersect === null) return Light.black;
  const { position, total_dist, isInside } = intersect;
  const light = Light.black;
  const material = object.materialAt(position);
  const normal = object.normal(position);
  if (material.emittance !== null) {
    const emit = material.emittance(toViewer, normal);
    light.mix(emit);
  }
  if (material.bdf !== null) {
    let nextDir: Vector = Vector.random3D();
    let amp_ratio: number = 0;
    const rigDir = getRigDir(position, normal);
    const isRigged = Math.random() < RIG_PROB;
    if (isRigged) {
      const d0 = rigDir.copy().normalize();
      const v = Vector.random3D().cross(d0).normalize();
      console.assert(
        Math.abs(v.dot(d0)) < 1e-6,
        `v is not perpendicular to d0 ${v.dot(d0)} ${v.magSq()} ${d0.magSq()}`,
      );
      const theta = Math.acos(
        (1 - Math.cos(RIG_THETA)) * Math.random() + Math.cos(RIG_THETA),
      );
      const a = Math.tan(theta);
      v.mult(a);
      nextDir = d0.copy().add(v).normalize();
    }
    const h = 1 - Math.cos(RIG_THETA);
    if (nextDir.dot(rigDir) > 1 - h) {
      amp_ratio = 2 / (1 - Math.cos(RIG_THETA));
    } else {
      console.assert(!isRigged, "rigged but not in rig cone");
    }
    const bdf = material.bdf(
      toViewer,
      normal,
      nextDir,
      isInside ? 1 / material.index : material.index,
    );
    if (bdf !== null && !bdf.isBlack()) {
      const nextPos = position.copy();
      const next = trace(new Ray(nextPos, nextDir), object, depth + 1);
      next.mult(1 / (1 - RIG_PROB + RIG_PROB * amp_ratio));
      light.mix(next.apply(bdf));
    }
  }
  if (!isInside && material.interior !== null)
    light.apply(
      material.interior(ray.position.copy(), ray.direction.copy(), total_dist),
    );
  return light;
}
