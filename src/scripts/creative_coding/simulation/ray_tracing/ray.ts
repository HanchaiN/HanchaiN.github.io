import { lerp } from "@/scripts/utils/math/utils.js";
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
    const s = Math.sign(d);
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

function _trace(
  ray: Ray,
  object: SceneObject,
  depth = 0,
): { light: Light; depth: number } {
  if (depth > MAX_DEPTH) return { light: Light.black, depth };
  const intersect = ray.intersect(object);
  const toViewer = ray.direction.copy().mult(-1);
  if (intersect === null) return { light: Light.black, depth };
  const { position, total_dist, isInside } = intersect;
  const light = Light.black;
  const { material, normal } = object.getNormalAndMaterial(position);
  if (material.emittance !== null) {
    const emit = material.emittance(toViewer, normal);
    light.mix(emit);
  }
  if (material.bdf !== null && (material.bdf.BRDF || material.bdf.BTDF)) {
    let nextDir: Vector = Vector.random3D();
    let amp_ratio: number = 0;
    const bdf_sign =
      material.bdf.BRDF && material.bdf.BTDF ? 0 : material.bdf.BRDF ? 1 : -1;
    const rigDir = getRigDir(position, normal);
    const rigProb =
      rigDir.magSq() < 1e-6 || rigDir.dot(normal) * bdf_sign >= 0
        ? RIG_PROB
        : 0;
    const isRigged = Math.random() < rigProb;
    if (isRigged) {
      const d0 = rigDir.copy().normalize();
      let v;
      while ((v = Vector.random3D().cross(d0)).magSq() < 1e-6);
      v.normalize().mult(
        Math.tan(Math.acos(lerp(Math.random(), Math.cos(RIG_THETA), 1))),
      );
      nextDir = d0.add(v).normalize();
    } else if (bdf_sign * nextDir.dot(normal) < 0) {
      nextDir.mult(-1);
    }
    if (rigProb !== 0) {
      const h = 1 - Math.cos(RIG_THETA);
      if (nextDir.dot(rigDir) > 1 - h) {
        amp_ratio = (bdf_sign ? 2 : 1) / (1 - Math.cos(RIG_THETA));
      } else {
        console.assert(!isRigged, "rigged but not in rig cone");
      }
    }
    const bdf = material.bdf(
      toViewer,
      normal,
      nextDir,
      isInside ? 1 / material.index : material.index,
    );
    if (!bdf.isBlack()) {
      const nextPos = position.copy();
      const { light: next, depth: nextDepth } = _trace(
        new Ray(nextPos, nextDir),
        object,
        depth + 1,
      );
      next.mult(1 / (1 - rigProb + rigProb * amp_ratio));
      light.mix(next.apply(bdf));
      depth = nextDepth;
    }
  }
  if (!isInside && material.interior !== null)
    light.apply(
      material.interior(ray.position.copy(), ray.direction.copy(), total_dist),
    );
  return { light, depth };
}

export function trace(ray: Ray, object: SceneObject): Light {
  return _trace(ray, object).light;
}
