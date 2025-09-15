import { Vector } from "@/scripts/utils/math/vector.js";

import { Dye, Light } from "./colors.js";
import { readSpectrum } from "./data.js";
import { Material, lambertianBRDF, phongEmitter } from "./material.js";
import * as SceneObject from "./object.js";
import { Ray } from "./ray.js";
import { wavelengths } from "./spectrum.js";
import type { TSpectrum } from "./spectrum.ts";

const material = (
  await import("./data/material.json", { with: { type: "json" } })
).default;
const light = (await import("./data/light.json", { with: { type: "json" } }))
  .default;

// https://www.graphics.cornell.edu/online/box/
const W = new Material(
  lambertianBRDF(new Dye(await readSpectrum(material, "W"))),
);
const R = new Material(
  lambertianBRDF(new Dye(await readSpectrum(material, "R"))),
);
const G = new Material(
  lambertianBRDF(new Dye(await readSpectrum(material, "G"))),
);
const L = new Material(
  lambertianBRDF(new Dye(wavelengths.map(() => 0.78) as TSpectrum)),
  phongEmitter(new Light(await readSpectrum(light, "intensity")), 1),
);
export const SCENE_REF = new SceneObject.UnionObject([
  new SceneObject.Quad(
    new Vector(552.8, 0.0, 0.0),
    new Vector(0.0, 0.0, 0.0),
    new Vector(0.0, 0.0, 559.2),
    new Vector(549.6, 0.0, 559.2),
    W,
  ),
  new SceneObject.Quad(
    new Vector(343.0, 548.8, 227.0),
    new Vector(343.0, 548.8, 332.0),
    new Vector(213.0, 548.8, 332.0),
    new Vector(213.0, 548.8, 227.0),
    L,
  ),
  new SceneObject.Quad(
    new Vector(556.0, 548.8, 0.0),
    new Vector(556.0, 548.8, 559.2),
    new Vector(0.0, 548.8, 559.2),
    new Vector(0.0, 548.8, 0.0),
    W,
  ),
  new SceneObject.Quad(
    new Vector(549.6, 0.0, 559.2),
    new Vector(0.0, 0.0, 559.2),
    new Vector(0.0, 548.8, 559.2),
    new Vector(556.0, 548.8, 559.2),
    W,
  ),
  new SceneObject.Quad(
    new Vector(0.0, 0.0, 559.2),
    new Vector(0.0, 0.0, 0.0),
    new Vector(0.0, 548.8, 0.0),
    new Vector(0.0, 548.8, 559.2),
    G,
  ),
  new SceneObject.Quad(
    new Vector(552.8, 0.0, 0.0),
    new Vector(549.6, 0.0, 559.2),
    new Vector(556.0, 548.8, 559.2),
    new Vector(556.0, 548.8, 0.0),
    R,
  ),
]);
export const SCENE = new SceneObject.UnionObject([
  SCENE_REF,
  new SceneObject.UnionObject([
    new SceneObject.Quad(
      new Vector(130.0, 165.0, 65.0),
      new Vector(82.0, 165.0, 225.0),
      new Vector(240.0, 165.0, 272.0),
      new Vector(290.0, 165.0, 114.0),
      W,
    ),
    new SceneObject.Quad(
      new Vector(290.0, 0.0, 114.0),
      new Vector(290.0, 165.0, 114.0),
      new Vector(240.0, 165.0, 272.0),
      new Vector(240.0, 0.0, 272.0),
      W,
    ),
    new SceneObject.Quad(
      new Vector(130.0, 0.0, 65.0),
      new Vector(130.0, 165.0, 65.0),
      new Vector(290.0, 165.0, 114.0),
      new Vector(290.0, 0.0, 114.0),
      W,
    ),
    new SceneObject.Quad(
      new Vector(82.0, 0.0, 225.0),
      new Vector(82.0, 165.0, 225.0),
      new Vector(130.0, 165.0, 65.0),
      new Vector(130.0, 0.0, 65.0),
      W,
    ),
    new SceneObject.Quad(
      new Vector(240.0, 0.0, 272.0),
      new Vector(240.0, 165.0, 272.0),
      new Vector(82.0, 165.0, 225.0),
      new Vector(82.0, 0.0, 225.0),
      W,
    ),
  ]),
  new SceneObject.UnionObject([
    new SceneObject.Quad(
      new Vector(423.0, 330.0, 247.0),
      new Vector(265.0, 330.0, 296.0),
      new Vector(314.0, 330.0, 456.0),
      new Vector(472.0, 330.0, 406.0),
      W,
    ),
    new SceneObject.Quad(
      new Vector(423.0, 0.0, 247.0),
      new Vector(423.0, 330.0, 247.0),
      new Vector(472.0, 330.0, 406.0),
      new Vector(472.0, 0.0, 406.0),
      W,
    ),
    new SceneObject.Quad(
      new Vector(472.0, 0.0, 406.0),
      new Vector(472.0, 330.0, 406.0),
      new Vector(314.0, 330.0, 456.0),
      new Vector(314.0, 0.0, 456.0),
      W,
    ),
    new SceneObject.Quad(
      new Vector(314.0, 0.0, 456.0),
      new Vector(314.0, 330.0, 456.0),
      new Vector(265.0, 330.0, 296.0),
      new Vector(265.0, 0.0, 296.0),
      W,
    ),
    new SceneObject.Quad(
      new Vector(265.0, 0.0, 296.0),
      new Vector(265.0, 330.0, 296.0),
      new Vector(423.0, 330.0, 247.0),
      new Vector(423.0, 0.0, 247.0),
      W,
    ),
  ]),
]);
export const FRAME_SIZE: [number, number] = [0.025, 0.025];
export const FOCAL_LENGTH = 0.035;
export const CAMERA_POSITION = new Vector(278, 273, -800);
const LIGHT_POSITION = Vector.add(
  SCENE_REF.objects[1].a,
  SCENE_REF.objects[1].b,
  SCENE_REF.objects[1].c,
  SCENE_REF.objects[1].d,
).mult(0.25);
const y_floor = SCENE_REF.objects[0].a.y;
const z_close = SCENE_REF.objects[0].a.z;

export function getRigDir(pos: Vector, normal: Vector): Vector {
  const toLight = Vector.sub(LIGHT_POSITION, pos).normalize();
  const y_min = 5 / 6;
  const d = 0.5 / Math.sqrt(y_min * y_min + 0.5);
  if (toLight.dot(normal) > d) return toLight;
  if (new Ray(pos, normal).intersect(SCENE_REF) === null) {
    const dy = y_floor - pos.y;
    const dz = (z_close + pos.z) / 2 - pos.z;
    const a = normal.x;
    const b = 2 * (normal.y * dy + normal.z * dz);
    const c = -normal.x * (dy * dy + dz * dz);
    const det = b * b - 4 * a * c;
    const dx = Math.abs(a) < 1e-5 ? 0 : (-b + Math.sqrt(det)) / (2 * a);
    const dir = new Vector(dx, dy, dz).normalize();
    if (dir.dot(normal) > 0) return dir;
  }
  return normal.copy().normalize();
}

export const LIGHT_DIRECTION = Vector.sub(
  LIGHT_POSITION,
  CAMERA_POSITION,
).normalize();
export const WALL_DIRECTION = new Vector(0, 0, 1);
