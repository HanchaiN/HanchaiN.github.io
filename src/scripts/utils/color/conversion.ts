import { PriorityQueue } from "../algo.js";
import { constrain } from "../math/utils.js";

function rescale(x: number): number {
  return Math.round(constrain(x, 0, 1) * 255);
}

export function srgba2str(
  c: [r: number, g: number, b: number],
  a: number,
): string {
  return `rgba(${rescale(c[0])}, ${rescale(c[1])}, ${rescale(c[2])}, ${a})`;
}
export function str2str(c: string): string {
  return srgb2str(str2srgb(c));
}
export function srgb2str(c: [r: number, g: number, b: number]): string {
  return `rgb(${rescale(c[0])}, ${rescale(c[1])}, ${rescale(c[2])})`;
}
export function str2srgb(c: string): [r: number, g: number, b: number] {
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext("2d", { colorSpace: "srgb" })!;
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0] / 255, data[1] / 255, data[2] / 255];
}

export function hcl2lab(
  hcl: [h: number, c: number, l: number],
): [l: number, a: number, b: number] {
  return [
    hcl[2],
    hcl[1] * Math.cos(hcl[0] * 2 * Math.PI),
    hcl[1] * Math.sin(hcl[0] * 2 * Math.PI),
  ];
}
export function lab2hcl(
  lab: [l: number, a: number, b: number],
): [h: number, c: number, l: number] {
  return [
    Math.atan2(lab[2], lab[1]) / (2 * Math.PI),
    Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]),
    lab[0],
  ];
}
export function lab2xyz(
  lab: [l: number, a: number, b: number],
): [x: number, y: number, z: number] {
  const CBRT_EPSILON = 6.0 / 29.0;
  const KAPPA = 243.89 / 27.0;
  const std = [0.9504492182750991, 1.0, 1.0889166484304715];
  const fy = (lab[0] + 0.16) / 1.16;
  const fx = fy + lab[1] / 5;
  const fz = fy - lab[2] / 2;
  return [
    std[0] * (fx > CBRT_EPSILON ? fx * fx * fx : (1.16 * fx - 0.16) / KAPPA),
    std[1] * (fy > CBRT_EPSILON ? fy * fy * fy : (1.16 * fy - 0.16) / KAPPA),
    std[2] * (fz > CBRT_EPSILON ? fz * fz * fz : (1.16 * fz - 0.16) / KAPPA),
  ];
}
export function xyz2lab(
  xyz: [x: number, y: number, z: number],
): [l: number, a: number, b: number] {
  const CBRT_EPSILON = 6.0 / 29.0;
  const EPSILON = CBRT_EPSILON * CBRT_EPSILON * CBRT_EPSILON;
  const std = [0.9504492182750991, 1.0, 1.0889166484304715];
  const t = [xyz[0] / std[0], xyz[1] / std[1], xyz[2] / std[2]];
  const fx =
    t[0] > EPSILON
      ? Math.cbrt(t[0])
      : t[0] / (3.0 * CBRT_EPSILON * CBRT_EPSILON) + 4.0 / 29.0;
  const fy =
    t[1] > EPSILON
      ? Math.cbrt(t[1])
      : t[1] / (3.0 * CBRT_EPSILON * CBRT_EPSILON) + 4.0 / 29.0;
  const fz =
    t[2] > EPSILON
      ? Math.cbrt(t[2])
      : t[2] / (3.0 * CBRT_EPSILON * CBRT_EPSILON) + 4.0 / 29.0;
  return [1.16 * fy - 0.16, 5.0 * (fx - fy), 2.0 * (fy - fz)];
}
export function oklab2lms(
  lab: [l: number, a: number, b: number],
): [l: number, m: number, s: number] {
  const oklab2lms = [
    [+1.0, +0.3963377774, +0.2158037573],
    [+1.0, -0.1055613458, -0.0638541728],
    [+1.0, -0.0894841775, -1.291485548],
  ];
  const lms_ = [
    lab[0] * oklab2lms[0][0] +
      lab[1] * oklab2lms[0][1] +
      lab[2] * oklab2lms[0][2],
    lab[0] * oklab2lms[1][0] +
      lab[1] * oklab2lms[1][1] +
      lab[2] * oklab2lms[1][2],
    lab[0] * oklab2lms[2][0] +
      lab[1] * oklab2lms[2][1] +
      lab[2] * oklab2lms[2][2],
  ];
  return [Math.pow(lms_[0], 3), Math.pow(lms_[1], 3), Math.pow(lms_[2], 3)];
}
export function lms2oklab(
  lms: [l: number, m: number, s: number],
): [l: number, a: number, b: number] {
  const lms_ = [Math.cbrt(lms[0]), Math.cbrt(lms[1]), Math.cbrt(lms[2])];
  const lms2oklab = [
    [+0.2104542553, +0.793617785, -0.0040720468],
    [+1.9779984951, -2.428592205, +0.4505937099],
    [+0.0259040371, +0.7827717662, -0.808675766],
  ];
  return [
    lms_[0] * lms2oklab[0][0] +
      lms_[1] * lms2oklab[0][1] +
      lms_[2] * lms2oklab[0][2],
    lms_[0] * lms2oklab[1][0] +
      lms_[1] * lms2oklab[1][1] +
      lms_[2] * lms2oklab[1][2],
    lms_[0] * lms2oklab[2][0] +
      lms_[1] * lms2oklab[2][1] +
      lms_[2] * lms2oklab[2][2],
  ];
}
export function xyz2lms(
  xyz: [x: number, y: number, z: number],
): [l: number, m: number, s: number] {
  const xyz2lms = [
    [+0.8189330101, +0.3618667424, -0.1288597137],
    [+0.0329845436, +0.9293118715, +0.0361456387],
    [+0.0482003018, +0.793617785, +0.633851707],
  ];
  return [
    xyz[0] * xyz2lms[0][0] + xyz[1] * xyz2lms[0][1] + xyz[2] * xyz2lms[0][2],
    xyz[0] * xyz2lms[1][0] + xyz[1] * xyz2lms[1][1] + xyz[2] * xyz2lms[1][2],
    xyz[0] * xyz2lms[2][0] + xyz[1] * xyz2lms[2][1] + xyz[2] * xyz2lms[2][2],
  ];
}
export function xyz2rgb(
  xyz: [x: number, y: number, z: number],
): [r: number, g: number, b: number] {
  const xyz2rgb = [
    [+8041697 / 3400850, -3049000 / 3400850, -1591847 / 3400850],
    [-1752003 / 340085000, +4851000 / 3400850, +301853 / 3400850],
    [+17697 / 3400850, -49000 / 3400850, +3432153 / 3400850],
  ];
  return [
    xyz[0] * xyz2rgb[0][0] + xyz[1] * xyz2rgb[0][1] + xyz[2] * xyz2rgb[0][2],
    xyz[0] * xyz2rgb[1][0] + xyz[1] * xyz2rgb[1][1] + xyz[2] * xyz2rgb[1][2],
    xyz[0] * xyz2rgb[2][0] + xyz[1] * xyz2rgb[2][1] + xyz[2] * xyz2rgb[2][2],
  ];
}
export function rgb2xyz(
  rgb: [r: number, g: number, b: number],
): [x: number, y: number, z: number] {
  const rgb2xyz = [
    [0.49, 0.31, 0.2],
    [0.17697, 0.8124, 0.01063],
    [0.0, 0.01, 0.99],
  ];
  return [
    rgb[0] * rgb2xyz[0][0] + rgb[1] * rgb2xyz[0][1] + rgb[2] * rgb2xyz[0][2],
    rgb[0] * rgb2xyz[1][0] + rgb[1] * rgb2xyz[1][1] + rgb[2] * rgb2xyz[1][2],
    rgb[0] * rgb2xyz[2][0] + rgb[1] * rgb2xyz[2][1] + rgb[2] * rgb2xyz[2][2],
  ];
}
export function rgb2lms(
  rgb: [r: number, g: number, b: number],
): [l: number, m: number, s: number] {
  const rgb2lms = [
    [0.4122214708, 0.5363325363, 0.0514459929],
    [0.2119034982, 0.6806995451, 0.1073969566],
    [0.0883024619, 0.2817188376, 0.6299787005],
  ];
  return [
    rgb[0] * rgb2lms[0][0] + rgb[1] * rgb2lms[0][1] + rgb[2] * rgb2lms[0][2],
    rgb[0] * rgb2lms[1][0] + rgb[1] * rgb2lms[1][1] + rgb[2] * rgb2lms[1][2],
    rgb[0] * rgb2lms[2][0] + rgb[1] * rgb2lms[2][1] + rgb[2] * rgb2lms[2][2],
  ];
}
export function lms2rgb(
  lms: [l: number, m: number, s: number],
): [r: number, g: number, b: number] {
  const lms2rgb = [
    [+4.0767416621, -3.3077115913, +0.2309699292],
    [-1.2684380046, +2.6097574011, -0.3413193965],
    [-0.0041960863, -0.7034186147, +1.707614701],
  ];
  return [
    lms[0] * lms2rgb[0][0] + lms[1] * lms2rgb[0][1] + lms[2] * lms2rgb[0][2],
    lms[0] * lms2rgb[1][0] + lms[1] * lms2rgb[1][1] + lms[2] * lms2rgb[1][2],
    lms[0] * lms2rgb[2][0] + lms[1] * lms2rgb[2][1] + lms[2] * lms2rgb[2][2],
  ];
}
export function rgb2srgb(
  rgb: [r: number, g: number, b: number],
): [r: number, g: number, b: number] {
  return [
    rgb[0] < 0.0031308
      ? rgb[0] * 12.92
      : 1.055 * Math.pow(rgb[0], 1 / 2.4) - 0.055,
    rgb[1] < 0.0031308
      ? rgb[1] * 12.92
      : 1.055 * Math.pow(rgb[1], 1 / 2.4) - 0.055,
    rgb[2] < 0.0031308
      ? rgb[2] * 12.92
      : 1.055 * Math.pow(rgb[2], 1 / 2.4) - 0.055,
  ];
}
export function srgb2rgb(
  rgb: [r: number, g: number, b: number],
): [r: number, g: number, b: number] {
  return [
    rgb[0] < 0.04045 ? rgb[0] / 12.92 : Math.pow((rgb[0] + 0.055) / 1.055, 2.4),
    rgb[1] < 0.04045 ? rgb[1] / 12.92 : Math.pow((rgb[1] + 0.055) / 1.055, 2.4),
    rgb[2] < 0.04045 ? rgb[2] / 12.92 : Math.pow((rgb[2] + 0.055) / 1.055, 2.4),
  ];
}
export function cubehelix2rgb(
  hsl: [h: number, s: number, l: number],
): [r: number, g: number, b: number] {
  const A = -0.14861,
    B = +1.78277,
    C = -0.29227,
    D = -0.90649,
    E = +1.97294;
  const h = (hsl[0] + 1 / 3) * 2 * Math.PI,
    l = hsl[2],
    a = hsl[1] * l * (1 - l),
    c = Math.cos(h),
    s = Math.sin(h);
  return [l + a * (A * c + B * s), l + a * (C * c + D * s), l + a * (E * c)];
}

