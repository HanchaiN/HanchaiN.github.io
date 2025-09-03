export class DragListY {
  constructor(
    private elem: HTMLElement,
    count: number,
    generator: (id: number) => HTMLElement = (id) => {
      const item = document.createElement("li");
      item.textContent = `Item ${id}`;
      return item;
    },
    id: number = 0,
  ) {
    this.elem.dataset.jsList = JSON.stringify({ listId: id });
    for (let j = 0; j < count; j++) {
      const item = generator(j);
      item.dataset.jsItem = JSON.stringify({ itemId: j, agent: id });
      item.draggable = true;
      this.elem.appendChild(item);
    }
    this.mountDragAndDrop();
  }

  private getDragAfterElement<T extends HTMLElement>(y: number): T | undefined {
    const items = [
      ...(this.elem.querySelectorAll<T>(
        "[data-js-item]:not(.dragging)",
      ) as unknown as Iterable<T>),
    ];

    return items.reduce<{ offset: number; element?: T }>(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY },
    ).element;
  }
  private mountDragAndDrop() {
    let draggedItem: HTMLElement | null = null;

    this.elem.addEventListener("dragstart", (event) => {
      draggedItem = event.target as HTMLElement;
      setTimeout(() => {
        (event.target as HTMLElement).style.display = "none";
      }, 0);
    });

    this.elem.addEventListener("dragend", () => {
      setTimeout(() => {
        draggedItem!.style.display = "block";
        draggedItem = null;
      }, 0);
    });

    this.elem.addEventListener("dragover", (event) => {
      event.preventDefault();
      const afterElement = this.getDragAfterElement(event.clientY);
      if (afterElement == null) {
        this.elem.appendChild(draggedItem!);
      } else {
        this.elem.insertBefore(draggedItem!, afterElement);
      }
    });

    this.elem.addEventListener("dragenter", (event) => {
      event.preventDefault();
      const afterElement = this.getDragAfterElement(event.clientY);
      if (afterElement == null) {
        this.elem.appendChild(draggedItem!);
      } else {
        this.elem.insertBefore(draggedItem!, afterElement);
      }
    });
  }

  get id(): number {
    return Number(JSON.parse(this.elem.dataset.jsList!).listId);
  }

  get ids(): number[] {
    const items = [
      ...(this.elem.querySelectorAll<HTMLElement>(
        "[data-js-item]",
      ) as unknown as Iterable<HTMLElement>),
    ];
    return items.map((item) => JSON.parse(item.dataset.jsItem!).itemId);
  }
}
