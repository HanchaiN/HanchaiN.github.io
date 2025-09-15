import {
  matrix_inverse,
  matrix_mult_vector,
} from "@/scripts/utils/math/matrix.js";
import type { TMatrix } from "@/scripts/utils/math/matrix.ts";
import { constrain, maxA, minA } from "@/scripts/utils/math/utils.js";
import { Vector } from "@/scripts/utils/math/vector.js";

import { MAX_DIST, MIN_DIST } from "./const.js";
import { Material } from "./material.js";

export abstract class SceneObject {
  constructor() {}
  abstract distance(pos: Vector, dir?: Vector): number;
  normal(pos: Vector): Vector {
    const vec = new Vector(
      this.distance(new Vector(+MIN_DIST, 0, 0).add(pos)) -
        this.distance(new Vector(-MIN_DIST, 0, 0).add(pos)),
      this.distance(new Vector(0, +MIN_DIST, 0).add(pos)) -
        this.distance(new Vector(0, -MIN_DIST, 0).add(pos)),
      this.distance(new Vector(0, 0, +MIN_DIST).add(pos)) -
        this.distance(new Vector(0, 0, -MIN_DIST).add(pos)),
    );
    if (vec.magSq() === 0) return Vector.normalize(pos).mult(-1);
    return vec.normalize();
  }
  abstract materialAt(pos: Vector): Material;
}
export abstract class ProxyObject extends SceneObject {
  constructor(public object: SceneObject) {
    super();
  }
  distance(pos: Vector, dir?: Vector) {
    return this.object.distance(pos, dir);
  }
  normal(pos: Vector) {
    return this.object.normal(pos);
  }
  materialAt(pos: Vector) {
    return this.object.materialAt(pos);
  }
}

export abstract class JointObject<
  T extends SceneObject[] | Record<string, SceneObject> = SceneObject[],
> extends SceneObject {
  constructor(public readonly objects: T) {
    super();
  }
  protected get objectsArray(): SceneObject[] {
    return Array.isArray(this.objects)
      ? this.objects
      : Object.values(this.objects);
  }
  protected abstract objectAt(pos: Vector): SceneObject;
  normal(pos: Vector) {
    return this.objectAt(pos).normal(pos);
  }
  materialAt(pos: Vector) {
    return this.objectAt(pos).materialAt(pos);
  }
}
export class UnionObject<
  T extends SceneObject[] | Record<string, SceneObject> = SceneObject[],
> extends JointObject<T> {
  constructor(objects: T) {
    super(objects);
  }
  distance(pos: Vector, dir?: Vector): number {
    return minA(this.objectsArray.map((o) => o.distance(pos, dir)));
  }
  protected objectAt(pos: Vector): SceneObject {
    return this.objectsArray.reduce<[SceneObject | null, number]>(
      ([a, d1], b) => {
        if (!Number.isFinite(d1) && d1 < 0) return [a, d1];
        const d2 = b.distance(pos);
        return !Number.isNaN(d2) && d2 < d1 ? [b, d2] : [a, d1];
      },
      [null, Infinity] as const,
    )[0]!;
  }
}
export class IntersectObject<
  T extends SceneObject[] | Record<string, SceneObject> = SceneObject[],
> extends JointObject<T> {
  constructor(objects: T) {
    super(objects);
  }
  distance(pos: Vector, dir?: Vector): number {
    return maxA(this.objectsArray.map((o) => o.distance(pos, dir)));
  }
  protected objectAt(pos: Vector): SceneObject {
    return this.objectsArray.reduce<[SceneObject | null, number]>(
      ([a, d1], b) => {
        if (!Number.isFinite(d1) && d1 > 0) return [a, d1];
        const d2 = b.distance(pos);
        return !Number.isNaN(d2) && d2 > d1 ? [b, d2] : [a, d1];
      },
      [null, -Infinity] as const,
    )[0]!;
  }
}

export class NegateObject extends SceneObject {
  constructor(public object: SceneObject) {
    super();
  }
  distance(pos: Vector, dir?: Vector) {
    return -this.object.distance(pos, dir);
  }
  normal(pos: Vector) {
    return this.object.normal(pos).mult(-1);
  }
  materialAt(pos: Vector) {
    return this.object.materialAt(pos);
  }
}
export class DifferenceObject extends IntersectObject {
  constructor(main: SceneObject, operator: SceneObject) {
    super([main, new NegateObject(operator)]);
  }
}

