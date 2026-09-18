export class BPlusTree<K extends KValue, V> {
  private readonly entries = new Map<K, V>();
  public constructor(private readonly compare: (left: K, right: K) => number = defaultCompare) {}
  public search(key: K): V | undefined { return this.entries.get(key); }
  public contains(key: K): boolean { return this.entries.has(key); }
  public insert(key: K, value: V): void { this.entries.set(key, value); }
  public delete(key: K): boolean { return this.entries.delete(key); }
  public scan(start?: K, end?: K): Array<[K, V]> { return [...this.entries.entries()].sort(([left], [right]) => this.compare(left, right)).filter(([key]) => (start === undefined || this.compare(key, start) >= 0) && (end === undefined || this.compare(key, end) <= 0)); }
  public get size(): number { return this.entries.size; }
}

function defaultCompare(left: KValue, right: KValue): number { return left < right ? -1 : left > right ? 1 : 0; }

type KValue = string | number | bigint;
