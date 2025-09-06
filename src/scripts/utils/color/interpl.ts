import {
  vector_add,
  vector_dist,
  vector_mult,
} from "@/scripts/utils/math/vector.js";

import { softargmax } from "../math/utils.js";

export const dist = vector_dist<[number, number, number]>;

export function generateGradient(
  num: number,
  stops: [number, [number, number, number]][],
) {
  const stops_ = stops
    .map(([t, c]) => [t, [...c]] as [number, [number, number, number]])
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
    return vector_add(vector_mult(c1, w[0]), vector_mult(c2, w[1]));
  }) as [number, number, number][];
}
