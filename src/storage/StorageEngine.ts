import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ErrorCode, StorageError } from '../shared/errors';

export interface KeyValue { key: string; value: Buffer; }
export interface StorageBatch { puts: Array<{ key: string; value: Buffer }>; deletes: string[]; }

export interface StorageEngine {
  open(): Promise<void>;
  close(): Promise<void>;
  get(key: string): Promise<Buffer | undefined>;
  put(key: string, value: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
  scan(prefix: string): Promise<KeyValue[]>;
  writeBatch(batch: StorageBatch): Promise<void>;
}

interface PersistedStore { [key: string]: string; }

export class FileStorageEngine implements StorageEngine {
  private readonly values = new Map<string, Buffer>();
  private opened = false;
  public constructor(private readonly filePath: string) {}

  public async open(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const stored = JSON.parse(await readFile(this.filePath, 'utf8')) as PersistedStore;
      for (const [key, value] of Object.entries(stored)) this.values.set(key, Buffer.from(value, 'base64'));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw new StorageError(ErrorCode.STORAGE, `Unable to open storage: ${this.filePath}`, false, error);
    }
    this.opened = true;
  }

  public async close(): Promise<void> { if (this.opened) await this.persist(); this.opened = false; }
  public async get(key: string): Promise<Buffer | undefined> { this.assertOpen(); return this.values.get(key); }
  public async put(key: string, value: Buffer): Promise<void> { await this.writeBatch({ puts: [{ key, value }], deletes: [] }); }
  public async delete(key: string): Promise<void> { await this.writeBatch({ puts: [], deletes: [key] }); }
  public async scan(prefix: string): Promise<KeyValue[]> { this.assertOpen(); return [...this.values.entries()].filter(([key]) => key.startsWith(prefix)).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => ({ key, value })); }
  public async writeBatch(batch: StorageBatch): Promise<void> { this.assertOpen(); for (const key of batch.deletes) this.values.delete(key); for (const item of batch.puts) this.values.set(item.key, item.value); await this.persist(); }

  private async persist(): Promise<void> { const output: PersistedStore = {}; for (const [key, value] of this.values) output[key] = value.toString('base64'); const temporaryPath = `${this.filePath}.tmp`; await writeFile(temporaryPath, JSON.stringify(output), 'utf8'); await rename(temporaryPath, this.filePath); }
  private assertOpen(): void { if (!this.opened) throw new StorageError(ErrorCode.STORAGE, 'Storage engine is not open'); }
}

export class RocksDbStorageEngine extends FileStorageEngine {
  public readonly backend = 'rocksdb-compatible-adapter';
}
