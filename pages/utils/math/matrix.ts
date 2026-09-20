import type { Tensor } from "./tensor.js";
import type { TVector } from "./vector.js";

export type TMatrix<
  T = unknown,
  N1 extends number = number,
  N2 extends number = number,
> = Tensor<T, [N1, N2]>;
export type TSquareMatrix<T = unknown, N extends number = number> = TMatrix<
  T,
  N,
  N
>;

export function matrix_dim<T extends TMatrix>(
  m: T,
): [
  T extends TMatrix<unknown, infer N1, number> ? N1 : number,
  T extends TMatrix<unknown, number, infer N2> ? N2 : number,
] {
  return [
    m.length as T extends TMatrix<unknown, infer N1, number> ? N1 : number,
    m[0]!.length as T extends TMatrix<unknown, number, infer N2> ? N2 : number,
  ];
}
export function matrix_identity<N extends number>(
  n: N,
): TSquareMatrix<number, N> {
  const m: number[][] = [];
  for (let i = 0; i < n; i++) {
    m.push([]);
    for (let j = 0; j < n; j++) {
      m.at(-1)!.push(i === j ? 1 : 0);
    }
  }
  return m as TSquareMatrix<number, N>;
}
export function matrix_transpose<T extends TMatrix<U>, U>(
  m: T,
): T extends TMatrix<U, infer N1, infer N2> ? TMatrix<U, N2, N1> : TMatrix {
  const [n1, n2] = matrix_dim(m);
  const mt: U[][] = [];
  for (let i = 0; i < n2; i++) {
    mt.push([]);
    for (let j = 0; j < n1; j++) {
      mt.at(-1)!.push(m[j]![i]!);
    }
  }
  return mt as TMatrix<U> as T extends TMatrix<U, infer N1, infer N2>
    ? TMatrix<U, N2, N1>
    : TMatrix;
}
export function matrix_add<T extends TMatrix<number>>(a: T, b: T): T {
  const [n1, n2] = matrix_dim(a);
  const m: number[][] = [];
  for (let i = 0; i < n1; i++) {
    m.push([]);
    for (let j = 0; j < n2; j++) {
      m.at(-1)!.push(a[i]![j]! + b[i]![j]!);
    }
  }
  return m as TMatrix<number> as T;
}
export function matrix_sub<T extends TMatrix<number>>(a: T, b: T): T {
  const [n1, n2] = matrix_dim(a);
  const m: number[][] = [];
  for (let i = 0; i < n1; i++) {
    m.push([]);
    for (let j = 0; j < n2; j++) {
      m.at(-1)!.push(a[i]![j]! - b[i]![j]!);
    }
  }
  return m as TMatrix<number> as T;
}
export function matrix_scale<T extends TMatrix<number>>(m: T, s: number): T {
  return m.map((row) => row.map((v) => v * s)) as TMatrix<number> as T;
}

export function matrix_mult<
  T extends TMatrix<number>,
  U extends (T extends TMatrix<number, number, infer N0 extends number>
    ? TMatrix<number, N0, number>
    : TMatrix<number>),
>(
  a: T,
  b: U,
): T extends TMatrix<number, infer N1 extends number, infer N0 extends number>
  ? U extends TMatrix<number, N0, infer N2 extends number>
    ? TMatrix<number, N1, N2>
    : TMatrix<number>
  : TMatrix<number> {
  const [a_n1, a_n2] = matrix_dim(a);
  const [b_n1, b_n2] = matrix_dim(b);
  if ((a_n2 as number) !== (b_n1 as number))
    throw new Error(
      `Matrix dimension mismatch: ${a_n1}x${a_n2} cannot multiply ${b_n1}x${b_n2}`,
    );
  const m: number[][] = [];
  for (let i = 0; i < a_n1; i++) {
    m.push([]);
    for (let j = 0; j < b_n2; j++) {
      let sum = 0;
      for (let k = 0; k < a_n2; k++) {
        sum += a[i]![k]! * b[k]![j]!;
      }
      m.at(-1)!.push(sum);
    }
  }
  return m as TMatrix<number> as ReturnType<typeof matrix_mult<T, U>>;
}
export function matrix_mult_vector<
  T extends TMatrix<number>,
  U extends (T extends TMatrix<number, number, infer N0 extends number>
    ? TVector<number, N0>
    : TVector<number>),
