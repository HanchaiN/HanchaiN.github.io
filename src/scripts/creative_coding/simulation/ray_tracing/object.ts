import { constrain, maxA, minA } from "@/scripts/utils/math/utils.js";
import { Vector } from "@/scripts/utils/math/vector.js";

import { MAX_DIST, MIN_DIST } from "./const.js";
import { Material } from "./material.js";

export class SceneObject {
  distance: (pos: Vector) => number;
  normal: (pos: Vector) => Vector;
  materialAt: (pos: Vector) => Material;
  constructor(
    distance: (pos: Vector) => number = () => MAX_DIST,
    normal: ((pos: Vector) => Vector) | null = null,
    material: ((pos: Vector) => Material) | Material = new Material(),
  ) {
    this.distance = distance;
    this.normal =
      normal ??
      ((pos) => {
        const vec = new Vector(
          distance(new Vector(+MIN_DIST, 0, 0).add(pos)) -
            distance(new Vector(-MIN_DIST, 0, 0).add(pos)),
          distance(new Vector(0, +MIN_DIST, 0).add(pos)) -
            distance(new Vector(0, -MIN_DIST, 0).add(pos)),
          distance(new Vector(0, 0, +MIN_DIST).add(pos)) -
            distance(new Vector(0, 0, -MIN_DIST).add(pos)),
        );
        if (vec.magSq() === 0) return Vector.normalize(pos).mult(-1);
        return vec.normalize();
      });
    if (material instanceof Material) this.materialAt = () => material;
    else this.materialAt = material;
  }
  static union(...objects: SceneObject[]) {
    const distance = (pos: Vector) => minA(objects.map((o) => o.distance(pos)));
    const normal = (pos: Vector) => {
      let object = objects[0];
      let dist = object.distance(pos);
      objects.forEach((o) => {
        const d = o.distance(pos);
        if (d < dist) {
          dist = d;
          object = o;
        }
      });
      return object.normal(pos);
    };
    const materialAt = (pos: Vector) => {
      let object = objects[0];
      let dist = object.distance(pos);
      objects.forEach((o) => {
        const d = o.distance(pos);
        if (d < dist) {
          dist = d;
          object = o;
        }
      });
      return object.materialAt(pos);
    };
    return new SceneObject(distance, normal, materialAt);
  }
  static intersect(...objects: SceneObject[]) {
    const distance = (pos: Vector) => maxA(objects.map((o) => o.distance(pos)));
    const normal = (pos: Vector) => {
      let object = objects[0];
      let dist = object.distance(pos);
      objects.forEach((o) => {
        const d = o.distance(pos);
        if (d > dist) {
          dist = d;
          object = o;
        }
      });
      return object.normal(pos);
    };
    const materialAt = (pos: Vector) => {
      let object = objects[0];
      let dist = object.distance(pos);
      objects.forEach((o) => {
        const d = o.distance(pos);
        if (d > dist) {
          dist = d;
          object = o;
        }
      });
      return object.materialAt(pos);
    };
    return new SceneObject(distance, normal, materialAt);
  }
  static subtract(main: SceneObject, operator: SceneObject) {
    const obj = SceneObject.intersect(main, SceneObject.negate(operator));
    obj.materialAt = main.materialAt;
    return obj;
  }
  static negate(object: SceneObject) {
    const distance = (pos: Vector) => -object.distance(pos);
    const normal = (pos: Vector) => object.normal(pos).mult(-1);
    return new SceneObject(distance, normal, object.materialAt);
  }
  translate(displacement: Vector) {
    const inv_transformation = (pos: Vector) => pos.copy().sub(displacement);
    const distance = (pos: Vector) => {
      return this.distance(inv_transformation(pos));
    };
    const normal = (pos: Vector) => {
      return this.normal(inv_transformation(pos));
    };
    const materialAt = (pos: Vector) => {
      return this.materialAt(inv_transformation(pos));
    };
    return new SceneObject(distance, normal, materialAt);
  }
  rotate(x: Vector, y: Vector, z: Vector) {
    const x_ = x.normalize(),
      y_ = y.normalize(),
      z_ = z.normalize();
    console.assert(
      Math.abs(x_.dot(y_.cross(z_))) === 1,
      "The transformation might contains skewing (not pure rotation).",
    );
    const inv_transformation = (pos: Vector) =>
      new Vector(
        pos.x * x_.x + pos.y * x_.y + pos.z * x_.z,
        pos.x * y_.x + pos.y * y_.y + pos.z * y_.z,
        pos.x * z_.x + pos.y * z_.y + pos.z * z_.z,
      );
    const distance = (pos: Vector) => {
      return this.distance(inv_transformation(pos));
    };
    const normal = (pos: Vector) => {
      return this.normal(inv_transformation(pos));
    };
    const materialAt = (pos: Vector) => {
      return this.materialAt(inv_transformation(pos));
    };
    return new SceneObject(distance, normal, materialAt);
  }
}

