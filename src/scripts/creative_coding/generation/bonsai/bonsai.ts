import { sample } from "@/scripts/utils/math/random.js";
import type { NCursesScreen, NCursesWindow } from "./ncurses.ts";

enum BaseType {
  none = 0,
  large = 1,
  small = 2,
}

enum BranchType {
  trunk = 0,
  shootLeft = 1,
  shootRight = 2,
  dying = 3,
  dead = 4,
}

interface Counters {
  branches: number;
  shoots: number;
  shootCounter: number;
}

interface Config {
  lifeStart: number;
  multiplier: number;
  baseType: BaseType;
  leavesSize: number;
  totalBranchCount: number;

  message: string;

  leaves: string[];
}

interface ncursesObjects {
  screen: NCursesScreen;

  baseWin: NCursesWindow;
  treeWin: NCursesWindow;
  messageBorderWin: NCursesWindow;
  messageWin: NCursesWindow;
}

export class Bonsai {
  private screen: NCursesScreen;
  private conf: Config;
  private objects: Partial<ncursesObjects>;
  private myCounters: Counters;

  constructor(
    screen: NCursesScreen,
    leavesInput: string = "&",
    message: string = "Hello, Bonsai!",
  ) {
    this.screen = screen;
    this.conf = this.getConfig(leavesInput, message);
    this.objects = { screen: screen };
    this.myCounters = {
      shoots: 0,
      branches: 0,
      shootCounter: Math.floor(Math.random() * 32768),
    };
  }

  *start() {
    this.init(this.conf, this.objects);
    yield* this.growTree(this.conf, this.objects as ncursesObjects);
  }

  getConfig(
    leavesInput: string = "&",
    message: string = "Hello, Bonsai!",
  ): Config {
    const conf: Config = {
      lifeStart: 32,
      multiplier: 5,
      baseType: BaseType.large,
      leavesSize: 0,
      totalBranchCount: 0,
      message,
      leaves: [],
    };
    leavesInput.split(",").forEach((token) => {
      if (conf.leavesSize < 100) conf.leaves[conf.leavesSize] = token;
      conf.leavesSize++;
    });
    return conf;
  }

  init(conf: Config, objects: Partial<ncursesObjects>) {
    for (let i = 0; i < 16; i++) {
      this.screen.initPair(i, i, 0);
    }
    this.drawWins(conf.baseType, objects);
    this.drawMessage(objects, conf.message);
  }

  drawWins(baseType: BaseType, objects: Partial<ncursesObjects>) {
    let baseWidth = 0;
    let baseHeight = 0;

    switch (baseType) {
      case BaseType.none:
        baseWidth = 0;
        baseHeight = 0;
        break;
      case BaseType.small:
        baseWidth = 15;
        baseHeight = 3;
        break;
      case BaseType.large:
      default:
        baseWidth = 31;
        baseHeight = 4;
        break;
    }

    const rows = this.screen.height;
    const cols = this.screen.width;

    const baseOriginY = rows - baseHeight;
    const baseOriginX = Math.floor(cols / 2) - Math.floor(baseWidth / 2);

    objects.baseWin = this.screen.createWindow(
      baseHeight,
      baseWidth,
      baseOriginY,
      baseOriginX,
    );
    objects.treeWin = this.screen.createWindow(rows - baseHeight, cols, 0, 0);

    this.drawBase(objects.baseWin, baseType);
  }

