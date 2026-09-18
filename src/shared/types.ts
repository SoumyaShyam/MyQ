export type SqlValue = null | boolean | number | string | Date;
export type Row = Record<string, SqlValue>;
export type DatabaseName = string;
export type TableName = string;
export type Lsn = bigint;
export type TransactionId = string;

export interface ColumnDefinition {
  name: string;
  dataType: 'INT' | 'VARCHAR' | 'BOOLEAN' | 'TIMESTAMP';
  length?: number;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
}

export interface TableDefinition {
  database: string;
  name: string;
  columns: ColumnDefinition[];
  primaryKey: string;
  uniqueColumns: string[];
  schemaVersion: number;
  createdAt: string;
}

export interface QueryResult {
  columns: string[];
  rows: Row[];
  affectedRows?: number;
  lastInsertId?: string;
}

export interface Principal {
  subject: string;
  username: string;
  role: 'ADMIN' | 'USER';
  issuedAt: number;
  expiresAt: number;
}
