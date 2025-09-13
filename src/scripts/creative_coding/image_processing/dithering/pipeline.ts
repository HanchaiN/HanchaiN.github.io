import convert_color from "@/scripts/utils/color/conversion.js";
import type {
  ColorSpace,
  ColorSpaceExt,
  ColorSpaceMap,
  ColorSpaceMapExt,
  RGBColor,
  SRGBColor,
  XYZColor,
} from "@/scripts/utils/color/conversion.ts";
import { DistanceE94 } from "@/scripts/utils/color/distance.js";
import { kernelRunner } from "@/scripts/utils/dom/kernelGenerator.js";
import type { IKernelFunctionThis } from "@/scripts/utils/dom/kernelGenerator.ts";
import { matrix_inverse, matrix_mult } from "@/scripts/utils/math/matrix.js";
import { sample } from "@/scripts/utils/math/random.js";
import {
  constrain,
  normalize,
  softargmax,
} from "@/scripts/utils/math/utils.js";
import {
  vector_add,
  vector_dot,
  vector_mag,
  vector_normalize,
  vector_proj,
  vector_scale,
  vector_sub,
} from "@/scripts/utils/math/vector.js";

function validate_map(map: number[][]) {
  if (map.length === 0) throw new Error("map must be non-empty");
  if (map.length !== map[0].length) throw new Error("map must be square");
  const n = map.length;
  const flat = map.flat();
  for (let i = 0; i < n * n; i++) {
    if (flat.indexOf(i) === -1) throw new Error("map must be permutation");
  }
  return n;
}

function normalize_map(map: number[][]) {
  const n = validate_map(map);
  return map.map((row) =>
    row.map((v) => v / (n * n) - (0.5 * (n * n - 1)) / (n * n)),
  );
}

function _threshold_map(
  n: number,
  x: number,
  y: number,
  base: number[][],
): number {
  if (n === 1) return 0;
  if (n % base.length !== 0) {
    throw new Error(
      `n must be power of base.length, but got ${n} % ${base.length}`,
    );
  }
  const partition_size = n / base.length;
  return (
    Math.pow(base.length, 2) *
      _threshold_map(
        partition_size,
        x % partition_size,
        y % partition_size,
        base,
      ) +
    base[Math.floor(x / partition_size)][Math.floor(y / partition_size)]
  );
}

function threshold_map(n: number, base: number[][]): number[][] {
  validate_map(base);
  return new Array(n)
    .fill(0)
    .map((_, i) =>
      new Array(n).fill(0).map((_, j) => _threshold_map(n, i, j, base)),
    );
}

function _applyDithering_Ordered<Embed extends number[]>(
  this: IKernelFunctionThis<{
    cmap: number[][];
    color_palette: SRGBColor[];
    embed_palette: Embed[];
    temperature: number;
    n_candidates: number;
    srgb2embed: (c: SRGBColor) => Embed;
    distance: (a: Embed, b: Embed) => number;
    project: (candidates: number[]) => {
      is: number[];
      es: Embed[];
      k_inv: number[][];
    };
  }>,
) {
  const n = this.constants.cmap.length;
  const { x, y } = this.thread;
  const seed = this.constants.cmap[x % n][y % n] + 0.5;
  const [r, g, b, a] = this.getColor();
  const target_embed = this.constants.srgb2embed([r, g, b]);
  let _target_embed = vector_scale(target_embed, 1);
  const candidates: number[] = [];
  const n_candidates = Math.max(
    1,
    Math.min(
      this.constants.embed_palette.length,
      this.constants.n_candidates,
      _target_embed.length + 1,
    ),
  );
  for (let i = 0; i < n_candidates; i++) {
    const weight = softargmax(
      this.constants.embed_palette.map((embed, j) =>
        candidates.includes(j)
          ? -Infinity
          : -this.constants.distance(embed, _target_embed),
      ),
      this.constants.temperature,
    );
    const idx = sample(
      this.constants.embed_palette.map((_, i) => i),
      weight,
    );
    const candidate_color = this.constants.embed_palette[idx];
    _target_embed = vector_add(
      _target_embed,
      vector_scale(
        vector_sub(_target_embed, candidate_color),
        1 / (n_candidates - i - 1),
      ),
    );
    candidates.push(idx);
  }
  const fallback = candidates[0];
  if (candidates.length > 1) {
    candidates.reverse();
    const { is, es, k_inv } = this.constants.project(candidates);
    const v0 = vector_sub(
      target_embed,
      this.constants.embed_palette[candidates[0]],
    );
    const k0 = es.map((e) => vector_dot(v0, e));
    let w = matrix_mult([k0], k_inv)[0];
    w.push(1 - w.reduce((acc, v) => acc + v, 0));
    w = w.map((v) => constrain(v, 0, 1));
    w = normalize(w);
    let acc = 0;
    for (let i = 0; i < w.length; i++) {
      acc += constrain(w[i], 0, 1);
      if (seed < acc) {
        const color = this.constants.color_palette[candidates[is[i]]];
        this.color(color[0], color[1], color[2], a);
        return;
      }
    }
  }
  const color = this.constants.color_palette[fallback];
  this.color(color[0], color[1], color[2], a);
}

