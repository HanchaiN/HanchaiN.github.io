// https://github.com/josdejong/mathjs/blob/develop/src/function/matrix/fft.js
import { Complex } from "../math/complex.js";
import type { Tensor } from "../math/tensor.js";

type Tensor0D<T = unknown> = Tensor<T, []>;
type Tensor1D<T = unknown> = Tensor<T, [number]>;
type Tensor1pD<T = unknown> = Exclude<Tensor<T>, Tensor0D<T>>;
type Tensor2pD<T = unknown> = Exclude<Tensor<T>, Tensor0D<T> | Tensor1D<T>>;

export function fft<T extends Tensor1pD<Complex>>(arr: T): T {
  return _ndFft(arr);
}
export default fft;

export function ifft<T extends Tensor1pD<Complex>>(arr: T): T {
  return _ndIfft(arr);
}

function _arraySize<T extends Tensor>(
  arr: T,
): T extends Tensor<unknown, infer D> ? D : number[] {
  if (!Array.isArray(arr))
    return [] as unknown as T extends Tensor<unknown, infer D> ? D : number[];
  if (arr.length === 0)
    return [0] as T extends Tensor<unknown, infer D> ? D : number[];
  return [arr.length, ..._arraySize(arr[0]!)] as T extends Tensor<
    unknown,
    infer D
  >
    ? D
    : number[];
}

function _ndFft<T extends Tensor1pD<Complex>>(arr: T): T {
  const size = _arraySize(arr);
  if (size.length === 1) return _fft(arr as Tensor<Complex, [number]>) as T;
  // ndFft along dimension 1,...,N-1 then 1dFft along dimension 0
  return _1dFft(
    (arr as Tensor2pD<Complex>).map((slice) =>
      _ndFft(slice as Tensor1pD<Complex>),
    ),
    0,
  ) as Tensor1pD<Complex> as T;
}

function _transpose<T extends Tensor2pD<_T>, _T = number | Complex>(
  arr: T,
): T extends Tensor<_T, infer D>
  ? D extends [
      infer N1 extends number,
      infer N2 extends number,
      ...infer _D extends number[],
    ]
    ? Tensor<_T, [N2, N1, ..._D]>
    : Tensor<_T, D>
  : Tensor {
  const size = _arraySize(arr);
  return new Array(size[1]!)
    .fill(0)
    .map((_, j) =>
      new Array(size[0])
        .fill(0)
        .map((_, i) => (arr[i]! as Tensor1pD)[j]! as Tensor),
    ) as ReturnType<typeof _transpose<T, _T>>;
}

function _1dFft<T extends Tensor2pD<Complex>>(arr: T, dim: number): T {
  const size = _arraySize(arr);
  if (dim !== 0)
    return new Array(size[0])
      .fill(0)
      .map((_, i) =>
        _1dFft(arr[i]! as Tensor2pD<Complex>, dim - 1),
      ) as Tensor2pD<Complex> as T;
  if (size.length === 1) return _fft(arr as Tensor<Complex, [number]>) as T;
  return _transpose(_1dFft(_transpose(arr) as Tensor2pD<Complex>, 1)) as T;
}

function _fft<T extends Tensor1D<Complex>>(arr: T): T {
  const len = arr.length;
  if (len === 1) return [arr[0]!] as readonly Complex[] as T;
  if (len % 2 !== 0) {
    // use chirp-z transform for non-power-of-2 FFT
    return _czt(arr) as T;
  }
  const ret = [
    ..._fft(arr.filter((_, i) => i % 2 === 0)),
    ..._fft(arr.filter((_, i) => i % 2 === 1)),
  ] as Complex[];
  for (let k = 0; k < len / 2; k++) {
    const p = ret[k]!;
    const q = Complex.mult(
      ret[k + len / 2]!,
      Complex.exp(Complex.mult(Complex.mult(2 * Math.PI, Complex.I), -k / len)),
    );
    ret[k] = Complex.add(p, q);
    ret[k + len / 2] = Complex.add(p, Complex.mult(-1, q));
  }
  return ret as readonly Complex[] as T;
}

function _czt<T extends Tensor1D<Complex>>(arr: T): T {
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
      .map((_, i) => Complex.mult(arr[i]!, chirp[n - 1 + i]!)),
    ...new Array(N2 - n).fill(0),
  ];
  const ichirp = [
    ...new Array(n + n - 1).fill(0).map((_, i) => Complex.div(1, chirp[i]!)),
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
  const ret: Complex[] = [];
  for (let i = n - 1; i < n + n - 1; i++) {
    ret.push(Complex.mult(ifftProduct[i]!, chirp[i]!));
  }
  return ret as readonly Complex[] as T;
}

function _ndIfft<T extends Tensor1pD<Complex>>(
  arr: T,
  normFactor: number = 1,
): T {
  const size = _arraySize(arr);
  if (size.length === 1)
    return _ifft(arr as Tensor1D<Complex>, normFactor) as T;
  return arr.map((slice) =>
    _ndIfft(slice as Tensor1pD<Complex>, normFactor * size[0]!),
  ) as Tensor1pD<Complex> as T;
}

function _ifft<T extends Tensor1D<Complex>>(arr: T, normFactor: number = 1): T {
  return _fft(arr.map(Complex.conj))
    .map(Complex.conj)
    .map((v) =>
      Complex.div(v, normFactor * arr.length),
    ) as readonly Complex[] as T;
}
