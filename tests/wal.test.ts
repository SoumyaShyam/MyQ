import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WalManager } from '../src/wal/WalManager';

test('WAL records survive reopen and continue LSNs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'myq-wal-'));
  const first = new WalManager(directory); await first.open(); const record = await first.append({ txnId: 'txn-1', operation: 'INSERT', database: 'app', table: 'users', primaryKey: '1', payload: { id: 1 } }); await first.commit('txn-1', record.lsn); await first.close();
  const second = new WalManager(directory); await second.open(); const records = await second.records(); expect(records).toHaveLength(2); expect(records[0]?.lsn).toBe(1); await second.close(); await rm(directory, { recursive: true, force: true });
});
