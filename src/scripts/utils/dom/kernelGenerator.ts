export function kernelGenerator<
  IConstants = Record<string, never>,
  IParameters extends any[] = [], // eslint-disable-line @typescript-eslint/no-explicit-any
  IReturnType = void,
>(
  main: (
    this: IKernelFunctionThis<IConstants>,
    ...args: IParameters
  ) => IReturnType,
  constants: IConstants,
  buffer: ImageData,
) {
  if (buffer.colorSpace !== "srgb") {
    console.warn("Buffer must be in sRGB color space");
  }
  return function* (
    this: IRenderFunctionThis<IConstants>,
    ...args: Parameters<typeof main>
  ): Generator<IReturnType, IReturnType[][], undefined> {
    const res: IReturnType[][] = new Array(this.output.x)
      .fill(null)
      .map(() => new Array(this.output.y).fill(null));
    for (let y = 0; y < this.output.y; y++) {
      for (let x = 0; x < this.output.x; x++) {
        yield (res[x][y] = main.bind({
          output: this.output,
          thread: { x, y, z: 0 },
          constants: this.constants,
          getColor: () => this.getColor(x, y),
          color: (
            r: number,
            g: number | null = null,
            b: number | null = null,
            a: number | null = null,
          ) =>
            g === null
              ? this.color(x, y, r)
              : b === null
                ? this.color(x, y, r, g)
                : a === null
                  ? this.color(x, y, r, g, b)
                  : this.color(x, y, r, g, b, a),
        })(...args));
      }
    }
    return res;
  }.bind({
    output: { x: buffer.width, y: buffer.height, z: 0 },
    constants: constants,
    getColor: (x: number, y: number) =>
      [
        buffer.data[4 * buffer.width * (buffer.height - y - 1) + 4 * x + 0] /
          255,
        buffer.data[4 * buffer.width * (buffer.height - y - 1) + 4 * x + 1] /
          255,
        buffer.data[4 * buffer.width * (buffer.height - y - 1) + 4 * x + 2] /
          255,
        buffer.data[4 * buffer.width * (buffer.height - y - 1) + 4 * x + 3] /
          255,
      ] as [r: number, g: number, b: number, a: number],
    color: (
      x: number,
      y: number,
      r: number,
      g: number | null = null,
      b: number | null = null,
      a: number | null = null,
    ) => {
      const index = 4 * buffer.width * (buffer.height - y - 1) + 4 * x;
      if (g === null) {
        a = buffer.data[index + 3];
        g = r;
        b = r;
      } else if (b === null) {
        a = g;
        g = r;
        b = r;
      } else if (a === null) {
        a = buffer.data[index + 3];
      }
      buffer.data.set([r * 255, g * 255, b * 255, a * 255], index);
    },
  });
}

export function kernelRunner<
  IConstants = Record<string, never>,
  IParameters extends any[] = [], // eslint-disable-line @typescript-eslint/no-explicit-any
>(
  main: (this: IKernelFunctionThis<IConstants>, ...args: IParameters) => void,
  constants: IConstants,
  buffer: ImageData,
) {
  const generator = kernelGenerator(main, constants, buffer);
  return function (...args: Parameters<typeof main>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-empty
    for (const _ of generator(...args)) {
    }
    return buffer;
  };
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
  color(v: number): void;
  color(v: number, a: number): void;
  color(r: number, g: number, b: number): void;
  color(r: number, g: number, b: number, a: number): void;
}

interface IRenderFunctionThis<ConstantsT = Record<string, never>> {
  output: {
    x: number;
    y: number;
    z: number;
  };
  constants: ConstantsT;
  getColor(x: number, y: number): [r: number, g: number, b: number, a: number];
  color(x: number, y: number, v: number): void;
  color(x: number, y: number, v: number, a: number): void;
  color(x: number, y: number, r: number, g: number, b: number): void;
  color(x: number, y: number, r: number, g: number, b: number, a: number): void;
}
