import { Fraction } from "@/scripts/utils/math/fraction.js";
import { shuffleArray } from "@/scripts/utils/math/random.js";
import { factorial, maxA, minA, sum } from "@/scripts/utils/math/utils.js";

export function toAdjMatrix(
  adjList: Map<number, { id: number; value: Fraction }[]>,
): Fraction[][] {
  const n = adjList.size;
  const matrix: Fraction[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => new Fraction(0)),
  );
  adjList.forEach((dist, agent) => {
    dist.forEach((item) => {
      matrix[agent][item.id] = item.value.copy();
    });
  });
  return matrix;
}
export function toAdjList(
  adjMatrix: Fraction[][],
  sort_id: (i: number, a: number, b: number) => number = (_, a, b) => a - b,
): Map<number, { id: number; value: Fraction }[]> {
  const map = new Map<number, { id: number; value: Fraction }[]>();
  adjMatrix.forEach((row, agent) => {
    map.set(
      agent,
      row
        .map((value, id) => ({ id, value: value.copy() }))
        .toSorted(
          (a, b) => sort_id(agent, a.id, b.id) || a.value.compare(b.value),
        ),
    );
  });
  return map;
}

export function SinkhornFrac(matrix: Fraction[][]) {
  // Technically, the result is likely irrational.
  // But the approximation process should result in rational numbers.
  // sum_i ai vij = 1 / bj
  // sum_j bj vij = 1 / ai
  // bj = 1 / sum_i ai vij
  // sum_j(ai vij / (sum_i ai vij)) = 1
  const n = matrix.length;
  for (let z = 0; z < n ** 2; z++) {
    let is_fixing = false;
    for (let i = 0; i < n; i++) {
      const total = matrix.reduce(
        (sum, row) => sum.add(row[i]),
        new Fraction(0),
      );
      if (total.compare(new Fraction(1)) !== 0) is_fixing = true;
      matrix.forEach((r) => r[i].div(total));
    }
    for (let j = 0; j < n; j++) {
      const total = matrix[j].reduce((sum, v) => sum.add(v), new Fraction(0));
      if (total.compare(new Fraction(1)) !== 0) is_fixing = true;
      matrix[j].forEach((v) => v.div(total));
    }
    if (!is_fixing) break;
  }
}

export function permanentFrac(matrix: Fraction[][]): Fraction {
  const n = matrix.length;
  if (!matrix.every((row) => row.length === n))
    throw new Error("Matrix must be square");
  let perm = new Fraction(0);
  for (let s = 0; s < 1 << n; s++) {
    const prod = new Fraction(1);
    for (let i = 0; i < n; i++) {
      const sum = new Fraction(0);
      for (let j = 0; j < n; j++) {
        if ((s & (1 << j)) !== 0) {
          sum.add(matrix[i][j]);
        }
      }
      prod.mul(sum);
      if (prod.compare() === 0) break;
    }
    if (prod.compare() === 0) continue;
    const bits = s.toString(2).replaceAll("0", "").length;
    if (bits % 2 === 0) {
      perm.add(prod);
    } else {
      perm.sub(prod);
    }
  }
  if (n % 2 === 1) perm = perm.mul(new Fraction(-1));
  return perm;
}

export function HopcroftKarp(n: number, adj: number[][]) {
  const pair_u = new Array<number>(n).fill(n);
  const pair_v = new Array<number>(n).fill(n);
  const dist = new Array<number>(n + 1).fill(Infinity);
  function bfs(): boolean {
    const q = [];
    for (let u = 0; u < n; u++) {
      if (pair_u[u] === n) {
        dist[u] = 0;
        q.push(u);
      } else {
        dist[u] = Infinity;
      }
    }
    dist[n] = Infinity;
    while (q.length > 0) {
      const u = q.shift()!;
      if (dist[u] < dist[n]) {
        shuffleArray(adj[u]).forEach((v) => {
          if (dist[pair_v[v]] === Infinity) {
            dist[pair_v[v]] = dist[u]! + 1;
            q.push(pair_v[v]!);
          }
        });
      }
    }
    return dist[n] !== Infinity;
  }
  function dfs(u: number): boolean {
    if (u !== n) {
      for (const v of shuffleArray(adj[u])) {
        if (dist[pair_v[v]] === dist[u] + 1) {
          if (dfs(pair_v[v])) {
            pair_v[v] = u;
            pair_u[u] = v;
            return true;
          }
        }
      }
      dist[u] = Infinity;
      return false;
    }
    return true;
  }
  let matching = 0;
  while (bfs()) {
    for (let u = 0; u < n; u++) {
      if (pair_u[u] === n) {
        if (dfs(u)) {
          matching++;
        }
      }
    }
  }
  if (matching !== n) return null; // No perfect matching
  return { pair_u, pair_v };
}

