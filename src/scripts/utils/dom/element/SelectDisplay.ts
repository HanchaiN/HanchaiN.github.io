abstract class ConditionalDisplay<
  T,
  E1 extends HTMLElement,
  E2 extends HTMLElement = HTMLElement,
> {
  constructor(
    private _target: E1,
    private _container: E2,
    includeContainer = false,
  ) {
    this._target.addEventListener("change", (e) => {
      const value = this._getValue(e.target! as E1);
      if (includeContainer && this._container.hasAttribute("data-select")) {
        if (
          this._getSelection(this._container.getAttribute("data-select")!).some(
            (v) => v === value,
          )
        ) {
          this._container.hidden = false;
        } else {
          this._container.hidden = true;
        }
      }
      this._container
        .querySelectorAll<HTMLElement>(":scope > [data-select]")
        .forEach((el) => {
          if (
            this._getSelection(el.getAttribute("data-select")!).some(
              (v) => v === value,
            )
          ) {
            el.hidden = false;
          } else {
            el.hidden = true;
          }
        });
    });
    this._target.dispatchEvent(new Event("change"));
  }

  protected abstract _getValue(el: E1): T;
  protected abstract _setValue(el: E1, value: T): void;
  protected abstract _getSelection(attr: string): T[];
  get value(): T {
    return this._getValue(this._target);
  }
  set value(value: T) {
    this._setValue(this._target, value);
    this._target.dispatchEvent(new Event("change"));
  }
  get target(): E1 {
    return this._target;
  }
  get container(): E2 {
    return this._container;
  }
}

export class SelectDisplay<
  T extends string = string,
  E extends HTMLElement = HTMLElement,
> extends ConditionalDisplay<T, HTMLSelectElement, E> {
  constructor(_select: HTMLSelectElement, _container: E) {
    super(_select, _container, false);
  }

  protected _getValue(el: HTMLSelectElement): T {
    return el.value as T;
  }
  protected _setValue(el: HTMLSelectElement, value: T): void {
    el.value = value as string;
  }
  protected _getSelection(attr: string): T[] {
    return attr
      .split(" ")
      .filter(Boolean)
      .map((v) => v.trim() as T);
  }
}
export class CheckDisplay<
  E extends HTMLElement = HTMLElement,
> extends ConditionalDisplay<boolean, HTMLInputElement, E> {
  constructor(_check: HTMLInputElement, _container: E) {
    super(_check, _container, true);
  }
  protected _getValue(el: HTMLInputElement): boolean {
    return el.checked;
  }
  protected _setValue(el: HTMLInputElement, value: boolean): void {
    el.checked = value;
  }
  protected _getSelection(attr: string): boolean[] {
    if (attr === "") return [true];
    return attr
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .map((v) => v === "true" || v === "1");
  }
}
