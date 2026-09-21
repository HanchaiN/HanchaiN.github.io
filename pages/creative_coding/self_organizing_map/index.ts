import convert_color from "@/utils/color/conversion.js";
import type {
  ColorSpace,
  ColorSpaceMap,
  SRGBColor,
} from "@/utils/color/conversion.ts";
import { DistanceE94 } from "@/utils/color/distance.js";
import {
  getPaletteAccentColors,
  getPaletteBaseColor,
} from "@/utils/color/palette.js";
import { onImageChange } from "@/utils/dom/image.js";
import { kernelGenerator } from "@/utils/dom/kernelGenerator.js";
import type { IKernelFunctionThis } from "@/utils/dom/kernelGenerator.ts";
import { randomRange, sample } from "@/utils/math/random.js";
import { argmax, constrainLerp, gaus, softargmax } from "@/utils/math/utils.js";
import { vector_dist } from "@/utils/math/vector.js";
import type { TVector } from "@/utils/math/vector.ts";
import { iterate_all } from "@/utils/utils.js";

import { PaletteInput } from "@/utils/dom/element/PaletteInput.js";

const embed: ColorSpace = "lab";
type EmbedColor = ColorSpaceMap[typeof embed];

const str2srgb = convert_color("str", "srgb")!,
  srgb2embed = convert_color("srgb", embed)!,
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
  let palette: PaletteInput;
  let target_generator: Generator<SRGBColor, never, void>;
  let renderer: ReturnType<
    typeof kernelGenerator<
      Record<string, never>,
      [
        best_matching: TVector<number, 2>,
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
    initBuffer: ImageData | null = null,
  ): Generator<SRGBColor, never, void> {
    while (true) {
      let c: SRGBColor = [Math.random(), Math.random(), Math.random()];

      if (palette.value.length > 0) {
        c = str2srgb(sample(palette.value));
      }
      if (buffer) {
        const i = randomRange(0, buffer.width * buffer.height);
        c = [
          buffer.data[i * 4 + 0]! / 255,
          buffer.data[i * 4 + 1]! / 255,
          buffer.data[i * 4 + 2]! / 255,
        ] as SRGBColor;
      }
      if (initBuffer) {
        const i = randomRange(0, initBuffer.width * initBuffer.height);
        c = [
          initBuffer.data[i * 4 + 0]! / 255,
          initBuffer.data[i * 4 + 1]! / 255,
          initBuffer.data[i * 4 + 2]! / 255,
        ] as SRGBColor;
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
    best_matching: TVector<number, 2>,
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

  function setup(config: HTMLFormElement, initImage: CanvasImageSource) {
    if (handlerId != null) clearTimeout(handlerId);
    {
      const canvas = new OffscreenCanvas(buffer.width, buffer.height);
      const ctx = canvas.getContext("2d", { alpha: false })!;
      ctx.drawImage(initImage, 0, 0, buffer.width, buffer.height);
      const initBuffer = ctx.getImageData(0, 0, buffer.width, buffer.height, {
        colorSpace: "srgb",
      });
      target_generator = targetGenerator(initBuffer);
      buffer.data.set(initBuffer.data);
    }
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
    renderer = kernelGenerator(apply_step, {}, buffer!);
    i = 0;
    {
      const iteration_count_elem = config.querySelector<HTMLOutputElement>(
        "output#iteration-count",
      )!;
      iteration_count_elem.value = "0";
      handlerId = setTimeout(async function redraw() {
        if (!isActive) return;
        await createImageBitmap(buffer).then((bmp) =>
          ctx.drawImage(bmp, 0, 0, ctx.canvas.width, ctx.canvas.height),
        );
        step();
        iteration_count_elem.value = (
          1 + Number(iteration_count_elem.value)
        ).toString();
        handlerId = setTimeout(redraw, 0);
      }, 0);
    }
  }
  function step() {
    const values = new Array(constants.color_choices)
      .fill(0)
      .map(() => target_generator.next().value);
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
              srgb2embed(values[k]!),
              srgb2embed([
                buffer.data[
                  4 * buffer.width * (buffer.height - j - 1) + 4 * i + 0
                ]! / 255,
                buffer.data[
                  4 * buffer.width * (buffer.height - j - 1) + 4 * i + 1
                ]! / 255,
                buffer.data[
                  4 * buffer.width * (buffer.height - j - 1) + 4 * i + 2
                ]! / 255,
              ]),
            );
            pos.push({ x: i, y: j, d: dist });
          }
        }
        const w = softargmax(
          pos.map(({ d }) => -d * constants.weight_positions),
        );
        pos = pos.map(({ x, y, d }, i) => ({ x, y, d, w: w[i]! }));
        const r = Math.random();
        let s = 0;
        for (let i = 0; i < pos.length; i++) {
          s += pos[i]!.w;
          if (s >= r) {
            col.push(pos[i]!);
            break;
          }
        }
        if (col.length <= k) col.push(pos[argmax(w)]!);
      }
      const w = softargmax(col.map(({ d }) => -d * constants.weight_colors));
      c = argmax(w);
      col = col.map(({ x, y, d }, i) => ({ x, y, d, w: w[i]! }));
      const r = Math.random();
      let s = 0;
      for (let i = 0; i < col.length; i++) {
        s += col[i]!.w;
        if (s >= r) {
          c = i;
          break;
        }
      }
      x = col[c]!.x;
      y = col[c]!.y;
    }
    const learning_rate =
        constants.learning_rate * Math.exp(-constants.learning_decay_rate * i),
      range = constants.range * Math.exp(-constants.range_decay_rate * i);
    iterate_all(renderer([x, y], values[c]!, learning_rate, range));
    i++;
  }

  return {
    start: (canvas: HTMLCanvasElement, config: HTMLFormElement) => {
      isActive = true;
      palette = new PaletteInput(
        config.querySelector("#palette")!,
        config.querySelector("#palette-text")!,
      );
      palette.value = getPaletteAccentColors();
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
          config.querySelector<HTMLOutputElement>("output#range-value")!.value =
            (+this.value).toFixed(3);
        });
      config
        .querySelector<HTMLInputElement>("input#learning-rate")!
        .addEventListener("input", function () {
          config.querySelector<HTMLOutputElement>(
            "output#learning-rate-value",
          )!.value = (+this.value).toFixed(3);
        });
      config
        .querySelector<HTMLInputElement>("input#color-choices")!
        .addEventListener("input", function () {
          config.querySelector<HTMLOutputElement>(
            "output#color-choices-value",
          )!.value = (+this.value).toFixed(3);
        });
      onImageChange(
        config.querySelector<HTMLInputElement>("#image")!,
        (img) => {
          setup(config, img);
        },
      );
    },
    stop: () => {
      isActive = false;
    },
  };
}
