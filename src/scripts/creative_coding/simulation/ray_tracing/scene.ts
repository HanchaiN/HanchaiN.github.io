import { Vector } from "@/scripts/utils/math/vector.js";

import { Dye, Light } from "./colors.js";
import { Material, lambertianBRDF, phongEmitter } from "./material.js";
import { SceneObject, quad } from "./object.js";

// https://www.graphics.cornell.edu/online/box/
const W = new Material(lambertianBRDF(new Dye([0.747, 0.74, 0.737])));
const R = new Material(lambertianBRDF(new Dye([0.058, 0.287, 0.642])));
const G = new Material(lambertianBRDF(new Dye([0.285, 0.16, 0.159])));
const L = new Material(
  lambertianBRDF(new Dye([0.78, 0.78, 0.78])),
  phongEmitter(new Light([8.0, 15.6, 18.4]), 1),
);
export const SCENE_REF = SceneObject.union(
  quad(
    new Vector(552.8, 0.0, 0.0),
    new Vector(0.0, 0.0, 0.0),
    new Vector(0.0, 0.0, 559.2),
    new Vector(549.6, 0.0, 559.2),
    W,
  ),
  quad(
    new Vector(343.0, 548.8, 227.0),
    new Vector(343.0, 548.8, 332.0),
    new Vector(213.0, 548.8, 332.0),
    new Vector(213.0, 548.8, 227.0),
    L,
  ),
  quad(
    new Vector(556.0, 548.8, 0.0),
    new Vector(556.0, 548.8, 559.2),
    new Vector(0.0, 548.8, 559.2),
    new Vector(0.0, 548.8, 0.0),
    W,
  ),
  quad(
    new Vector(549.6, 0.0, 559.2),
    new Vector(0.0, 0.0, 559.2),
    new Vector(0.0, 548.8, 559.2),
    new Vector(556.0, 548.8, 559.2),
    W,
  ),
  quad(
    new Vector(0.0, 0.0, 559.2),
    new Vector(0.0, 0.0, 0.0),
    new Vector(0.0, 548.8, 0.0),
    new Vector(0.0, 548.8, 559.2),
    G,
  ),
  quad(
    new Vector(552.8, 0.0, 0.0),
    new Vector(549.6, 0.0, 559.2),
    new Vector(556.0, 548.8, 559.2),
    new Vector(556.0, 548.8, 0.0),
    R,
  ),
);
export const SCENE = SceneObject.union(
  SCENE_REF,
  quad(
    new Vector(130.0, 165.0, 65.0),
    new Vector(82.0, 165.0, 225.0),
    new Vector(240.0, 165.0, 272.0),
    new Vector(290.0, 165.0, 114.0),
    W,
  ),
  quad(
    new Vector(290.0, 0.0, 114.0),
    new Vector(290.0, 165.0, 114.0),
    new Vector(240.0, 165.0, 272.0),
    new Vector(240.0, 0.0, 272.0),
    W,
  ),
  quad(
    new Vector(130.0, 0.0, 65.0),
    new Vector(130.0, 165.0, 65.0),
    new Vector(290.0, 165.0, 114.0),
    new Vector(290.0, 0.0, 114.0),
    W,
  ),
  quad(
    new Vector(82.0, 0.0, 225.0),
    new Vector(82.0, 165.0, 225.0),
    new Vector(130.0, 165.0, 65.0),
    new Vector(130.0, 0.0, 65.0),
    W,
  ),
  quad(
    new Vector(240.0, 0.0, 272.0),
    new Vector(240.0, 165.0, 272.0),
    new Vector(82.0, 165.0, 225.0),
    new Vector(82.0, 0.0, 225.0),
    W,
  ),

  quad(
    new Vector(423.0, 330.0, 247.0),
    new Vector(265.0, 330.0, 296.0),
    new Vector(314.0, 330.0, 456.0),
    new Vector(472.0, 330.0, 406.0),
    W,
  ),
  quad(
    new Vector(423.0, 0.0, 247.0),
    new Vector(423.0, 330.0, 247.0),
    new Vector(472.0, 330.0, 406.0),
    new Vector(472.0, 0.0, 406.0),
    W,
  ),
  quad(
    new Vector(472.0, 0.0, 406.0),
    new Vector(472.0, 330.0, 406.0),
    new Vector(314.0, 330.0, 456.0),
    new Vector(314.0, 0.0, 456.0),
    W,
  ),
  quad(
    new Vector(314.0, 0.0, 456.0),
    new Vector(314.0, 330.0, 456.0),
    new Vector(265.0, 330.0, 296.0),
    new Vector(265.0, 0.0, 296.0),
    W,
  ),
  quad(
    new Vector(265.0, 0.0, 296.0),
    new Vector(265.0, 330.0, 296.0),
    new Vector(423.0, 330.0, 247.0),
    new Vector(423.0, 0.0, 247.0),
    W,
  ),
);
export const FRAME_SIZE: [number, number] = [0.025, 0.025];
export const FOCAL_LENGTH = 0.035;
export const CAMERA_POSITION = new Vector(278, 273, -800);
export const LIGHT_POSITION = new Vector(278.5, 548.8, 279.5);
export const LIGHT_DIRECTION = Vector.sub(
  LIGHT_POSITION,
  CAMERA_POSITION,
).normalize();
export const WHITE_DIRECTION = new Vector(0, 0, 1);
