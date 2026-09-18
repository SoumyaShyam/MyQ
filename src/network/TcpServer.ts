import net from 'node:net';
import { FrameCodec } from './FrameCodec';
import { AuthService } from '../auth/AuthService';
import { QueryService } from '../executor/QueryService';
import { MyQError, ErrorCode } from '../shared/errors';

interface LoginRequest { type: 'LOGIN'; requestId?: string; username: string; password: string; }
interface QueryRequest { type: 'QUERY'; requestId?: string; token: string; database: string; sql: string; }
interface PingRequest { type: 'PING'; requestId?: string; token?: string; }

type Request = LoginRequest | QueryRequest | PingRequest;

export class TcpServer {
  private readonly server = net.createServer((socket) => this.handle(socket));
  private readonly codec: FrameCodec;
  public constructor(private readonly host: string, private readonly port: number, maxFrameBytes: number, private readonly auth: AuthService, private readonly query: QueryService) { this.codec = new FrameCodec(maxFrameBytes); }
  public async start(): Promise<void> { await new Promise<void>((resolve, reject) => { const onError = (error: Error) => { this.server.off('listening', onListening); reject(error); }; const onListening = () => { this.server.off('error', onError); resolve(); }; this.server.once('error', onError); this.server.once('listening', onListening); this.server.listen(this.port, this.host); }); }
  public async stop(): Promise<void> { await new Promise<void>((resolve) => this.server.close(() => resolve())); }
  private handle(socket: net.Socket): void { let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0); socket.on('data', (chunk) => { buffer = Buffer.concat([buffer, chunk]); try { let decoded = this.codec.decode(buffer); while (decoded) { buffer = decoded.remaining; void this.dispatch(socket, decoded.value); decoded = this.codec.decode(buffer); } } catch (error) { this.send(socket, this.error(error)); socket.destroy(); } }); socket.on('error', () => undefined); }
  private async dispatch(socket: net.Socket, input: unknown): Promise<void> { try { const request = this.validateRequest(input); if (request.type === 'LOGIN') { const result = await this.auth.login(request.username, request.password); this.send(socket, { type: 'LOGIN_OK', requestId: request.requestId, token: result.token, expiresAt: result.principal.expiresAt }); return; } if (request.type === 'PING') { if (request.token) this.auth.verify(request.token); this.send(socket, { type: 'PONG', requestId: request.requestId, serverTime: new Date().toISOString() }); return; } const principal = this.auth.verify(request.token); const result = await this.query.execute(request.sql, request.database, principal); this.send(socket, { type: 'QUERY_OK', requestId: request.requestId, result }); } catch (error) { this.send(socket, this.error(error)); } }
  private validateRequest(input: unknown): Request { if (!input || typeof input !== 'object' || !('type' in input)) throw new MyQError(ErrorCode.PROTOCOL, 'Invalid request'); const request = input as Partial<Request>; if (request.type === 'LOGIN' && typeof request.username === 'string' && typeof request.password === 'string') return request as LoginRequest; if (request.type === 'QUERY' && typeof request.token === 'string' && typeof request.database === 'string' && typeof request.sql === 'string') return request as QueryRequest; if (request.type === 'PING') return request as PingRequest; throw new MyQError(ErrorCode.PROTOCOL, 'Invalid request payload'); }
  private send(socket: net.Socket, value: unknown): void { if (!socket.destroyed) socket.write(this.codec.encode(value)); }
  private error(error: unknown): object { const value = error instanceof MyQError ? error : new MyQError(ErrorCode.INTERNAL, 'Internal server error', false, error); return { type: 'ERROR', code: value.code, message: value.message, retryable: value.retryable }; }
}
