export function rot_hilbert(
  [x, y]: [number, number],
  rx: number,
  ry: number,
  n: number,
): [number, number] {
  if (ry === 0) {
    if (rx === 1) {
      x = n - 1 - x;
      y = n - 1 - y;
    }
    const t = x;
    x = y;
    y = t;
  }
  return [x, y];
}
export function rot_moore(
  [x, y]: [number, number],
  rx: number,
  ry: number,
  n: number,
): [number, number] {
  if (rx === 0) {
    x = n - 1 - x;
  }
  if (rx === 1) {
    y = n - 1 - y;
  }
  const t = x;
  x = y;
  y = t;
  return [x, y];
}
//convert (x,y) to d
export function xy2d(
  n: number,
  _x: number,
  _y: number,
  rot: (
    [x, y]: [number, number],
    rx: number,
    ry: number,
    n: number,
  ) => [number, number],
) {
  let d = 0;
  let x = _x;
  let y = _y;
  for (let s = n / 2; s > 0; s /= 2) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    const xy = rot([x, y], rx, ry, n);
    x = xy[0];
    y = xy[1];
  }
  return d;
}
//convert d to (x,y)
export function d2xy(
  n: number,
  _d: number,
  rot: (
    [x, y]: [number, number],
    rx: number,
    ry: number,
    n: number,
  ) => [number, number],
): [number, number] {
  let d = _d;
  let x = 0;
  let y = 0;
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & (d / 2);
    const ry = 1 & (d ^ rx);
    const xy = rot([x, y], rx, ry, n);
    x = xy[0];
    y = xy[1];
    x += s * rx;
    y += s * ry;
    d /= 4;
  }
  return [x, y];
}
