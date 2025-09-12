import convert_color from "@/scripts/utils/color/conversion.js";
import type { RGBColor, SRGBColor } from "@/scripts/utils/color/conversion.js";
import { constrain, constrainLerp, lerp } from "@/scripts/utils/math/utils.js";

type IToneMapper = (ref: RGBColor) => (col: RGBColor) => RGBColor;

// https://64.github.io/tonemapping/
export const luminance = convert_color("rgb", "lum")!;
const exposture =
  (exposture: number) =>
  ([r, g, b]: RGBColor): RGBColor => [
    r * exposture,
    g * exposture,
    b * exposture,
  ];
const white_balance = ([ref_r, ref_g, ref_b]: RGBColor) => {
  const rgb2xyz = convert_color("rgb", "xyz")!,
    xyz2rgb = convert_color("xyz", "rgb")!;

  const [x0, y0, z0] = rgb2xyz([ref_r, ref_g, ref_b]);
  return ([r, g, b]: RGBColor): RGBColor => {
    const [x, y, z] = rgb2xyz([r, g, b]);
    const [x_, y_, z_] = [x / x0, y / y0, z / z0];
    return xyz2rgb([x_, y_, z_]);
  };
};
const contrast =
  (contrast: number) =>
  ([r, g, b]: RGBColor): RGBColor => [
    contrast * (r - 0.5) + 0.5,
    contrast * (g - 0.5) + 0.5,
    contrast * (b - 0.5) + 0.5,
  ];
const brightness =
  (brightness: number) =>
  ([r, g, b]: RGBColor): RGBColor => [
    r + brightness,
    g + brightness,
    b + brightness,
  ];
const saturation =
  (saturation: number) =>
  ([r, g, b]: RGBColor): RGBColor => {
    const l = luminance([r, g, b]);
    return [
      lerp(saturation, l, r),
      lerp(saturation, l, g),
      lerp(saturation, l, b),
    ];
  };
const clamp = ([r, g, b]: RGBColor): RGBColor => [
  constrain(r, 0, 1),
  constrain(g, 0, 1),
  constrain(b, 0, 1),
];
export const reinhard: IToneMapper =
  () =>
  ([r, g, b]: RGBColor): RGBColor => [r / (1 + r), g / (1 + g), b / (1 + b)];
export const reinhard_lum: IToneMapper =
  () =>
  ([r, g, b]: RGBColor): RGBColor => {
    const l = luminance([r, g, b]);
    return [r / (1 + l), g / (1 + l), b / (1 + l)];
  };
export const reinhard_jodie: IToneMapper = ([
  ref_r,
  ref_g,
  ref_b,
]: RGBColor) => {
  const reinhard_lum_ = reinhard_lum([ref_r, ref_g, ref_b]);
  const reinhard_ = reinhard([ref_r, ref_g, ref_b]);
  return ([r, g, b]: RGBColor): RGBColor => {
    const l = reinhard_lum_([r, g, b]);
    const h = reinhard_([r, g, b]);
    const i = h;
    return [
      constrainLerp(i[0], l[0], h[0]),
      constrainLerp(i[1], l[1], h[1]),
      constrainLerp(i[2], l[2], h[2]),
    ];
  };
};
export const reinhard_jodie_lum: IToneMapper = ([
  ref_r,
  ref_g,
  ref_b,
]: RGBColor) => {
  const reinhard_lum_ = reinhard_lum([ref_r, ref_g, ref_b]);
  const reinhard_ = reinhard([ref_r, ref_g, ref_b]);
  return ([r, g, b]: RGBColor): RGBColor => {
    const l = reinhard_lum_([r, g, b]);
    const h = reinhard_([r, g, b]);
    const i = l;
    return [
      constrainLerp(i[0], l[0], h[0]),
      constrainLerp(i[1], l[1], h[1]),
      constrainLerp(i[2], l[2], h[2]),
    ];
  };
};
export const scaler: IToneMapper =
  ([ref_r, ref_g, ref_b]: RGBColor) =>
  ([r, g, b]: RGBColor): RGBColor => [r / ref_r, g / ref_g, b / ref_b];
