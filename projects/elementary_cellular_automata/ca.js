export class CA {
  set rule(rule) {
    this.ruleset = [];
    for (let j = 0; j < 8; j++) {
      this.ruleset.push(rule % 2);
      rule = Math.floor(rule / 2);
    }
    this.ruleset.reverse();
  };
  set filler(filler) {
    this.cells = new Array(this.w).fill(0);
    for (let i = 0; i < this.w; i++) {
      this.cells[i] = filler % 2;
      filler = Math.floor(filler / 2);
    }
    this.cells.reverse();
    if (!this.looped) {
      this.cells = [].concat(new Array(this.h).fill(0), ...this.cells, new Array(this.h).fill(0))
    }
    this.generation = 0;
  };
  constructor(wid, heig, looped) {
    this.w = wid;
    this.h = heig;
    this.looped = looped;
    // An array of 0s and 1s
    if (this.looped) {
      this.cells = new Array(this.w).fill(0);
    } else {
      this.cells = new Array(this.w + 2 * this.h).fill(0);
    }
  }
  // The process of creating the new generation
  generate() {
    // First we create an empty array filled with 0s for the new values
    let nextgen = new Array(this.cells.length).fill(0);
    let left;
    let me;
    let right;
    if (this.looped) {
      for (let i = 0; i < this.cells.length; i++) {
        left = this.cells[(i + this.cells.length - 1) % (this.cells.length)]; // Left neighbor state
        me = this.cells[(i + this.cells.length) % (this.cells.length)]; // Current state
        right = this.cells[(i + this.cells.length + 1) % (this.cells.length)]; // Right neighbor state
        nextgen[i] = this.evaluate(left, me, right); // Compute next generation state based on ruleset
      }
    } else {
      for (let i = 1; i < this.cells.length - 1; i++) {
        left = this.cells[(i - 1)]; // Left neighbor state
        me = this.cells[(i)]; // Current state
        right = this.cells[(i + 1)]; // Right neighbor state
        nextgen[i] = this.evaluate(left, me, right); // Compute next generation state based on ruleset
      }
    }
    // The current generation is the new generation
    this.cells = nextgen;
    this.generation++;
    if (!this.looped)
      return this.cells.slice(this.h, -this.h);
    else
      return this.cells;
  };

  // This is the easy part, just draw the cells
  display(p, forward) {
    for (let i = 0; i < this.cells.length; i++) {
      let j = 0;
      if (this.cells[i] == 1)
        j += 150;
      else
        j -= 150;
      if (!this.looped && (i < this.h || i > this.cells.length - this.h))
        j *= 0.5;
      p.fill(j + 100);
      p.noStroke();
      if (this.looped)
        p.rect(i * p.width / (this.w), this.generation * p.height / (this.h * forward), p.width / (this.w), p.height / (this.h * forward));
      else
        p.rect(i * p.width / (this.w + 2 * this.h), this.generation * p.height / (this.h * forward), p.width / (this.w + 2 * this.h), p.height / (this.h * forward));
    }
  };
  // Implementing the Wolfram rules
  // Could be improved and made more concise, but here we can explicitly see what is going on for each case
  evaluate(a, b, c) {
    return this.ruleset[(1 - a) * 4 + (1 - b) * 2 + (1 - c)] ?? 0;
  };
}
