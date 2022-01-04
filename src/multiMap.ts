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
