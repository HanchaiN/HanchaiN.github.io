type _TVector<
  T = unknown,
  N extends number = number,
  _R extends readonly T[] = readonly [],
> = number extends N
  ? readonly T[]
  : _R["length"] extends N
    ? _R
    : _TVector<T, N, readonly [T, ..._R]>;
type _MutableTVector<
  T = unknown,
  N extends number = number,
  _R extends T[] = [],
> = number extends N
  ? T[]
  : _R["length"] extends N
    ? _R
    : _TVector<T, N, [T, ..._R]>;

type _TensorUnsized<T = number> = T | readonly _TensorUnsized<T>[];
type _MutableTensorUnsized<T = number> = T | _TensorUnsized<T>[];

export type Tensor<
  T = unknown,
  D extends readonly number[] = number[],
> = number[] extends D
  ? _TensorUnsized<T>
  : D extends readonly [infer N extends number, ...infer _D extends number[]]
    ? _TVector<Tensor<T, _D>, N>
    : T;

export type MutableTensor<
  T = unknown,
  D extends number[] = number[],
> = number[] extends D
  ? _MutableTensorUnsized<T>
  : D extends [infer N extends number, ...infer _D extends number[]]
    ? _MutableTVector<MutableTensor<T, _D>, N>
    : T;
