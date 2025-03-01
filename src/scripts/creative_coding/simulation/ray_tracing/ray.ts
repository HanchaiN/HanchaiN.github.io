import { Vector } from "@/scripts/utils/math/vector.js";
import { Light } from "./colors.js";
import {
  LIGHT_PROB as LIGHT_PROBABILITY,
  LIGHT_RANGE,
  MAX_DEPTH,
  MAX_DIST,
  MIN_DIST,
} from "./const.js";
import type { SceneObject } from "./object.js";
import { LIGHT_POSITION } from "./scene.js";

export class Ray {
  position: Vector;
  direction: Vector;
  constructor(pos: Vector, dir: Vector) {
    this.position = pos;
    this.direction = dir.normalize();
  }
  intersect(object: SceneObject) {
    const position = this.position.copy();
    let d: number,
      total_dist = 0;
    while ((d = object.distance(position)) <= MIN_DIST) {
      total_dist += d = Math.max(Math.abs(d) * 0.99, MIN_DIST);
      position.add(this.direction.copy().mult(d));
    }
    const isInside = object.distance(position) < 0;
    while ((d = object.distance(position)) > MIN_DIST) {
      total_dist += d = Math.max(
        Math.abs(d) * 0.99,
        Math.abs(d) - MIN_DIST / 2,
      );
      position.add(this.direction.copy().mult(d));
      if (total_dist > MAX_DIST) {
        return null;
      }
    }
    return {
      position,
      total_dist,
      isInside,
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
    const isRigged = Math.random() < LIGHT_PROBABILITY;
    const nextDir = isRigged
      ? Vector.sub(LIGHT_POSITION, position)
          .normalize()
          .add(Vector.random3D().mult(LIGHT_RANGE))
          .normalize()
      : Vector.random3D();
    const bdf = material.bdf(
      toViewer,
      normal,
      nextDir,
      isInside ? 1 / material.index : material.index,
    );
    if (bdf !== null && !bdf.isBlack()) {
      const nextPos = position.copy();
      const next = trace(new Ray(nextPos, nextDir), object, depth + 1);
      next.mult(
        1 /
          (isRigged
            ? 1 +
              LIGHT_PROBABILITY /
                Math.pow(Math.sin(Math.asin(LIGHT_RANGE) / 2), 2)
            : 1),
      );
      light.mix(next.apply(bdf));
    }
  }
  if (!isInside && material.interior !== null)
    light.apply(
      material.interior(ray.position.copy(), ray.direction.copy(), total_dist),
    );
  return light;
}