export abstract class TransformObject extends SceneObject {
  constructor(public object: SceneObject) {
    super();
  }
  protected abstract inv_pos(pos: Vector): Vector;
  protected abstract inv_dir(dir: Vector): Vector;
  protected abstract trn_dir(dir: Vector): Vector;
  distance(pos: Vector, dir?: Vector) {
    return this.object.distance(
      this.inv_pos(pos),
      dir ? this.inv_dir(dir) : dir,
    );
  }
  normal(pos: Vector) {
    return this.trn_dir(this.object.normal(this.inv_pos(pos)));
  }
  materialAt(pos: Vector) {
    return this.object.materialAt(this.inv_pos(pos));
  }
}
export class TranslateObject extends TransformObject {
  constructor(
    object: SceneObject,
    private displacement: Vector,
  ) {
    super(object);
  }
  protected inv_pos(pos: Vector) {
    return pos.copy().sub(this.displacement);
  }
  protected inv_dir(dir: Vector) {
    return dir;
  }
  protected trn_dir(dir: Vector) {
    return dir;
  }
}
export class RotateObject extends TransformObject {
  private _matrix: TMatrix<number, 3, 3>;
  private _inv_matrix: TMatrix<number, 3, 3>;
  constructor(
    object: SceneObject,
    new_x: Vector,
    new_y: Vector,
    new_z: Vector,
  ) {
    super(object);
    console.assert(
      Math.abs(new_x.dot(new_y.cross(new_z))) ===
        new_x.mag() * new_y.mag() * new_z.mag(),
      "The transformation might contains skewing (not pure rotation).",
    );
    this._matrix = [
      [new_x.x, new_y.x, new_z.x],
      [new_x.y, new_y.y, new_z.y],
      [new_x.z, new_y.z, new_z.z],
    ];
    const _inv_matrix = matrix_inverse(this._matrix);
    if (_inv_matrix === null) throw new Error("Matrix is not invertible.");
    this._inv_matrix = _inv_matrix;
  }
  protected inv_pos(pos: Vector) {
    return new Vector(
      ...matrix_mult_vector(this._inv_matrix, [pos.x, pos.y, pos.z]),
    );
  }
  protected inv_dir(dir: Vector) {
    return this.inv_pos(dir).normalize();
  }
  protected trn_dir(dir: Vector) {
    return new Vector(
      ...matrix_mult_vector(this._matrix, [dir.x, dir.y, dir.z]),
    ).normalize();
  }
}

abstract class PrimitiveObject extends SceneObject {
  constructor(private mat: Material | ((pos: Vector) => Material)) {
    super();
  }
  materialAt(pos: Vector) {
    if (this.mat instanceof Material) return this.mat;
    return this.mat(pos);
  }
}
// https://iquilezles.org/articles/distfunctions/
export class Horizon extends PrimitiveObject {
  constructor(mat: Material | ((pos: Vector) => Material)) {
    super(mat);
  }

  distance(pos: Vector) {
    return Math.max(MAX_DIST - pos.mag(), 0);
  }
  normal(pos: Vector) {
    return Vector.normalize(pos).mult(-1);
  }
}

class _Sphere extends PrimitiveObject {
  constructor(
    private radius: number,
    mat: Material | ((pos: Vector) => Material),
  ) {
    super(mat);
  }
  distance(pos: Vector, dir?: Vector) {
    if (!dir) return pos.mag() - this.radius;
    const d = pos.mag() - this.radius;
    if (Math.abs(d) < 2 * MIN_DIST) return d;
    const c = pos.magSq() - Math.pow(this.radius + 2 * MIN_DIST, 2);
    const b = 2 * pos.dot(dir);
    const det = b * b - 4 * c;
    if (det < 0) return Infinity;
    const t = (-b + Math.sqrt(det)) / 2;
    if (t < 0) return Infinity;
    return Math.sign(d) * t;
  }
  normal(pos: Vector) {
    return pos.copy().normalize();
  }
}
export class Sphere extends ProxyObject {
  constructor(
    public readonly center: Vector,
    public readonly radius: number,
    mat: ((pos: Vector) => Material) | Material,
  ) {
    super(new TranslateObject(new _Sphere(radius, mat), center));
  }
}
class _Box extends PrimitiveObject {
  constructor(
    private dimension: Vector,
    mat: Material | ((pos: Vector) => Material),
  ) {
    super(mat);
  }
  distance(pos: Vector) {
    const pos_ = new Vector(
      Math.abs(pos.x),
      Math.abs(pos.y),
      Math.abs(pos.z),
    ).sub(this.dimension);
    const v = Math.max(pos_.x, pos_.y, pos_.z);
    if (v < 0) return v;
    return new Vector(
      Math.max(pos_.x, 0),
      Math.max(pos_.y, 0),
      Math.max(pos_.z, 0),
    ).mag();
  }
}
export class Box extends ProxyObject {
  constructor(
    public readonly center: Vector,
    public readonly sx: Vector,
    public readonly sy: Vector,
    public readonly sz: Vector,
    mat: ((pos: Vector) => Material) | Material,
  ) {
    const dx = sx.copy().mult(0.5);
    const dy = sy.copy().mult(0.5);
    const dz = sz.copy().mult(0.5);
    super(
      new TranslateObject(
        new RotateObject(
          new _Box(new Vector(dx.mag(), dy.mag(), dz.mag()), mat),
          Vector.normalize(dx),
          Vector.normalize(dy),
          Vector.normalize(dz),
        ),
        Vector.add(center, dx, dy, dz),
      ),
    );
  }
}

