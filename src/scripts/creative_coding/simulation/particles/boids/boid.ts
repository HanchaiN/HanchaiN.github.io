import { Vector } from "@/scripts/utils/math/vector.js";
import { map } from "@/scripts/utils/math/utils.js";
import { randomGaussian } from "@/scripts/utils/math/random.js";

export const GROUP: { [key: string]: symbol } = {
  PEER: Symbol("peer"),
  PREY: Symbol("prey"),
  PRED: Symbol("hunt"),
};
export const SETTING = {
  speedMax: 100,
  speedMin: 50,
  margin: 50,
  visualRange: 75,
  separationRange: 20,
  visualAngle: 0.9 * Math.PI * 2,
  avoidance: 5,
  uniqueness: 0.5,
  [GROUP.PEER]: {
    alignment: 0.025,
    coherence: 0.005,
    separation: 0.15,
    agreeableness: 1.0,
  },
  [GROUP.PRED]: {
    alignment: 0,
    coherence: -0.0025,
    separation: 0.25,
    agreeableness: -0.25,
  },
  [GROUP.PREY]: {
    alignment: 0,
    coherence: 0.0025,
    separation: 0.05,
    agreeableness: -0.25,
  },
};

export class Boid {
  system: BoidSystem;
  pos: Vector;
  vel: Vector;
  id_inherit: Vector;
  id: Vector;
  private _id_vel?: Vector;
  private _vel?: Vector;
  constructor(system: BoidSystem, pos: Vector, vel: Vector, id: number) {
    this.system = system;
    this.pos = pos.copy();
    this.vel = vel.copy();
    this.id_inherit = Vector.fromPolar(1, id * 2 * Math.PI);
    this.id = this.id_inherit.copy();
  }
  eval() {
    this._id_vel = this.id.copy().mult(0);
    this._vel = this.vel.copy();
    this._id_vel.add(
      Vector.sub(this.id_inherit, this.id).mult(SETTING.uniqueness),
    );
    const acc = {
      [GROUP.PEER]: {
        count: 0,
        pos: Vector.mult(this.pos, 0),
        vel: Vector.mult(this.vel, 0),
        id: Vector.mult(this.id, 0),
        sepCount: 0,
        dist: Vector.mult(this.pos, 0),
      },
      [GROUP.PREY]: {
        count: 0,
        pos: Vector.mult(this.pos, 0),
        vel: Vector.mult(this.vel, 0),
        id: Vector.mult(this.id, 0),
        sepCount: 0,
        dist: Vector.mult(this.pos, 0),
      },
      [GROUP.PRED]: {
        count: 0,
        pos: Vector.mult(this.pos, 0),
        vel: Vector.mult(this.vel, 0),
        id: Vector.mult(this.id, 0),
        sepCount: 0,
        dist: Vector.mult(this.pos, 0),
      },
    };
    for (const other of this.system.boids) {
      if (other == this) continue;
      const dist = Vector.sub(other.pos, this.pos);
      const id_diff = Vector.angleBetween(this.id, other.id) / (2 * Math.PI);
      const group =
        id_diff < -1 / 6
          ? GROUP.PREY
          : id_diff > 1 / 6
            ? GROUP.PRED
            : GROUP.PEER;
      if (dist.mag() < SETTING.separationRange) {
        acc[group].sepCount++;
        acc[group].dist.add(dist);
      }
      if (
        dist.mag() < SETTING.visualRange &&
        Math.abs(this.vel.angleBetween(dist)) < SETTING.visualAngle / 2
      ) {
        acc[group].count++;
        acc[group].pos.add(other.pos);
        acc[group].vel.add(other.vel);
        acc[group].id.add(other.id);
      }
    }
    for (const key in GROUP) {
      const group = GROUP[key];
      if (acc[group].sepCount > 0) {
        acc[group].dist.div(acc[group].sepCount);
        this._vel.add(
          acc[group].dist.copy().mult(-1).mult(SETTING[group].separation),
        );
      }
      if (acc[group].count > 0) {
        acc[group].pos.div(acc[group].count);
        acc[group].vel.div(acc[group].count);
        acc[group].id.normalize();
        this._vel.add(
          Vector.sub(acc[group].pos, this.pos).mult(SETTING[group].coherence),
        );
        this._vel.add(
          Vector.sub(acc[group].vel, this.vel).mult(SETTING[group].alignment),
        );
        this._id_vel.add(
          Vector.sub(acc[group].id, this.id).mult(SETTING[group].agreeableness),
        );
      }
    }
    {
      if (this.pos.x - this.system.wall.left < SETTING.margin)
        this._vel.add(new Vector(+1, 0).mult(SETTING.avoidance));
      if (this.pos.y - this.system.wall.top < +SETTING.margin)
        this._vel.add(new Vector(0, +1).mult(SETTING.avoidance));
      if (this.pos.x - this.system.wall.right > -SETTING.margin)
        this._vel.add(new Vector(-1, 0).mult(SETTING.avoidance));
      if (this.pos.y - this.system.wall.bottom > -SETTING.margin)
        this._vel.add(new Vector(0, -1).mult(SETTING.avoidance));
    }
  }
  update(deltaTime: number) {
    const dt = deltaTime / 1000;
    this.vel = this._vel!;
    if (this.vel.mag() < SETTING.speedMin) this.vel.setMag(SETTING.speedMin);
    if (this.vel.mag() > SETTING.speedMax) this.vel.setMag(SETTING.speedMax);
    this.pos.add(this.vel.copy().mult(dt));
    this.id.add(this._id_vel!.copy().mult(dt)).normalize();
    while (this.pos.x < this.system.wall.left)
      this.pos.add(
        new Vector(this.system.wall.right - this.system.wall.left, 0),
      );
    while (this.pos.x > this.system.wall.right)
      this.pos.sub(
        new Vector(this.system.wall.right - this.system.wall.left, 0),
      );
    while (this.pos.y < this.system.wall.top)
      this.pos.add(
        new Vector(0, this.system.wall.bottom - this.system.wall.top),
      );
    while (this.pos.y > this.system.wall.bottom)
      this.pos.sub(
        new Vector(0, this.system.wall.bottom - this.system.wall.top),
      );
  }
  data() {
    return {
      c: map(this.id.heading(), -Math.PI, +Math.PI, 0, 360),
      p: {
        x: this.pos.x,
        y: this.pos.y,
      },
      d: {
        x: this.vel.x,
        y: this.vel.y,
      },
    };
  }
}

export class BoidSystem {
  wall: { left: number; right: number; top: number; bottom: number };
  boids: Boid[];
  constructor(w: number, h: number, n: number) {
    this.wall = {
      left: 0,
      right: w,
      top: 0,
      bottom: h,
    };
    const padding = 3;
    this.boids = new Array(n).fill(null).map(() => {
      return new Boid(
        this,
        new Vector(
          map(
            randomGaussian(0, 1),
            -padding,
            +padding,
            this.wall.left,
            this.wall.right,
          ),
          map(
            randomGaussian(0, 1),
            -padding,
            +padding,
            this.wall.top,
            this.wall.bottom,
          ),
        ),
        Vector.random2D().mult(SETTING.speedMax),
        Math.random(),
      );
    });
  }
  data() {
    return this.boids.map((b) => b.data());
  }
  update(deltaTime: number, n = 1) {
    for (let i = 0; i < n; i++) {
      this.boids.forEach((b) => b.eval());
      this.boids.forEach((b) => b.update(deltaTime / n));
    }
  }
}