function _get_pairing(connectivity: boolean[][]) {
  const n = connectivity.length;
  const hk = HopcroftKarp(
    n,
    connectivity.map((row) =>
      row.map((v, j) => (v ? j : -1)).filter((j) => j >= 0),
    ),
  );
  if (!hk) throw new Error("No perfect matching found");
  return hk.pair_u;
}
export function BvNDecomposeFrac(
  matrix: Fraction[][],
  get_pairing: ((connectivity: boolean[][]) => number[]) | null = null,
): [Fraction, number[]][] {
  if (get_pairing === null) get_pairing = _get_pairing;
  const n = matrix.length;
  if (!matrix.every((row) => row.length === n))
    throw new Error("Matrix must be square");
  if (
    !matrix.every(
      (row) =>
        row
          .reduce((sum, v) => sum.add(v), new Fraction(0))
          .compare(new Fraction(1)) === 0,
    )
  )
    throw new Error("Row sums must be 1");
  if (
    !matrix[0].every(
      (_, j) =>
        matrix
          .reduce((sum, row) => sum.add(row[j]), new Fraction(0))
          .compare(new Fraction(1)) === 0,
    )
  )
    throw new Error("Column sums must be 1");
  const A = matrix.map((row) => row.map((v) => v.copy()));
  const decomposition: [Fraction, number[]][] = []; // List of permutation matrices
  while (A.some((row) => row.some((v) => v.compare() > 0))) {
    const pair_u = get_pairing(A.map((row) => row.map((v) => v.compare() > 0)));
    const P: number[] = [];
    for (let row = 0; row < n; row++) {
      if (pair_u[row] === n) {
        throw new Error("No perfect matching found");
      }
      P.push(pair_u[row]!);
    }

    let lambda = new Fraction(1);
    for (let row = 0; row < n; row++) {
      const col = P[row];
      if (A[row][col].compare(lambda) < 0) {
        lambda = A[row][col].copy();
      }
    }
    for (let row = 0; row < n; row++) {
      const col = P[row];
      A[row][col] = A[row][col].sub(lambda);
    }
    decomposition.push([lambda, P]);
  }
  return decomposition;
}
export function BvNDecompose(
  matrix: number[][],
  get_pairing: ((connectivity: boolean[][]) => number[]) | null = null,
): [number, number[]][] {
  if (get_pairing === null) get_pairing = _get_pairing;
  const n = matrix.length;
  if (!matrix.every((row) => row.length === n))
    throw new Error("Matrix must be square");
  if (!matrix.every((row) => sum(row) === 1))
    throw new Error("Row sums must be 1");
  if (!matrix[0].every((_, j) => sum(matrix.map((row) => row[j])) === 1))
    throw new Error("Column sums must be 1");
  const A = matrix.map((row) => [...row]);
  const decomposition: [number, number[]][] = []; // List of permutation matrices
  while (A.some((row) => row.some((v) => v > 0))) {
    const pair_u = get_pairing(A.map((row) => row.map((v) => v > 0)));
    const P: number[] = [];
    for (let row = 0; row < n; row++) {
      if (pair_u[row] === n) {
        throw new Error("No perfect matching found");
      }
      P.push(pair_u[row]!);
    }

    let lambda = 1;
    for (let row = 0; row < n; row++) {
      const col = P[row];
      lambda = Math.min(lambda, A[row][col]);
    }
    for (let row = 0; row < n; row++) {
      const col = P[row];
      A[row][col] -= lambda;
    }
    decomposition.push([lambda, P]);
  }
  return decomposition;
}

