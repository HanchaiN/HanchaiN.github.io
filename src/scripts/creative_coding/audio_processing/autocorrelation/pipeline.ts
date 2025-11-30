import { average } from "@/scripts/utils/math/utils.js";

export function autocorrelation(buffer: Float32Array, bin_count: number) {
  const mean = average(buffer);
  const mean2 = average(buffer.map((v) => v * v));
  const variance = mean2 - mean * mean;
  const ret = new Float32Array(bin_count)
    .fill(0)
    .map((_, k) =>
      buffer.reduce(
        (acc, curr, i) =>
          i + k < 0 || i + k >= buffer.length
            ? acc
            : acc + (curr - mean) * (buffer[i + k] - mean),
        0,
      ),
    )
    .map((val, k) => val / (variance * (buffer.length - k)));
  return ret.map((v, _, arr) => v / arr[0]);
}

export function extractPeaks(buffer: Float32Array) {
  let state: 0 | 1 | -1 = 0;
  const peaks: number[] = [];
  buffer.forEach((_, k) => {
    switch (state as number) {
      case +1:
        if (buffer[k] - buffer[k - 1] < 0) {
          state = -1;
          peaks.push(k);
        }
        break;
      case -1:
        if (buffer[k] - buffer[k - 1] > 0) {
          state = +1;
        }
        break;
      case 0:
        if (buffer[k + 1] - buffer[k] > 0) {
          state = +1;
          break;
        } else if (buffer[k + 1] - buffer[k] < 0) {
          state = -1;
          peaks.push(k);
        }
        break;
      default:
        break;
    }
  });
  return peaks;
}

export function filterPeaks(
  peaks: number[],
  buffer: Float32Array,
  threshold_frac: number,
) {
  const _peaks = [];
  _peaks.push(peaks[0]);
  for (let j = 1; j < peaks.length; j++) {
    const prev = _peaks.at(-1)!;
    const curr = peaks[j];
    if (buffer[curr] > threshold_frac * buffer[prev]) {
      _peaks.push(curr);
    }
  }
  return _peaks;
}

export function extractPeriod(peaks: number[]) {
  const periods: number[] = [];
  for (let j = 1; j < peaks.length; j++) {
    periods.push(peaks[j] - peaks[j - 1]);
  }
  if (periods.length === 0) return 0;
  return average(periods);
}
