export class Fraction {
  constructor(
    private _numerator: number,
    private _denominator: number = 1,
  ) {
    this.normalize();
  }

  get number() {
    return this._numerator / this._denominator;
  }
  get numerator() {
    return this._numerator;
  }
  get denominator() {
    return this._denominator;
  }
  toString(): string {
    return `${this._numerator}/${this._denominator}`;
  }

  private gcd(a: number, b: number): number {
    if (!b) return a;

    return this.gcd(b, Math.floor(a % b));
  }
  private normalize() {
    const gcd = this.gcd(
      Math.abs(this._numerator),
      Math.abs(this._denominator),
    );
    this._numerator /= gcd;
    this._denominator /= gcd;
    if (this._denominator < 0) {
      this._numerator = -this._numerator;
      this._denominator = -this._denominator;
    }
  }

  copy(): Fraction {
    return new Fraction(this._numerator, this._denominator);
  }

  add(other: Fraction): Fraction {
    this._numerator =
      this._numerator * other.denominator + other.numerator * this._denominator;
    this._denominator *= other.denominator;
    this.normalize();
    return this;
  }

  static add(a: Fraction, b: Fraction): Fraction {
    return a.copy().add(b);
  }

  sub(other: Fraction): Fraction {
    this._numerator =
      this._numerator * other.denominator - other.numerator * this._denominator;
    this._denominator *= other.denominator;
    this.normalize();
    return this;
  }

  static sub(a: Fraction, b: Fraction): Fraction {
    return a.copy().sub(b);
  }

  mul(other: Fraction): Fraction {
    this._numerator *= other.numerator;
    this._denominator *= other.denominator;
    this.normalize();
    return this;
  }

  static mul(a: Fraction, b: Fraction): Fraction {
    return a.copy().mul(b);
  }

  div(other: Fraction): Fraction {
    this._numerator *= other.denominator;
    this._denominator *= other.numerator;
    this.normalize();
    return this;
  }

  static div(a: Fraction, b: Fraction): Fraction {
    return a.copy().div(b);
  }

  compare(other: Fraction | null = null): 1 | 0 | -1 {
    if (other !== null) {
      return Fraction.sub(this, other).compare();
    }
    if (this._numerator === 0) return 0;
    if (this._numerator < 0) return -1;
    return 1;
  }

  static compare(a: Fraction, b: Fraction | null = null): 1 | 0 | -1 {
    return a.compare(b);
  }
}
