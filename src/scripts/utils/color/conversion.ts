import { PriorityQueue } from "../algo/datastructure.js";
import { constrain } from "../math/utils.js";

function rescale(x: number): number {
  return Math.round(constrain(x, 0, 1) * 255);
}

export type Color = [number, number, number];
export type HCLColor = [h: number, c: number, l: number];
export type OKHCLColor = [h: number, c: number, l: number];
export type LABColor = [l: number, a: number, b: number];
export type OKLABColor = [l: number, a: number, b: number];
export type LMSColor = [l: number, m: number, s: number];
export type XYZColor = [x: number, y: number, z: number];
export type RGBColor = [r: number, g: number, b: number];
export type SRGBColor = [r: number, g: number, b: number];
export type CubehelixColor = [h: number, s: number, l: number];
export type RGBAColor = [r: number, g: number, b: number, a: number];
export type ColorSpaceMap = {
  hcl: HCLColor;
  lab: LABColor;
  okhcl: HCLColor;
  oklab: OKLABColor;
  lms: LMSColor;
  xyz: XYZColor;
  rgb: RGBColor;
  srgb: SRGBColor;
  cubehelix: CubehelixColor;
};
export type ColorSpaceMapExt = ColorSpaceMap & {
  str: string;
  css: string;
  hex: string;
  lum: [l: number];
};

export type ColorSpace = keyof ColorSpaceMap;
export type ColorSpaceExt = keyof ColorSpaceMapExt;

function str2srgb(c: string): SRGBColor {
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext("2d", { colorSpace: "srgb" })!;
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1, { colorSpace: "srgb" }).data;
  return [data[0] / 255, data[1] / 255, data[2] / 255];
}

function hex2srgb(c: string): RGBColor {
  if (c.startsWith("#")) c = c.slice(1);
  c = c.replace(/[^0-9a-fA-F]/g, "");
  const len = Math.max(1, Math.ceil(c.length / 3));
  c = c.padEnd(3 * len, "0");
  return [
    Number.parseInt(c.slice(0 * len, 1 * len), 16) / (Math.pow(16, len) - 1),
    Number.parseInt(c.slice(1 * len, 2 * len), 16) / (Math.pow(16, len) - 1),
    Number.parseInt(c.slice(2 * len, 3 * len), 16) / (Math.pow(16, len) - 1),
  ];
}
function srgb2css(c: SRGBColor): string {
  return `srgb(${c.map(rescale).join(", ")})`;
  // return `#` + c.map(rescale).map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function srgba2css(c: SRGBColor, a: number): string {
  return `srgba(${c.map(rescale).join(", ")}, ${a})`;
}

function css2srgb(c: string): SRGBColor {
  return str2srgb(c);
}
function srgb2hex(c: RGBColor): string {
  return (
    `#` +
    c
      .map(rescale)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
  );
}
export function srgba2hex(c: RGBColor, a: number): string {
  return (
    `#` +
    [...c, a]
      .map(rescale)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
  );
}

function str2str(c: string): string {
  return c;
}

function hcl2lab(hcl: HCLColor): LABColor;
function hcl2lab(hcl: OKHCLColor): OKLABColor;
function hcl2lab(hcl: HCLColor | OKHCLColor): LABColor | OKLABColor {
  return [
    hcl[2],
    hcl[1] * Math.cos(hcl[0] * 2 * Math.PI),
    hcl[1] * Math.sin(hcl[0] * 2 * Math.PI),
  ];
}
function lab2hcl(lab: LABColor): HCLColor;
function lab2hcl(lab: OKLABColor): OKHCLColor;
function lab2hcl(lab: LABColor | OKLABColor): HCLColor | OKHCLColor {
  return [
    Math.atan2(lab[2], lab[1]) / (2 * Math.PI),
    Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]),
    lab[0],
  ];
}

