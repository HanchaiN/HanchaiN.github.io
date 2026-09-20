export class Namespace<T, K0 extends keyof T = never> {
  private readonly _namespace?: Partial<T>;
  private readonly _gen?: {
    [K in keyof T]?: (cache: Namespace<T, K0 | K>) => T[K];
  };
  private readonly _depBy?: Map<keyof T, Set<keyof T>>;

  protected readonly _deps: Set<Exclude<keyof T, K0>>;
  protected readonly _excluded: Set<K0>;

  protected get namespace(): NonNullable<Namespace<T, K0>["_namespace"]> {
    if (this._proxy) return this._proxy.namespace;
    return this._namespace!;
  }
  protected get gen(): NonNullable<Namespace<T, K0>["_gen"]> {
    if (this._proxy)
      return this._proxy.gen as NonNullable<Namespace<T, K0>["_gen"]>;
    return this._gen!;
  }
  protected get depBy(): NonNullable<Namespace<T, K0>["_depBy"]> {
    if (this._proxy) return this._proxy.depBy;
    return this._depBy!;
  }

  public static create<T>() {
    return new Namespace<T>();
  }

  private constructor(
    private readonly _proxy?: K0 extends never ? never : Namespace<T>,
    excluded?: Iterable<K0>,
  ) {
    if (!this._proxy) {
      this._namespace = {};
      this._gen = {};
      this._depBy = new Map();
    }
    this._deps = new Set();
    this._excluded = new Set(excluded ?? []);
  }
  private getProxy<K extends Exclude<keyof T, K0>>(prop: K) {
    const proxy = new Namespace<T, K0 | K>(
      (this._proxy ?? this) as K0 extends never ? never : Namespace<T>,
      this._excluded.union(new Set([prop])),
    );
    return proxy;
  }
  get<K extends Exclude<keyof T, K0>>(prop: K): T[K] | null {
    if (this._excluded.has(prop as keyof T as K0))
      throw new Error("Circular dependency");
    this._deps.add(prop);
    const v = this.namespace[prop];
    if (typeof v !== "undefined") return v;
    if (!this.gen[prop]) return null;
    const proxy = this.getProxy(prop);
    const v_ = this.gen[prop](proxy);
    return this._set(prop, v_, proxy._deps);
  }
  refresh<K extends Exclude<keyof T, K0>>(prop: K) {
    this.remove(prop);
    return this.get(prop);
  }
  remove<K extends keyof T>(prop: K) {
    this.updated(prop);
    delete this.namespace[prop];
  }
  updated<K extends keyof T>(prop: K) {
    this.depBy.forEach((deps) => {
      deps.delete(prop);
    });
    this.depBy.get(prop)?.forEach((p) => {
      this.remove(p);
    });
    this.depBy.delete(prop);
  }
  private _set<K extends keyof T>(
    prop: K,
    value: T[K],
    deps: Set<Exclude<keyof T, K0 | K>> | null = null,
  ) {
    this.updated(prop);
    this.namespace[prop] = value;
    deps?.forEach((p) => {
      if (!this.depBy.has(p)) this.depBy.set(p, new Set());
      this.depBy.get(p)!.add(prop);
    });
    return value;
  }
  set<K extends keyof T>(prop: K, value: T[K]) {
    return this._set(prop, value);
  }
  setGen<K extends Exclude<keyof T, K0>>(
    prop: K,
    gen: (cache: Namespace<T, K0 | K>) => T[K],
    init: boolean = true,
  ) {
    this.gen[prop] = gen;
    this.remove(prop);
    return init ? this.get(prop) : null;
  }
}