export type ColorSpace =
  | "hcl"
  | "lab"
  | "okhcl"
  | "oklab"
  | "lms"
  | "xyz"
  | "rgb"
  | "srgb"
  | "cubehelix";
type Color = [number, number, number];
function _from_to(
  inp: ColorSpace,
  out: ColorSpace,
): ((x: Color) => Color) | null {
  const nodes: ColorSpace[] = [
    "hcl",
    "lab",
    "okhcl",
    "oklab",
    "lms",
    "xyz",
    "rgb",
    "srgb",
    "cubehelix",
  ];
  const edges: { [i: string]: { [o: string]: (x: Color) => Color } } = {
    hcl: {
      lab: hcl2lab,
    },
    lab: {
      hcl: lab2hcl,
      xyz: lab2xyz,
    },
    okhcl: {
      oklab: hcl2lab,
    },
    oklab: {
      okhcl: lab2hcl,
      lms: oklab2lms,
    },
    lms: {
      oklab: lms2oklab,
      // xyz: lms2xyz,
      rgb: lms2rgb,
    },
    xyz: {
      lab: xyz2lab,
      rgb: xyz2rgb,
      lms: xyz2lms,
    },
    rgb: {
      xyz: rgb2xyz,
      lms: rgb2lms,
      srgb: rgb2srgb,
    },
    srgb: {
      rgb: srgb2rgb,
    },
    cubehelix: {
      rgb: cubehelix2rgb,
    },
  };
  const i = nodes.indexOf(inp),
    o = nodes.indexOf(out);
  if (i === -1 || o === -1) return null;
  const dist = nodes.map(() => Infinity);
  const prev = nodes.map(() => -1);
  const q = new PriorityQueue(([dist]: [number, number]) => dist);
  dist[i] = 0;
  q.push([0, i]);
  while (q.top() !== null) {
    if (dist[o] !== Infinity) break;
    const [d, u] = q.pop()!;
    if (d > dist[u]) continue;
    for (const _v in edges[nodes[u]]) {
      const v = nodes.indexOf(_v as ColorSpace);
      const alt = d + 1;
      if (alt < dist[v]) {
        prev[v] = u;
        dist[v] = alt;
        q.push([alt, v]);
      }
    }
  }
  if (dist[o] === Infinity) return null;
  const path: ((x: Color) => Color)[] = [];
  for (let at = o; at !== -1 && prev[at] !== -1; at = prev[at]) {
    const from = nodes[prev[at]];
    const to = nodes[at];
    path.push(edges[from as string][to as string]);
  }
  return (x: Color) => path.reduceRight((v, f) => f(v), x);
}

export default function convert_color(
  inp: ColorSpace,
  out: ColorSpace,
): ((x: Color) => Color) | null;
export default function convert_color(
  inp: "str",
  out: ColorSpace,
): ((x: string) => Color) | null;
export default function convert_color(
  inp: ColorSpace,
  out: "str",
): ((x: Color) => string) | null;
export default function convert_color(
  inp: "str",
  out: "str",
): ((x: string) => string) | null;
export default function convert_color(
  inp: "str" | ColorSpace,
  out: "str" | ColorSpace,
):
  | ((x: Color) => Color)
  | ((x: string) => Color)
  | ((x: Color) => string)
  | ((x: string) => string)
  | null {
  if (inp !== "str" && out !== "str") return _from_to(inp, out);
  if (inp === "str" && out !== "str") {
    const f = _from_to("srgb", out);
    if (f === null) return null;
    return (x: string) => f(str2srgb(x));
  }
  if (out === "str" && inp !== "str") {
    const f = _from_to(inp, "srgb");
    if (f === null) return null;
    return (x: Color) => srgb2str(f(x));
  }
  return (x: string) => srgb2str(str2srgb(x));
}