export const STD_ILLUM = [0.9504492182750991, 1.0, 1.0889166484304715];
function lab2xyz(lab: LABColor): XYZColor {
  const DELTA = 6.0 / 29.0;
  const DELTA2 = DELTA * DELTA;
  const fy = (lab[0] + 0.16) / 1.16;
  const fx = fy + lab[1] / 5;
  const fz = fy - lab[2] / 2;
  return [
    STD_ILLUM[0] *
      (fx > DELTA ? fx * fx * fx : (fx - 4.0 / 29.0) * 3.0 * DELTA2),
    STD_ILLUM[1] *
      (fy > DELTA ? fy * fy * fy : (fy - 4.0 / 29.0) * 3.0 * DELTA2),
    STD_ILLUM[2] *
      (fz > DELTA ? fz * fz * fz : (fz - 4.0 / 29.0) * 3.0 * DELTA2),
  ];
}
function xyz2lab(xyz: XYZColor): LABColor {
  const DELTA = 6.0 / 29.0;
  const DELTA2 = DELTA * DELTA;
  const DELTA3 = DELTA * DELTA * DELTA;
  const t = [
    xyz[0] / STD_ILLUM[0],
    xyz[1] / STD_ILLUM[1],
    xyz[2] / STD_ILLUM[2],
  ];
  const fx =
    t[0] > DELTA3 ? Math.cbrt(t[0]) : t[0] / (3.0 * DELTA2) + 4.0 / 29.0;
  const fy =
    t[1] > DELTA3 ? Math.cbrt(t[1]) : t[1] / (3.0 * DELTA2) + 4.0 / 29.0;
  const fz =
    t[2] > DELTA3 ? Math.cbrt(t[2]) : t[2] / (3.0 * DELTA2) + 4.0 / 29.0;
  return [1.16 * fy - 0.16, 5.0 * (fx - fy), 2.0 * (fy - fz)];
}

const OKLAB2LMS = [
  [+1.0, +0.3963377774, +0.2158037573],
  [+1.0, -0.1055613458, -0.0638541728],
  [+1.0, -0.0894841775, -1.291485548],
];
const _LMS2OKLAB = [
  [+0.2104542553, +0.793617785, -0.0040720468],
  [+1.9779984951, -2.428592205, +0.4505937099],
  [+0.0259040371, +0.7827717662, -0.808675766],
];
function oklab2lms(lab: OKLABColor): LMSColor {
  const lms_ = [
    lab[0] * OKLAB2LMS[0][0] +
      lab[1] * OKLAB2LMS[0][1] +
      lab[2] * OKLAB2LMS[0][2],
    lab[0] * OKLAB2LMS[1][0] +
      lab[1] * OKLAB2LMS[1][1] +
      lab[2] * OKLAB2LMS[1][2],
    lab[0] * OKLAB2LMS[2][0] +
      lab[1] * OKLAB2LMS[2][1] +
      lab[2] * OKLAB2LMS[2][2],
  ];
  return [Math.pow(lms_[0], 3), Math.pow(lms_[1], 3), Math.pow(lms_[2], 3)];
}
function lms2oklab(lms: LMSColor): OKLABColor {
  const lms_ = [Math.cbrt(lms[0]), Math.cbrt(lms[1]), Math.cbrt(lms[2])];
  return [
    lms_[0] * _LMS2OKLAB[0][0] +
      lms_[1] * _LMS2OKLAB[0][1] +
      lms_[2] * _LMS2OKLAB[0][2],
    lms_[0] * _LMS2OKLAB[1][0] +
      lms_[1] * _LMS2OKLAB[1][1] +
      lms_[2] * _LMS2OKLAB[1][2],
    lms_[0] * _LMS2OKLAB[2][0] +
      lms_[1] * _LMS2OKLAB[2][1] +
      lms_[2] * _LMS2OKLAB[2][2],
  ];
}

