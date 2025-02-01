import convert_color, { str2str } from "@/scripts/utils/color/conversion.js";
import { constrainLerp } from "../math/utils.js";

const str2okhcl = convert_color("str", "okhcl")!;

const _palettes = {
  light: {
    accent: [
      "rgb(175, 48, 41)",
      "rgb(188, 82, 21)",
      "rgb(173, 131, 1)",
      "rgb(102, 128, 11)",
      "rgb(36, 131, 123)",
      "rgb(32, 94, 166)",
      "rgb(94, 64, 157)",
      "rgb(160, 47, 111)",
    ],
    base: [
      "rgb(255, 252, 240)",
      "rgb(242, 240, 229)",
      "rgb(230, 228, 217)",
      "rgb(218, 216, 206)",
      "rgb(206, 205, 195)",
      "rgb(183, 181, 172)",
      "rgb(111, 110, 105)",
      "rgb(16, 15, 15)",
    ],
  },
  dark: {
    accent: [
      "rgb(209, 77, 65)",
      "rgb(218, 112, 44)",
      "rgb(208, 162, 21)",
      "rgb(135, 154, 57)",
      "rgb(58, 169, 159)",
      "rgb(67, 133, 190)",
      "rgb(139, 126, 200)",
      "rgb(206, 93, 151)",
    ],
    base: [
      "rgb(16, 15, 15)",
      "rgb(28, 27, 26)",
      "rgb(40, 39, 38)",
      "rgb(52, 51, 49)",
      "rgb(64, 62, 60)",
      "rgb(87, 86, 83)",
      "rgb(135, 133, 128)",
      "rgb(206, 205, 195)",
    ],
  },
};

export function getPalette(isDark: boolean | null = null) {
  if (isDark === null)
    isDark = window?.matchMedia?.("(prefers-color-scheme: dark)")?.matches
      ? true
      : false;
  return isDark ? _palettes.dark : _palettes.light;
}

export function getPaletteAccentColor(
  index: number,
  isDark: boolean | null = null,
) {
  const palettes = getPalette(isDark);
  return str2str(palettes.accent[index % palettes.accent.length]);
}

export function getPaletteAccentColors(isDark: boolean | null = null) {
  const palettes = getPalette(isDark);
  return palettes.accent.map((c) => str2str(c));
}

export function getPaletteBaseColor(
  index: number,
  isDark: boolean | null = null,
) {
  const palettes = getPalette(isDark);
  return str2str(
    palettes.base[
      Math.floor(constrainLerp(index, 0, palettes.accent.length - 0.99))
    ],
  );
}

export function getPaletteBaseColors(isDark: boolean | null = null) {
  const palettes = getPalette(isDark);
  return palettes.base.map((c) => str2str(c));
}

export function getChroma(isDark: boolean | null = null) {
  const c = getPaletteAccentColor(0, isDark);
  return str2okhcl(c)[1];
}

export function getLightness(isDark: boolean | null = null) {
  const c = getPaletteAccentColor(0, isDark);
  return str2okhcl(c)[2];
}
