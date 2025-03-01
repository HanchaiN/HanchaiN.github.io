import convert_color from "@/scripts/utils/color/conversion.js";
import { constrainLerp } from "../math/utils.js";

const str2okhcl = convert_color("str", "okhcl")!,
  str2hex = convert_color("str", "hex")!;

// https://stephango.com/flexoki
const __palette = {
  bw: {
    "0": "#FFFCF0",
    "50": "#F2F0E5",
    "100": "#E6E4D9",
    "150": "#DAD8CE",
    "200": "#CECDC3",
    "300": "#B7B5AC",
    "400": "#9F9D96",
    "500": "#878580",
    "600": "#6F6E69",
    "700": "#575653",
    "800": "#403E3C",
    "850": "#343331",
    "900": "#282726",
    "950": "#1C1B1A",
    "1000": "#100F0F",
  },
  re: {
    "50": "#FFE1D5",
    "100": "#FFCABB",
    "150": "#FDB2A2",
    "200": "#F89A8A",
    "300": "#E8705F",
    "400": "#D14D41",
    "500": "#C03E35",
    "600": "#AF3029",
    "700": "#942822",
    "800": "#6C201C",
    "850": "#551B18",
    "900": "#3E1715",
    "950": "#261312",
  },
  or: {
    "50": "#FFE7CE",
    "100": "#FED3AF",
    "150": "#FCC192",
    "200": "#F9AE77",
    "300": "#EC8B49",
    "400": "#DA702C",
    "500": "#CB6120",
    "600": "#BC5215",
    "700": "#9D4310",
    "800": "#71320D",
    "850": "#59290D",
    "900": "#40200D",
    "950": "#27180E",
  },
  ye: {
    "50": "#FAEEC6",
    "100": "#F6E2A0",
    "150": "#F1D67E",
    "200": "#ECCB60",
    "300": "#DFB431",
    "400": "#D0A215",
    "500": "#BE9207",
    "600": "#AD8301",
    "700": "#8E6B01",
    "800": "#664D01",
    "850": "#503D02",
    "900": "#3A2D04",
    "950": "#241E08",
  },
  gr: {
    "50": "#EDEECF",
    "100": "#DDE2B2",
    "150": "#CDD597",
    "200": "#BEC97E",
    "300": "#A0AF54",
    "400": "#879A39",
    "500": "#768D21",
    "600": "#66800B",
    "700": "#536907",
    "800": "#3D4C07",
    "850": "#313D07",
    "900": "#252D09",
    "950": "#1A1E0C",
  },
  cy: {
    "50": "#DDF1E4",
    "100": "#BFE8D9",
    "150": "#A2DECE",
    "200": "#87D3C3",
    "300": "#5ABDAC",
    "400": "#3AA99F",
    "500": "#2F968D",
    "600": "#24837B",
    "700": "#1C6C66",
    "800": "#164F4A",
    "850": "#143F3C",
    "900": "#122F2C",
    "950": "#101F1D",
  },
  bl: {
    "50": "#E1ECEB",
    "100": "#C6DDE8",
    "150": "#ABCFE2",
    "200": "#92BFDB",
    "300": "#66A0C8",
    "400": "#4385BE",
    "500": "#3171B2",
    "600": "#205EA6",
    "700": "#1A4F8C",
    "800": "#163B66",
    "850": "#133051",
    "900": "#12253B",
    "950": "#101A24",
  },
  pu: {
    "50": "#F0EAEC",
    "100": "#E2D9E9",
    "150": "#D3CAE6",
    "200": "#C4B9E0",
    "300": "#A699D0",
    "400": "#8B7EC8",
    "500": "#735EB5",
    "600": "#5E409D",
    "700": "#4F3685",
    "800": "#3C2A62",
    "850": "#31234E",
    "900": "#261C39",
    "950": "#1A1623",
  },
  ma: {
    "50": "#FEE4E5",
    "100": "#FCCFDA",
    "150": "#F9B9CF",
    "200": "#F4A4C2",
    "300": "#E47DA8",
    "400": "#CE5D97",
    "500": "#B74583",
    "600": "#A02F6F",
    "700": "#87285E",
    "800": "#641F46",
    "850": "#4F1B39",
    "900": "#39172B",
    "950": "#24131D",
  },
};

const _palettes = {
  light: {
    accent: [
      __palette.re["600"],
      __palette.or["600"],
      __palette.ye["600"],
      __palette.gr["600"],
      __palette.cy["600"],
      __palette.bl["600"],
      __palette.pu["600"],
      __palette.ma["600"],
    ],
    base: [
      __palette.bw["0"],
      __palette.bw["50"],
      __palette.bw["100"],
      __palette.bw["150"],
      __palette.bw["200"],
      __palette.bw["300"],
      __palette.bw["600"],
      __palette.bw["1000"],
    ],
  },
  dark: {
    accent: [
      __palette.re["400"],
      __palette.or["400"],
      __palette.ye["400"],
      __palette.gr["400"],
      __palette.cy["400"],
      __palette.bl["400"],
      __palette.pu["400"],
      __palette.ma["400"],
    ],
    base: [
      __palette.bw["1000"],
      __palette.bw["950"],
      __palette.bw["900"],
      __palette.bw["850"],
      __palette.bw["800"],
      __palette.bw["700"],
      __palette.bw["500"],
      __palette.bw["200"],
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
  return str2hex(palettes.accent[index % palettes.accent.length]);
}

export function getPaletteAccentColors(isDark: boolean | null = null) {
  const palettes = getPalette(isDark);
  return palettes.accent.map((c) => str2hex(c));
}

export function getPaletteBaseColor(
  index: number,
  isDark: boolean | null = null,
) {
  const palettes = getPalette(isDark);
  return str2hex(
    palettes.base[
      Math.floor(constrainLerp(index, 0, palettes.accent.length - 0.99))
    ],
  );
}

export function getPaletteBaseColors(isDark: boolean | null = null) {
  const palettes = getPalette(isDark);
  return palettes.base.map((c) => str2hex(c));
}

export function getChroma(isDark: boolean | null = null) {
  const c = getPaletteAccentColor(0, isDark);
  return str2okhcl(c)[1];
}

export function getLightness(isDark: boolean | null = null) {
  const c = getPaletteAccentColor(0, isDark);
  return str2okhcl(c)[2];
}
