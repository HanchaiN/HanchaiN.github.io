import { Vector } from "@/scripts/utils/math/vector.js";
import type p5 from "p5";
export interface BranchConfig {
  [type: number | symbol]: {
    angle: number;
    lenScale: number;
    widScale: number;
    type: number | symbol;
  }[];
}

export class Branch {
  rule: BranchConfig;
  begin: Vector;
  end: Vector;
  type: number | symbol;
  finished: boolean;
  size: number;
  branches: Branch[];
  constructor(
    begin: Vector,
    end: Vector,
    type: number | symbol,
    rule: BranchConfig,
    size: number = 1,
  ) {
    this.rule = rule;
    this.begin = begin;
    this.end = end;
    this.type = type;
    this.size = size;
    this.finished = false;
    this.branches = [];
  }

  show(p: p5, strokeWidth: number = 1) {
    p.stroke(255);
    p.strokeWeight(this.size * strokeWidth);
    p.line(this.begin.x, this.begin.y, this.end.x, this.end.y);
    this.branches.forEach((branch) => branch.show(p, strokeWidth));
  }

  get childCount(): number {
    if (!this.finished) return 1;
    return this.branches.reduce((acc, branch) => acc + branch.childCount, 0);
  }

  grow() {
    if (this.finished) {
      this.branches.forEach((branch) => branch.grow());
      return;
    }
    this.finished = true;
    this.branches.push(
      ...this.rule[this.type].map((rule) => {
        const newEnd = Vector.sub(this.end, this.begin)
          .rotate(rule.angle)
          .mult(rule.lenScale)
          .add(this.end);
        return new Branch(
          this.end,
          newEnd,
          rule.type,
          this.rule,
          this.size * rule.widScale,
        );
      }),
    );
  }
}