export const scaler_lum: IToneMapper = ([ref_r, ref_g, ref_b]: RGBColor) => {
  const ref = luminance([ref_r, ref_g, ref_b]);
  return ([r, g, b]: RGBColor): RGBColor => [r / ref, g / ref, b / ref];
};
export const reinhard_ext: IToneMapper = ([ref_r, ref_g, ref_b]: RGBColor) => {
  const r2 = ref_r * ref_r,
    g2 = ref_g * ref_g,
    b2 = ref_b * ref_b;
  const reinhard_ = reinhard([ref_r, ref_g, ref_b]);
  return ([r, g, b]: RGBColor): RGBColor => {
    const c = reinhard_([r, g, b]);
    return [(1 + r / r2) * c[0], (1 + g / g2) * c[1], (1 + b / b2) * c[2]];
  };
};
export const reinhard_lum_ext: IToneMapper = ([
  ref_r,
  ref_g,
  ref_b,
]: RGBColor) => {
  const l = luminance([ref_r, ref_g, ref_b]);
  const l2 = l * l;
  return ([r, g, b]: RGBColor): RGBColor => {
    const li = luminance([r, g, b]);
    const lo = ((1 + li / l2) * li) / (1 + li);
    return [(r * lo) / li, (g * lo) / li, (b * lo) / li];
  };
};
export const reinhard_jodie_ext: IToneMapper = ([
  ref_r,
  ref_g,
  ref_b,
]: RGBColor) => {
  const reinhard = reinhard_ext([ref_r, ref_g, ref_b]);
  const reinhard_lum = reinhard_lum_ext([ref_r, ref_g, ref_b]);
  return ([r, g, b]: RGBColor): RGBColor => {
    const l = reinhard_lum([r, g, b]);
    const h = reinhard([r, g, b]);
    const i = h;
    return [
      constrainLerp(i[0], l[0], h[0]),
      constrainLerp(i[1], l[1], h[1]),
      constrainLerp(i[2], l[2], h[2]),
    ];
  };
};
export const reinhard_jodie_lum_ext: IToneMapper = ([
  ref_r,
  ref_g,
  ref_b,
]: RGBColor) => {
  const reinhard = reinhard_ext([ref_r, ref_g, ref_b]);
  const reinhard_lum = reinhard_lum_ext([ref_r, ref_g, ref_b]);
  return ([r, g, b]: RGBColor): RGBColor => {
    const l = reinhard_lum([r, g, b]);
    const h = reinhard([r, g, b]);
    const i = l;
    return [
      constrainLerp(i[0], l[0], h[0]),
      constrainLerp(i[1], l[1], h[1]),
      constrainLerp(i[2], l[2], h[2]),
    ];
  };
};

const gamma =
  (y: number) =>
  ([r, g, b]: RGBColor): RGBColor => {
    const lum = luminance([r, g, b]);
    const factor = Math.pow(lum, y) / lum;
    return [r * factor, g * factor, b * factor];
  };

export const postProcessorGen =
  (
    TONEMAPPER: IToneMapper = () => (col) => col,
    GAMMA = 1,
    EXPOSTURE = 1,
    BRIGHTNESS = 0,
    CONTRAST = 1,
    SATURATION = 1,
  ) =>
  ({
    bright = [1, 1, 1],
    white = [1, 1, 1],
  }: {
    bright?: RGBColor;
    white?: RGBColor;
  }) => {
    const exposture_ = exposture(EXPOSTURE);
    const white_balance_ = white_balance(exposture_(white));
    const contrast_ = contrast(CONTRAST);
    const brightness_ = brightness(BRIGHTNESS);
    const saturate_ = saturation(SATURATION);
    const tonemapper_ = TONEMAPPER(
      saturate_(brightness_(contrast_(white_balance_(exposture_(bright))))),
    );
    const gamma_ = gamma(GAMMA);
    const rgb2srgb = convert_color("rgb", "srgb")!;
    return ([r, g, b]: RGBColor): SRGBColor =>
      rgb2srgb(
        gamma_(
          clamp(
            tonemapper_(
              saturate_(
                brightness_(contrast_(white_balance_(exposture_([r, g, b])))),
              ),
            ),
          ),
        ),
      );
  };
