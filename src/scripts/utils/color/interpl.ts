import { lerp, softargmax } from "../math/utils.js";
import { vector_add, vector_scale } from "../math/vector.js";

export function clerp<T extends number[]>(t: number, c0: T, c1: T): T {
  return c0.map((_, i) => lerp(t, c0[i], c1[i])) as T;
}

export function generateGradient<T extends number[]>(
  num: number,
  stops: [number, T][],
) {
  const stops_ = stops
    .map(([t, c]) => [t, [...c]] as [number, T])
    .sort(([t1], [t2]) => t1 - t2);
  return new Array(num).fill(0).map((_, i) => {
    const t0 = i / (num - 1);
    const j = stops_.findIndex(([s]) => s >= t0);
    if (j === 0) return [...stops_[0][1]];
    if (j === -1) return [...stops_[stops_.length - 1][1]];
    const [t1, c1] = stops_[j - 1];
    const [t2, c2] = stops_[j];
    const w = softargmax(
      [t1, t2].map((t) => Math.abs(t - t0) / Math.abs(t1 - t2)),
      -8,
    );
    return vector_add(vector_scale(c1, w[0]), vector_scale(c2, w[1]));
  }) as T[];
}
