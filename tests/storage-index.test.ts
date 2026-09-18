import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStorageEngine } from '../src/storage/StorageEngine';
import { BPlusTree } from '../src/indexes/BPlusTree';

describe('storage and indexes', () => {
  test('persists values across engine reopen', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'myq-'));
    const path = join(directory, 'store.json');
    const first = new FileStorageEngine(path); await first.open(); await first.put('row/1', Buffer.from('{"id":1}')); await first.close();
    const second = new FileStorageEngine(path); await second.open(); expect((await second.get('row/1'))?.toString()).toBe('{"id":1}'); await second.close(); await rm(directory, { recursive: true, force: true });
  });
  test('maintains ordered B+ tree operations', () => {
    const tree = new BPlusTree<number, string>(); tree.insert(3, 'c'); tree.insert(1, 'a'); tree.insert(2, 'b'); expect(tree.search(2)).toBe('b'); expect(tree.scan()).toEqual([[1, 'a'], [2, 'b'], [3, 'c']]); expect(tree.delete(2)).toBe(true); expect(tree.contains(2)).toBe(false);
  });
});
