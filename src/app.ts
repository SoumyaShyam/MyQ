import { join } from 'node:path';
import { AuthService } from './auth/AuthService';
import { ConfigProvider, type MyQConfig } from './config/ConfigProvider';
import { IndexManager } from './indexes/IndexManager';
import { SqlParser } from './parser/SqlParser';
import { QueryService } from './executor/QueryService';
import { TcpServer } from './network/TcpServer';
import { CatalogService } from './storage/CatalogService';
import { FileStorageEngine } from './storage/StorageEngine';
import { WalManager } from './wal/WalManager';
import { RecoveryManager } from './wal/RecoveryManager';

export class MyQApplication {
  private readonly storage: FileStorageEngine;
  private readonly wal: WalManager;
  private readonly server: TcpServer;
  public constructor(private readonly config: MyQConfig = ConfigProvider.load()) {
    this.storage = new FileStorageEngine(join(config.storage.dataDir, 'store.json'));
    this.wal = new WalManager(config.wal.walDir);
    const catalog = new CatalogService(this.storage);
    const indexes = new IndexManager();
    const auth = new AuthService(this.storage, config.auth.jwtSecret, config.auth.jwtTtlSeconds, config.auth.bcryptRounds);
    const query = new QueryService(new SqlParser(), catalog, this.storage, indexes, this.wal, auth);
    this.catalog = catalog;
    this.indexes = indexes;
    this.server = new TcpServer(config.server.host, config.server.port, config.server.maxFrameBytes, auth, query);
    this.auth = auth;
  }
  private readonly auth: AuthService;
  private readonly catalog: CatalogService;
  private readonly indexes: IndexManager;
  public async start(): Promise<void> { await this.storage.open(); await this.wal.open(); await new RecoveryManager(this.wal, this.storage).recover(); await this.auth.ensureAdmin(); await this.rebuildIndexes(); await this.server.start(); }
  public async stop(): Promise<void> { await this.server.stop(); await this.wal.close?.(); await this.storage.close(); }
  private async rebuildIndexes(): Promise<void> { for (const database of await this.catalog.listDatabases()) for (const table of await this.catalog.listTables(database)) { this.indexes.createTableIndexes(table); for (const entry of await this.storage.scan(`row/${table.database}/${table.name}/`)) { const row = JSON.parse(entry.value.toString('utf8')) as Record<string, string | number | boolean | null>; this.indexes.insert(table, String(row[table.primaryKey]), row); } } }
}
