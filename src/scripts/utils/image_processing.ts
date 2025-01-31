import { constrain, map } from "@/scripts/utils/math/utils.js";
import convert_color from "@/scripts/utils/color/conversion.js";

const srgb2hcl = convert_color("srgb", "hcl")!;

export function deepCopyImageData(imageData: ImageData): ImageData {
  const newImageData = new ImageData(imageData.width, imageData.height);
  newImageData.data.set(new Uint8ClampedArray(imageData.data));
  return newImageData;
}

export function interpolateAt(
  imageData: ImageData,
  x: number,
  y: number,
  inIndex: number = 3,
) {
  const x0 = Math.max(Math.floor(x), 0);
  const x1 = Math.min(Math.ceil(x), imageData.width - 1);
  const y0 = Math.max(Math.floor(y), 0);
  const y1 = Math.min(Math.ceil(y), imageData.height - 1);
  const p00 = imageData.data[(y0 * imageData.width + x0) * 4 + inIndex];
  const p01 = imageData.data[(y1 * imageData.width + x0) * 4 + inIndex];
  const p10 = imageData.data[(y0 * imageData.width + x1) * 4 + inIndex];
  const p11 = imageData.data[(y1 * imageData.width + x1) * 4 + inIndex];
  const p0 = x0 === x1 ? p00 : map(x, x0, x1, p00, p10);
  const p1 = x0 === x1 ? p01 : map(x, x0, x1, p01, p11);
  return y0 === y1 ? p0 : map(y, y0, y1, p0, p1);
}

export function getLuminance(imageData: ImageData, outIndex: number = 3) {
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      const index = (y * imageData.width + x) * 4;
      const l = srgb2hcl([
        imageData.data[index] / 255,
        imageData.data[index + 1] / 255,
        imageData.data[index + 2] / 255,
      ])[2];
      if (outIndex < 0) {
        imageData.data[index] = l * 255;
        imageData.data[index + 1] = l * 255;
        imageData.data[index + 2] = l * 255;
        imageData.data[index + 3] = 255;
      } else imageData.data[index + outIndex] = l * 255;
    }
  }
}

export function getGaussianKernel(radius: number, sigma: number = radius / 3) {
  const kernel = [];
  let sum = 0;
  for (let y = -radius; y <= radius; y++) {
    const row = [];
    for (let x = -radius; x <= radius; x++) {
      const k = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      row.push(k);
      sum += k;
    }
    kernel.push(row);
  }
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      kernel[y + radius][x + radius] /= sum;
    }
  }
  return kernel;
}

export function applyConvolution(
  imageData: ImageData,
  kernel: number[][],
  kernelRadius: [number, number],
  inIndex: number = 3,
  outIndex: number = inIndex,
  baseline: number = 0,
) {
  const _imageData = deepCopyImageData(imageData);
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      const index = (y * imageData.width + x) * 4;
      let value = baseline;
      for (let ky = -kernelRadius[1]; ky <= kernelRadius[1]; ky++) {
        for (let kx = -kernelRadius[0]; kx <= kernelRadius[0]; kx++) {
          const k = kernel[ky + kernelRadius[1]][kx + kernelRadius[0]];
          value += interpolateAt(_imageData, x + kx, y + ky, inIndex) * k;
        }
      }
      imageData.data[index + outIndex] = value;
    }
  }
}

export function applyGaussianBlur(
  imageData: ImageData,
  radius: number,
  sigma: number = radius / 3,
) {
  applyConvolution(imageData, getGaussianKernel(radius, sigma), [
    radius,
    radius,
  ]);
}

export function getGradient(
  imageData: ImageData,
  inIndex: number = 3,
  dxIndex: number = 0,
  dyIndex: number = 1,
  magIndex: number = 2,
) {
  applyConvolution(
    imageData,
    [[+1 / 4, 0, -1 / 4]],
    [1, 0],
    inIndex,
    dxIndex,
    128,
  );
  applyConvolution(
    imageData,
    [[+1 / 4], [0], [-1 / 4]],
    [0, 1],
    inIndex,
    dyIndex,
    128,
  );
  if (magIndex < 0) return;
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      const index = (y * imageData.width + x) * 4;
      const dx = 2 * (imageData.data[index + dxIndex] - 128);
      const dy = 2 * (imageData.data[index + dyIndex] - 128);
      imageData.data[index + magIndex] = constrain(
        Math.sqrt(dy * dy + dx * dx) * Math.SQRT2,
        0,
        255,
      );
    }
  }
}
