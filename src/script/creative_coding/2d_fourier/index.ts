import { getColor, onImageChange } from "@/script/utils/dom";
import { constrainMap, symlog } from "@/script/utils/math";
import * as color from "@thi.ng/color";
import { Base64Encode } from "base64-stream";
import GIFEncoder from "gifencoder";
import type { Complex, MathJsChain } from "mathjs";
import { abs, fft, im, re, reshape } from "mathjs";
import { update } from "./update";

export default function execute() {
  let parent: HTMLElement;
  let display_canvas: HTMLCanvasElement;
  let display_ctx: CanvasRenderingContext2D;
  let kspace_canvas: HTMLCanvasElement;
  let kspace_ctx: CanvasRenderingContext2D;
  let fft_size_slider: HTMLInputElement;
  let fft_size_value: HTMLSlotElement;
  let render_size_slider: HTMLInputElement;
  let render_size_value: HTMLSlotElement;
  let overlay_slider: HTMLInputElement;
  let overlay_value: HTMLSlotElement;
  const getBackground = () => getColor("--md-sys-color-surface", "#000");
  let isActive = false;
  let src = "";

  function setup() {
    if (!display_canvas) return;
    display_ctx.lineWidth = 0;
    display_ctx.fillStyle = getBackground();
    display_ctx.fillRect(0, 0, display_canvas.width, display_canvas.height);
    fft_size_slider.min = "0";
    fft_size_slider.max = "2048";
    fft_size_slider.value = "64";
    render_size_slider.min = "0";
    render_size_slider.max = "4096";
    render_size_slider.value = "128";
  }

  function redraw(img: HTMLImageElement) {
    if (!isActive) return;
    if (fft_size_slider.valueAsNumber === 0)
      fft_size_value.innerText = fft_size_slider.value = Math.min(
        img.width,
        img.height,
      ).toString();
    if (render_size_slider.valueAsNumber === 0)
      render_size_value.innerText = render_size_slider.value = Math.min(
        img.width,
        img.height,
      ).toString();
    const kspace = (() => {
      const placeholder = parent.querySelector("img#kspace-canvas");
      if (placeholder) {
        placeholder.replaceWith(kspace_canvas);
        placeholder.remove();
      }
      const fft_canvas = new OffscreenCanvas(
        fft_size_slider.valueAsNumber,
        fft_size_slider.valueAsNumber,
      );
      const fft_ctx = fft_canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      })!;
      fft_ctx.fillStyle = "#000";
      fft_ctx.fillRect(0, 0, fft_canvas.width, fft_canvas.height);
      fft_ctx.drawImage(img, 0, 0, fft_canvas.width, fft_canvas.height);
      const imageData = fft_ctx.getImageData(
        0,
        0,
        fft_canvas.width,
        fft_canvas.height,
      );
      const luminance = new Array(imageData.width * imageData.height)
        .fill(0)
        .map((_, i) => {
          const index = i * 4;
          return color.oklch(
            color.srgb(
              imageData.data[index] / 255,
              imageData.data[index + 1] / 255,
              imageData.data[index + 2] / 255,
            ),
          ).l;
        });
      const kspace = fft(
        reshape(luminance, [
          imageData.width,
          imageData.height,
        ]) as unknown as number[][],
      ) as unknown[][] as Complex[][];

      let minColor = color.rgb(getColor("--md-sys-color-surface", "#000")).xyz;
      let maxColor = color.rgb(
        getColor("--md-sys-color-on-surface", "#FFF"),
      ).xyz;
      if (color.oklch(minColor).l > color.oklch(maxColor).l) {
        [minColor, maxColor] = [maxColor, minColor];
      }
      const minValue = symlog(
        kspace
          .flat()
          .map(
            (v) =>
              re(
                abs(v) as unknown as MathJsChain<Complex>,
              ) as unknown as number,
          )
          .reduce((a, b) => Math.min(a, b)),
      );
      const maxValue = symlog(
        kspace
          .flat()
          .map(
            (v) =>
              re(
                abs(v) as unknown as MathJsChain<Complex>,
              ) as unknown as number,
          )
          .reduce((a, b) => Math.max(a, b)),
      );
      for (let i = 0; i < kspace.length; i++) {
        for (let j = 0; j < kspace[0].length; j++) {
          const x =
              i < kspace.length / 2
                ? i + kspace.length / 2
                : i - kspace.length / 2,
            y =
              j < kspace[i].length / 2
                ? j + kspace[i].length / 2
                : j - kspace[i].length / 2;
          const value = symlog(
            re(
              abs(kspace[i][j]) as unknown as MathJsChain<Complex>,
            ) as unknown as number,
          );
          imageData.data[(x * imageData.width + y) * 4 + 0] =
            constrainMap(value, minValue, maxValue, minColor[0], maxColor[0]) *
            255;
          imageData.data[(x * imageData.width + y) * 4 + 1] =
            constrainMap(value, minValue, maxValue, minColor[1], maxColor[1]) *
            255;
          imageData.data[(x * imageData.width + y) * 4 + 2] =
            constrainMap(value, minValue, maxValue, minColor[2], maxColor[2]) *
            255;
          imageData.data[(x * imageData.width + y) * 4 + 3] = 255;
        }
      }
      fft_ctx.putImageData(imageData, 0, 0);
      kspace_ctx.drawImage(
        fft_canvas,
        0,
        0,
        kspace_canvas.width,
        kspace_canvas.height,
      );
      {
        const elem = document.createElement("img");
        elem.className = kspace_canvas.className;
        elem.width = kspace_canvas.width;
        elem.height = kspace_canvas.height;
        fft_canvas.convertToBlob().then((blob) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => {
            elem.src = reader.result as string;
          });
          reader.readAsDataURL(blob);
        });
        elem.id = "kspace-canvas";
        kspace_canvas.replaceWith(elem);
      }
      return kspace;
    })();
    const render_canvas = new OffscreenCanvas(
      render_size_slider.valueAsNumber,
      render_size_slider.valueAsNumber,
    );
    const render_ctx = render_canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
      willReadFrequently: true,
    })!;
    function* draw() {
      let minColor = color.rgb(getColor("--md-sys-color-surface", "#000")).xyz;
      let maxColor = color.rgb(
        getColor("--md-sys-color-on-surface", "#FFF"),
      ).xyz;
      if (color.oklch(minColor).l > color.oklch(maxColor).l) {
        [minColor, maxColor] = [maxColor, minColor];
      }
      const kspace_height = kspace.length,
        kspace_width = kspace[0].length;
      const iter = (function* helicalIndices(n) {
        let num = 0;
        let curr_x = 0,
          dir_x = 1,
          lim_x = 1,
          curr_num_lim_x = 2;
        let curr_y = -1,
          dir_y = 1,
          lim_y = 1,
          curr_num_lim_y = 3;
        let curr_rep_at_lim_x = 0;
        let curr_rep_at_lim_y = 0;
        yield [0, 0];
        while (num < n) {
          if (curr_x != lim_x) {
            curr_x += dir_x;
          } else {
            curr_rep_at_lim_x += 1;
            if (curr_rep_at_lim_x == curr_num_lim_x - 1) {
              if (lim_x < 0) {
                lim_x = -lim_x + 1;
              } else {
                lim_x = -lim_x;
              }
              curr_rep_at_lim_x = 0;
              curr_num_lim_x += 1;
              dir_x = -dir_x;
            }
          }
          if (curr_y != lim_y) {
            curr_y += dir_y;
          } else {
            curr_rep_at_lim_y += 1;
            if (curr_rep_at_lim_y == curr_num_lim_y - 1) {
              if (lim_y < 0) {
                lim_y = -lim_y + 1;
              } else {
                lim_y = -lim_y;
              }
              curr_rep_at_lim_y = 0;
              curr_num_lim_y += 1;
              dir_y = -dir_y;
            }
          }
          yield [curr_x, curr_y];
          num += 1;
        }
      })(kspace.length * kspace[0].length);
      const data_canvas = new OffscreenCanvas(
        render_size_slider.valueAsNumber,
        render_size_slider.valueAsNumber,
      );
      const data_gl = data_canvas.getContext("webgl")!;
      data_gl.getExtension("OES_texture_float");
      data_gl.viewport(
        0,
        0,
        data_gl.drawingBufferWidth,
        data_gl.drawingBufferHeight,
      );
      const updater = update(data_gl, kspace_width, kspace_height);
      for (const index of iter) {
        const x_ = index[0] + kspace_width / 2,
          y_ = index[1] + kspace_height / 2;
        const x =
            x_ < kspace_width / 2
              ? x_ + kspace_width / 2
              : x_ - kspace_width / 2,
          y =
            y_ < kspace_height / 2
              ? y_ + kspace_height / 2
              : y_ - kspace_height / 2;
        const value = kspace[y][x];
        const wx = constrainMap(x_, 0, kspace_width, -0.5, 0.5);
        const wy = constrainMap(y_, 0, kspace_height, -0.5, 0.5);
        updater(
          wx,
          wy,
          re(value as unknown as MathJsChain<Complex>) as unknown as number,
          im(value as unknown as MathJsChain<Complex>) as unknown as number,
          overlay_slider.valueAsNumber,
        );
        render_ctx.drawImage(
          data_canvas,
          0,
          0,
          render_ctx.canvas.width,
          render_ctx.canvas.height,
        );
        yield [wx * kspace_width, wy * kspace_height];
      }
      updater(0, 0, 0, 0, 0);
      render_ctx.drawImage(
        data_canvas,
        0,
        0,
        render_ctx.canvas.width,
        render_ctx.canvas.height,
      );
      return null;
    }
    const encoder = new GIFEncoder(render_canvas.width, render_canvas.height);
    {
      const stream = encoder.createReadStream().pipe(
        new Base64Encode({
          prefix: "data:image/gif;base64,",
        }),
      );
      const src = [""];
      stream
        .on("data", (chunk: string) => {
          try {
            src[src.length - 1] += chunk;
          } catch (e) {
            console.warn(e);
            src.push(chunk);
          }
        })
        .on("end", () => {
          console.log(src);
          const elem = document.createElement("img");
          elem.className = display_canvas.className;
          elem.width = display_canvas.width;
          elem.height = display_canvas.height;
          if (src.length === 1) elem.src = src[0];
          else
            render_canvas.convertToBlob({ type: "image/gif" }).then((blob) => {
              const reader = new FileReader();
              reader.addEventListener("load", () => {
                elem.src = reader.result as string;
              });
              reader.readAsDataURL(blob);
            });
          elem.id = "display-canvas";
          display_canvas.replaceWith(elem);
        });
    }
    encoder.start();
    encoder.setRepeat(-1);
    let total_time = 0;
    let delay = 0;
    const frames = draw();
    requestAnimationFrame(function draw() {
      if (!isActive || img.src != src) return;
      const res = frames.next();
      display_ctx.drawImage(
        render_canvas,
        0,
        0,
        display_ctx.canvas.width,
        display_ctx.canvas.height,
      );
      const k = res.value;
      if (k === null) {
        delay += 1000;
      } else {
        const [wx, wy] = k;
        const sx = 16 / 2,
          sy = 16 / 2;
        delay += constrainMap(
          Math.exp(-((wx * wx) / (2 * sx) + (wy * wy) / (2 * sy))),
          0,
          2 * Math.PI * sx * sy,
          0,
          30_000,
        );
      }
      if (delay > 20) {
        encoder.setDelay(delay);
        total_time += delay;
        encoder.addFrame(render_ctx as unknown as CanvasRenderingContext2D);
        delay = 0;
      }
      if (!res.done) return requestAnimationFrame(draw);
      encoder.finish();
      console.log(total_time);
    });
  }

  return {
    start: (
      sketch: HTMLCanvasElement,
      kspaceCanvas: HTMLCanvasElement,
      config: HTMLFormElement,
    ) => {
      parent = sketch.parentElement!;
      display_canvas = sketch;
      display_ctx = display_canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      })!;
      kspace_canvas = kspaceCanvas!;
      kspace_ctx = kspace_canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      })!;
      onImageChange(
        config.querySelector<HTMLInputElement>("#image")!,
        (img) => {
          src = img.src;
          redraw(img);
        },
      );
      fft_size_slider = config.querySelector("#fft-size")!;
      fft_size_value = config.querySelector("#fft-size-value")!;
      render_size_slider = config.querySelector("#render-size")!;
      render_size_value = config.querySelector("#render-size-value")!;
      overlay_slider = config.querySelector("#overlay")!;
      overlay_value = config.querySelector("#overlay-value")!;
      fft_size_slider.addEventListener("input", () => {
        fft_size_value.innerText = fft_size_slider.value;
      });
      render_size_slider.addEventListener("input", () => {
        render_size_value.innerText = render_size_slider.value;
      });
      overlay_slider.addEventListener("input", () => {
        overlay_value.innerText = Number.parseFloat(
          overlay_slider.value,
        ).toFixed(3);
      });
      setup();
      isActive = true;
    },
    stop: () => {
      isActive = false;
    },
  };
}
