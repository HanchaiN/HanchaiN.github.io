import { applyDithering } from "@/scripts/creative_coding/image_processing/dithering/pipeline.js";
import { onImageChange } from "@/scripts/utils/dom.js";
import { sample } from "@/scripts/utils/math/random.js";
import { softargmax } from "@/scripts/utils/math/utils.js";
import * as color from "@thi.ng/color";
import potrace from "potrace";
import { extendCentroids, getSilhouetteScore, kMeans } from "./kmeans.js";
import { applyQuantization } from "./pipeline.js";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let svgCanvas: SVGSVGElement;
  const getBackground = () => getPaletteBaseColor(0);
  let isActive = false;
  let isAuto = 0;
  let image: HTMLImageElement;
  let form: HTMLFormElement;
  let cache: { [n: number]: color.XYZD65[] } = {};
  let n_colors: number = 0;
  let _palette_: string[] = [];
  const palette_ = {
    get: () => _palette_,
    set: (palette: string[]) => {
      _palette_ = palette;
    },
  };
  const getPalette = () => palette_.get().map((c) => color.xyzD65(c));
  const setPalette = (palette: color.XYZD65[]) => {
    palette_.set(palette.map((c) => color.css(color.srgb(c))));
  };

  function setup() {
    if (!canvas) return;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function clear(img: HTMLImageElement) {
    if (!isActive) return;
    image = img;
    cache = {};
    canvas.width = img.width;
    canvas.height = img.height;
    setPalette([]);
    redraw(true);
  }
  function getSamples() {
    const sample_dim =
      form.querySelector<HTMLInputElement>("#sample-dim")!.valueAsNumber;
    const scale = Math.max(
      1,
      Math.max(canvas.width, canvas.height) / sample_dim,
    );
    const offscreen = new OffscreenCanvas(
        canvas.width / scale,
        canvas.height / scale,
      ),
      offscreenCtx = offscreen.getContext("2d")!;
    offscreenCtx.drawImage(image, 0, 0, offscreen.width, offscreen.height);
    const buffer = offscreenCtx.getImageData(
      0,
      0,
      offscreen.width,
      offscreen.height,
    );
    const samples = new Array(buffer.width * buffer.height)
      .fill(0)
      .map((_, i) => {
        return color.xyzD65(
          color.srgb(
            buffer.data[i * 4 + 0] / 255,
            buffer.data[i * 4 + 1] / 255,
            buffer.data[i * 4 + 2] / 255,
          ),
        );
      });
    const copy = (v: color.XYZD65) => v.copy(),
      dist = (a: color.XYZD65, b: color.XYZD65) => {
        return color.distEucledian3(a, b);
      },
      average = (a: color.XYZD65[], w: number[]) => {
        const v = [0, 0, 0, 0];
        a.forEach((_, i) => {
          v[0] += a[i][0] * w[i];
          v[1] += a[i][1] * w[i];
          v[2] += a[i][2] * w[i];
          v[3] += w[i];
        });
        return color.xyzD65(v[0] / v[3], v[1] / v[3], v[2] / v[3]);
      };
    return { offscreen, samples, copy, dist, average };
  }
  function cluster() {
    if (!isActive || !image) return;
    n_colors =
      form.querySelector<HTMLInputElement>("#palette-count")!.valueAsNumber;
    if (n_colors <= 0) {
      setPalette([]);
      return;
    }
    const { samples, copy, dist, average } = getSamples();
    const N_SAMPLE = samples.length;
    const max_iter = 1000;
    const closestKey = Object.keys(cache)
      .map((n) => parseInt(n.toString()))
      .reduce((a, b) => {
        const dA = Math.abs(a - n_colors);
        const dB = Math.abs(b - n_colors);
        return dA === dB ? Math.min(a, b) : dA < dB ? a : b;
      }, 0);
    const seed = cache[closestKey] ?? [];
    const palette = kMeans(
      samples,
      N_SAMPLE,
      n_colors,
      max_iter,
      seed,
      copy,
      dist,
      average,
    );
    setPalette(palette);
  }
  function snap() {
    if (!isActive || !image) return;
    const { samples, dist } = getSamples(),
      palette = getPalette().map((c) =>
        sample(
          samples,
          softargmax(
            samples.map((sample) => -dist(c, sample)),
            1 / 100000,
          ),
        ),
      );
    setPalette(palette);
  }
  function updateScore() {
    if (!isActive || !image) return;
    const { samples, dist } = getSamples(),
      palette = getPalette();
    if (palette.length === 0) return;
    const score = getSilhouetteScore(samples, palette, dist);
    form.querySelector<HTMLInputElement>("#palette-score")!.valueAsNumber =
      score;
  }

  function redraw(raw = false, dither = false) {
    if (!isActive || !image) return;
    if (raw || palette_.get().length === 0) {
      requestAnimationFrame(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const { offscreen } = getSamples();
        offscreen.convertToBlob().then((blob) => {
          svgCanvas.innerHTML = `<image href="${URL.createObjectURL(
            blob,
          )}" width=${svgCanvas.getAttribute(
            "width",
          )} height=${svgCanvas.getAttribute("height")}></image>`;
        });
      });
      return;
    }
    requestAnimationFrame(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      (dither ? applyDithering : applyQuantization)(
        imageData,
        palette_.get().map((c) => color.srgb(c).xyz),
        dither ? 1 / 1000 : 0,
      );
      ctx.putImageData(imageData, 0, 0);
    });
  }
  function vectorize() {
    if (!isActive || !image) return;
    const colors = [];
    const imageData = ctx.getImageData(
      0,
      0,
      ctx.canvas.width,
      ctx.canvas.height,
    );
    for (let i = 0; i < ctx.canvas.width * ctx.canvas.height; i++) {
      const c = color.css(
        color.srgb(
          imageData.data[i * 4 + 0] / 255,
          imageData.data[i * 4 + 1] / 255,
          imageData.data[i * 4 + 2] / 255,
        ),
      );
      if (colors.indexOf(c) === -1) colors.push(c);
      if (colors.length === 0 || colors.length > n_colors) {
        console.log("Invalid number of colors", colors.length);
        return;
      }
    }
    const domParser = new DOMParser();
    Promise.all(
      colors.map(async (c) => {
        const offscreen = document.createElement("canvas");
        offscreen.width = ctx.canvas.width;
        offscreen.height = ctx.canvas.height;
        const offscreenCtx = offscreen.getContext("2d")!;
        const imageData_ = offscreenCtx.getImageData(
          0,
          0,
          offscreen.width,
          offscreen.height,
        );
        for (let i = 0; i < ctx.canvas.width * ctx.canvas.height; i++) {
          const c_ = color.css(
            color.srgb(
              imageData.data[i * 4 + 0] / 255,
              imageData.data[i * 4 + 1] / 255,
              imageData.data[i * 4 + 2] / 255,
            ),
          );
          if (c_ === c) {
            imageData_.data[i * 4 + 0] =
              imageData_.data[i * 4 + 1] =
              imageData_.data[i * 4 + 2] =
                0;
            imageData_.data[i * 4 + 3] = 255;
          } else {
            imageData_.data[i * 4 + 0] =
              imageData_.data[i * 4 + 1] =
              imageData_.data[i * 4 + 2] =
                255;
            imageData_.data[i * 4 + 3] = 0;
          }
        }
        offscreenCtx.putImageData(imageData_, 0, 0);
        const dataURL = await new Promise<string>((resolve, reject) => {
          offscreen.toBlob((blob) => {
            if (!blob) reject("Failed to convert to blob");
            const fileReader = new FileReader();
            fileReader.addEventListener("load", () => {
              resolve(fileReader.result as string);
            });
            fileReader.readAsDataURL(blob!);
          }, "image/png");
        });
        const data = dataURL.replace(/^data:image\/\w+;base64,/, ""),
          buffer = new Buffer(data, "base64");
        return new Promise<SVGSVGElement>((resolve, reject) =>
          potrace.trace(
            buffer,
            {
              turdPolicy: "minority",
              turdSize: 2,
              alphaMax: 1,
              optCurve: true,
              optTolerance: 1,
              blackOnWhite: true,
              background: "transparent",
            },
            (err, svg) => {
              if (err) {
                reject(err);
                return;
              }
              const svg_ = domParser.parseFromString(svg, "image/svg+xml")
                .documentElement as unknown as SVGSVGElement;
              svg_.querySelectorAll("path").forEach((path) => {
                path.setAttribute("fill", c);
              });
              resolve(svg_);
            },
          ),
        );
      }),
    ).then((svgs) => {
      console.log(svgs);
      requestAnimationFrame(() => {
        svgCanvas.innerHTML = "";
        svgs.forEach((svg) => svgCanvas.appendChild(svg));
      });
    });
  }

  function updatePaletteText() {
    const colors = form
      .querySelector<HTMLTextAreaElement>("#palette-text")!
      .value.split("\n");
    const palette = [];
    for (const c of colors) {
      if (c === "") continue;
      palette.push(color.xyzD65(c));
    }
    form.querySelector<HTMLInputElement>("#palette-count")!.valueAsNumber =
      palette.length;
    setPalette(palette);
  }

  return {
    start: (
      sketch: HTMLCanvasElement,
      svg: SVGSVGElement,
      config: HTMLFormElement,
    ) => {
      canvas = sketch;
      svgCanvas = svg;
      form = config;
      palette_.set = (palette) => {
        _palette_ = palette;
        form.querySelector<HTMLTextAreaElement>("#palette-text")!.value = "";
        form.querySelector<HTMLDivElement>("#palette")!.innerHTML = "";
        form.querySelector<HTMLInputElement>("#palette-count")!.valueAsNumber =
          palette.length;
        for (let i = 0; i < palette.length; i++) {
          const input = document.createElement("input");
          input.type = "color";
          input.value = color.css(color.srgb(palette[i]));
          form.querySelector<HTMLDivElement>("#palette")!.appendChild(input);
          input.addEventListener("input", function () {
            const palette = getPalette();
            palette[i] = color.xyzD65(this.value);
            setPalette(palette);
          });
          form.querySelector<HTMLTextAreaElement>("#palette-text")!.value +=
            input.value + "\n";
        }
        cache[palette.length] = getPalette();
      };
      ctx = canvas.getContext("2d", {
        willReadFrequently: true,
      })!;
      setup();
      onImageChange(form.querySelector<HTMLInputElement>("#image")!, clear);
      form
        .querySelector<HTMLButtonElement>("#calc")!
        .addEventListener("click", () => cluster());
      form
        .querySelector<HTMLButtonElement>("#snap")!
        .addEventListener("click", () => snap());
      form
        .querySelector<HTMLButtonElement>("#eval")!
        .addEventListener("click", () => updateScore());
      form
        .querySelector<HTMLButtonElement>("#draw-raw")!
        .addEventListener("click", () => redraw(true));
      form
        .querySelector<HTMLButtonElement>("#draw-quant")!
        .addEventListener("click", () => redraw(false, false));
      form
        .querySelector<HTMLButtonElement>("#draw-dither")!
        .addEventListener("click", () => redraw(false, true));
      form
        .querySelector<HTMLButtonElement>("#draw-svg")!
        .addEventListener("click", () => vectorize());
      form
        .querySelector<HTMLButtonElement>("#update-color")!
        .addEventListener("click", updatePaletteText);
      form
        .querySelector<HTMLInputElement>("#palette-count")!
        .addEventListener("input", function () {
          if (!image) return;
          form.querySelector<HTMLInputElement>("#palette-score")!.value = "";
          const { samples, copy, dist } = getSamples();
          setPalette(
            extendCentroids(
              samples,
              this.valueAsNumber,
              getPalette(),
              dist,
              copy,
            ),
          );
        });
      form
        .querySelector<HTMLButtonElement>("#autorun")!
        .addEventListener("click", async () => {
          if (isAuto !== 0) {
            isAuto = 0;
            return;
          }
          isAuto++;
          n_colors = 0;
          form.querySelector<HTMLInputElement>("#palette-count")!.disabled =
            true;
          clear(image);
          while (isAuto === 1) {
            form.querySelector<HTMLInputElement>("#palette-count")!.value =
              n_colors.toString();
            cluster();
            updateScore();
            console.log(
              n_colors,
              palette_.get(),
              form.querySelector<HTMLInputElement>("#palette-score")!.value,
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await new Promise((resolve) => requestAnimationFrame(resolve));
            n_colors++;
          }
          form.querySelector<HTMLInputElement>("#palette-count")!.disabled =
            false;
          isAuto--;
        });
      isActive = true;
    },
    stop: () => {
      isActive = false;
    },
  };
}
