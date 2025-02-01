export class BrainfuckEngine {
  ram: boolean[][];
  ptr: number;
  prog: string;
  pptr: number;
  constructor(prog: string) {
    this.ram = new Array(30000).fill(null).map(() => new Array(8).fill(false));
    this.ptr = 0;
    this.prog = prog;
    this.pptr = -1;
  }

  *exec() {
    while (true) {
      this.pptr++;
      if (typeof this.prog[this.pptr] === "undefined") return "HALTED";
      switch (this.prog[this.pptr]) {
        case "+":
          yield this.inc();
          break;
        case "-":
          yield this.dec();
          break;
        case ">":
          yield this.nxt();
          break;
        case "<":
          yield this.pre();
          break;
        case "[":
          yield this.lin();
          break;
        case "]":
          yield this.lot();
          break;
        case ".":
          yield this.opt();
          break;
        case ",":
          yield "INPUT";
          yield this.inp(yield);
          break;
        default:
          yield;
      }
    }
  }

  opt() {
    return this.ram[this.ptr].reduceRight(
      (acc, curr) => (acc << 1) | (curr ? 0b1 : 0b0),
      0,
    );
  }
  inp(val: number) {
    this.ram[this.ptr] = this.ram[this.ptr].map(
      (_, ind) => (val & (0b1 << ind)) >> ind === 0b1,
    );
  }
  inc() {
    this.inp(this.opt() + 1);
  }
  dec() {
    this.inp(this.opt() - 1);
  }
  nxt() {
    this.ptr++;
    this.ptr += this.ram.length;
    this.ptr %= this.ram.length;
  }
  pre() {
    this.ptr--;
    this.ptr += this.ram.length;
    this.ptr %= this.ram.length;
  }
  lin() {
    if (this.opt() === 0) {
      let count = 0;
      do {
        if (this.pptr >= this.prog.length) throw RangeError();
        switch (this.prog[this.pptr]) {
          case "[":
            count++;
            break;
          case "]":
            count--;
            break;
          default:
        }
        this.pptr++;
      } while (count > 0);
      this.pptr--;
    }
  }
  lot() {
    let count = 0;
    do {
      if (this.pptr < 0) throw RangeError();
      switch (this.prog[this.pptr]) {
        case "[":
          count++;
          break;
        case "]":
          count--;
          break;
        default:
      }
      this.pptr--;
    } while (count < 0);
  }
}
