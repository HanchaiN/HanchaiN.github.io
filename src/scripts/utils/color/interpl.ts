import { softargmax } from "../math/utils.js";
import { vector_add, vector_scale, vlerp } from "../math/vector.js";
import type { ColorSpace, ColorSpaceMap } from "./conversion.js";
import convert_color from "./conversion.js";

export function clerp<
  C1 extends ColorSpace = "rgb",
  C2 extends ColorSpace = C1,
>(
  t: number,
  c0: ColorSpaceMap[C1],
  c1: ColorSpaceMap[C1],
  mode_val: C1 = "rgb" as C1,
  mode_calc: C2 = mode_val as ColorSpace as C2,
): ColorSpaceMap[C1] {
  const to = convert_color(mode_val, mode_calc)!;
  const from = convert_color(mode_calc, mode_val)!;
  const c0_ = to(c0) as ColorSpaceMap[C2];
  const c1_ = to(c1) as ColorSpaceMap[C2];
  const c_ = vlerp(t, c0_, c1_);
  return from(c_) as ColorSpaceMap[C1];
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