  drawBase(baseWin: NCursesWindow, baseType: BaseType) {
    switch (baseType) {
      case BaseType.none:
        break;
      case BaseType.small:
        baseWin.setColorPair(8);
        baseWin.print("(");
        baseWin.setColorPair(2);
        baseWin.print("---");
        baseWin.setColorPair(11);
        baseWin.print("./~~~\\.");
        baseWin.setColorPair(2);
        baseWin.print("---");
        baseWin.setColorPair(8);
        baseWin.print(")");
        baseWin.move_print(1, 0, " (           ) ");
        baseWin.move_print(2, 0, "  (_________)  ");
        break;
      case BaseType.large:
      default:
        baseWin.setBold(true);
        baseWin.setColorPair(8);
        baseWin.print(":");
        baseWin.setColorPair(2);
        baseWin.print("___________");
        baseWin.setColorPair(11);
        baseWin.print("./~~~\\.");
        baseWin.setColorPair(2);
        baseWin.print("___________");
        baseWin.setColorPair(8);
        baseWin.print(":");
        baseWin.move_print(1, 0, " \\                           / ");
        baseWin.move_print(2, 0, "  \\                         / ");
        baseWin.move_print(3, 0, "  (_)                     (_)");
        baseWin.setBold(false);
        break;
    }
  }

  drawMessage(objects: Partial<ncursesObjects>, message: string) {
    if (!message) return;

    const messageWin = this.createMessageWindows(objects, message);

    const maxWidth = messageWin.width - 2;
    message.split("\n").forEach((line) => {
      let linePosition = 0;
      line.split(" \t").forEach((word) => {
        const wordLength = word.length;
        linePosition += wordLength;

        if (linePosition < maxWidth) {
          messageWin.print(word);
          if (linePosition + 1 < maxWidth) {
            messageWin.print(" ");
            linePosition++;
          }
        } else if (wordLength > maxWidth) {
          messageWin.print(word);
          linePosition = messageWin.x;
        } else {
          messageWin.print("\n");
          messageWin.print(word);
          linePosition = wordLength;
        }
      });
    });
  }

  createMessageWindows(objects: Partial<ncursesObjects>, message: string) {
    const maxY = this.screen.height,
      maxX = this.screen.width;
    let boxWidth = 0,
      boxHeight = 0;

    if (message.length + 3 <= 0.25 * maxX) {
      boxWidth = message.length + 1;
      boxHeight = 1;
    } else {
      boxWidth = 0.25 * maxX;
      boxHeight = Math.floor(message.length / boxWidth) * 2;
    }

    objects.messageBorderWin = this.screen.createWindow(
      boxHeight + 2,
      boxWidth + 4,
      Math.floor(maxY * 0.7 - 1),
      Math.floor(maxX * 0.7 - 2),
    );
    objects.messageWin = this.screen.createWindow(
      boxHeight,
      boxWidth + 1,
      Math.floor(maxY * 0.7),
      Math.floor(maxX * 0.7),
    );

    objects.messageBorderWin.setColorPair(8);
    objects.messageBorderWin.setBold(true);
    objects.messageBorderWin.border("|", "|", "-", "-", "+", "+", "+", "+");

    return objects.messageWin;
  }

  *growTree(conf: Config, objects: ncursesObjects) {
    const maxY = objects.treeWin.height,
      maxX = objects.treeWin.width;

    yield* this.branch(
      conf,
      objects,
      maxY - 1,
      Math.floor(maxX / 2),
      BranchType.trunk,
      conf.lifeStart,
    );
    return;
  }

