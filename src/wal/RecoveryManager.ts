import { ErrorCode, MyQError } from '../shared/errors';
import type { Row } from '../shared/types';
import type { StorageEngine } from '../storage/StorageEngine';
import { WalManager, type LogRecord } from './WalManager';

export class RecoveryManager {
  public constructor(private readonly wal: WalManager, private readonly storage: StorageEngine) {}
  public async recover(): Promise<number> {
    const records = await this.wal.records();
    const committed = new Set(records.filter((record) => record.operation === 'COMMIT').map((record) => String((record.payload as { committedLsn: number }).committedLsn)));
    let replayed = 0;
    for (const record of records.filter((item) => item.operation !== 'COMMIT' && committed.has(String(item.lsn)))) {
      await this.replay(record);
      replayed += 1;
    }
    return replayed;
  }
  private async replay(record: LogRecord): Promise<void> {
    if (!record.primaryKey || !record.database || !record.table) throw new MyQError(ErrorCode.WAL, `Invalid WAL mutation at LSN ${record.lsn}`);
    const key = `row/${record.database}/${record.table}/${record.primaryKey}`;
    if (record.operation === 'DELETE') await this.storage.delete(key);
    else if (record.operation === 'INSERT' || record.operation === 'UPDATE') await this.storage.put(key, Buffer.from(JSON.stringify(record.payload as Row)));
  }
}