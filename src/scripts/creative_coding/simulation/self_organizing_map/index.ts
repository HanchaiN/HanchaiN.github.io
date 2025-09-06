import { generate } from "@/scripts/creative_coding/generation/perlin_noise/pipeline.js";
import type {
  ColorSpace,
  ColorSpaceMap,
  SRGBColor,
} from "@/scripts/utils/color/conversion.js";
import convert_color from "@/scripts/utils/color/conversion.js";
import { DistanceE94 } from "@/scripts/utils/color/distance.js";
import {
  getPaletteAccentColors,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";
import { onImageChange } from "@/scripts/utils/dom/image.js";
import { kernelGenerator } from "@/scripts/utils/dom/kernelGenerator.js";
import type { IKernelFunctionThis } from "@/scripts/utils/dom/kernelGenerator.ts";
import { randomGaussian, randomUniform } from "@/scripts/utils/math/random.js";
import { constrainLerp, gaus, softargmax } from "@/scripts/utils/math/utils.js";
import { vector_dist } from "@/scripts/utils/math/vector.js";
import type { TVector2 } from "@/scripts/utils/math/vector.ts";
import { iterate_all } from "@/scripts/utils/utils.js";

import { applyDithering_Ordered } from "../../image_processing/dithering/pipeline.js";
import { extractPalette } from "../../image_processing/palette_extraction/pipeline.js";

const embed: ColorSpace = "xyz";
type EmbedColor = ColorSpaceMap[typeof embed];

const str2srgb = convert_color("str", "srgb")!,
  srgb2embed = convert_color("srgb", embed)!,
  srgb2okhcl = convert_color("srgb", "okhcl")!,
  okhcl2srgb = convert_color("okhcl", "srgb")!,
  embed2lab = convert_color(embed, "lab")!,
  embed2srgb = convert_color(embed, "srgb")!;
const embed_distance = (c1: EmbedColor, c2: EmbedColor) =>
  DistanceE94(embed2lab(c1), embed2lab(c2));

export default function execute() {
  let isActive = false;
  const scale = 1;
  let ctx: CanvasRenderingContext2D;
  let handlerId: ReturnType<typeof setTimeout> | null = null;
  let buffer: ImageData;
  let generator: Generator<SRGBColor, never, void>;
  let renderer: ReturnType<
    typeof kernelGenerator<
      Record<string, never>,
      [
        best_matching: TVector2,
        element: SRGBColor,
        learning_rate: number,
        range: number,
      ]
    >
  >;
  let i = 0;

  const constants = {
    range: 0.125,
    learning_rate: 0.125,
    range_decay_rate: 1e-3,
    learning_decay_rate: 1e-6,
    color_choices: 3,
    weight_positions: +10,
    weight_colors: -1,
  };

  function* targetGenerator(
    image: CanvasImageSource,
  ): Generator<SRGBColor, never, void> {
    const offscreen = new OffscreenCanvas(100, 100);
    const offscreenCtx = offscreen.getContext("2d", { alpha: false })!;
    offscreenCtx.drawImage(image, 0, 0, offscreen.width, offscreen.height);
    const buffer = offscreenCtx.getImageData(
      0,
      0,
      offscreen.width,
      offscreen.height,
    );
    const auto_palette = extractPalette(buffer, 16).map((c) => str2srgb(c));
    const auto_palette_weight = auto_palette.map(() => 1 / auto_palette.length);
    {
      applyDithering_Ordered(buffer, auto_palette);
      const ind = new Array(buffer.width * buffer.height)
        .fill(0)
        .map((_, i) => {
          return srgb2embed([
            buffer.data[i * 4 + 0] / 255,
            buffer.data[i * 4 + 1] / 255,
            buffer.data[i * 4 + 2] / 255,
          ]);
        })
        .map((v) => {
          let min_dist = Infinity,
            min_ind = -1;
          for (let j = 0; j < auto_palette.length; j++) {
            const dist = embed_distance(v, srgb2embed(auto_palette[j]));
            if (dist < min_dist) {
              min_dist = dist;
              min_ind = j;
            }
          }
          return min_ind;
        });
      const freq = auto_palette.map(
        (_, i) =>
          ind.filter((j) => j === i).length / (buffer.width * buffer.height),
      );
      softargmax(freq).forEach((v, i) => (auto_palette_weight[i] = v));
    }
    console.log(auto_palette.map((v, i) => [v, auto_palette_weight[i]]));
    const palette = getPaletteAccentColors().map((v) => {
      return str2srgb(v);
    });
    const palette_hcl = new Array(buffer.width * buffer.height)
        .fill(0)
        .map((_, i) => {
          return srgb2okhcl([
            buffer.data[i * 4 + 0] / 255,
            buffer.data[i * 4 + 1] / 255,
            buffer.data[i * 4 + 2] / 255,
          ]);
        }),
      avg_l =
        palette_hcl.reduce((acc, v) => acc + v[2], 0) / palette_hcl.length,
      avg_c =
        palette_hcl.reduce((acc, v) => acc + v[1], 0) / palette_hcl.length,
      cov_ll =
        palette_hcl.reduce(
          (acc, v) => acc + (v[2] - avg_l) * (v[2] - avg_l),
          0,
        ) / palette_hcl.length,
      cov_cc =
        palette_hcl.reduce(
          (acc, v) => acc + (v[1] - avg_c) * (v[1] - avg_c),
          0,
        ) / palette_hcl.length,
      cov_lc =
        palette_hcl.reduce(
          (acc, v) => acc + (v[2] - avg_l) * (v[1] - avg_c),
          0,
        ) / palette_hcl.length,
      fac_xl = Math.sqrt(cov_ll),
      fac_xc = cov_lc / fac_xl,
      fac_yc = Math.sqrt(cov_cc - fac_xc * fac_xc);
    while (true) {
      let c: SRGBColor;

      if (Math.random() < 0.0025)
        c = [
          Math.round(Math.random()),
          Math.round(Math.random()),
          Math.round(Math.random()),
        ];
      else if (Math.random() < 0.95) {
        c = auto_palette[Math.floor(Math.random() * auto_palette.length)];
        const seed = Math.random();
        let s = 0;
        for (let j = 0; j < auto_palette.length; j++) {
          s += auto_palette_weight[j];
          if (s >= seed) {
            c = auto_palette[j];
            break;
          }
        }
      } else if (Math.random() < 0.0125)
        c = palette[Math.floor(Math.random() * palette.length)];
      // eslint-disable-next-line no-dupe-else-if
      else if (Math.random() < 0.0125)
        c = okhcl2srgb([
          randomUniform(0, 1),
          randomUniform(0.05, 0.1),
          randomGaussian(0.8, 0.125),
        ]);
      else if (Math.random() < 0.5) {
        c = okhcl2srgb([
          randomUniform(0, 1),
          randomUniform(
            avg_c - 1.5 * Math.sqrt(cov_cc),
            avg_c + 1.5 * Math.sqrt(cov_cc),
          ),
          randomGaussian(avg_l, Math.sqrt(cov_ll)),
        ]);
      } else {
        const x = randomGaussian(),
          y = randomGaussian();
        c = okhcl2srgb([
          randomUniform(0, 1),
          avg_c + fac_xc * x + fac_yc * y,
          avg_l + fac_xl * x,
        ]);
      }
      if (
        c[0] >= 0 &&
        c[0] <= 1 &&
        c[1] >= 0 &&
        c[1] <= 1 &&
        c[2] >= 0 &&
        c[2] <= 1
      )
        yield c;
    }
  }

  function apply_step(
    this: IKernelFunctionThis<Record<string, never>>,
    best_matching: TVector2,
    element: SRGBColor,
    learning_rate: number,
    range: number,
  ) {
    const ratio =
      learning_rate *
      gaus(
        vector_dist([this.thread.x, this.thread.y], best_matching) /
          (this.output.x * range),
      );
    const current = srgb2embed(this.getColor().slice(0, 3) as SRGBColor);
    const target = srgb2embed(element);
    const [r, g, b] = embed2srgb([
      constrainLerp(ratio, current[0], target[0]),
      constrainLerp(ratio, current[1], target[1]),
      constrainLerp(ratio, current[2], target[2]),
    ]);
    this.color(r, g, b, 1);
  }

  function setup(config: HTMLFormElement, image: CanvasImageSource) {
    if (handlerId != null) clearTimeout(handlerId);
    generator = targetGenerator(image);
    constants.range =
      +config.querySelector<HTMLInputElement>("input#range")!.value;
    constants.learning_rate = +config.querySelector<HTMLInputElement>(
      "input#learning-rate",
    )!.value;
    constants.range_decay_rate = +config.querySelector<HTMLInputElement>(
      "input#range-decay-rate",
    )!.value;
    constants.learning_decay_rate = +config.querySelector<HTMLInputElement>(
      "input#learning-decay-rate",
    )!.value;
    constants.color_choices = +config.querySelector<HTMLInputElement>(
      "input#color-choices",
    )!.value;
    constants.weight_positions = +config.querySelector<HTMLInputElement>(
      "input#weight-positions",
    )!.value;
    constants.weight_colors = +config.querySelector<HTMLInputElement>(
      "input#weight-colors",
    )!.value;
    config.querySelector<HTMLInputElement>("input#iteration-count")!.value =
      "0";
    renderer = kernelGenerator(apply_step, {}, buffer!);
    i = 0;
    handlerId = setTimeout(async function update() {
      if (!isActive) return;
      await createImageBitmap(buffer).then((bmp) =>
        ctx.drawImage(bmp, 0, 0, ctx.canvas.width, ctx.canvas.height),
      );
      step();
      config.querySelector<HTMLInputElement>("input#iteration-count")!.value = (
        1 +
        +config.querySelector<HTMLInputElement>("input#iteration-count")!.value
      ).toString();
      handlerId = setTimeout(update, 0);
    }, 0);
  }
  function step() {
    const values = new Array(constants.color_choices)
      .fill(0)
      .map(() => generator.next().value);
    let x = -1,
      y = -1,
      c = 0;
    {
      let col = [];
      for (let k = 0; k < values.length; k++) {
        let pos = [];
        for (let i = 0; i < buffer.width; i++) {
          for (let j = 0; j < buffer.height; j++) {
            const dist = embed_distance(
              srgb2embed(values[k]),
              srgb2embed([
                buffer.data[
                  4 * buffer.width * (buffer.height - j - 1) + 4 * i + 0
                ] / 255,
                buffer.data[
                  4 * buffer.width * (buffer.height - j - 1) + 4 * i + 1
                ] / 255,
                buffer.data[
                  4 * buffer.width * (buffer.height - j - 1) + 4 * i + 2
                ] / 255,
              ]),
            );
            pos.push({ x: i, y: j, d: dist });
          }
        }
        const w = softargmax(
          pos.map(({ d }) => -d * constants.weight_positions),
        );
        pos = pos.map(({ x, y, d }, i) => ({ x, y, d, w: w[i] }));
        const r = Math.random();
        let s = 0;
        for (let i = 0; i < pos.length; i++) {
          s += pos[i].w;
          if (s >= r) {
            col.push(pos[i]);
            break;
          }
        }
        if (col.length <= k) col.push(pos[w.indexOf(Math.max(...w))]);
      }
      const w = softargmax(col.map(({ d }) => -d * constants.weight_colors));
      c = w.indexOf(Math.max(...w));
      col = col.map(({ x, y, d }, i) => ({ x, y, d, w: w[i] }));
      const r = Math.random();
      let s = 0;
      for (let i = 0; i < col.length; i++) {
        s += col[i].w;
        if (s >= r) {
          c = i;
          break;
        }
      }
      x = col[c].x;
      y = col[c].y;
    }
    const learning_rate =
        constants.learning_rate * Math.exp(-constants.learning_decay_rate * i),
      range = constants.range * Math.exp(-constants.range_decay_rate * i);
    iterate_all(renderer([x, y], values[c], learning_rate, range));
    i++;
  }

  return {
    start: (canvas: HTMLCanvasElement, config: HTMLFormElement) => {
      isActive = true;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      ctx.fillStyle = getPaletteBaseColor(0.5);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      buffer = ctx.createImageData(
        canvas.width / scale,
        canvas.height / scale,
        { colorSpace: "srgb" },
      );
      config.querySelector<HTMLInputElement>("input#range")!.defaultValue =
        constants.range.toString();
      config.querySelector<HTMLInputElement>(
        "input#learning-rate",
      )!.defaultValue = constants.learning_rate.toString();
      config.querySelector<HTMLInputElement>(
        "input#range-decay-rate",
      )!.defaultValue = constants.range_decay_rate.toString();
      config.querySelector<HTMLInputElement>(
        "input#learning-decay-rate",
      )!.defaultValue = constants.learning_decay_rate.toString();
      config.querySelector<HTMLInputElement>(
        "input#color-choices",
      )!.defaultValue = constants.color_choices.toString();
      config.querySelector<HTMLInputElement>(
        "input#weight-positions",
      )!.defaultValue = constants.weight_positions.toString();
      config.querySelector<HTMLInputElement>(
        "input#weight-colors",
      )!.defaultValue = constants.weight_colors.toString();
      config
        .querySelector<HTMLInputElement>("input#range")!
        .addEventListener("input", function () {
          config.querySelector<HTMLInputElement>(
            "slot#range-value",
          )!.innerText = (+this.value).toFixed(3);
        });
      config
        .querySelector<HTMLInputElement>("input#learning-rate")!
        .addEventListener("input", function () {
          config.querySelector<HTMLInputElement>(
            "slot#learning-rate-value",
          )!.innerText = (+this.value).toFixed(3);
        });
      config
        .querySelector<HTMLInputElement>("input#color-choices")!
        .addEventListener("input", function () {
          config.querySelector<HTMLInputElement>(
            "slot#color-choices-value",
          )!.innerText = (+this.value).toFixed(3);
        });
      canvas.addEventListener("click", function () {
        generate(buffer);
        const ofs_canvas = new OffscreenCanvas(buffer.width, buffer.height);
        const ofs_ctx = ofs_canvas.getContext("2d")!;
        ofs_ctx.putImageData(buffer, 0, 0);
        ctx.drawImage(ofs_canvas, 0, 0, canvas.width, canvas.height);
        setup(config, canvas);
      });
      onImageChange(
        config.querySelector<HTMLInputElement>("#image")!,
        (img) => {
          const canvas = new OffscreenCanvas(buffer.width, buffer.height);
          const ctx = canvas.getContext("2d", { alpha: false })!;
          ctx.drawImage(img, 0, 0, buffer.width, buffer.height);
          const _buffer = ctx.getImageData(0, 0, buffer.width, buffer.height, {
            colorSpace: "srgb",
          });
          buffer.data.set(_buffer.data);
          setup(config, canvas);
        },
      );
    },
    stop: () => {
      isActive = false;
    },
  };
}
