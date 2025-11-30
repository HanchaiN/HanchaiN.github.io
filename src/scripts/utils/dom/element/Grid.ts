export class Grid2D {
  private listeners: ((grid: Grid2D) => void)[];
  constructor(
    private sizeInput: HTMLInputElement,
    private container: HTMLTableElement,
  ) {
    this.listeners = [];
    this.sizeInput.addEventListener("change", () => this.update());
    this.update();
  }

  private update() {
    const n = this.sizeInput.valueAsNumber;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const row = document.createElement("tr");
      for (let j = 0; j < n; j++) {
        const cell = this.get(i, j) ?? document.createElement("td");
        this.get(i, j)?.parentNode?.replaceChild(
          document.createElement("td"),
          cell,
        );
        row.appendChild(cell);
      }
      fragment.appendChild(row);
    }
    this.container.replaceChildren(fragment);
    this.listeners.forEach((x) => x(this));
  }

  get(i: number, j: number): HTMLTableCellElement | null {
    const row = this.container.rows.item(i);
    if (!row) return null;
    return row.cells.item(j);
  }

  get size(): number {
    return this.sizeInput.valueAsNumber;
  }
  set size(n: number) {
    this.sizeInput.value = n.toString();
    this.update();
  }

  get matrix(): HTMLTableCellElement[][] {
    return Array.from(this.container.rows).map((row) => Array.from(row.cells));
  }

  addChangeHandler(callback: (grid: Grid2D) => void) {
    this.listeners.push(callback);
  }

  removeChangeHandler(callback: (grid: Grid2D) => void) {
    this.listeners = this.listeners.filter((x) => x !== callback);
  }
}