export function applyDithering_Ordered(
  buffer: ImageData,
  color_palette: SRGBColor[],
  {
    temperature = 0,
    mask_size = 16,
    n_candidates = 0,
    order_mode = "cie",
  }: {
    temperature?: number;
    mask_size?: number;
    n_candidates?: number;
    order_mode?: "cie" | "rgb" | "lum";
  } = {},
) {
  const embed: ColorSpaceExt = { cie: "xyz", rgb: "rgb", lum: "lum" }[
    order_mode
  ] as "xyz" | "rgb" | "lum";
  type EmbedColor = ColorSpaceMapExt[typeof embed];
  const srgb2embed = convert_color("srgb", embed)!;
  let distance: (a: EmbedColor, b: EmbedColor) => number;
  switch (order_mode) {
    case "cie": {
      const xyz2lab = convert_color("xyz", "lab")!;
      distance = (a: EmbedColor, b: EmbedColor) =>
        DistanceE94(xyz2lab(a as XYZColor), xyz2lab(b as XYZColor));
      break;
    }
    case "rgb":
      distance = (a: EmbedColor, b: EmbedColor) =>
        vector_mag(vector_sub(a as RGBColor, b as RGBColor));
      break;
    case "lum":
      distance = (a: EmbedColor, b: EmbedColor) =>
        Math.abs((a as [l: number])[0] - (b as [l: number])[0]);
      break;
    default:
      throw new Error(`Unknown order_mode: ${order_mode}`);
  }

  const cmap = normalize_map(
    threshold_map(mask_size, [
      [0, 2],
      [3, 1],
    ]),
  );
  const embed_palette = color_palette.map(srgb2embed);

  const project_cache: Map<
    string,
    { is: number[]; es: EmbedColor[]; k_inv: number[][] }
  > = new Map();
  function project(candidates: number[]) {
    const key = candidates.join(",");
    if (project_cache.has(key)) return project_cache.get(key)!;
    const is: number[] = [];
    const vs: EmbedColor[] = [];
    const es: EmbedColor[] = [];
    for (let i = 1; i < candidates.length; i++) {
      const v = vector_sub(
        embed_palette[candidates[i]],
        embed_palette[candidates[0]],
      );
      let u = vector_scale(v, 1);
      for (let j = 0; j < es.length; j++) {
        const proj = vector_proj(u, es[j]);
        u = vector_sub(u, proj);
      }
      if (vector_dot(u, u) > 1e-5) {
        vs.push(v);
        is.push(i);
        const e = vector_normalize(u);
        es.push(e);
      }
    }
    is.push(0);
    const ks: number[][] = [];
    for (let i = 0; i < vs.length; i++) {
      const k = es.map((e) => vector_dot(vs[i], e));
      ks.push(k);
    }
    const k_inv = matrix_inverse(ks);
    if (k_inv === null) throw new Error("Matrix is singular");
    project_cache.set(key, { is, es, k_inv });
    return project_cache.get(key)!;
  }

  const runner = kernelRunner(
    _applyDithering_Ordered,
    {
      cmap,
      color_palette,
      embed_palette,
      temperature,
      n_candidates: n_candidates <= 0 ? Infinity : n_candidates,
      srgb2embed,
      distance: distance,
      project,
    },
    buffer,
  );
  return runner();
}

