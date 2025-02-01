export interface Rule<State, Entry> {
  states: State[];
  entries: Entry[];
  null_symbol: Entry;
  operation_table: Map<
    State,
    Map<
      Entry,
      {
        state: State;
        symbol: Entry;
        direction: "R" | "L" | "N";
      }
    >
  >;
  initial_state: State;
}
export class TuringMachine<State, Entry> {
  rule!: Rule<State, Entry>;
  pointer!: number;
  state!: State;
  tape!: Entry[];
  constructor(rule: Rule<State, Entry>) {
    if (
      rule.states.length == 0 ||
      rule.entries.length == 0 ||
      !rule.entries.includes(rule.null_symbol) ||
      !rule.states.includes(rule.initial_state)
    ) {
      this.error();
      return;
    }
    this.rule = rule;
  }
  init(inp: Entry[]) {
    this.pointer = 0;
    this.state = this.rule.initial_state;
    if (
      !inp.every(
        function (this: TuringMachine<State, Entry>, entry: Entry) {
          return this.rule.entries.includes(entry);
        }.bind(this),
      )
    ) {
      this.error();
      return false;
    }
    this.tape = inp;
    this.tape.push(this.rule.null_symbol);
  }
  read(index: number) {
    while (index < 0) {
      this.tape = ([] as Array<Entry>).concat(
        new Array(this.tape.length).fill(null).map(() => this.rule.null_symbol),
        this.tape,
      );
      this.pointer += this.tape.length;
      index += this.tape.length;
    }
    while (index >= this.tape.length) {
      this.tape = ([] as Array<Entry>).concat(
        this.tape,
        new Array(this.tape.length).fill(null).map(() => this.rule.null_symbol),
      );
    }
    return this.tape[index];
  }
  calculate() {
    const ins = this.rule.operation_table
      .get(this.state)
      ?.get(this.read(this.pointer));
    if (!ins) {
      console.log("HALTED");
      return false;
    }
    if (
      !this.rule.states.includes(ins.state) ||
      !this.rule.entries.includes(ins.symbol) ||
      !["L", "R", "N"].includes(ins.direction)
    ) {
      this.error();
      return false;
    }
    this.tape[this.pointer] = ins.symbol;
    switch (ins.direction) {
      case "R":
        this.pointer--;
        break;
      case "L":
        this.pointer++;
        break;
      case "N":
        break;
    }
    this.state = ins.state;
    return true;
  }
  error() {
    console.error("ERROR");
  }
}
