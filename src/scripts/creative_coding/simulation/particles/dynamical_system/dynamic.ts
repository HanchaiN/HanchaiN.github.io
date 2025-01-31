import { Vector } from "@/scripts/utils/math/vector.js";

export class State {
  static options = {
    rk: {
      a: [[], [1 / 2], [0, 1 / 2], [0, 0, 1]],
      b: [1 / 6, 1 / 3, 1 / 3, 1 / 6],
      c: [0, 1 / 2, 1 / 2, 1], // a.map(_ => _.reduce((acc, curr) => acc + curr, 0))
    },
  };
  _state: Vector[];
  constructor(state: Vector) {
    this._state = [Vector.copy(state)];
  }
  get dim() {
    return this._state[0].dim;
  }
  get order() {
    return 1;
  }
  get state() {
    return this._state.map((v) => Vector.copy(v));
  }
  update(
    func: (time: number, state: Vector[]) => Vector,
    t: number,
    dt: number,
  ) {
    // Runge-Kutta methods
    const k: Vector[] = [];
    const delta = Vector.zero(this.dim);
    State.options.rk.b.forEach((bi, i) => {
      const state_ = Vector.copy(this.state[0]);
      k.forEach((kj, j) => {
        if (State.options.rk.a[i][j] !== 0)
          state_.add(Vector.copy(kj).mult(State.options.rk.a[i][j] * dt));
      });
      const ki = func(t + State.options.rk.c[i] * dt, [state_]);
      k.push(ki);
      delta.add(Vector.copy(ki).mult(bi));
    });
    this._state[0].add(delta.mult(dt));
  }
}

export class HigherOrderState extends State {
  static options = {
    rk: {
      a: [[], [1 / 2], [0, 1 / 2], [0, 0, 1]],
      b: [1 / 6, 1 / 3, 1 / 3, 1 / 6],
      c: [0, 1 / 2, 1 / 2, 1], // a.map(_ => _.reduce((acc, curr) => acc + curr, 0))
    },
  };
  constructor(...state: Vector[]) {
    super(state[0]);
    if (state.length === 0 || state.some((v) => v.dim !== state[0].dim))
      throw new Error();
    this._state = state.map((v) => Vector.copy(v));
  }
  get dim() {
    return this._state[0].dim;
  }
  get order() {
    return this._state.length;
  }
  set order(order) {
    if (order > this.order)
      this._state.push(
        ...new Array(order - this.order)
          .fill(null)
          .map(() => Vector.zero(this.dim)),
      );
    else this._state = this._state.slice(0, order + 1);
  }
  update(
    func: (time: number, state: Vector[]) => Vector,
    t: number,
    dt: number,
  ) {
    // Runge-Kutta methods
    const k: Vector[][] = [];
    const delta: Vector[] = new Array(this.order)
      .fill(null)
      .map(() => Vector.zero(this.dim));
    State.options.rk.b.forEach((bi, i) => {
      const state_ = this.state;
      k.forEach((kj, j) => {
        if (State.options.rk.a[i][j] === 0) return;
        state_.forEach((s, k) =>
          s.add(Vector.copy(kj[k]).mult(State.options.rk.a[i][j] * dt)),
        );
      });
      const ki = new Array(this.order)
        .fill(null)
        .map((_, i) =>
          i + 1 === this.order
            ? func(t + State.options.rk.c[i] * dt, state_)
            : Vector.copy(this.state[i + 1]),
        );
      k.push(ki);
      delta.forEach((d, i) => d.add(ki[i].mult(bi)));
    });
    this._state.forEach((s, i) => s.add(delta[i].mult(dt)));
  }
  // update(func: (time: number, state: Vector[]) => Vector, t: number, dt: number) {
  //     // Euler methods
  //     const der = func(t, this.state);
  //     this._state.forEach((v, i) => {
  //         if (i === this.order - 1)
  //             v.add(Vector.copy(der).mult(dt));
  //         else
  //             v.add(this._state[i + 1].mult(dt));
  //     });
  // }
}
