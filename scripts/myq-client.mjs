import net from 'node:net';
import { createHash } from 'node:crypto';

const host = process.env.MYQ_HOST ?? '127.0.0.1';
const port = Number(process.env.MYQ_PORT ?? 3306);
const username = process.env.MYQ_USER ?? 'admin';
const password = process.env.MYQ_PASSWORD ?? 'admin';
const database = process.env.MYQ_DATABASE ?? 'app';
const sql = process.argv.slice(2).join(' ') || 'SELECT * FROM users';

function checksum(payload) {
  return createHash('sha256').update(payload).digest().readUInt32BE(0);
}

function frame(value) {
  const payload = Buffer.from(JSON.stringify(value), 'utf8');
  const output = Buffer.alloc(14 + payload.length);
  output.write('MYQ1', 0, 4, 'ascii');
  output.writeUInt8(1, 4);
  output.writeUInt8(0, 5);
  output.writeUInt32BE(payload.length, 6);
  payload.copy(output, 10);
  output.writeUInt32BE(checksum(payload), 10 + payload.length);
  return output;
}

function decode(buffer) {
  if (buffer.length < 10) return undefined;
  const length = buffer.readUInt32BE(6);
  const frameLength = 14 + length;
  if (buffer.length < frameLength) return undefined;
  return { value: JSON.parse(buffer.subarray(10, 10 + length).toString('utf8')), remaining: buffer.subarray(frameLength) };
}

const socket = net.createConnection({ host, port });
let buffer = Buffer.alloc(0);
let stage = 'login';
let requestId = 1;

socket.on('connect', () => socket.write(frame({ type: 'LOGIN', requestId: String(requestId++), username, password })));
socket.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  const decoded = decode(buffer);
  if (!decoded) return;
  buffer = decoded.remaining;
  if (stage === 'login' && decoded.value.type === 'LOGIN_OK') {
    stage = 'query';
    socket.write(frame({ type: 'QUERY', requestId: String(requestId), token: decoded.value.token, database, sql }));
    return;
  }
  console.log(JSON.stringify(decoded.value, null, 2));
  socket.end();
});
socket.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