const XYZ2LMS = [
  [+0.8189330101, +0.3618667424, -0.1288597137],
  [+0.0329845436, +0.9293118715, +0.0361456387],
  [+0.0482003018, +0.793617785, +0.633851707],
];
function xyz2lms(xyz: XYZColor): LMSColor {
  return [
    xyz[0] * XYZ2LMS[0][0] + xyz[1] * XYZ2LMS[0][1] + xyz[2] * XYZ2LMS[0][2],
    xyz[0] * XYZ2LMS[1][0] + xyz[1] * XYZ2LMS[1][1] + xyz[2] * XYZ2LMS[1][2],
    xyz[0] * XYZ2LMS[2][0] + xyz[1] * XYZ2LMS[2][1] + xyz[2] * XYZ2LMS[2][2],
  ];
}

// CIE RGB
// const XYZ2RGB = [
//   [+8041697 / 3400850, -3049000 / 3400850, -1591847 / 3400850],
//   [-1752003 / 340085000, +4851000 / 3400850, +301853 / 3400850],
//   [+17697 / 3400850, -49000 / 3400850, +3432153 / 3400850],
// ];
// const RGB2XYZ = [
//   [0.49, 0.31, 0.2],
//   [0.17697, 0.8124, 0.01063],
//   [0.0, 0.01, 0.99],
// ];
// Linear RGB
const XYZ2RGB = [
  [+3.2406225, -1.537208, -0.4986286],
  [-0.9689307, +1.8757561, +0.0415175],
  [+0.0557101, -0.2040211, +1.0569959],
];
const RGB2XYZ = [
  [0.4124, 0.3576, 0.1805],
  [0.2126, 0.7152, 0.0722],
  [0.0193, 0.1192, 0.9505],
];
function xyz2rgb(xyz: XYZColor): RGBColor {
  return [
    xyz[0] * XYZ2RGB[0][0] + xyz[1] * XYZ2RGB[0][1] + xyz[2] * XYZ2RGB[0][2],
    xyz[0] * XYZ2RGB[1][0] + xyz[1] * XYZ2RGB[1][1] + xyz[2] * XYZ2RGB[1][2],
    xyz[0] * XYZ2RGB[2][0] + xyz[1] * XYZ2RGB[2][1] + xyz[2] * XYZ2RGB[2][2],
  ];
}
function rgb2xyz(rgb: RGBColor): XYZColor {
  return [
    rgb[0] * RGB2XYZ[0][0] + rgb[1] * RGB2XYZ[0][1] + rgb[2] * RGB2XYZ[0][2],
    rgb[0] * RGB2XYZ[1][0] + rgb[1] * RGB2XYZ[1][1] + rgb[2] * RGB2XYZ[1][2],
    rgb[0] * RGB2XYZ[2][0] + rgb[1] * RGB2XYZ[2][1] + rgb[2] * RGB2XYZ[2][2],
  ];
}

const RGB2LMS = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const LMS2RGB = [
  [+4.0767416621, -3.3077115913, +0.2309699292],
  [-1.2684380046, +2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, +1.707614701],
];
function rgb2lms(rgb: RGBColor): LMSColor {
  return [
    rgb[0] * RGB2LMS[0][0] + rgb[1] * RGB2LMS[0][1] + rgb[2] * RGB2LMS[0][2],
    rgb[0] * RGB2LMS[1][0] + rgb[1] * RGB2LMS[1][1] + rgb[2] * RGB2LMS[1][2],
    rgb[0] * RGB2LMS[2][0] + rgb[1] * RGB2LMS[2][1] + rgb[2] * RGB2LMS[2][2],
  ];
}
function lms2rgb(lms: LMSColor): RGBColor {
  return [
    lms[0] * LMS2RGB[0][0] + lms[1] * LMS2RGB[0][1] + lms[2] * LMS2RGB[0][2],
    lms[0] * LMS2RGB[1][0] + lms[1] * LMS2RGB[1][1] + lms[2] * LMS2RGB[1][2],
    lms[0] * LMS2RGB[2][0] + lms[1] * LMS2RGB[2][1] + lms[2] * LMS2RGB[2][2],
  ];
}

