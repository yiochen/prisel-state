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

export class ImmutableMap<KeyT, ValueT> {
  private map: Map<KeyT, ValueT> = new Map();

  constructor(data: Map<KeyT, ValueT>) {
    this.copyFromData(data);
  }

  public static builder<KeyT, ValueT>(): ImmutableMapBuilder<KeyT, ValueT> {
    return new ImmutableMapBuilder<KeyT, ValueT>([]);
  }

  public get(key: KeyT) {
    return this.map.get(key);
  }

  public has(key: KeyT) {
    return this.map.has(key);
  }

  private copyFromData(data: Map<KeyT, ValueT>) {
    for (const [key, value] of data) {
      this.map.set(key, value);
    }
  }
}

export class ImmutableMapBuilder<KeyT, ValueT> {
  private length = 0;
  private entries: Array<[KeyT, ValueT]> = [];
  private parent: ImmutableMapBuilder<KeyT, ValueT> | null;

  constructor(
    entries: Array<[KeyT, ValueT]>,
    length = entries.length,
    parent: ImmutableMapBuilder<KeyT, ValueT> | null = null
  ) {
    this.entries = entries;
    this.length = length;
    this.parent = parent;
  }

  isEmpty() {
    return this.entries.length === 0 && (this.parent?.length ?? 0) === 0;
  }

  set(key: KeyT, value: ValueT) {
    this.entries.push([key, value]);
    return new ImmutableMapBuilder<KeyT, ValueT>(this.entries);
  }

  *getEntries(): Generator<[KeyT, ValueT]> {
    if (this.parent !== null) {
      yield* this.parent.getEntries();
    }
    for (let i = 0; i < this.length; i++) {
      yield this.entries[i];
    }
  }

  setParent(parent: ImmutableMapBuilder<KeyT, ValueT>) {
    return new ImmutableMapBuilder<KeyT, ValueT>(
      this.entries,
      this.length,
      parent
    );
  }

  build() {
    const map = new Map<KeyT, ValueT>();
    for (const [key, value] of this.getEntries()) {
      map.set(key, value);
    }
    return new ImmutableMap(map);
  }
}
