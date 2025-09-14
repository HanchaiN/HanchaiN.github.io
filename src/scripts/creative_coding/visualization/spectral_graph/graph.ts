import {
  MathNumericType,
  diag,
  eigs,
  matrix,
  subtract,
  transpose,
} from "mathjs";

import { sum } from "@/scripts/utils/math/utils.js";

export class Graph<T> {
  private _node: T[];
  private _adjMatrix: number[][];
  private _directed: boolean;
  constructor(directed = false) {
    this._node = [];
    this._adjMatrix = [];
    this._directed = directed;
  }
  get order() {
    return this._node.length;
  }
  get size() {
    return sum(this._adjMatrix.flat());
  }
  clear() {
    this._node = [];
    this._adjMatrix = [];
  }
  addNode(v: T) {
    if (this._node.includes(v)) return false;
    this._node.push(v);
    this._adjMatrix.push(new Array(this._node.length - 1).fill(0) as number[]);
    this._adjMatrix.forEach((lst) => lst.push(0));
    return true;
  }
  deleteNode(v: T) {
    const ind = this._node.indexOf(v);
    if (ind == -1) return false;
    this._node.splice(ind, 1);
    this._adjMatrix.splice(ind, 1);
    this._adjMatrix = this._adjMatrix.map((lst) => lst.splice(ind, 1));
    return true;
  }
  setEdge(u: T, v: T, w: number) {
    const iu = this._node.indexOf(u);
    const iv = this._node.indexOf(v);
    if (iu < 0 || iv < 0) return false;
    this._adjMatrix[iu][iv] = w;
    if (!this._directed) this._adjMatrix[iv][iu] = w;
    return true;
  }
  getEdge(u: T, v: T) {
    const iu = this._node.indexOf(u);
    const iv = this._node.indexOf(v);
    if (iu < 0 || iv < 0) return 0;
    return this._adjMatrix[iu][iv];
  }
  addEdge(u: T, v: T) {
    const iu = this._node.indexOf(u);
    const iv = this._node.indexOf(v);
    if (iu < 0 || iv < 0) return false;
    this._adjMatrix[iu][iv]++;
    if (!this._directed) this._adjMatrix[iv][iu]++;
    return true;
  }
  removeEdge(u: T, v: T) {
    const iu = this._node.indexOf(u);
    const iv = this._node.indexOf(v);
    if (iu < 0 || iv < 0) return false;
    if (this._adjMatrix[iu][iv] <= 0) return false;
    this._adjMatrix[iu][iv]--;
    if (!this._directed) this._adjMatrix[iv][iu]--;
    return true;
  }
  simplify() {
    this._adjMatrix = this._adjMatrix.map((lst, i) =>
      lst.map((w, j) => (i == j || w <= 0 ? 0 : 1)),
    );
    return true;
  }
  degree() {
    return this._adjMatrix.map((lst) =>
      lst.reduce((acc, val) => acc + (val ? 1 : 0), 0),
    );
  }
  spectral() {
    const lap = subtract(diag(this.degree()), matrix(this._adjMatrix));
    return transpose(
      eigs(lap).eigenvectors.map(({ vector }) => vector as MathNumericType[]),
    ) as number[][];
  }
}
