export class SelectDisplay<T extends string = string> {
  constructor(
    private _select: HTMLSelectElement,
    private _display: HTMLElement,
    separator: string = ",",
  ) {
    this._select.addEventListener("change", (e) => {
      const value = (e.target! as HTMLSelectElement).value.trim();
      this._display
        .querySelectorAll<HTMLElement>("[data-select]")
        .forEach((el) => {
          const elValue = el.getAttribute("data-select")!;
          if (elValue.split(separator).some((v) => v.trim() === value)) {
            el.hidden = false;
          } else {
            el.hidden = true;
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
