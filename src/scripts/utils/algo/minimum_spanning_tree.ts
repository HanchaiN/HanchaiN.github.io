import { iterate_all } from "../utils.js";
import { PriorityQueue } from "./datastructure.js";

export function* minimum_spanning_tree_step(edges: number[][]) {
  const tree_edges: number[] = [];
  const vertex: number[] = [];
  const lookup = new PriorityQueue<{ ie: number; d: number }>((_) => _.d);
  function addNode(iv: number) {
    if (vertex.includes(iv)) return;
    vertex.push(iv);
    edges.forEach(([ia, ib, d], ie) => {
      if (ia === iv || ib === iv) lookup.push({ ie, d });
    });
  }
  addNode(0);
  while (lookup.top()) {
    const { ie } = lookup.pop()!;
    const [ia, ib] = edges[ie];
    const a_ = vertex.includes(ia);
    const b_ = vertex.includes(ib);
    if (a_ && b_) continue;
    if (a_) addNode(ib);
    if (b_) addNode(ia);
    tree_edges.push(ie);
    yield tree_edges;
  }
  return tree_edges;
}

export function minimum_spanning_tree(edges: number[][]) {
  return iterate_all(minimum_spanning_tree_step(edges));
}
