import {
  MathNumericType,
  diag,
  eigs,
  matrix,
  subtract,
  transpose,
} from "mathjs";

export class Graph<T> {
  node: T[];
  adj: number[][];
  _directed: boolean;
  constructor(directed = false) {
    this.node = [];
    this.adj = [];
    this._directed = directed;
  }
  addNode(v: T) {
    if (this.node.includes(v)) return false;
    this.node.push(v);
    this.adj.push(new Array(this.node.length - 1).fill(0) as number[]);
    this.adj.forEach((lst) => lst.push(0));
    return true;
  }
  deleteNode(v: T) {
    const ind = this.node.indexOf(v);
    if (ind == -1) return false;
    this.node.splice(ind, 1);
    this.adj.splice(ind, 1);
    this.adj = this.adj.map((lst) => lst.splice(ind, 1));
    return true;
  }
  addEdge(u: T, v: T) {
    const iu = this.node.indexOf(u);
    const iv = this.node.indexOf(v);
    if (iu < 0 || iv < 0) return false;
    this.adj[iu][iv]++;
    if (!this._directed) this.adj[iv][iu]++;
    return true;
  }
  removeEdge(u: T, v: T) {
    const iu = this.node.indexOf(u);
    const iv = this.node.indexOf(v);
    if (iu < 0 || iv < 0) return false;
    if (this.adj[iu][iv] <= 0) return false;
    this.adj[iu][iv]--;
    if (!this._directed) this.adj[iv][iu]--;
    return true;
  }
  degree() {
    return this.adj.map((lst) =>
      lst.reduce((acc, val) => acc + (val ? 1 : 0), 0),
    );
  }
  simplify() {
    this.adj = this.adj.map((lst, i) =>
      lst.map((w, j) => (i == j || w <= 0 ? 0 : 1)),
    );
    return true;
  }
  spectral() {
    const lap = subtract(diag(this.degree()), matrix(this.adj));
    return transpose(
      eigs(lap).eigenvectors.map(({ vector }) => vector as MathNumericType[]),
    ) as number[][];
  }
}
