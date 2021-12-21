export function assert(condition: boolean, error: string) {
  if (!condition) {
    throw new Error(error);
  }
}

export function assertNonNull<T>(value: T, label: string): NonNullable<T> {
  assert(
    value != undefined && value != null,
    `assert ${label} to be non-null, but is ${value}`
  );
  return value!!;
}

export type AllDeps = undefined;
export const AllDeps = undefined;

/**
 * Compare dependency arrays.
 * @param oldDeps
 * @param newDeps
 * @returns true if dependencies are considered equal
 */
export function unchangedDeps(
  oldDeps: any[] | AllDeps,
  newDeps: any[] | AllDeps
) {
  if (oldDeps === AllDeps || newDeps === AllDeps) {
    // if any of the dependencies are undefined. That means whole closure
    // is considered as dependency. Every call to state func will trigger
    // execution of the hook.
    return false;
  }
  if (newDeps.length != oldDeps.length) {
    return false;
  }
  return oldDeps.every((value, index) => Object.is(value, newDeps[index]));
}

export class ImmutableMapBuilder<KeyT, ValueT> {
  entry: [KeyT, ValueT] | null = null;
  previous: ImmutableMapBuilder<KeyT, ValueT> | null = null;
  parent: ImmutableMapBuilder<KeyT, ValueT> | null = null;
  private built: ImmutableMap<KeyT, ValueT> | null = null;

  constructor(
    entry: [KeyT, ValueT] | null = null,
    previous: ImmutableMapBuilder<KeyT, ValueT> | null = null,
    parent: ImmutableMapBuilder<KeyT, ValueT> | null = null
  ) {
    this.entry = entry;
    this.previous = previous;
    this.parent = parent;
    if (previous && parent) {
      throw new Error("Cannot set parent and previous at the same time");
    }
  }

  isEmpty() {
    return (
      this.entry === null && this.previous === null && this.parent === null
    );
  }

  set(key: KeyT, value: ValueT) {
    if (this.isEmpty()) {
      return new ImmutableMapBuilder<KeyT, ValueT>([key, value], null, null);
    }
    return new ImmutableMapBuilder<KeyT, ValueT>([key, value], this, null);
  }

  setParent(parent: ImmutableMapBuilder<KeyT, ValueT>) {
    if (this.isEmpty()) {
      return parent;
    }
    return new ImmutableMapBuilder<KeyT, ValueT>(this.entry, null, parent);
  }

  private *getEntriesReverse(): Generator<[KeyT, ValueT], void, undefined> {
    let current: ImmutableMapBuilder<KeyT, ValueT> | null = this;
    while (current) {
      if (current.entry) {
        yield current.entry;
      }
      if (current.parent) {
        current = current.parent;
      } else {
        current = current.previous;
      }
    }
  }

  *getEntries(): Generator<[KeyT, ValueT], void, undefined> {
    const entries = Array.from(this.getEntriesReverse());
    yield* entries.reverse();
  }

  build() {
    if (this.built) {
      return this.built;
    }
    const map = new Map<KeyT, ValueT>(this.getEntries());
    const built = (this.built = new ImmutableMap(map));
    return built;
  }
}
export class ImmutableMap<KeyT, ValueT> {
  private map: Map<KeyT, ValueT> = new Map();

  private static EMPTY_BUILDER = new ImmutableMapBuilder<any, any>();

  constructor(data: Map<KeyT, ValueT>) {
    this.copyFromData(data);
  }

  public static builder<KeyT, ValueT>(): ImmutableMapBuilder<KeyT, ValueT> {
    return ImmutableMap.EMPTY_BUILDER;
  }

  public get(key: KeyT) {
    return this.map.get(key);
  }

  public has(key: KeyT) {
    return this.map.has(key);
  }

  private copyFromData(data: Map<KeyT, ValueT>) {
    this.map = new Map([...this.map, ...data]);
  }
}

export class MultiMap<KeyT, ValueT> {
  private map: Map<KeyT, Set<ValueT>> = new Map();

  add(key: KeyT, value: ValueT) {
    if (!this.map.has(key)) {
      this.map.set(key, new Set());
    }
    this.map.get(key)?.add(value);
  }

  has(key: KeyT, value?: ValueT): boolean;
  has(key: KeyT, ...value: ValueT[]): boolean {
    if (value.length === 0) {
      return this.map.has(key);
    }
    return this.map.get(key)?.has(value[0]) ?? false;
  }

  delete(key: KeyT, value?: ValueT): void;
  delete(key: KeyT, ...value: ValueT[]) {
    if (!this.map.has(key)) {
      return;
    }
    if (this.map.has(key) && value.length === 0) {
      this.map.delete(key);
    }
    if (value.length === 1 && this.map.get(key)?.has(value[0])) {
      const set = this.map.get(key)!;
      set.delete(value[0]);
      if (set.size === 0) {
        this.delete(key);
      }
    }
  }

  get(key: KeyT): Set<ValueT> {
    return this.map.get(key) ?? new Set();
  }
}

export function isGenerator(value: any): value is Generator<any, any, any> {
  return (
    typeof value === "object" &&
    typeof value.next === "function" &&
    typeof value.return === "function" &&
    typeof value.throw === "function"
  );
}
