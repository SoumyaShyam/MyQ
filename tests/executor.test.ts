import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { QueryService } from '../src/executor/QueryService';
import { IndexManager } from '../src/indexes/IndexManager';
import { SqlParser } from '../src/parser/SqlParser';
import { CatalogService } from '../src/storage/CatalogService';
import { FileStorageEngine } from '../src/storage/StorageEngine';
import { WalManager } from '../src/wal/WalManager';
import type { Principal } from '../src/shared/types';
import { MyQError } from '../src/shared/errors';

const principal: Principal = { subject: 'admin', username: 'admin', role: 'ADMIN', issuedAt: 0, expiresAt: Number.MAX_SAFE_INTEGER };

test('executor validates a complete multi-row insert before applying rows', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'myq-executor-'));
  const storage = new FileStorageEngine(join(directory, 'store.json')); await storage.open();
  const wal = new WalManager(join(directory, 'wal')); await wal.open();
  const catalog = new CatalogService(storage); const query = new QueryService(new SqlParser(), catalog, storage, new IndexManager(), wal);
  await query.execute('CREATE DATABASE app', 'app', principal);
  await query.execute('CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(255) UNIQUE)', 'app', principal);
  await expect(query.execute("INSERT INTO users VALUES (1, 'a'), (2, 'a')", 'app', principal)).rejects.toBeInstanceOf(MyQError);
  expect(await storage.scan('row/app/users/')).toHaveLength(0);
  await wal.close(); await storage.close(); await rm(directory, { recursive: true, force: true });
});

test('executor rejects primary-key updates and invalid values', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'myq-executor-'));
  const storage = new FileStorageEngine(join(directory, 'store.json')); await storage.open();
  const wal = new WalManager(join(directory, 'wal')); await wal.open();
  const catalog = new CatalogService(storage); const query = new QueryService(new SqlParser(), catalog, storage, new IndexManager(), wal);
  await query.execute('CREATE DATABASE app', 'app', principal);
  await query.execute('CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255) NOT NULL)', 'app', principal);
  await query.execute("INSERT INTO users VALUES (1, 'A')", 'app', principal);
  await expect(query.execute('UPDATE users SET id = 2 WHERE id = 1', 'app', principal)).rejects.toThrow('primary key');
  await expect(query.execute('INSERT INTO users VALUES (2, 10)', 'app', principal)).rejects.toThrow('Invalid value');
  await wal.close(); await storage.close(); await rm(directory, { recursive: true, force: true });
});