>(
  m: T,
  v: U,
): T extends TMatrix<number, infer N1 extends number, number>
  ? TVector<number, N1>
  : TVector<number> {
  const [m_n1, m_n2] = matrix_dim(m);
  const v_n = v.length;
  if ((m_n2 as number) !== (v_n as number))
    throw new Error(
      `Matrix and vector dimension mismatch: ${m_n1}x${m_n2} cannot multiply ${v_n}`,
    );
  const res: number[] = [];
  for (let i = 0; i < m_n1; i++) {
    let sum = 0;
    for (let j = 0; j < m_n2; j++) {
      sum += m[i]![j]! * v[j]!;
    }
    res.push(sum);
  }
  return res as TVector<number> as ReturnType<typeof matrix_mult_vector<T, U>>;
}
export function matrix_det<T extends TSquareMatrix<number>>(m: T): number {
  const [n1, n2] = matrix_dim(m);
  if ((n1 as number) !== (n2 as number))
    throw new Error(`Matrix is not square: ${n1}x${n2}`);
  const n = n1 as number;
  if (n === 1) {
    const m_ = m as TSquareMatrix<number> as TSquareMatrix<number, 1>;
    return m_[0][0];
  }
  if (n === 2) {
    const m_ = m as TSquareMatrix<number> as TSquareMatrix<number, 2>;
    return m_[0][0] * m_[1][1] - m_[0][1] * m_[1][0];
  }
  if (n === 3) {
    const m_ = m as TSquareMatrix<number> as TSquareMatrix<number, 3>;
    return (
      m_[0][0] * (m_[1][1] * m_[2][2] - m_[1][2] * m_[2][1]) -
      m_[0][1] * (m_[1][0] * m_[2][2] - m_[1][2] * m_[2][0]) +
      m_[0][2] * (m_[1][0] * m_[2][1] - m_[1][1] * m_[2][0])
    );
  }
  let det = 0;
  for (let j = 0; j < n; j++) {
    const subm: number[][] = [];
    for (let i = 1; i < n; i++) {
      subm.push(m[i]!.filter((_, col) => col !== j));
    }
    det +=
      (j % 2 === 0 ? 1 : -1) *
      m[0]![j]! *
      matrix_det(subm as TSquareMatrix<number> as T);
  }
  return det;
}
export function matrix_inverse<T extends TSquareMatrix<number>>(
  m: T,
): T | null {
  const [n1, n2] = matrix_dim(m);
  if ((n1 as number) !== (n2 as number))
    throw new Error(`Matrix is not square: ${n1}x${n2}`);
  const n = n1 as number;
  const det = matrix_det(m);
  if (det === 0) return null;
  if (n === 1) {
    const m_ = m as TSquareMatrix<number> as TSquareMatrix<number, 1>;
    return [[1 / m_[0][0]]] as TSquareMatrix<number> as T;
  }
  if (n === 2) {
    const m_ = m as TSquareMatrix<number> as TSquareMatrix<number, 2>;
    return [
      [m_[1][1] / det, -m_[0][1] / det],
      [-m_[1][0] / det, m_[0][0] / det],
    ] as TSquareMatrix<number> as T;
  }
  const adj: number[][] = [];
  for (let i = 0; i < n; i++) {
    adj.push([]);
    for (let j = 0; j < n; j++) {
      const subm: number[][] = [];
      for (let ii = 0; ii < n; ii++) {
        if (ii === i) continue;
        subm.push(m[ii]!.filter((_, col) => col !== j));
      }
      adj[i]!.push(
        ((i + j) % 2 === 0 ? 1 : -1) *
          matrix_det(subm as TSquareMatrix<number>),
      );
    }
  }
  const adjT = matrix_transpose(adj as TMatrix<number>) as TMatrix<number>;
  return matrix_scale(adjT as T, 1 / det);
}
