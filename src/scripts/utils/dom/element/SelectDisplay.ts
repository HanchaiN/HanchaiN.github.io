export class SelectDisplay<T extends string = string> {
  private _select: HTMLSelectElement;
  private _display: HTMLElement;

  constructor(
    select: HTMLSelectElement,
    container: HTMLElement,
    separator: string = ",",
  ) {
    this._select = select;
    this._display = container;
    this._select.addEventListener("change", (e) => {
      const value = (e.target! as HTMLSelectElement).value.trim();
      this._display.querySelectorAll("[data-select]").forEach((el) => {
        const elValue = el.getAttribute("data-select")!;
        if (elValue.split(separator).some((v) => v.trim() === value)) {
          el.classList.remove("d-none");
        } else {
          el.classList.add("d-none");
        }
      });
    });
    this._select.dispatchEvent(new Event("change"));
  }

  get value(): T {
    return this._select.value as T;
  }
  set value(value: T) {
    this._select.value = value;
    this._select.dispatchEvent(new Event("change"));
  }
  get display(): HTMLElement {
    return this._display;
  }
}
