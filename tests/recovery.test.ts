import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStorageEngine } from '../src/storage/StorageEngine';
import { RecoveryManager } from '../src/wal/RecoveryManager';
import { WalManager } from '../src/wal/WalManager';

test('recovery replays committed row mutations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'myq-recovery-'));
  const storage = new FileStorageEngine(join(directory, 'store.json')); await storage.open();
  const wal = new WalManager(join(directory, 'wal')); await wal.open();
  const record = await wal.append({ txnId: 'txn-1', operation: 'INSERT', database: 'app', table: 'users', primaryKey: '1', payload: { id: 1, name: 'Soumya' } }); await wal.commit('txn-1', record.lsn);
  expect(await storage.get('row/app/users/1')).toBeUndefined();
  expect(await new RecoveryManager(wal, storage).recover()).toBe(1);
  expect((await storage.get('row/app/users/1'))?.toString()).toContain('Soumya');
  await wal.close(); await storage.close(); await rm(directory, { recursive: true, force: true });
});
