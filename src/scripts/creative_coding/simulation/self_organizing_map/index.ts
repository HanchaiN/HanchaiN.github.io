import { generate } from "@/scripts/creative_coding/generation/perlin_noise/pipeline.js";
import { kernelGenerator, onImageChange } from "@/scripts/utils/dom.js";
import { TVector2, TVector3, vector_dist } from "@/scripts/utils/math/index.js";
import { constrainLerp, gaus, softargmax } from "@/scripts/utils/math/utils.js";
import { randomGaussian, randomUniform } from "@/scripts/utils/math/random.js";
import type { IKernelFunctionThis } from "@/scripts/utils/types.ts";
import {
  getPaletteAccentColors,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";
import convert_color from "@/scripts/utils/color/conversion.js";
import { getPalette } from "../../image_processing/color_quantization/pipeline.js";
import { applyDithering } from "../../image_processing/dithering/pipeline.js";

const str2srgb = convert_color("str", "srgb")!,
  srgb2oklab = convert_color("srgb", "oklab")!,
  srgb2okhcl = convert_color("srgb", "okhcl")!,
  okhcl2srgb = convert_color("okhcl", "srgb")!,
  oklab2srgb = convert_color("oklab", "srgb")!;
export default function execute() {
  let isActive = false;
  const scale = 1;
  let ctx: CanvasRenderingContext2D;
  let handlerId: number | null = null;
  let buffer: ImageData;
  let generator: Generator<TVector3, never, void>;
  let renderer: ReturnType<
    typeof kernelGenerator<
      IConstants,
      [best_matching: TVector2, element: TVector3, iter: number]
    >
  >;
  let i = 0;

  interface IConstants {
    range: number;
    learning_rate: number;
    range_decay_rate: number;
    learning_decay_rate: number;
    color_choices: number;
    weight_positions: number;
    weight_colors: number;
  }
  const constants: IConstants = {
    range: 0.125,
    learning_rate: 0.125,
    range_decay_rate: 1e-3,
    learning_decay_rate: 1e-6,
    color_choices: 3,
    weight_positions: +10,
    weight_colors: -1,
  };

  function* elementGenerator(
    image: CanvasImageSource,
  ): Generator<TVector3, never, void> {
    const offscreen = new OffscreenCanvas(100, 100);
    const offscreenCtx = offscreen.getContext("2d", { alpha: false })!;
    offscreenCtx.drawImage(image, 0, 0, offscreen.width, offscreen.height);
    const buffer = offscreenCtx.getImageData(
      0,
      0,
      offscreen.width,
      offscreen.height,
    );
    const auto_palette = getPalette(buffer, 16).map((c) => str2srgb(c));
    const auto_palette_weight = auto_palette.map(() => 1 / auto_palette.length);
    {
      applyDithering(buffer, auto_palette);
      const ind = new Array(buffer.width * buffer.height)
        .fill(0)
        .map((_, i) => {
          return srgb2oklab([
            buffer.data[i * 4 + 0] / 255,
            buffer.data[i * 4 + 1] / 255,
            buffer.data[i * 4 + 2] / 255,
          ]);
        })
        .map((v) => {
          let min_dist = Infinity,
            min_ind = -1;
          for (let j = 0; j < auto_palette.length; j++) {
            const dist = vector_dist(v, srgb2oklab(auto_palette[j]));
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
      let c: TVector3;

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

  function main(
    this: IKernelFunctionThis<IConstants>,
    best_matching: TVector2,
    element: TVector3,
    iter: number,
  ) {
    const ratio =
      this.constants.learning_rate *
      Math.exp(-this.constants.learning_decay_rate * iter) *
      gaus(
        vector_dist([this.thread.x, this.thread.y], best_matching) /
          (this.output.x *
            this.constants.range *
            Math.exp(-this.constants.range_decay_rate * iter)),
      );
    const current = srgb2oklab(this.getColor().slice(0, 3) as TVector3);
    const target = srgb2oklab(element);
    const l_ = constrainLerp(ratio, current[0], target[0]),
      a_ = constrainLerp(ratio, current[1], target[1]),
      b_ = constrainLerp(ratio, current[2], target[2]);
    const [r, g, b] = oklab2srgb([l_, a_, b_]);
    this.color(r, g, b, 1);
  }

  function setup(config: HTMLFormElement, image: CanvasImageSource) {
    if (handlerId != null) cancelAnimationFrame(handlerId);
    generator = elementGenerator(image);
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
    renderer = kernelGenerator(main, constants, buffer!);
    i = 0;
    handlerId = requestAnimationFrame(function draw() {
      if (!isActive) return;
      createImageBitmap(buffer).then((bmp) =>
        ctx.drawImage(bmp, 0, 0, ctx.canvas.width, ctx.canvas.height),
      );
      new Promise<void>((resolve) => resolve(render())).then(() => {
        config.querySelector<HTMLInputElement>("input#iteration-count")!.value =
          (
            1 +
            +config.querySelector<HTMLInputElement>("input#iteration-count")!
              .value
          ).toString();
        requestAnimationFrame(draw);
      });
    });
  }
  function render() {
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
            const dist = vector_dist(
              srgb2oklab(values[k]),
              srgb2oklab([
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
    const step = renderer([x, y], values[c], i++);
    while (!step.next().done) continue;
  }

  return {
    start: (canvas: HTMLCanvasElement, config: HTMLFormElement) => {
      isActive = true;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      ctx.fillStyle = getPaletteBaseColor(0.5);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      buffer = ctx.createImageData(canvas.width / scale, canvas.height / scale);
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
          buffer.data.set(
            ctx.getImageData(0, 0, buffer.width, buffer.height).data,
          );
          setup(config, canvas);
        },
      );
    },
    stop: () => {
      isActive = false;
    },
  };
}
