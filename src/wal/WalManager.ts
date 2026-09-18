import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ErrorCode, WalError } from '../shared/errors';
import type { TransactionId } from '../shared/types';

export interface LogRecord { lsn: number; txnId: TransactionId; operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'CATALOG' | 'COMMIT'; database: string; table: string; primaryKey?: string; payload: unknown; committed: boolean; }

export class WalManager {
  private lsn = 0;
  private filePath = '';
  public constructor(private readonly directory: string) {}
  public async open(): Promise<void> { await mkdir(this.directory, { recursive: true }); this.filePath = join(this.directory, 'wal.jsonl'); try { const records = await this.read(); this.lsn = records.at(-1)?.lsn ?? 0; } catch (error) { throw new WalError(ErrorCode.WAL, 'Unable to open WAL', false, error); } }
  public async append(record: Omit<LogRecord, 'lsn' | 'committed'>): Promise<LogRecord> { const item: LogRecord = { ...record, lsn: ++this.lsn, committed: false }; await this.write(item); return item; }
  public async commit(txnId: string, lsn: number): Promise<void> { await this.write({ lsn: ++this.lsn, txnId, operation: 'COMMIT', database: '', table: '', payload: { committedLsn: lsn }, committed: true }); }
  public async records(): Promise<LogRecord[]> { return this.read(); }
  public newTransactionId(): string { return randomUUID(); }
  public async close(): Promise<void> {}
  private async write(record: LogRecord): Promise<void> { try { const payload = Buffer.from(JSON.stringify(record), 'utf8'); const frame = Buffer.allocUnsafe(8 + payload.length); frame.writeUInt32BE(payload.length, 0); frame.writeUInt32BE(this.checksum(payload), 4); payload.copy(frame, 8); await appendFile(this.filePath, frame); } catch (error) { throw new WalError(ErrorCode.WAL, 'Unable to append WAL record', false, error); } }
  private async read(): Promise<LogRecord[]> { try { const content = await readFile(this.filePath); if (content[0] === 0x7b) return this.readLegacyJsonLines(content); const records: LogRecord[] = []; let offset = 0; while (offset < content.length) { if (content.length - offset < 8) throw new WalError(ErrorCode.WAL, 'Truncated WAL frame header'); const length = content.readUInt32BE(offset); const checksum = content.readUInt32BE(offset + 4); offset += 8; if (content.length - offset < length) throw new WalError(ErrorCode.WAL, 'Truncated WAL frame payload'); const payload = content.subarray(offset, offset + length); offset += length; if (this.checksum(payload) !== checksum) throw new WalError(ErrorCode.WAL, 'WAL checksum mismatch'); records.push(JSON.parse(payload.toString('utf8')) as LogRecord); } return records; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; if (error instanceof WalError) throw error; throw new WalError(ErrorCode.WAL, 'Unable to read WAL', false, error); } }
  private readLegacyJsonLines(content: Buffer): LogRecord[] { return content.toString('utf8').split('\n').filter(Boolean).map((line) => { const record = JSON.parse(line) as LogRecord; if (record.operation === 'CATALOG' && record.committed) return { ...record, operation: 'COMMIT', lsn: record.lsn + 1, payload: { committedLsn: record.lsn } }; return record; }); }
  private checksum(payload: Buffer): number { return createHash('sha256').update(payload).digest().readUInt32BE(0); }
}