function missingPairing(pair_u: number[]) {
  const n = pair_u.length;
  const us = pair_u.map((v, i) => (v === -1 ? i : -1)).filter((i) => i !== -1);
  const vs = new Array(n)
    .fill(0)
    .map((_, j) => j)
    .filter((j) => !pair_u.includes(j));
  if (us.length !== vs.length) throw new Error("Must be a matching");
  return { us, vs };
}
function pairingActivity(
  pair_u: number[],
  activity: number[][],
  weight: number[][] | null = null,
) {
  let a = sum(pair_u.map((v, u) => (v !== -1 ? activity[u][v] : 0)));
  if (weight !== null && pair_u.includes(-1)) {
    const { us, vs } = missingPairing(pair_u);
    if (vs.length !== 1)
      throw new Error("Must be a perfect or near-perfect matching");
    a *= weight[us[0]][vs[0]];
  }
  return a;
}
export function preTransverse(
  activity: number[][],
  sample_size: number = -5,
  steps: number = -1,
) {
  const n = activity.length;
  const _sample_size =
    sample_size >= 0 ? sample_size : Math.round(-sample_size * n * n);
  const a_max = maxA(activity.flat());
  const a_min = minA(activity.flat().filter((b) => b > 0));
  const v_min = Math.pow(a_min, n) / factorial(n);
  const a0 = activity.map((row) => row.map((v) => (v > 0 ? v : v_min)));
  const a_ = new Array(n).fill(0).map(() => new Array(n).fill(a_max));
  const weight = new Array(n).fill(0).map(() => new Array(n).fill(n * a_max));
  while (true) {
    let y = -1;
    for (let u = 0; u < n; u++) {
      for (let v = 0; v < n; v++) {
        if (a_[u][v] > a0[u][v]) {
          y = u;
          break;
        }
      }
      if (y >= 0) break;
    }
    if (y < 0) break;
    const pairings = new Array(_sample_size)
      .fill(0)
      .map(() => samplePairing(a_, weight, steps));
    let tot = 0;
    const act = new Array(n).fill(0).map(() => new Array(n).fill(0));
    for (const pair_u of pairings) {
      const { us, vs } = missingPairing(pair_u);
      if (us.length === 0) tot += pairingActivity(pair_u, a_);
      else if (us.length === 1)
        act[us[0]][vs[0]] += pairingActivity(pair_u, a_);
      else throw new Error("Must be a perfect or near-perfect matching");
    }
    for (let v = 0; v < n; v++) {
      a_[y][v] = Math.max(a_[y][v] * Math.exp(-0.5), a0[y][v]);
      for (let u = 0; u < n; u++) {
        weight[u][v] = act[u][v] > 0 ? tot / act[u][v] : weight[u][v];
      }
    }
  }
  return weight;
}
function nextTransverse(activity: number[][], pair_u: number[]) {
  pair_u = [...pair_u];
  const n = activity.length;
  const { us, vs } = missingPairing(pair_u);
  if (us.length === 0) {
    const i = Math.floor(Math.random() * n);
    pair_u[i] = -1;
    return pair_u;
  }
  if (us.length === 1) {
    const u = us[0],
      v = vs[0];
    const iz = Math.random() > 0.5;
    const z = Math.floor(Math.random() * n);
    if (((!iz && z === u) || (iz && v === z)) && activity[u][v] > 0) {
      pair_u[u] = v;
      return pair_u;
    } else if (iz && activity[u][z] > 0) {
      const x = pair_u.findIndex((v) => v === z);
      pair_u[u] = z;
      pair_u[x] = -1;
      return pair_u;
    } else if (!iz && activity[z][v] > 0) {
      pair_u[z] = v;
      return pair_u;
    }
    return pair_u;
  }
  throw new Error("Must be a perfect or near-perfect matching");
}
function transverseStep(
  activity: number[][],
  weight: number[][],
  pair_u: number[],
) {
  if (Math.random() > 0.5) return [...pair_u];
  const pair_u_ = nextTransverse(activity, pair_u);
  if (pair_u.every((v, u) => v === pair_u_[u])) return pair_u_;
  const w0 = pairingActivity(pair_u, activity, weight);
  const w1 = pairingActivity(pair_u_, activity, weight);
  if (Math.random() < Math.min(1, w1 / w0)) return pair_u_;
  return [...pair_u];
}
export function samplePairing(
  activity: number[][],
  weight: number[][],
  steps: number = -1,
) {
  const n = activity.length;
  const _steps =
    steps >= 0
      ? steps
      : Math.round(-steps * Math.max(1, Math.pow(n, 7) * Math.log(n)));
  let sample = HopcroftKarp(
    n,
    activity.map((row) =>
      row.map((v, j) => (v > 0 ? j : -1)).filter((j) => j >= 0),
    ),
  )?.pair_u;
  if (!sample) throw new Error("No perfect matching found");
  for (let step = 0; step < _steps; step++) {
    sample = transverseStep(activity, weight, sample);
  }
  return sample;
}