class _Plane extends PrimitiveObject {
  constructor(
    private norm: Vector,
    mat: Material | ((pos: Vector) => Material),
  ) {
    super(mat);
  }
  distance(pos: Vector, dir?: Vector) {
    if (!dir) return this.norm.dot(pos);
    const p = this.norm.dot(pos);
    const d = this.norm.dot(dir);
    if (Math.sign(p) * Math.sign(d) > 0) return Math.sign(p) * Infinity;
    return p / Math.abs(d);
  }
  normal() {
    return this.norm.copy();
  }
}
export class Plane extends ProxyObject {
  constructor(
    public readonly norm: Vector = new Vector(0, 1, 0),
    public readonly pivot: Vector = new Vector(0, 0, 0),
    mat: Material | ((pos: Vector) => Material),
  ) {
    super(new TranslateObject(new _Plane(norm, mat), pivot));
  }
}
export class Triangle extends PrimitiveObject {
  private o: number;
  private norm: Vector;
  private ba: Vector;
  private cb: Vector;
  private ac: Vector;
  private ba_: Vector;
  private cb_: Vector;
  private ac_: Vector;
  constructor(
    public readonly a: Vector,
    public readonly b: Vector,
    public readonly c: Vector,
    mat: Material | ((pos: Vector) => Material),
    public readonly signed: 0 | 1 | -1 = 0,
  ) {
    super(mat);
    this.ba = Vector.sub(b, a).normalize();
    this.cb = Vector.sub(c, b).normalize();
    this.ac = Vector.sub(a, c).normalize();
    this.norm = Vector.cross(this.ba, this.ac);
    this.o = -Vector.dot(a, this.norm);
    this.ba_ = Vector.cross(this.ba, this.norm);
    this.cb_ = Vector.cross(this.cb, this.norm);
    this.ac_ = Vector.cross(this.ac, this.norm);
  }
  distance(p: Vector, dir?: Vector): number {
    const pa = Vector.sub(p, this.a);
    const s =
      this.signed === 0 ? 1 : Math.sign(this.norm.dot(pa)) * this.signed;
    if (dir) {
      if (this.norm.dot(dir) === 0) return s * Infinity;
      const t = -(this.o + this.norm.dot(p)) / this.norm.dot(dir);
      if (t < 0) return s * Infinity;
      const p_ = Vector.add(p, dir.copy().mult(t));
      const pa_ = Vector.sub(p_, this.a);
      const pb_ = Vector.sub(p_, this.b);
      const pc_ = Vector.sub(p_, this.c);
      const sa = Math.sign(2 * MIN_DIST + this.ba_.dot(pa_));
      const sb = Math.sign(2 * MIN_DIST + this.cb_.dot(pb_));
      const sc = Math.sign(2 * MIN_DIST + this.ac_.dot(pc_));
      if (sa + sb + sc >= 2) return s * t;
    }
    const pb = Vector.sub(p, this.b);
    const pc = Vector.sub(p, this.c);
    const sa = Math.sign(this.ba_.dot(pa));
    const sb = Math.sign(this.cb_.dot(pb));
    const sc = Math.sign(this.ac_.dot(pc));
    if (sa + sb + sc >= 2) return s * Math.abs(this.norm.dot(pa));
    const va = constrain(this.ba.dot(pa), 0, 1);
    const vb = constrain(this.cb.dot(pb), 0, 1);
    const vc = constrain(this.ac.dot(pc), 0, 1);
    return (
      s *
      Math.sqrt(
        Math.min(
          Vector.mult(this.ba, va).sub(pa).magSq(),
          Vector.mult(this.cb, vb).sub(pb).magSq(),
          Vector.mult(this.ac, vc).sub(pc).magSq(),
        ),
      )
    );
  }
  normal(p: Vector) {
    const n = this.norm.copy();
    if (this.signed !== 0) return n.mult(this.signed);
    const pa = Vector.sub(p, this.a);
    const s = Math.sign(n.dot(pa));
    if (s === 0) return n;
    return n.mult(s);
  }
}
export class Quad extends PrimitiveObject {
  private o: number;
  private norm: Vector;
  private ba: Vector;
  private cb: Vector;
  private dc: Vector;
  private ad: Vector;
  private ba_: Vector;
  private cb_: Vector;
  private dc_: Vector;
  private ad_: Vector;
  constructor(
    public readonly a: Vector,
    public readonly b: Vector,
    public readonly c: Vector,
    public readonly d: Vector,
    mat: Material | ((pos: Vector) => Material),
    public readonly signed: 0 | 1 | -1 = 0,
  ) {
    super(mat);
    this.ba = Vector.sub(this.b, this.a).normalize();
    this.cb = Vector.sub(this.c, this.b).normalize();
    this.dc = Vector.sub(this.d, this.c).normalize();
    this.ad = Vector.sub(this.a, this.d).normalize();
    this.norm = Vector.cross(this.ba, this.ad);
    this.o = -Vector.dot(this.a, this.norm);
    if (Math.abs(Vector.dot(this.c, this.norm) - this.o) > 1e-5)
      console.warn("The quad might be non-planar.");
    this.ba_ = Vector.cross(this.ba, this.norm);
    this.cb_ = Vector.cross(this.cb, this.norm);
    this.dc_ = Vector.cross(this.dc, this.norm);
    this.ad_ = Vector.cross(this.ad, this.norm);
  }
  distance(p: Vector, dir?: Vector): number {
    const pa = Vector.sub(p, this.a);
    const s =
      this.signed === 0 ? 1 : Math.sign(this.norm.dot(pa)) * this.signed;
    if (dir) {
      if (this.norm.dot(dir) === 0) return s * Infinity;
      const t = -(this.o + this.norm.dot(p)) / this.norm.dot(dir);
      if (t < 0) return s * Infinity;
      const p_ = Vector.add(p, dir.copy().mult(t));
      const pa_ = Vector.sub(p_, this.a);
      const pb_ = Vector.sub(p_, this.b);
      const pc_ = Vector.sub(p_, this.c);
      const pd_ = Vector.sub(p_, this.d);
      const sa = Math.sign(2 * MIN_DIST + this.ba_.dot(pa_));
      const sb = Math.sign(2 * MIN_DIST + this.cb_.dot(pb_));
      const sc = Math.sign(2 * MIN_DIST + this.dc_.dot(pc_));
      const sd = Math.sign(2 * MIN_DIST + this.ad_.dot(pd_));
      if (sa + sb + sc + sd >= 3) return s * t;
    }
    const pb = Vector.sub(p, this.b);
    const pc = Vector.sub(p, this.c);
    const pd = Vector.sub(p, this.d);
    const sa = Math.sign(this.ba_.dot(pa));
    const sb = Math.sign(this.cb_.dot(pb));
    const sc = Math.sign(this.dc_.dot(pc));
    const sd = Math.sign(this.ad_.dot(pd));
    if (sa + sb + sc + sd >= 3) return s * Math.abs(this.norm.dot(pa));
    const va = Math.max(this.ba.dot(pa), 0);
    const vb = Math.max(this.cb.dot(pb), 0);
    const vc = Math.max(this.dc.dot(pc), 0);
    const vd = Math.max(this.ad.dot(pd), 0);
    return (
      s *
      Math.sqrt(
        Math.min(
          Vector.mult(this.ba, va).sub(pa).magSq(),
          Vector.mult(this.cb, vb).sub(pb).magSq(),
          Vector.mult(this.dc, vc).sub(pc).magSq(),
          Vector.mult(this.ad, vd).sub(pd).magSq(),
        ),
      )
    );
  }
  normal(p: Vector) {
    const n = this.norm.copy();
    if (this.signed !== 0) return n.mult(this.signed);
    const pa = Vector.sub(p, this.a);
    const s = Math.sign(n.dot(pa));
    if (s === 0) return n;
    return n.mult(s);
  }
}
