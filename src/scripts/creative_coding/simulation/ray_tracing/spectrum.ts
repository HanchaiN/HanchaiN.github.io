import convert_color from "@/scripts/utils/color/conversion.js";
import type { RGBColor, XYZColor } from "@/scripts/utils/color/conversion.ts";
import {
  type TMatrix,
  matrix_mult_vector,
} from "@/scripts/utils/math/matrix.js";
import { map } from "@/scripts/utils/math/utils.js";

import { MAX_LUM } from "./const.js";

export type TSpectrum = number[] & { readonly length: 16 };
export const wavelengths: TSpectrum = new Array(16)
  .fill(0)
  .map((_, i, a) => map(i, 0, a.length - 1, 400, 700)) as TSpectrum;

export function blackBody(temp: number): TSpectrum {
  const c1 = Math.pow(400, 5) * MAX_LUM; // scale factor to set 400nm to MAX_LUM
  const c2 = (1e9 * 6.62607015e-34 * 2.99792458e8) / 1.380649e-23; // h*c / kB in nm*K
  return wavelengths.map((wl) => {
    return ((c1 / Math.pow(wl, 5)) * 1) / (Math.exp(c2 / (wl * temp)) - 1);
  }) as TSpectrum;
}

export type CMapMode = "camera" | "approx" | "approxXYZ";
export type CRefIllum = "Uniform" | "D65";
export type CMaxMode = "global" | "channel";
export type CMode = { mode: CMapMode; max_ref: CRefIllum; max_mode: CMaxMode };
export const default_mode: CMode = {
  mode: "approx",
  max_ref: "Uniform",
  max_mode: "global",
};
export const REF_ILLUM: { [key in CRefIllum]: TSpectrum } = {
  Uniform: wavelengths.map(() => MAX_LUM) as TSpectrum,
  D65: blackBody(6504),
};
const _toRGBs: Map<
  CMapMode,
  {
    _toRGB: (v: TSpectrum) => RGBColor;
    ref_illum: Map<CRefIllum, RGBColor>;
  }
> = new Map();
async function getToRGB({ mode, max_ref, max_mode }: CMode) {
  if (!_toRGBs.has(mode)) {
    let _toRGB: (v: TSpectrum) => RGBColor;
    switch (mode) {
      case "camera": {
        const { readSpectrum } = await import("./data.js");
        const _camera_response = (
          await import("./data/camera_response.json", {
            with: { type: "json" },
          })
        ).default;
        const camera_response: [r: TSpectrum, g: TSpectrum, b: TSpectrum] = [
          await readSpectrum(_camera_response, "R"),
          await readSpectrum(_camera_response, "G"),
          await readSpectrum(_camera_response, "B"),
        ];
        _toRGB = (v: TSpectrum): RGBColor => {
          return matrix_mult_vector(camera_response, v) as RGBColor;
        };
        break;
      }
      case "approx": {
        // https://www.graphics.cornell.edu/online/formats/mdl/chunks/color.html
        const approx_response: [r: TSpectrum, g: TSpectrum, b: TSpectrum] = [
          wavelengths.map((v) =>
            600 <= v && v <= 700 ? 0.01 : 0,
          ) as TSpectrum,
          wavelengths.map((v) =>
            500 <= v && v <= 600 ? 0.01 : 0,
          ) as TSpectrum,
          wavelengths.map((v) =>
            400 <= v && v <= 500 ? 0.01 : 0,
          ) as TSpectrum,
        ];
        _toRGB = (v: TSpectrum): RGBColor => {
          return matrix_mult_vector(approx_response, v) as RGBColor;
        };
        break;
      }
      case "approxXYZ": {
        // https://www.graphics.cornell.edu/online/formats/mdl/chunks/color.html
        const approx_response: [r: TSpectrum, g: TSpectrum, b: TSpectrum] = [
          wavelengths.map((v) =>
            600 <= v && v <= 700 ? 0.01 : 0,
          ) as TSpectrum,
          wavelengths.map((v) =>
            500 <= v && v <= 600 ? 0.01 : 0,
          ) as TSpectrum,
          wavelengths.map((v) =>
            400 <= v && v <= 500 ? 0.01 : 0,
          ) as TSpectrum,
        ];
        const apRGB2XYZ: TMatrix<number, 3, 3> = [
          [27933.7, 32748.0, 12111.3],
          [12696.8, 55268.7, 4974.29],
          [6.147, 3039.01, 69633.7],
        ];
        const xyz2rgb = convert_color("xyz", "rgb")!;
        _toRGB = (v: TSpectrum): RGBColor => {
          return xyz2rgb(
            matrix_mult_vector(
              apRGB2XYZ,
              matrix_mult_vector(approx_response, v),
            ) as XYZColor,
          );
        };
        break;
      }
      default: {
        throw new Error(`Invalid mode ${mode}`);
      }
    }
    _toRGBs.set(mode, { _toRGB, ref_illum: new Map() });
  }
  const { _toRGB, ref_illum } = _toRGBs.get(mode)!;
  if (!ref_illum.has(max_ref)) {
    ref_illum.set(max_ref, _toRGB(REF_ILLUM[max_ref]!));
  }
  let max_response = ref_illum.get(max_ref)!;
  switch (max_mode) {
    case "channel":
      break;
    case "global": {
      const m = Math.max(...max_response);
      max_response = max_response.map(() => m) as RGBColor;
      break;
    }
    default:
      throw new Error(`Invalid max_mode ${max_mode}`);
  }
  return { _toRGB, max_response };
}

export async function toRGB(
  v: TSpectrum,
  mode = default_mode,
): Promise<RGBColor> {
  const { _toRGB, max_response } = await getToRGB(mode);
  const rgb = _toRGB(v);
  return rgb.map((c, i) => c / max_response[i]) as RGBColor;
}
