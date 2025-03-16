import { Vector } from "@/scripts/utils/math/vector.js";
import { iterate_all } from "@/scripts/utils/utils.js";

export function* delaunay_triangulation_step(
  nodes: Vector[],
  supertriangle: Vector[],
) {
  function getEdges(triangles: number[][]) {
    const edges: number[][] = [];
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
  const nodes_: Vector[] = [];
  {
    const [a, b, c] = supertriangle;
    if (
      a.x * b.y + c.x * a.y + b.x * c.y - (c.x * b.y + a.x * c.y + b.x * a.y) >
      0
    ) {
      nodes_.push(a, b, c);
    } else {
      nodes_.push(c, b, a);
    }
  }
  nodes_.push(...nodes);
  let triangle: number[][] = [];
  triangle.push([0, 1, 2]);
  for (let _i = 0; _i < nodes.length; _i++) {
    const node = nodes[_i];
    const i = _i + 3;
    const t: number[] = [];
    triangle.forEach(([ia, ib, ic], it) => {
      const a = nodes_[ia];
      const b = nodes_[ib];
      const c = nodes_[ic];
      const a_ = Vector.sub(a, node);
      const b_ = Vector.sub(b, node);
      const c_ = Vector.sub(c, node);
      const s_ =
        a_.x * b_.y * c_.magSq() +
        c_.x * a_.y * b_.magSq() +
        b_.x * c_.y * a_.magSq() -
        (c_.x * b_.y * a_.magSq() +
          a_.x * c_.y * b_.magSq() +
          b_.x * a_.y * c_.magSq());
      if (s_ > 0) t.push(it);
    });
    const pol: number[][] = [];
    t.forEach((it) => {
      const [ia, ib, ic] = triangle[it];
      if (
        t.every((it_) => {
          const [ia_, ib_, ic_] = triangle[it_];
          return (
            it === it_ ||
            (ia !== ia_ && ia !== ib_ && ia !== ic_) ||
            (ib !== ia_ && ib !== ib_ && ib !== ic_)
          );
        })
      )
        pol.push([ia, ib]);
      if (
        t.every((it_) => {
          const [ia_, ib_, ic_] = triangle[it_];
          return (
            it === it_ ||
            (ib !== ia_ && ib !== ib_ && ib !== ic_) ||
            (ic !== ia_ && ic !== ib_ && ic !== ic_)
          );
        })
      )
        pol.push([ib, ic]);
      if (
        t.every((it_) => {
          const [ia_, ib_, ic_] = triangle[it_];
          return (
            it === it_ ||
            (ic !== ia_ && ic !== ib_ && ic !== ic_) ||
            (ia !== ia_ && ia !== ib_ && ia !== ic_)
          );
        })
      )
        pol.push([ic, ia]);
    });
    triangle = triangle.filter((_, it) => !t.includes(it));
    pol.forEach(([ia, ib]) => triangle.push([ia, ib, i]));
    yield getEdges(
      triangle
        .filter(([ia, ib, ic]) => ia > 2 && ib > 2 && ic > 2)
        .map(([ia, ib, ic]) => [ia - 3, ib - 3, ic - 3]),
    );
  }
  return getEdges(
    triangle
      .filter(([ia, ib, ic]) => ia > 2 && ib > 2 && ic > 2)
      .map(([ia, ib, ic]) => [ia - 3, ib - 3, ic - 3]),
  );
}

export function delaunay_triangulation(
  nodes: Vector[],
  supertriangle: Vector[],
) {
  return iterate_all(delaunay_triangulation_step(nodes, supertriangle));
}