function rgb2srgb(rgb: RGBColor): SRGBColor {
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
function srgb2rgb(rgb: RGBColor): SRGBColor {
  return [
    rgb[0] < 0.04045 ? rgb[0] / 12.92 : Math.pow((rgb[0] + 0.055) / 1.055, 2.4),
    rgb[1] < 0.04045 ? rgb[1] / 12.92 : Math.pow((rgb[1] + 0.055) / 1.055, 2.4),
    rgb[2] < 0.04045 ? rgb[2] / 12.92 : Math.pow((rgb[2] + 0.055) / 1.055, 2.4),
  ];
}

function cubehelix2rgb(hsl: CubehelixColor): RGBColor {
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

export function rgb2lum(rgb: RGBColor): [l: number] {
  return [0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]];
}

export default function convert_color<
  T1 extends keyof ColorSpaceMapExt,
  T2 extends keyof ColorSpaceMapExt,
>(
  inp: T1,
  out: T2,
): ((x: ColorSpaceMapExt[T1]) => ColorSpaceMapExt[T2]) | null {
  if (out === "str") {
    console.warn("Please specify the output color format.");
    return null;
  }
  const nodes: (keyof ColorSpaceMapExt)[] = [
    "hcl",
    "lab",
    "okhcl",
    "oklab",
    "lms",
    "xyz",
    "rgb",
    "srgb",
    "cubehelix",
    "str",
    "css",
    "hex",
    "lum",
  ];
  const edges: {
    [i in keyof ColorSpaceMapExt]?: {
      [o in keyof ColorSpaceMapExt]?: (
        x: ColorSpaceMapExt[i],
      ) => ColorSpaceMapExt[o];
    };
  } = {
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
      lum: rgb2lum,
    },
    srgb: {
      rgb: srgb2rgb,
      css: srgb2css,
      hex: srgb2hex,
    },
    cubehelix: {
      rgb: cubehelix2rgb,
    },
    css: {
      str: str2str,
      srgb: css2srgb,
    },
    hex: {
      str: str2str,
      srgb: hex2srgb,
    },
    str: {
      srgb: str2srgb,
    },
  };
  const i = nodes.indexOf(inp),
    o = nodes.indexOf(out);
  if (i === -1 || o === -1) {
    console.warn("Invalid color format.");
    return null;
  }
  const dist = nodes.map(() => Infinity);
  const prev = nodes.map(() => -1);
  const q = new PriorityQueue(([dist]: [number, number]) => dist);
  dist[i] = 0;
  q.push([0, i]);
  while (q.top() !== null) {
    if (dist[o] !== Infinity) break;
    const [d, u] = q.pop()!;
    if (d > dist[u]) continue;
    if (!(nodes[u] in edges)) continue;
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
  if (dist[o] === Infinity) {
    console.warn(`Cannot convert from ${inp} to ${out}`);
    return null;
  }
  const path: ((
    x: ColorSpaceMapExt[keyof ColorSpaceMapExt],
  ) => ColorSpaceMapExt[keyof ColorSpaceMapExt])[] = [];
  for (let at = o; at !== -1 && prev[at] !== -1; at = prev[at]) {
    const from = nodes[prev[at]];
    const to = nodes[at];
    path.push(
      edges[from]![to]! as (
        x: ColorSpaceMapExt[keyof ColorSpaceMapExt],
      ) => ColorSpaceMapExt[keyof ColorSpaceMapExt],
    );
  }
  return (x: ColorSpaceMapExt[T1]) =>
    path.reduceRight(
      (v: ColorSpaceMapExt[keyof ColorSpaceMapExt], f) => f(v),
      x,
    ) as ColorSpaceMapExt[T2];
}
