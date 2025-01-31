import type p5 from "p5";

export interface p5Extension extends p5 {
  canvas: HTMLCanvasElement;
}

export interface IKernelFunctionThis<ConstantsT = Record<string, never>> {
  output: {
    x: number;
    y: number;
    z: number;
  };
  thread: {
    x: number;
    y: number;
    z: number;
  };
  constants: ConstantsT;
  getColor(): [r: number, g: number, b: number, a: number];
  color(r: number): void;
  color(r: number, a: number): void;
  color(r: number, g: number, b: number, a: number): void;
}

export interface IRenderFunctionThis<ConstantsT = Record<string, never>> {
  output: {
    x: number;
    y: number;
    z: number;
  };
  constants: ConstantsT;
  getColor(x: number, y: number): [r: number, g: number, b: number, a: number];
  color(x: number, y: number, r: number): void;
  color(x: number, y: number, r: number, a: number): void;
  color(x: number, y: number, r: number, g: number, b: number, a: number): void;
}
