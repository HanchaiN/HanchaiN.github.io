export interface IBasePriorityQueue<A> {
  top(): A | null;
  pop(): A | null;
  push(item: A): void;
}
// TODO: Manage inheritance such that (How does TS works?)
// - Priority: (<A>{new (compare)}) => <A>{new (priority)}
// - Ordered: (<A&...>{new (compare)}) => <A>{new (compare)}
// - Ordered: (<A&...>{new (priority)}) => <A>{new (priority)}

// Lowest top
export class ComparePriorityQueue<A> implements IBasePriorityQueue<A> {
  private _heap: A[];
  private _compare: (a: A, b: A) => number;
  constructor(compare: (first: A, second: A) => number) {
    this._heap = [];
    this._compare = compare;
  }

  top() {
    if (this._heap.length === 0) {
      return null;
    }
    return this._heap[0]!;
  }

  pop() {
    if (this._heap.length === 0) {
      return null;
    }
    const item = this._heap.at(0)!;
    this._heap[0] = this._heap.at(-1)!;
    this._heap.pop();
    this._heapifyDown();
    return item;
  }

  push(item: A) {
    this._heap.push(item);
    this._heapifyUp();
  }

  private _heapifyUp() {
    let index = this._heap.length - 1;
    while (
      this._hasParent(index) &&
      this._compare(this._parent(index)!, this._heap[index]!) > 0
    ) {
      this._swap(this._getParentIndex(index), index);
      index = this._getParentIndex(index);
    }
  }

  private _heapifyDown() {
    let index = 0;
    while (this._hasLeftChild(index)) {
      let smallerChildIndex = this._getLeftChildIndex(index);
      if (
        this._hasRightChild(index) &&
        this._compare(this._rightChild(index)!, this._leftChild(index)!) < 0
      ) {
        smallerChildIndex = this._getRightChildIndex(index);
      }
      if (this._heap[index]! < this._heap[smallerChildIndex]!) {
        break;
      } else {
        this._swap(index, smallerChildIndex);
      }
      index = smallerChildIndex;
    }
  }

  private _getLeftChildIndex(parentIndex: number) {
    return 2 * parentIndex + 1;
  }

  private _getRightChildIndex(parentIndex: number) {
    return 2 * parentIndex + 2;
  }

  private _getParentIndex(childIndex: number) {
    return Math.floor((childIndex - 1) / 2);
  }

  private _hasLeftChild(index: number) {
    return this._getLeftChildIndex(index) < this._heap.length;
  }

  private _hasRightChild(index: number) {
    return this._getRightChildIndex(index) < this._heap.length;
  }

  private _hasParent(index: number) {
    return this._getParentIndex(index) >= 0;
  }

  private _leftChild(index: number) {
    return this._heap[this._getLeftChildIndex(index)];
  }

  private _rightChild(index: number) {
    return this._heap[this._getRightChildIndex(index)];
  }

  private _parent(index: number) {
    return this._heap[this._getParentIndex(index)];
  }

  private _swap(indexOne: number, indexTwo: number) {
    if (
      0 > indexOne ||
      indexOne >= this._heap.length ||
      0 > indexTwo ||
      indexTwo >= this._heap.length
    )
      throw RangeError("Out-of-range");
    const temp = this._heap[indexOne]!;
    this._heap[indexOne] = this._heap[indexTwo]!;
    this._heap[indexTwo] = temp;
  }
}
export class PriorityQueue<A> extends ComparePriorityQueue<A> {
  constructor(priority: (item: A) => number) {
    super((a, b) => priority(a) - priority(b));
  }
}

abstract class BaseWrappedPriorityQueue<A, T> implements IBasePriorityQueue<A> {
  private _queue: IBasePriorityQueue<T>;
  constructor(q: IBasePriorityQueue<T>) {
    this._queue = q;
  }
  protected abstract _map(item: A): T;
  protected abstract _unmap(elem: T): A;
  top() {
    const elem = this._queue.top();
    if (elem === null) return null;
    return this._unmap(elem);
  }
  pop() {
    const elem = this._queue.pop();
    if (elem === null) return null;
    return this._unmap(elem);
  }
  push(item: A) {
    return this._queue.push(this._map(item));
  }
}
abstract class CompareWrappedPriorityQueue<
  A,
  T,
> extends BaseWrappedPriorityQueue<A, T> {
  constructor(compare: (first: T, second: T) => number) {
    super(new ComparePriorityQueue(compare));
  }
}
abstract class PriorityWrappedPriorityQueue<
  A,
  T,
> extends BaseWrappedPriorityQueue<A, T> {
  constructor(priority: (item: T) => number) {
    super(new PriorityQueue(priority));
  }
}
export class OrderedPriorityQueue<A> extends CompareWrappedPriorityQueue<
  A,
  { index: number; item: A }
> {
  private _index: number;
  constructor(compare: (a: A, b: A) => number) {
    super((a, b) => a.index - b.index || compare(a.item, b.item));
    this._index = 0;
  }
  protected override _map(item: A): { index: number; item: A } {
    return {
      index: ++this._index,
      item,
    };
  }
  protected override _unmap(elem: { index: number; item: A }): A {
    return elem.item;
  }
}

export class CachedPriorityQueue<A> extends PriorityWrappedPriorityQueue<
  A,
  { priority?: number; item: A }
> {
  constructor(priority: (item: A) => number) {
    super((a) =>
      typeof a.priority === "number"
        ? a.priority
        : (a.priority = priority(a.item)),
    );
  }
  protected override _map(item: A): { item: A } {
    return {
      item,
    };
  }
  protected override _unmap(elem: { item: A }): A {
    return elem.item;
  }
}

export function binarySearch(
  arr: number[],
  targetL: number,
  targetH: number = targetL,
): number {
  const [l, h] = binarySearchBound(arr, targetL, targetH);
  if (l === h) return l;
  return -1;
}
export function binarySearchBound(
  arr: number[],
  targetL: number,
  targetH: number = targetL,
): [number, number] {
  let low = 0;
  let high = arr.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midVal = arr[mid]!;
    if (midVal < targetL) {
      low = mid + 1;
    } else if (midVal > targetH) {
      high = mid - 1;
    } else {
      return [mid, mid];
    }
  }
  return [high, low];
}
