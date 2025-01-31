import { Vector } from "@/scripts/utils/math/vector.js";
import type p5 from "p5";
export class Draggable {
  static p: p5;
  isDragging: boolean;
  isHover: boolean;
  x: number;
  y: number;
  r: number;
  offsetX: number;
  offsetY: number;
  Ox: number;
  Oy: number;
  R: number;
  get p(): p5 {
    return Draggable.p;
  }
  constructor(r: number) {
    this.isDragging = false;
    this.isHover = false;
    this.x = 0;
    this.y = 0;
    this.r = r;
    this.offsetX = 0;
    this.offsetY = 0;
    this.Ox = 0;
    this.Oy = 0;
    this.R = 0;
  }

  hover() {
    if (
      this.p.mouseX > this.x - this.r &&
      this.p.mouseX < this.x + this.r &&
      this.p.mouseY > this.y - this.r &&
      this.p.mouseY < this.y + this.r
    ) {
      this.isHover = true;
    } else {
      this.isHover = false;
    }
  }

  update() {
    if (this.isDragging) {
      this.x = this.p.mouseX + this.offsetX;
      this.y = this.p.mouseY + this.offsetY;
      const vec = new Vector(this.x - this.Ox, this.y - this.Oy);
      if (vec.mag() > this.R) {
        vec.setMag(this.R);
      }
      this.x = vec.x + this.Ox;
      this.y = vec.y + this.Oy;
    }
  }
  setOffset(Ox: number, Oy: number, r: number) {
    this.x = ((this.x - this.Ox) / this.R) * r + Ox;
    this.y = -((-this.y + this.Oy) / this.R) * r + Oy;
    this.Ox = Ox;
    this.Oy = Oy;
    this.R = r;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  show() {
    this.p.strokeWeight(10);
    if (this.isDragging) {
      this.p.stroke(50);
    } else if (this.isHover) {
      this.p.stroke(100);
    } else {
      this.p.stroke(175, 200);
    }
    this.p.point(this.x, this.y);
  }

  pressed() {
    if (
      this.p.mouseX > this.x - this.r &&
      this.p.mouseX < this.x + this.r &&
      this.p.mouseY > this.y - this.r &&
      this.p.mouseY < this.y + this.r
    ) {
      this.isDragging = true;
      this.offsetX = this.x - this.p.mouseX;
      this.offsetY = this.y - this.p.mouseY;
    }
  }

  released() {
    this.isDragging = false;
  }
}
