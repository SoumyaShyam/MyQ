import { ErrorCode, MyQError } from '../shared/errors';
import type { Row, TableDefinition } from '../shared/types';
import { BPlusTree } from './BPlusTree';

export interface TableIndexes { primary: BPlusTree<string, Row>; unique: Map<string, BPlusTree<string, string>>; }

export class IndexManager {
  private readonly indexes = new Map<string, TableIndexes>();
  public createTableIndexes(definition: TableDefinition): void { const unique = new Map<string, BPlusTree<string, string>>(); for (const column of definition.uniqueColumns) unique.set(column, new BPlusTree<string, string>()); this.indexes.set(this.key(definition.database, definition.name), { primary: new BPlusTree<string, Row>(), unique }); }
  public getTableIndexes(definition: TableDefinition): TableIndexes { const value = this.indexes.get(this.key(definition.database, definition.name)); if (!value) { this.createTableIndexes(definition); return this.indexes.get(this.key(definition.database, definition.name)) as TableIndexes; } return value; }
  public insert(definition: TableDefinition, primaryKey: string, row: Row): void { const indexes = this.getTableIndexes(definition); if (indexes.primary.contains(primaryKey)) throw new MyQError(ErrorCode.PRIMARY_KEY_CONFLICT, `Primary key ${primaryKey} already exists`); for (const column of definition.uniqueColumns) { const value = row[column]; if (value !== null && value !== undefined && indexes.unique.get(column)?.contains(String(value))) throw new MyQError(ErrorCode.UNIQUE_CONFLICT, `Unique value for ${column} already exists`); } indexes.primary.insert(primaryKey, row); for (const column of definition.uniqueColumns) { const value = row[column]; if (value !== null && value !== undefined) indexes.unique.get(column)?.insert(String(value), primaryKey); } }
  public validateInsert(definition: TableDefinition, primaryKey: string, row: Row): void { const indexes = this.getTableIndexes(definition); if (indexes.primary.contains(primaryKey)) throw new MyQError(ErrorCode.PRIMARY_KEY_CONFLICT, `Primary key ${primaryKey} already exists`); for (const column of definition.uniqueColumns) { const value = row[column]; if (value !== null && value !== undefined && indexes.unique.get(column)?.contains(String(value))) throw new MyQError(ErrorCode.UNIQUE_CONFLICT, `Unique value for ${column} already exists`); } }
  public update(definition: TableDefinition, primaryKey: string, oldRow: Row, newRow: Row): void { this.delete(definition, primaryKey, oldRow); try { this.insert(definition, primaryKey, newRow); } catch (error) { this.insert(definition, primaryKey, oldRow); throw error; } }
  public delete(definition: TableDefinition, primaryKey: string, row: Row): void { const indexes = this.getTableIndexes(definition); indexes.primary.delete(primaryKey); for (const column of definition.uniqueColumns) { const value = row[column]; if (value !== null && value !== undefined) indexes.unique.get(column)?.delete(String(value)); } }
  public scan(definition: TableDefinition): Array<[string, Row]> { return this.getTableIndexes(definition).primary.scan(); }
  public dropTableIndexes(definition: TableDefinition): void { this.indexes.delete(this.key(definition.database, definition.name)); }
  private key(database: string, table: string): string { return `${database}.${table}`; }
}