  *branch(
    conf: Config,
    objects: ncursesObjects,
    y: number,
    x: number,
    type: BranchType,
    life: number,
  ): Generator<void> {
    this.myCounters.branches++;
    let dx = 0,
      dy = 0,
      age = 0,
      shootCooldown = conf.multiplier;

    while (life > 0) {
      life--;
      age = conf.lifeStart - life;
      [dx, dy] = this.setDeltas(type, life, age, conf.multiplier);

      const maxY = objects.treeWin.height;
      if (dy > 0 && y > maxY - 2) dy--;

      if (life < 3)
        yield* this.branch(conf, objects, y, x, BranchType.dead, life);
      else if (type === BranchType.trunk && life < conf.multiplier + 2)
        yield* this.branch(conf, objects, y, x, BranchType.dying, life);
      else if (
        (type === BranchType.shootLeft || type === BranchType.shootRight) &&
        life < conf.multiplier + 2
      )
        yield* this.branch(conf, objects, y, x, BranchType.dying, life);
      else if (
        type === BranchType.trunk &&
        (life % conf.multiplier === 0 || Math.random() < 1 / 3)
      ) {
        if (Math.random() < 1 / 8 && life > 7) {
          shootCooldown = conf.multiplier * 2;
          yield* this.branch(
            conf,
            objects,
            y,
            x,
            BranchType.trunk,
            life + Math.floor(Math.random() * 5) - 2,
          );
        } else if (shootCooldown <= 0) {
          shootCooldown = conf.multiplier * 2;

          const shootLife = life + conf.multiplier;

          this.myCounters.shoots++;
          this.myCounters.shootCounter++;
          yield* this.branch(
            conf,
            objects,
            y,
            x,
            this.myCounters.shootCounter % 2 === 0
              ? BranchType.shootLeft
              : BranchType.shootRight,
            shootLife,
          );
        }
      }
      shootCooldown--;

      x += dx;
      y += dy;

      this.chooseColor(type, objects.treeWin);
      const branchStr = this.chooseString(conf, type, life, dx, dy);
      if (x % branchStr.length === 0)
        objects.treeWin.move_print(y, x, branchStr);
      objects.treeWin.setBold(false);

      yield;
    }
  }

  setDeltas(
    type: BranchType,
    life: number,
    age: number,
    multiplier: number,
  ): [number, number] {
    switch (type) {
      case BranchType.trunk:
        if (age <= 2 || life < 4) return [sample([-1, 0, 1]), 0];
        if (age < multiplier * 3)
          return [
            sample([-2, -1, 0, 1, 2], [1, 3, 2, 3, 1]),
            age % Math.floor(multiplier / 2) === 0 ? -1 : 0,
          ];
        return [sample([-1, 0, 1]), sample([-1, 0], [7, 3])];
      case BranchType.shootLeft:
        return [
          sample([-2, -1, 0, +1], [2, 4, 3, 1]),
          sample([-1, 0, +1], [2, 6, 2]),
        ];
      case BranchType.shootRight:
        return [
          sample([-1, 0, +1, +2], [1, 3, 4, 2]),
          sample([-1, 0, +1], [2, 6, 2]),
        ];
      case BranchType.dying:
        return [
          sample([-3, -2, -1, 0, +1, +2, +3], [1, 2, 3, 3, 3, 2, 1]),
          sample([-1, 0, +1], [2, 6, 2]),
        ];
      case BranchType.dead:
        return [sample([-1, 0, +1]), sample([-1, 0, +1], [3, 4, 3])];
    }
  }

  chooseColor(type: BranchType, win: NCursesWindow) {
    switch (type) {
      case BranchType.trunk:
      case BranchType.shootLeft:
      case BranchType.shootRight:
        if (Math.random() < 1 / 2) {
          win.setBold(true);
          win.setColorPair(11);
        } else {
          win.setColorPair(3);
        }
        break;
      case BranchType.dying:
        if (Math.random() < 1 / 10) win.setBold(true);
        win.setColorPair(2);
        break;
      case BranchType.dead:
        if (Math.random() < 1 / 3) win.setBold(true);
        win.setColorPair(10);
        break;
    }
  }

  chooseString(
    conf: Config,
    type: BranchType,
    life: number,
    dx: number,
    dy: number,
  ): string {
    if (life < 4) type = BranchType.dying;
    switch (type) {
      case BranchType.trunk:
        if (dy == 0) return "/~";
        if (dx < 0) return "\\|";
        if (dx > 0) return "|/";
        return "/|\\";
      case BranchType.shootLeft:
        if (dy > 0) return "\\";
        if (dy == 0) return "\\_";
        if (dx < 0) return "\\|";
        if (dx > 0) return "/";
        return "/|";
      case BranchType.shootRight:
        if (dy > 0) return "/";
        if (dy == 0) return "_/";
        if (dx < 0) return "\\|";
        if (dx > 0) return "/";
        return "/|";
      case BranchType.dying:
      case BranchType.dead:
        return conf.leaves[Math.floor(Math.random() * conf.leavesSize)];
    }
  }
}