export function applyDithering_ErrorDiffusion(
  buffer: ImageData,
  color_palette: SRGBColor[],
  {
    temperature = 0,
    err_decay = 1.0,
  }: {
    temperature?: number;
    err_decay?: number;
  } = {},
) {
  const embed: ColorSpace = "lab";
  type EmbedColor = ColorSpaceMap[typeof embed];
  const srgb2embed = convert_color("srgb", embed)!,
    embed2lab = convert_color(embed, "lab")!;
  const color_distance = (a: EmbedColor, b: EmbedColor) =>
    DistanceE94(embed2lab(a), embed2lab(b));

  const color_palette_ = color_palette.map(srgb2embed);
  const err_diffusion: [[number, number], number][] = [
    // [[+1, 0], 1 / 8],
    // [[+2, 0], 1 / 8],
    // [[-1, 1], 1 / 8],
    // [[+0, 1], 1 / 8],
    // [[+1, 1], 1 / 8],
    // [[+0, 2], 1 / 8],
    // [[+1, 0], 7 / 16],
    // [[-1, 1], 3 / 16],
    // [[+0, 1], 5 / 16],
    // [[+1, 1], 1 / 16],
    [[+1, 0], 7 / 48],
    [[+2, 0], 5 / 48],
    [[-2, 1], 3 / 48],
    [[-1, 1], 5 / 48],
    [[+0, 1], 7 / 48],
    [[+1, 1], 5 / 48],
    [[+2, 1], 3 / 48],
    [[-2, 2], 1 / 48],
    [[-1, 2], 3 / 48],
    [[+0, 2], 5 / 48],
    [[+1, 2], 3 / 48],
    [[+2, 2], 1 / 48],
  ];

  const buffer_ = new Array(buffer.width * buffer.height)
    .fill(0)
    .map((_, i) =>
      srgb2embed([
        buffer.data[i * 4 + 0] / 255,
        buffer.data[i * 4 + 1] / 255,
        buffer.data[i * 4 + 2] / 255,
      ]),
    );
  for (let j = 0; j < buffer.height; j++) {
    for (let i = 0; i < buffer.width; i++) {
      const index = j * buffer.width + i;
      const target_color = buffer_[index];
      const color_index = sample(
        color_palette.map((_, i) => i),
        softargmax(
          color_palette_.map((color) => -color_distance(color, target_color)),
          temperature,
        ),
      );
      const err = vector_scale(
        vector_sub(target_color, color_palette_[color_index]),
        buffer.data[index * 4 + 3] / 255,
      );
      err_diffusion.forEach(([ind, w]) => {
        const i_ = i + ind[0];
        const j_ = j + ind[1];
        if (0 > i_ || i_ >= buffer.width || 0 > j_ || j_ >= buffer.height)
          return;
        const index = j_ * buffer.width + i_;
        const diff = vector_scale(err, w * err_decay);
        for (let k = 0; k < 3; k++) buffer_[index][k] += diff[k];
      });
      buffer.data[index * 4 + 0] = color_palette[color_index][0] * 255;
      buffer.data[index * 4 + 1] = color_palette[color_index][1] * 255;
      buffer.data[index * 4 + 2] = color_palette[color_index][2] * 255;
    }
  }
}
