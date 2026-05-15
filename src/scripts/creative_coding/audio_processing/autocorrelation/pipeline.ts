import { average } from "@/scripts/utils/math/utils.js";

export function normalize(buffer: Float32Array) {
  const mean = average(buffer);
  const mean2 = average(buffer.map((v) => v * v));
  const dev = Math.sqrt(mean2 - mean * mean);

  return buffer.map(v => (v - mean) / dev)
}

export function autocorrelation(buffer: Float32Array, bin_count: number) {
  const ret = new Float32Array(bin_count)
    .fill(0)
    .map((_, k) =>
      buffer.reduce(
        (acc, curr, i) =>
          i + k < 0 || i + k >= buffer.length
            ? acc
            : acc + (curr) * (buffer[i + k]),
        0,
      ),
    )
    .map((val, k) => val / (buffer.length - k));
  return ret;
}
export function autocorrelation_yin(buffer: Float32Array, bin_count: number) {
  const ret = new Float32Array(bin_count)
    .fill(0)
    .map((_, k) =>
      buffer.reduce(
        (acc, curr, i) =>
          i + k < 0 || i + k >= buffer.length
            ? acc
            : acc + Math.pow(curr - buffer[i + k], 2),
        0,
      ),
    )
  const acc = ret.reduce<number[]>((a, b) => [...a, (a.at(-1) ?? 0) + b], []).map(v => v > 1e-5 ? v : 1);
  return ret.map((v, i) => v * (i) / acc[i]);
}

export function extractPeaks(buffer: Float32Array, direction: number = +1) {
  let state: 0 | 1 | -1 = 0;
  const peaks: number[] = [];
  buffer.forEach((_, k) => {
    switch (state as number) {
      case +1:
        if (buffer[k] - buffer[k - 1] < 0) {
          state = -1;
          if (direction >= 0) peaks.push(k - 1);
        }
        break;
      case -1:
        if (buffer[k] - buffer[k - 1] > 0) {
          state = +1;
          if (direction <= 0) peaks.push(k - 1);
        }
        break;
      case 0:
        if (buffer[k + 1] - buffer[k] > 0) {
          state = +1;
          if (direction <= 0) peaks.push(k - 1);
          break;
        } else if (buffer[k + 1] - buffer[k] < 0) {
          state = -1;
          if (direction >= 0) peaks.push(k - 1);
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
  periods.sort();
  return average(periods.splice(Math.floor(periods.length * 0.3), Math.ceil(periods.length * 0.7)));
}



export function detectPitchYIN(buf: Float32Array, sampleRate: number) {
  // https://www.vocalpitch.app/
  const SIZE = buf.length;
  const rms = Math.sqrt(average(buf.map(v => v * v)));
  if (rms < 0.001) return { freq: -1, confidence: 0 };

  const minFreq = 27.5, maxFreq = 3520 * 5 / 4;
  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.min(Math.floor(sampleRate / minFreq), Math.floor(SIZE / 2));
  const threshold = 0.15;

  const d = new Float32Array(maxLag + 1);
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0;
    for (let j = 0; j < SIZE - maxLag; j++) {
      const delta = buf[j] - buf[j + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }

  const cmndf = new Float32Array(maxLag + 1);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    runningSum += d[tau];
    cmndf[tau] = runningSum > 0 ? d[tau] * tau / runningSum : 1;
  }

  let bestTau = -1;
  for (let tau = minLag; tau <= maxLag; tau++) {
    if (cmndf[tau] < threshold) {
      while (tau + 1 <= maxLag && cmndf[tau + 1] < cmndf[tau]) tau++;
      bestTau = tau;
      break;
    }
  }

  if (bestTau === -1) {
    let minVal = Infinity;
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (cmndf[tau] < minVal) { minVal = cmndf[tau]; bestTau = tau; }
    }
    if (minVal >= 0.5) return { freq: -1, confidence: 0 };
  }

  let T0 = bestTau;
  if (bestTau > 0 && bestTau < maxLag) {
    const s0 = cmndf[bestTau - 1], s1 = cmndf[bestTau], s2 = cmndf[bestTau + 1];
    const a = (s0 + s2 - 2 * s1) / 2;
    if (a > 0) T0 = bestTau + (s0 - s2) / (2 * a);
  }

  return { freq: sampleRate / T0, confidence: 1 - cmndf[bestTau] };
}