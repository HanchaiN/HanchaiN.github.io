import {
  vector_cross2,
  vector_magSq,
  vector_sub,
  type TVector,
} from "../math/vector.js";
import { iterate_all } from "../utils.js";

export function* delaunay_triangulation_step<T extends TVector<number, 2>>(
  nodes: T[],
  supertriangle: [T, T, T],
) {
  type IndexEdge = [number, number];
  type IndexTriangle = [number, number, number];
  function getEdges(triangles: IndexTriangle[]) {
    const edges: IndexEdge[] = [];
    triangles.forEach(([ia, ib, ic]) => {
      if (
        !edges.some(
          ([i, j]) => (i === ia && j === ib) || (i === ib && j === ia),
        )
      )
        edges.push([ia, ib]);
      if (
        !edges.some(
          ([i, j]) => (i === ib && j === ic) || (i === ic && j === ib),
        )
      )
        edges.push([ib, ic]);
      if (
        !edges.some(
          ([i, j]) => (i === ic && j === ia) || (i === ia && j === ic),
        )
      )
        edges.push([ic, ia]);
    });
    return edges;
  }
  const nodes_: T[] = [];
  {
    const [a, b, c] = supertriangle;
    if (vector_cross2(a, b) + vector_cross2(b, c) + vector_cross2(c, a) > 0) {
      nodes_.push(a, b, c);
    } else {
      nodes_.push(c, b, a);
    }
  }
  nodes_.push(...nodes);
  let triangles: IndexTriangle[] = [];
  triangles.push([0, 1, 2]);
  for (let _i = 0; _i < nodes.length; _i++) {
    const node = nodes[_i]!;
    const i = _i + 3;
    const bad_triangles: number[] = [];
    triangles.forEach(([ia, ib, ic], it) => {
      const a = nodes_[ia]!;
      const b = nodes_[ib]!;
      const c = nodes_[ic]!;
      const a_ = vector_sub(a, node);
      const b_ = vector_sub(b, node);
      const c_ = vector_sub(c, node);
      const s_ =
        vector_cross2(a_, b_) * vector_magSq(c_) +
        vector_cross2(b_, c_) * vector_magSq(a_) +
        vector_cross2(c_, a_) * vector_magSq(b_);
      if (s_ > 0)
        // node is in triangle
        bad_triangles.push(it);
    });
    const hole_edges: IndexEdge[] = [];
    bad_triangles.forEach((it) => {
      const [ia, ib, ic] = triangles[it]!;
      if (
        bad_triangles.every((it_) => {
          const [ia_, ib_, ic_] = triangles[it_]!;
          return (
            it === it_ ||
            (ia !== ia_ && ia !== ib_ && ia !== ic_) ||
            (ib !== ia_ && ib !== ib_ && ib !== ic_)
          );
        })
      )
        hole_edges.push([ia, ib]);
      if (
        bad_triangles.every((it_) => {
          const [ia_, ib_, ic_] = triangles[it_]!;
          return (
            it === it_ ||
            (ib !== ia_ && ib !== ib_ && ib !== ic_) ||
            (ic !== ia_ && ic !== ib_ && ic !== ic_)
          );
        })
      )
        hole_edges.push([ib, ic]);
      if (
        bad_triangles.every((it_) => {
          const [ia_, ib_, ic_] = triangles[it_]!;
          return (
            it === it_ ||
            (ic !== ia_ && ic !== ib_ && ic !== ic_) ||
            (ia !== ia_ && ia !== ib_ && ia !== ic_)
          );
        })
      )
        hole_edges.push([ic, ia]);
    });
    triangles = triangles.filter((_, it) => !bad_triangles.includes(it));
    hole_edges.forEach(([ia, ib]) => triangles.push([ia, ib, i]));
    yield getEdges(
      triangles
        .filter(([ia, ib, ic]) => ia > 2 && ib > 2 && ic > 2)
        .map(([ia, ib, ic]) => [ia - 3, ib - 3, ic - 3]),
    );
  }
  return getEdges(
    triangles
      .filter(([ia, ib, ic]) => ia > 2 && ib > 2 && ic > 2)
      .map(([ia, ib, ic]) => [ia - 3, ib - 3, ic - 3]),
  );
}

export function delaunay_triangulation<T extends TVector<number, 2>>(
  nodes: T[],
  supertriangle: [T, T, T],
) {
  return iterate_all(delaunay_triangulation_step(nodes, supertriangle));
}
