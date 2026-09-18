import { FrameCodec } from '../src/network/FrameCodec';

test('frame codec handles partial and complete frames', () => {
  const codec = new FrameCodec(1024); const frame = codec.encode({ type: 'PING', requestId: '1' });
  expect(codec.decode(frame.subarray(0, 2))).toBeUndefined();
  const decoded = codec.decode(frame); expect(decoded?.value).toEqual({ type: 'PING', requestId: '1' }); expect(decoded?.remaining.length).toBe(0);
});
