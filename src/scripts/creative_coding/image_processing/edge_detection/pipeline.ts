import {
  applyGaussianBlur,
  getGradient,
  getLuminance,
  interpolateAt,
} from "@/scripts/utils/image_processing.js";

export function getOutlierMask(
  imageData: ImageData,
  inIndex: number = 2,
  maskIndex: number = 3,
  maskBit: number = 0b11111111,
  threshold_l: number = 3,
  threshold_h: number = Infinity,
) {
  const mag_arranged = imageData.data
    .filter((_, i) => i % 4 === inIndex)
    .filter((_, i) => (imageData.data[i * 4 + maskIndex] & maskBit) === maskBit)
    .sort((a, b) => a - b);
  const mag_q1 = mag_arranged[Math.round((mag_arranged.length - 1) * 0.25)];
  const mag_q3 = mag_arranged[Math.round((mag_arranged.length - 1) * 0.75)];
  const mag_l = mag_q1 - threshold_l * (mag_q3 - mag_q1);
  const mag_h = mag_q3 + threshold_h * (mag_q3 - mag_q1);
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      const index = (y * imageData.width + x) * 4;
      const mag = imageData.data[index + inIndex];
      if (mag_l > mag || mag > mag_h)
        imageData.data[index + maskIndex] &= ~maskBit;
    }
  }
}

export function applyMaximumGradientMask(
  imageData: ImageData,
  dxIndex: number = 0,
  dyIndex: number = 1,
  magIndex: number = 2,
  maskIndex: number = 3,
  maskBit: number = 0b11111111,
) {
  const radius = [0.5, 1, Math.SQRT2];
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      const index = (y * imageData.width + x) * 4;
      const dx = imageData.data[index + dxIndex] - 128;
      const dy = imageData.data[index + dyIndex] - 128;
      const mag =
        magIndex < 0
          ? Math.sqrt(dy * dy + dx * dx) / Math.SQRT2
          : imageData.data[index + magIndex];
      const dir = Math.atan2(dy, dx);
      if (
        radius.length > 0 &&
        radius.filter(
          (r) =>
            interpolateAt(
              imageData,
              x + r * Math.cos(dir),
              y + r * Math.sin(dir),
              magIndex,
            ) >= mag ||
            interpolateAt(
              imageData,
              x - r * Math.cos(dir),
              y - r * Math.sin(dir),
              magIndex,
            ) >= mag,
        ).length /
          radius.length >
          0.5
      )
        imageData.data[(y * imageData.width + x) * 4 + maskIndex] &= ~maskBit;
    }
  }
}

export function applyMaskConnectivity(
  imageData: ImageData,
  maskIndex: number = 3,
  maskBit: number = 0b11111111,
  radius: number = 1,
  minNeighbors: number = 0,
  maxNeighbors: number = Infinity,
) {
  let isUpdated = false;
  const _mask = new Array<boolean>(imageData.width * imageData.height)
    .fill(true)
    .map((_, i) => (imageData.data[i * 4 + maskIndex] & maskBit) === maskBit);
  const checker = [];
  for (let ky = -radius; ky <= radius; ky++) {
    for (let kx = -radius; kx <= radius; kx++) {
      if (kx === 0 && ky === 0) continue;
      checker.push([kx, ky]);
    }
  }
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      const neighbors_count = checker.filter(([kx, ky]) => {
        if (
          y + ky < 0 ||
          y + ky >= imageData.height ||
          x + kx < 0 ||
          x + kx >= imageData.width
        )
          return false;
        return _mask[(y + ky) * imageData.width + (x + kx)];
      }).length;
      if (minNeighbors > neighbors_count || neighbors_count > maxNeighbors) {
        imageData.data[(y * imageData.width + x) * 4 + maskIndex] &= ~maskBit;
        isUpdated ||= true;
      }
    }
  }
  return isUpdated;
}

export function getEdgeMask(
  imageData: ImageData,
  dxIndex: number = 0,
  dyIndex: number = 1,
  magIndex: number = 2,
  maskIndex: number = 3,
) {
  {
    const lumIndex = 3;
    getLuminance(imageData, lumIndex);
    applyGaussianBlur(imageData, lumIndex);
    getGradient(imageData, lumIndex, dxIndex, dyIndex, magIndex);
  }
  {
    const mask = 0b11111111;
    imageData.data.set(
      imageData.data.map((v, i) => (i % 4 === maskIndex ? 255 : v)),
    );
    // Double thresholding
    getOutlierMask(imageData, magIndex, maskIndex, mask, 3);
    // Non-maximum suppression
    applyMaximumGradientMask(imageData, 0, 1, magIndex, maskIndex, mask);
    // Connectivity
    for (let _ = 0; _ < 20; _++) {
      const isUpdated =
        applyMaskConnectivity(imageData, maskIndex, mask, 1, 0, 6) ||
        applyMaskConnectivity(imageData, maskIndex, mask, 2, 1);
      if (!isUpdated) break;
    }
    // Double thresholding
    getOutlierMask(imageData, magIndex, maskIndex, mask, 1.5);
  }
  return imageData;
}
