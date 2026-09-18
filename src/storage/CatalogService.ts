import { ErrorCode, MyQError } from '../shared/errors';
import type { TableDefinition } from '../shared/types';
import type { StorageEngine } from './StorageEngine';

export class CatalogService {
  public constructor(private readonly storage: StorageEngine) {}
  public async createDatabase(name: string): Promise<void> { const key = `meta/db/${name}`; if (await this.storage.get(key)) throw new MyQError(ErrorCode.ALREADY_EXISTS, `Database ${name} already exists`); await this.storage.put(key, Buffer.from(JSON.stringify({ name, createdAt: new Date().toISOString() }))); }
  public async databaseExists(name: string): Promise<boolean> { return (await this.storage.get(`meta/db/${name}`)) !== undefined; }
  public async listDatabases(): Promise<string[]> { const entries = await this.storage.scan('meta/db/'); return entries.map((entry) => JSON.parse(entry.value.toString('utf8')) as { name: string }).map((database) => database.name); }
  public async createTable(definition: TableDefinition): Promise<void> { const key = this.tableKey(definition.database, definition.name); if (await this.storage.get(key)) throw new MyQError(ErrorCode.ALREADY_EXISTS, `Table ${definition.name} already exists`); await this.storage.put(key, Buffer.from(JSON.stringify(definition))); }
  public async getTable(database: string, table: string): Promise<TableDefinition> { const value = await this.storage.get(this.tableKey(database, table)); if (!value) throw new MyQError(ErrorCode.NOT_FOUND, `Table ${database}.${table} does not exist`); return JSON.parse(value.toString('utf8')) as TableDefinition; }
  public async dropTable(database: string, table: string): Promise<void> { await this.storage.delete(this.tableKey(database, table)); }
  public async listTables(database: string): Promise<TableDefinition[]> { const entries = await this.storage.scan(`meta/table/${database}/`); return entries.map((entry) => JSON.parse(entry.value.toString('utf8')) as TableDefinition); }
  private tableKey(database: string, table: string): string { return `meta/table/${database}/${table}`; }
}