// https://iquilezles.org/articles/distfunctions/
class Sphere extends SceneObject {
  constructor(radius: number, mat: ((pos: Vector) => Material) | Material) {
    const distance = (pos: Vector) => pos.mag() - radius;
    const normal = (pos: Vector) => pos.copy().normalize();
    super(distance, normal, mat);
  }
}
export function sphere(
  center: Vector,
  radius: number,
  mat: ((pos: Vector) => Material) | Material = new Material(),
) {
  return new Sphere(radius, mat).translate(center);
}
class Box extends SceneObject {
  constructor(dimension: Vector, mat: Material | ((pos: Vector) => Material)) {
    const distance = (pos: Vector) => {
      const pos_ = new Vector(
        Math.abs(pos.x),
        Math.abs(pos.y),
        Math.abs(pos.z),
      ).sub(dimension);
      const v = Math.max(pos_.x, pos_.y, pos_.z);
      if (v < 0) return v;
      return new Vector(
        Math.max(pos_.x, 0),
        Math.max(pos_.y, 0),
        Math.max(pos_.z, 0),
      ).mag();
    };
    super(distance, null, mat);
  }
}
export function box(
  origin: Vector,
  sx: Vector,
  sy: Vector,
  sz: Vector,
  mat: Material | ((pos: Vector) => Material) = new Material(),
) {
  const dx = sx.copy().mult(0.5);
  const dy = sy.copy().mult(0.5);
  const dz = sz.copy().mult(0.5);
  return new Box(new Vector(dx.mag(), dy.mag(), dz.mag()), mat)
    .rotate(dx, dy, dz)
    .translate(Vector.add(origin, dx, dy, dz));
}
class Plane extends SceneObject {
  constructor(
    norm: Vector,
    mat: Material | ((pos: Vector) => Material) | undefined,
  ) {
    const distance = (pos: Vector) => norm.dot(pos);
    const normal = () => norm.copy();
    super(distance, normal, mat);
  }
}
export function plane(
  norm = new Vector(0, 1, 0),
  pivot = new Vector(0, 0, 0),
  mat: Material | ((pos: Vector) => Material) = new Material(),
) {
  return new Plane(norm.normalize(), mat).translate(pivot);
}
class Triangle extends SceneObject {
  constructor(
    a: Vector,
    b: Vector,
    c: Vector,
    mat: Material | ((pos: Vector) => Material),
  ) {
    const ba = Vector.sub(b, a).normalize();
    const cb = Vector.sub(c, b).normalize();
    const ac = Vector.sub(a, c).normalize();
    const norm = Vector.cross(ba, ac);
    const ba_ = Vector.cross(ba, norm);
    const cb_ = Vector.cross(cb, norm);
    const ac_ = Vector.cross(ac, norm);
    const distance = (p: Vector) => {
      const pa = Vector.sub(p, a);
      const pb = Vector.sub(p, b);
      const pc = Vector.sub(p, c);
      const sa = Math.sign(ba_.dot(pa));
      const sb = Math.sign(cb_.dot(pb));
      const sc = Math.sign(ac_.dot(pc));
      if (sa + sb + sc >= 2) return Math.abs(norm.dot(pa));
      const va = constrain(ba.dot(pa), 0, 1);
      const vb = constrain(cb.dot(pb), 0, 1);
      const vc = constrain(ac.dot(pc), 0, 1);
      return Math.sqrt(
        Math.min(
          Vector.mult(ba, va).sub(pa).magSq(),
          Vector.mult(cb, vb).sub(pb).magSq(),
          Vector.mult(ac, vc).sub(pc).magSq(),
        ),
      );
    };
    const normal = () => norm;
    super(distance, normal, mat);
  }
}
export function triangle(
  a: Vector,
  b: Vector,
  c: Vector,
  mat: Material | ((pos: Vector) => Material) = new Material(),
) {
  return new Triangle(a, b, c, mat);
}
class Quad extends SceneObject {
  constructor(
    a: Vector,
    b: Vector,
    c: Vector,
    d: Vector,
    mat: Material | ((pos: Vector) => Material),
  ) {
    const ba = Vector.sub(b, a).normalize();
    const cb = Vector.sub(c, b).normalize();
    const dc = Vector.sub(d, c).normalize();
    const ad = Vector.sub(a, d).normalize();
    const norm = Vector.cross(ba, ad);
    const ba_ = Vector.cross(ba, norm);
    const cb_ = Vector.cross(cb, norm);
    const dc_ = Vector.cross(dc, norm);
    const ad_ = Vector.cross(ad, norm);
    const distance = (p: Vector) => {
      const pa = Vector.sub(p, a);
      const pb = Vector.sub(p, b);
      const pc = Vector.sub(p, c);
      const pd = Vector.sub(p, d);
      const sa = Math.sign(ba_.dot(pa));
      const sb = Math.sign(cb_.dot(pb));
      const sc = Math.sign(dc_.dot(pc));
      const sd = Math.sign(ad_.dot(pd));
      if (sa + sb + sc + sd >= 3) return Math.abs(norm.dot(pa));
      const va = Math.max(ba.dot(pa), 0);
      const vb = Math.max(cb.dot(pb), 0);
      const vc = Math.max(dc.dot(pc), 0);
      const vd = Math.max(ad.dot(pd), 0);
      return Math.sqrt(
        Math.min(
          Vector.mult(ba, va).sub(pa).magSq(),
          Vector.mult(cb, vb).sub(pb).magSq(),
          Vector.mult(dc, vc).sub(pc).magSq(),
          Vector.mult(ad, vd).sub(pd).magSq(),
        ),
      );
    };
    const normal = () => norm.copy();
    super(distance, normal, mat);
  }
}
export function quad(
  a: Vector,
  b: Vector,
  c: Vector,
  d: Vector,
  mat: Material | ((pos: Vector) => Material) = new Material(),
) {
  return new Quad(a, b, c, d, mat);
}
class Horizon extends SceneObject {
  constructor(mat: Material | ((pos: Vector) => Material)) {
    const distance = (pos: { mag: () => number }) =>
      Math.max(MAX_DIST - pos.mag(), 0);
    const normal = (pos: Vector) => Vector.normalize(pos).mult(-1);
    super(distance, normal, mat);
  }
}
export function horizon(
  mat: Material | ((pos: Vector) => Material) = new Material(),
) {
  return new Horizon(mat);
}
