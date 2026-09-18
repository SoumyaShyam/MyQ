import { FrameCodec } from '../src/network/FrameCodec';
import { ProtocolError } from '../src/shared/errors';

test('protocol frames include the MYQ1 header and reject checksum changes', () => {
  const codec = new FrameCodec(1024); const frame = codec.encode({ type: 'PING' });
  expect(frame.toString('ascii', 0, 4)).toBe('MYQ1'); expect(frame.readUInt8(4)).toBe(1);
  frame[10] = (frame[10] ?? 0) ^ 1;
  expect(() => codec.decode(frame)).toThrow(ProtocolError);
});
