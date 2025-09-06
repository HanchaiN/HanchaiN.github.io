import { Vector } from "@/scripts/utils/math/vector.js";

import { Dye, Light } from "./colors.js";

type IEmittance = (toViewer: Vector, norm: Vector) => Light;
type IBRDF = (toViewer: Vector, norm: Vector, toSource: Vector) => Dye;
type IBTDF = (
  toViewer: Vector,
  norm: Vector,
  toSource: Vector,
  rel_index: number,
) => Dye;
type IBDF = (
  toViewer: Vector,
  norm: Vector,
  toSource: Vector,
  rel_index: number,
) => Dye;
type IInterior = (from: Vector, direction: Vector, distance: number) => Dye;

export function lambertianEmitter(color: Light): IEmittance {
  return () => color.clone();
}
export function phongEmitter(color: Light, exponent: number): IEmittance {
  return (toViewer, norm) => {
    const emit_rate = Math.pow(Math.max(-norm.dot(toViewer), 0), exponent);
    return color.clone().mult(emit_rate);
  };
}
function BDF(BRDF: IBRDF | null = null, BTDF: IBTDF | null = null): IBDF {
  if (BRDF === null && BTDF === null) {
    return () => Dye.black;
  }
  if (BTDF === null)
    return (toViewer, norm, toSource) => {
      if (norm.dot(toViewer) * norm.dot(toSource) > 0) {
        return BRDF!(toViewer, norm, toSource).lightMult(2);
      }
      return Dye.black;
    };
  if (BRDF === null)
    return (toViewer, norm, toSource, rel_index: number) => {
      if (norm.dot(toViewer) * norm.dot(toSource) < 0) {
        return BTDF!(toViewer, norm, toSource, rel_index).lightMult(2);
      }
      return Dye.black;
    };
  return (toViewer, norm, toSource, rel_index) => {
    const cos_i = Math.abs(norm.dot(toViewer));
    const cos_t = Math.sqrt(1 - (1 - cos_i * cos_i) / (rel_index * rel_index));
    const R =
      (Math.pow((cos_i - rel_index * cos_t) / (cos_i + rel_index * cos_t), 2) +
        Math.pow(
          (cos_t - rel_index * cos_i) / (cos_t + rel_index * cos_i),
          2,
        )) /
      2;
    if (norm.dot(toViewer) * norm.dot(toSource) > 0) {
      return BRDF!(toViewer, norm, toSource).lightMult(R);
    }
    if (norm.dot(toViewer) * norm.dot(toSource) < 0) {
      return BTDF!(toViewer, norm, toSource, rel_index).lightMult(1 - R);
    }
    return Dye.black;
  };
}
export function lambertianBRDF(color: Dye): IBRDF {
  return (toViewer, norm, toSource) => {
    const diffuse_rate = Math.abs(norm.dot(toSource));
    return color.clone().lightMult(diffuse_rate);
  };
}
export function phongBRDF(
  diffuse: Dye,
  specular: Dye,
  exponent: number,
): IBRDF {
  const lambertian = lambertianBRDF(diffuse);
  return (toViewer, norm, toSource) => {
    const reflect_to = Vector.mult(norm, 2 * toSource.dot(norm)).sub(toSource);
    const specular_rate = Math.pow(
      Math.max(reflect_to.dot(toViewer), 0),
      exponent,
    );
    const factor = Dye.black;
    factor.lightMix(lambertian(toViewer, norm, toSource));
    factor.lightMix(specular.clone().lightMult(specular_rate));
    factor.lightMult(0.5);
    return factor;
  };
}
export function blinnphongBRDF(
  diffuse: Dye,
  specular: Dye,
  exponent: number,
): IBRDF {
  const lambertian = lambertianBRDF(diffuse);
  return (toViewer, norm, toSource) => {
    const half_angle = Vector.add(toViewer, toSource);
    const factor = Dye.black;
    const specular_rate = Math.pow(Math.max(norm.dot(half_angle), 0), exponent);
    factor.lightMix(lambertian(toViewer, norm, toSource));
    factor.lightMix(specular.clone().lightMult(specular_rate));
    factor.lightMult(0.5);
    return factor;
  };
}
export function phongBTDF(color: Dye, exponent: number): IBTDF {
  return (toViewer, norm, toSource, rel_index) => {
    const cos_i = Math.abs(norm.dot(toViewer));
    const refract_to = toViewer
      .copy()
      .mult(-rel_index)
      .add(
        norm
          .copy()
          .mult(
            rel_index * cos_i -
              Math.sqrt(1 - rel_index * rel_index * (1 - cos_i * cos_i)),
          ),
      );
    const refract_rate = Math.pow(
      Math.max(refract_to.dot(toViewer), 0),
      exponent,
    );
    return color.clone().lightMult(refract_rate);
  };
}
export function defaultInterior(color: Dye): IInterior {
  return (from, direction, distance) => color.clone().mult(distance);
}
export class Material {
  emittance: IEmittance | null;
  bdf: IBDF;
  interior: IInterior | null;
  index: number;
  constructor(
    brdf: IBRDF | null = null,
    emittance: IEmittance | null = null,
    btdf: IBTDF | null = null,
    interior: IInterior | null = null,
    index: number = 1,
  ) {
    this.emittance = emittance;
    this.bdf = BDF(brdf, btdf);
    this.interior = interior;
    this.index = index;
  }
}
