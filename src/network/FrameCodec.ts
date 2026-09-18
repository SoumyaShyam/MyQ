import { createHash } from 'node:crypto';
import { ProtocolError, ErrorCode } from '../shared/errors';

export class FrameCodec {
  public constructor(private readonly maxFrameBytes: number) {}
  public encode(value: unknown): Buffer { const payload = Buffer.from(JSON.stringify(value), 'utf8'); if (payload.length > this.maxFrameBytes) throw new ProtocolError(ErrorCode.PROTOCOL, 'Frame is too large'); const frame = Buffer.allocUnsafe(14 + payload.length); frame.write('MYQ1', 0, 4, 'ascii'); frame.writeUInt8(1, 4); frame.writeUInt8(0, 5); frame.writeUInt32BE(payload.length, 6); payload.copy(frame, 10); frame.writeUInt32BE(this.checksum(payload), 10 + payload.length); return frame; }
  public decode(buffer: Buffer): { value: unknown; remaining: Buffer } | undefined { if (buffer.length < 10) return undefined; if (buffer.toString('ascii', 0, 4) !== 'MYQ1' || buffer.readUInt8(4) !== 1) throw new ProtocolError(ErrorCode.PROTOCOL, 'Unsupported frame header'); const length = buffer.readUInt32BE(6); if (length > this.maxFrameBytes) throw new ProtocolError(ErrorCode.PROTOCOL, 'Frame is too large'); const frameLength = 14 + length; if (buffer.length < frameLength) return undefined; const payload = buffer.subarray(10, 10 + length); if (this.checksum(payload) !== buffer.readUInt32BE(10 + length)) throw new ProtocolError(ErrorCode.PROTOCOL, 'Frame checksum mismatch'); let value: unknown; try { value = JSON.parse(payload.toString('utf8')) as unknown; } catch (error) { throw new ProtocolError(ErrorCode.PROTOCOL, 'Invalid JSON frame', false, error); } return { value, remaining: buffer.subarray(frameLength) }; }
  private checksum(payload: Buffer): number { return createHash('sha256').update(payload).digest().readUInt32BE(0); }
}
