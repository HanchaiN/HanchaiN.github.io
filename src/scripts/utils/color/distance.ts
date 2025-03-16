import type { HCLColor, LABColor, SRGBColor } from "./conversion.ts";

export function DistanceRedMean(color1: SRGBColor, color2: SRGBColor): number {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  const rMean = (r1 + r2) / 2,
    r = r2 - r1,
    g = g2 - g1,
    b = b2 - b1;
  return Math.sqrt(
    (2 + rMean) * Math.pow(r, 2) +
      4 * Math.pow(g, 2) +
      (3 - rMean) * Math.pow(b, 2),
  );
}
export function DistanceHyAB(color1: LABColor, color2: LABColor): number {
  const [l1, a1, b1] = color1;
  const [l2, a2, b2] = color2;
  return (
    Math.abs(l1 - l2) + Math.sqrt(Math.pow(a2 - a1, 2) + Math.pow(b2 - b1, 2))
  );
}
export function DistanceEab(color1: LABColor, color2: LABColor): number {
  const [l1, a1, b1] = color1;
  const [l2, a2, b2] = color2;
  return Math.sqrt(
    Math.pow(l1 - l2, 2) + Math.pow(a2 - a1, 2) + Math.pow(b2 - b1, 2),
  );
}
export function DistanceCMC(
  color1: HCLColor,
  color2: HCLColor,
  options = {
    l: 2,
    c: 1,
  },
): number {
  const { l, c } = options;
  const [l1, c1, h1] = color1;
  const [l2, c2, h2] = color2;
  const f = Math.sqrt(Math.pow(c1, 4) / (Math.pow(c1, 4) + 1900));
  let h1_ = (Math.atan2(Math.sin(h1), Math.cos(h1)) * 360) / (2 * Math.PI);
  if (h1_ < 0) h1_ += 360;
  let h2_ = (Math.atan2(Math.sin(h2), Math.cos(h2)) * 360) / (2 * Math.PI);
  if (h2_ < 0) h2_ += 360;
  let deltaH = Math.abs(h1_ - h2_);
  if (deltaH > 180) deltaH = 360 - deltaH;
  const t =
    164 <= h1_ && h1_ <= 345
      ? 0.56 + Math.abs(0.2 * Math.cos(h1_ + 168))
      : 0.36 + Math.abs(0.4 * Math.cos(h1_ + 35));
  const sL = l1 < 16 ? 0.511 : (0.040975 * l1) / (1 + 0.01765 * l1);
  const sC = (0.0638 * c1) / (1 + 0.0131 * c1) + 0.638;
  const sH = sC * (f * t + 1 - f);
  return Math.sqrt(
    Math.pow((l2 - l1) / (l * sL), 2) +
      Math.pow((c2 - c1) / (c * sC), 2) +
      Math.pow(deltaH / sH, 2),
  );
}
export function DistanceE94(
  color1: LABColor,
  color2: LABColor,
  options = {
    k1: 0.045,
    k2: 0.015,
    kL: 1,
    kC: 1,
    kH: 1,
  },
): number {
  const { k1, k2, kL, kC, kH } = options;
  const [l1, a1, b1] = color1;
  const c1 = Math.sqrt(Math.pow(a1, 2) + Math.pow(b1, 2));
  const [l2, a2, b2] = color2;
  const c2 = Math.sqrt(Math.pow(a2, 2) + Math.pow(b2, 2));
  const deltaH = Math.sqrt(
    Math.max(
      0,
      Math.pow(a2 - a1, 2) + Math.pow(b2 - b1, 2) - Math.pow(c2 - c1, 2),
    ),
  );
  const sL = 1,
    sC = 1 + k1 * c1,
    sH = 1 + k2 * c1;
  const res = Math.sqrt(
    Math.pow((l2 - l1) / (kL * sL), 2) +
      Math.pow((c2 - c1) / (kC * sC), 2) +
      Math.pow(deltaH / (kH * sH), 2),
  );
  return res;
}
export function DistanceE00(
  color1: LABColor,
  color2: LABColor,
  options = {
    kL: 1,
    kC: 1,
    kH: 1,
  },
): number {
  const { kL, kC, kH } = options;
  const [l1, a1, b1] = color1;
  const c1 = Math.sqrt(Math.pow(a1, 2) + Math.pow(b1, 2));
  const [l2, a2, b2] = color2;
  const c2 = Math.sqrt(Math.pow(a2, 2) + Math.pow(b2, 2));
  const l_avg = (l1 + l2) / 2,
    c_avg = (c1 + c2) / 2;
  const a1_ =
    a1 +
    (a1 / 2) *
      (1 -
        Math.sqrt(Math.pow(c_avg, 7) / (Math.pow(c_avg, 7) + Math.pow(25, 7))));
  const c1_ = Math.sqrt(Math.pow(a1_, 2) + Math.pow(b1, 2));
  const a2_ =
    a2 +
    (a2 / 2) *
      (1 -
        Math.sqrt(Math.pow(c_avg, 7) / (Math.pow(c_avg, 7) + Math.pow(25, 7))));
  const c2_ = Math.sqrt(Math.pow(a2_, 2) + Math.pow(b2, 2));
  const c_avg_ = (c1_ + c2_) / 2;
  let h1 = (Math.atan2(b1, a1_) * 360) / (2 * Math.PI);
  if (h1 < 0) h1 += 360;
  let h2 = (Math.atan2(b2, a2_) * 360) / (2 * Math.PI);
  if (h2 < 0) h2 += 360;
  let deltaH = h2 - h1;
  let h_avg = (h1 + h2) / 2;
  if (Math.abs(deltaH) > 180) {
    if (h2 <= h1) {
      deltaH += 360;
      h_avg += 180;
    } else {
      deltaH -= 360;
      h_avg -= 180;
    }
  }
  if (c1_ === 0) h_avg = h1;
  if (c2_ === 0) h_avg = h2;
  const deltaH_ =
    2 * Math.sqrt(c1_ * c2_) * Math.sin(((deltaH / 2) * Math.PI) / 180);
  const t =
    1 -
    0.17 * Math.cos(((h_avg - 30) * Math.PI) / 360) +
    0.24 * Math.cos((2 * h_avg * Math.PI) / 360) +
    0.32 * Math.cos(((3 * h_avg + 6) * Math.PI) / 360) -
    0.2 * Math.cos(((4 * h_avg - 63) * Math.PI) / 360);
  const sL =
      1 +
      (0.015 * Math.pow(l_avg - 50, 2)) /
        Math.sqrt(20 + Math.pow(l_avg - 50, 2)),
    sC = 1 + 0.045 * c_avg_,
    sH = 1 + 0.015 * c_avg_ * t;
  const rt =
    -2 *
    Math.sqrt(Math.pow(c_avg_, 7) / (Math.pow(c_avg_, 7) + Math.pow(25, 7))) *
    Math.sin((Math.PI / 6) * Math.exp(-Math.pow((h_avg - 275) / 25, 2)));
  return Math.sqrt(
    Math.max(
      0,
      Math.pow((l2 - l1) / (kL * sL), 2) +
        Math.pow((c2_ - c1_) / (kC * sC), 2) +
        Math.pow(deltaH / (kH * sH), 2) +
        (((rt * (c2_ - c1_)) / (kC * sC)) * deltaH_) / (kH * sH),
    ),
  );
}
