// https://github.com/josdejong/mathjs/blob/develop/src/function/matrix/fft.js
import { Complex } from "../math/complex.js";

type Tensor1D = Complex[];
type Tensor = Tensor1D | Tensor[];

export function fft<T extends Tensor>(arr: T): T {
  return _ndFft(arr);
}
export default fft;

function _arraySize(arr: Tensor | Complex): number[] {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return [arr.length, ..._arraySize(arr[0])];
}

function _ndFft<T extends Tensor>(arr: T): T {
  const size = _arraySize(arr);
  if (size.length === 1) return _fft(arr as Tensor1D) as T;
  // ndFft along dimension 1,...,N-1 then 1dFft along dimension 0
  return _1dFft(arr.map((slice) => _ndFft(slice as Tensor)) as T, 0);
}

function _transpose<T extends Exclude<Tensor, Tensor1D>>(arr: T): T {
  const size = _arraySize(arr);
  return new Array(size[1])
    .fill(0)
    .map((_, j) => new Array(size[0]).fill(0).map((_, i) => arr[i][j])) as T;
}

function _1dFft<T extends Tensor>(arr: T, dim: number): T {
  const size = _arraySize(arr);
  if (dim !== 0)
    return new Array(size[0])
      .fill(0)
      .map((_, i) =>
        _1dFft((arr as Exclude<Tensor, Tensor1D>)[i] as Tensor, dim - 1),
      ) as T;
  if (size.length === 1) return _fft(arr as Tensor1D) as T;
  return _transpose(
    _1dFft(_transpose(arr as Exclude<Tensor, Tensor1D>), 1),
  ) as T;
}

function _fft(arr: Tensor1D): Tensor1D {
  const len = arr.length;
  if (len === 1) return [arr[0]];
  if (len % 2 !== 0) {
    // use chirp-z transform for non-power-of-2 FFT
    return _czt(arr);
  }
  const ret = [
    ..._fft(arr.filter((_, i) => i % 2 === 0)),
    ..._fft(arr.filter((_, i) => i % 2 === 1)),
  ];
  for (let k = 0; k < len / 2; k++) {
    const p = ret[k];
    const q = Complex.mult(
      ret[k + len / 2],
      Complex.exp(Complex.mult(Complex.mult(2 * Math.PI, Complex.I), -k / len)),
    );
    ret[k] = Complex.add(p, q);
    ret[k + len / 2] = Complex.add(p, Complex.mult(-1, q));
  }
  return ret;
}

function _czt(arr: Tensor1D): Tensor1D {
  const n = arr.length;
  const w = Complex.exp(
    Complex.div(Complex.mult(-1, Complex.mult(2 * Math.PI, Complex.I)), n),
  );
  const chirp: Complex[] = [];
  for (let i = 1 - n; i < n; i++) {
    chirp.push(Complex.pow(w, (i * i) / 2));
  }
  const N2 = Math.pow(2, Math.ceil(Math.log2(n + n - 1)));
  const xp = [
    ...new Array(n)
      .fill(0)
      .map((_, i) => Complex.mult(arr[i], chirp[n - 1 + i])),
    ...new Array(N2 - n).fill(0),
  ];
  const ichirp = [
    ...new Array(n + n - 1).fill(0).map((_, i) => Complex.div(1, chirp[i])),
    ...new Array(N2 - (n + n - 1)).fill(0),
  ];
  const fftXp = _fft(xp);
  const fftIchirp = _fft(ichirp);
  const fftProduct = new Array(N2)
    .fill(0)
    .map((_, i) => Complex.mult(fftXp[i], fftIchirp[i]));
  const ifftProduct = _ndFft(fftProduct.map(Complex.conj))
    .map(Complex.conj)
    .map((v) => Complex.div(v, N2));
  const ret: Tensor1D = [];
  for (let i = n - 1; i < n + n - 1; i++) {
    ret.push(Complex.mult(ifftProduct[i], chirp[i]));
  }
  return ret;
}
