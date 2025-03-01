import type p5 from "p5";

export interface p5Extension extends p5 {
  canvas: HTMLCanvasElement;
}

export type ExcludeKeys<T, K> = Pick<T, Exclude<keyof T, K>>;
