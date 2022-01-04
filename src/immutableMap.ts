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
    return new ImmutableMapBuilder<KeyT, ValueT>(null, this, parent);
  }

  *getEntriesReverse(): Generator<[KeyT, ValueT], void, undefined> {
    if (this.entry) {
      yield this.entry;
    }
    if (this.previous) {
      yield* this.previous.getEntriesReverse();
    }
    if (this.parent) {
      yield* this.parent.getEntriesReverse();
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
